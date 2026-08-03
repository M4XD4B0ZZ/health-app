#!/usr/bin/env node
/**
 * RESOLVER-V3-048-INCIDENT-002 Remediation C -- the dedicated, governed recovery executable for a
 * Protocol-v4 Development Execution Lease that an abruptly terminated process left stuck in
 * `executing`.
 *
 * This is deliberately a SEPARATE executable rather than a new mode on
 * `scripts/run-resolver-v3-048-live-development.mjs`: the live launcher's surface is the one that
 * can spend money, and broadening it with a lease-mutating mode would mean every future change to
 * that file has to re-argue why recovery cannot reach dispatch. Here the argument is structural --
 * this file imports no transport, no interpreter, no Development/Holdout runner and no live entry
 * point, so there is no code path from it to a provider request at all. It additionally refuses to
 * run when an `ANTHROPIC_API_KEY` is present in the process environment (a recovery operator should
 * never be running with a live credential loaded), and it never reads that variable's value.
 *
 * It reuses the live launcher's already-reviewed local-only TypeScript build (`loadCompiledBridge`)
 * so there is exactly one compiled bridge in this repository -- never a second build path, never
 * `tsx`/`ts-node`/`npx`/an automatic install.
 *
 * Usage:
 *   node scripts/recover-resolver-v3-048-abandoned-lease.mjs --inspect \
 *     --authorization-id "<ID>"
 *
 *   node scripts/recover-resolver-v3-048-abandoned-lease.mjs --recover \
 *     --authorization-id "<ID>" \
 *     --expected-lease-version <N> \
 *     --expected-lease-status executing \
 *     --expected-lease-hash "<HASH>" \
 *     --reason-code <CODE> \
 *     --approval-reference "<HUMAN_APPROVAL_REFERENCE>" \
 *     --confirm-executing-process-not-running \
 *     --confirmation-token "RECOVER-ABANDONED-EXECUTION-LEASE"
 *
 * `--inspect` is strictly read-only: it prints the current lease state, the durable runtime-journal
 * accounting classification, and the last recorded liveness of the interrupted run, so a human can
 * decide -- this command never infers that the process holding the lease is dead. `--recover`
 * requires every expected-state field, an enumerated reason code, a non-empty human approval
 * reference, an explicit liveness confirmation flag, and the exact confirmation token; it appends
 * exactly one `abandoned` lease version, preserves every earlier version byte-for-byte, writes a
 * durable, separately hashed recovery record, and NEVER makes the authorization reusable. A repeat
 * invocation fails closed.
 *
 * Secret-free output: every printed error is a constant code from `KNOWN_RECOVERY_ERROR_CODES` (or a
 * Protocol-v4 domain code truncated to its constant prefix); no path, credential, host detail, or
 * foreign error message is ever printed.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REAL_REPO_ROOT,
  loadCompiledBridge,
  isWorkingTreeClean,
} from './run-resolver-v3-048-live-development.mjs';

export const KNOWN_RECOVERY_ERROR_CODES = new Set([
  'RECOVERY_MODE_REQUIRED',
  'RECOVERY_UNKNOWN_ARGUMENT',
  'RECOVERY_DUPLICATE_ARGUMENT',
  'RECOVERY_MISSING_VALUE',
  'RECOVERY_MISSING_AUTHORIZATION_ID',
  'RECOVERY_MISSING_EXPECTED_LEASE_VERSION',
  'RECOVERY_INVALID_EXPECTED_LEASE_VERSION',
  'RECOVERY_MISSING_EXPECTED_LEASE_STATUS',
  'RECOVERY_MISSING_EXPECTED_LEASE_HASH',
  'RECOVERY_MISSING_REASON_CODE',
  'RECOVERY_MISSING_APPROVAL_REFERENCE',
  'RECOVERY_MISSING_CONFIRMATION_TOKEN',
  'RECOVERY_MISSING_LIVENESS_CONFIRMATION',
  'RECOVERY_CREDENTIAL_PRESENT',
  'RECOVERY_CWD_MUST_BE_REPO_ROOT',
  'RECOVERY_WORKING_TREE_DIRTY',
  'RECOVERY_LEASE_NOT_FOUND',
]);

export class RecoveryCliError extends Error {
  /** `code` MUST be one of `KNOWN_RECOVERY_ERROR_CODES`; `internalDetail` is never printed. */
  constructor(code, internalDetail) {
    super(code);
    this.name = 'RecoveryCliError';
    this.internalDetail = internalDetail;
  }
}

const VALUE_FLAGS = new Set([
  '--authorization-id',
  '--expected-lease-version',
  '--expected-lease-status',
  '--expected-lease-hash',
  '--reason-code',
  '--approval-reference',
  '--confirmation-token',
]);
const BOOLEAN_FLAGS = new Set([
  '--inspect',
  '--recover',
  '--confirm-executing-process-not-running',
]);

export function parseRecoveryArgs(argv) {
  const args = {
    mode: null,
    authorizationId: null,
    expectedLeaseVersion: null,
    expectedLeaseStatus: null,
    expectedLeaseHash: null,
    reasonCode: null,
    approvalReference: null,
    confirmationToken: null,
    confirmedExecutingProcessNotRunning: false,
    help: false,
    errors: [],
  };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (BOOLEAN_FLAGS.has(token)) {
      if (seen.has(token)) args.errors.push('RECOVERY_DUPLICATE_ARGUMENT');
      seen.add(token);
      if (token === '--inspect') args.mode = args.mode === 'recover' ? 'conflict' : 'inspect';
      else if (token === '--recover') args.mode = args.mode === 'inspect' ? 'conflict' : 'recover';
      else args.confirmedExecutingProcessNotRunning = true;
      continue;
    }
    if (VALUE_FLAGS.has(token)) {
      if (seen.has(token)) args.errors.push('RECOVERY_DUPLICATE_ARGUMENT');
      seen.add(token);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        args.errors.push('RECOVERY_MISSING_VALUE');
        continue;
      }
      i += 1;
      if (token === '--authorization-id') args.authorizationId = value;
      else if (token === '--expected-lease-version') args.expectedLeaseVersion = value;
      else if (token === '--expected-lease-status') args.expectedLeaseStatus = value;
      else if (token === '--expected-lease-hash') args.expectedLeaseHash = value;
      else if (token === '--reason-code') args.reasonCode = value;
      else if (token === '--approval-reference') args.approvalReference = value;
      else args.confirmationToken = value;
      continue;
    }
    args.errors.push('RECOVERY_UNKNOWN_ARGUMENT');
  }
  if (!args.help && (args.mode === null || args.mode === 'conflict')) {
    args.errors.push('RECOVERY_MODE_REQUIRED');
  }
  return args;
}

/** Presence-only. The value is never read into anything printed, logged, or persisted. */
function assertNoCredentialPresent(env) {
  if (env.ANTHROPIC_API_KEY) throw new RecoveryCliError('RECOVERY_CREDENTIAL_PRESENT');
}

function assertCwdIsRepoRoot() {
  if (path.resolve(process.cwd()) !== path.resolve(REAL_REPO_ROOT)) {
    throw new RecoveryCliError('RECOVERY_CWD_MUST_BE_REPO_ROOT');
  }
}

/** The canonical live root is DERIVED here, never accepted from the operator -- there is no flag
 * that can point this command at a different root. `repoRootForTests` only changes where that
 * canonical root is anchored, never which relative root is used. */
function canonicalLiveRoot(bridge, repoRootForTests) {
  return path.resolve(repoRootForTests ?? process.cwd(), bridge.PROTOCOL_V4_LIVE_ROOT);
}

/** Read-only. Never mutates a lease, never writes a file, never touches the network. */
export async function runInspect(parsedArgs, { repoRootForTests, envForTests } = {}) {
  assertNoCredentialPresent(envForTests ?? process.env);
  if (!parsedArgs.authorizationId) throw new RecoveryCliError('RECOVERY_MISSING_AUTHORIZATION_ID');
  if (!repoRootForTests) assertCwdIsRepoRoot();
  const bridge = loadCompiledBridge(REAL_REPO_ROOT);
  const artifactStoreRoot = canonicalLiveRoot(bridge, repoRootForTests);

  const lease = bridge.readProtocolV4ExecutionLease(artifactStoreRoot, parsedArgs.authorizationId);
  if (!lease) throw new RecoveryCliError('RECOVERY_LEASE_NOT_FOUND');
  const durableAccounting = bridge.classifyProtocolV4DurableAccounting({
    artifactStoreRoot,
    authorizationId: parsedArgs.authorizationId,
    repoRoot: repoRootForTests,
  });
  const events = bridge.readProtocolV4RuntimeJournal(
    artifactStoreRoot,
    parsedArgs.authorizationId,
    repoRootForTests,
  );
  const recoveryRecords = bridge.readProtocolV4LeaseRecoveryRecords(
    artifactStoreRoot,
    parsedArgs.authorizationId,
    repoRootForTests,
  );

  return {
    authorizationId: parsedArgs.authorizationId,
    // A stable semantic identity, never the absolute filesystem path.
    artifactRootKind: 'protocol_v4_live',
    lease: {
      leaseId: lease.leaseId,
      version: lease.version,
      status: lease.status,
      leaseHash: lease.leaseHash,
      phase: lease.phase,
      runKind: lease.runKind,
    },
    durableAccounting,
    journalEventCount: events.length,
    /** The interrupted run's own last durable liveness record. Presented for a HUMAN to evaluate --
     * this command never concludes from it that the process is or is not running. */
    lastRecordedLiveness: events.length > 0 ? events[events.length - 1].liveness : null,
    priorRecoveryRecordCount: recoveryRecords.length,
    recoverable:
      lease.status === 'executing' && durableAccounting !== null && recoveryRecords.length === 0,
    note:
      'Liveness is never inferred. Confirm independently that the recorded process is not running ' +
      'before invoking --recover.',
  };
}

export async function runRecover(parsedArgs, { repoRootForTests, envForTests } = {}) {
  const env = envForTests ?? process.env;
  assertNoCredentialPresent(env);
  if (!parsedArgs.authorizationId) throw new RecoveryCliError('RECOVERY_MISSING_AUTHORIZATION_ID');
  if (parsedArgs.expectedLeaseVersion === null)
    throw new RecoveryCliError('RECOVERY_MISSING_EXPECTED_LEASE_VERSION');
  if (!/^\d+$/.test(parsedArgs.expectedLeaseVersion))
    throw new RecoveryCliError('RECOVERY_INVALID_EXPECTED_LEASE_VERSION');
  if (!parsedArgs.expectedLeaseStatus)
    throw new RecoveryCliError('RECOVERY_MISSING_EXPECTED_LEASE_STATUS');
  if (!parsedArgs.expectedLeaseHash)
    throw new RecoveryCliError('RECOVERY_MISSING_EXPECTED_LEASE_HASH');
  if (!parsedArgs.reasonCode) throw new RecoveryCliError('RECOVERY_MISSING_REASON_CODE');
  if (!parsedArgs.approvalReference || parsedArgs.approvalReference.trim().length === 0)
    throw new RecoveryCliError('RECOVERY_MISSING_APPROVAL_REFERENCE');
  if (!parsedArgs.confirmationToken)
    throw new RecoveryCliError('RECOVERY_MISSING_CONFIRMATION_TOKEN');
  if (!parsedArgs.confirmedExecutingProcessNotRunning)
    throw new RecoveryCliError('RECOVERY_MISSING_LIVENESS_CONFIRMATION');
  if (!repoRootForTests) {
    assertCwdIsRepoRoot();
    // A recovery run mutates durable lease state -- require the same clean-tree discipline the live
    // launcher requires, so the recorded repository state is unambiguous.
    if (!isWorkingTreeClean(REAL_REPO_ROOT))
      throw new RecoveryCliError('RECOVERY_WORKING_TREE_DIRTY');
  }

  const bridge = loadCompiledBridge(REAL_REPO_ROOT);
  const artifactStoreRoot = canonicalLiveRoot(bridge, repoRootForTests);

  // Every remaining precondition (canonical root, authorization-not-consumed, lease still
  // `executing` at exactly this version+hash, no terminal version anywhere in the history, exact
  // confirmation token, enumerated reason code, non-empty approval reference, explicit liveness
  // confirmation) is enforced by the real, unit-tested domain function -- never re-implemented here.
  const result = bridge.recoverProtocolV4AbandonedExecutionLeaseGoverned({
    artifactStoreRoot,
    authorizationId: parsedArgs.authorizationId,
    expectedLeaseVersion: Number(parsedArgs.expectedLeaseVersion),
    expectedLeaseStatus: parsedArgs.expectedLeaseStatus,
    expectedLeaseHash: parsedArgs.expectedLeaseHash,
    reasonCode: parsedArgs.reasonCode,
    humanRecoveryApprovalReference: parsedArgs.approvalReference,
    confirmationToken: parsedArgs.confirmationToken,
    confirmedExecutingProcessNotRunning: true,
    env: {},
    repoRoot: repoRootForTests,
  });

  return {
    authorizationId: result.authorizationId,
    artifactRootKind: 'protocol_v4_live',
    preRecoveryLeaseVersion: result.preRecoveryLeaseVersion,
    preRecoveryLeaseHash: result.preRecoveryLeaseHash,
    recoveredLeaseVersion: result.recoveredLeaseVersion,
    recoveredLeaseStatus: result.recoveredLeaseStatus,
    preservedLeaseVersions: result.preservedLeaseVersions,
    reasonCode: result.reasonCode,
    humanRecoveryApprovalReference: result.humanRecoveryApprovalReference,
    recoveredAtIso: result.recoveredAtIso,
    recoveryRecordHash: result.recoveryRecordHash,
    usageAccounting: result.durableAccounting.classification,
    durableAccounting: result.durableAccounting,
    authorizationReusable: false,
    note:
      'The authorization is permanently non-reusable. No provider call was made and no credential ' +
      'was read by this command.',
  };
}

const CODE_PREFIX_PATTERN = /^[A-Z][A-Z0-9_]*/;

/** Secret-free classification: a `RecoveryCliError` surfaces its enumerated code; any other error
 * surfaces only the constant-code prefix of its message (never a path, host, or free-text detail). */
export function classifyRecoveryError(error) {
  if (error instanceof RecoveryCliError) {
    return {
      class: 'RecoveryCliError',
      code: KNOWN_RECOVERY_ERROR_CODES.has(error.message)
        ? error.message
        : 'RECOVERY_UNRECOGNIZED_CODE',
    };
  }
  const name = typeof error?.name === 'string' ? error.name : 'Error';
  const message = typeof error?.message === 'string' ? error.message : '';
  const match = CODE_PREFIX_PATTERN.exec(message);
  return {
    class: /^[A-Za-z0-9]+$/.test(name) ? name : 'Error',
    code: match ? match[0] : 'RECOVERY_UNCLASSIFIED_ERROR',
  };
}

function printHelp() {
  console.log(`RESOLVER-V3-048-INCIDENT-002 governed abandoned-lease recovery

Usage:
  node scripts/recover-resolver-v3-048-abandoned-lease.mjs --inspect \\
    --authorization-id <ID>

  node scripts/recover-resolver-v3-048-abandoned-lease.mjs --recover \\
    --authorization-id <ID> \\
    --expected-lease-version <N> \\
    --expected-lease-status executing \\
    --expected-lease-hash <HASH> \\
    --reason-code <operator_interrupted_process|host_crash|unrecoverable_environment_failure|superseded_by_new_authorization> \\
    --approval-reference <HUMAN_APPROVAL_REFERENCE> \\
    --confirm-executing-process-not-running \\
    --confirmation-token RECOVER-ABANDONED-EXECUTION-LEASE

This command performs NO provider or network operation, never reads ANTHROPIC_API_KEY, and refuses
to run at all if one is present in the environment. The canonical live artifact root is derived, not
accepted as an argument. Liveness is never inferred: --recover requires an explicit human
confirmation that the recorded process is not running. Recovery appends exactly one 'abandoned'
lease version, preserves every earlier version byte-for-byte, writes a durable separately-hashed
recovery record, and never makes the authorization reusable. A repeat invocation fails closed.
`);
}

async function main(argv) {
  const args = parseRecoveryArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.errors.length > 0) {
    for (const code of args.errors) {
      console.error(KNOWN_RECOVERY_ERROR_CODES.has(code) ? code : 'RECOVERY_UNRECOGNIZED_CODE');
    }
    printHelp();
    return 1;
  }
  try {
    const result = args.mode === 'inspect' ? await runInspect(args) : await runRecover(args);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (err) {
    const classified = classifyRecoveryError(err);
    console.error(`${classified.class}: ${classified.code}`);
    return 1;
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      const classified = classifyRecoveryError(err);
      console.error(`${classified.class}: ${classified.code}`);
      process.exit(1);
    },
  );
}
