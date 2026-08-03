import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { REAL_REPO_ROOT, loadCompiledBridge } from '../run-resolver-v3-048-live-development.mjs';
import {
  parseRecoveryArgs,
  runInspect,
  runRecover,
  RecoveryCliError,
  classifyRecoveryError,
} from '../recover-resolver-v3-048-abandoned-lease.mjs';

/**
 * RESOLVER-V3-048-INCIDENT-002 -- the mandated crash tests, run against a REAL child process that is
 * killed abruptly (SIGKILL), not a catchable JavaScript exception. This is the only way to prove the
 * property the incident actually exposed: that durable evidence survives a process that never gets
 * to run another line, a `finally` block, or an exit handler.
 *
 * These tests never touch the real repository live root and never touch the real incident worktree
 * (`D:\Workspaces_VSCode\HealthApp-live-auth`). Every root is a fresh temp directory. No provider
 * call, no credential, no network. Run via
 * `node --test scripts/__tests__/resolver-v3-048-runtime-journal-crash.test.mjs`.
 */

const PLAN_HASH = 'crash-test-plan-hash';
const TREE_HASH = 'crash-test-tree-hash';
const APPROVAL = 'HUMAN-APPROVAL/incident-002/crash-test';

const tempDirs = [];
let bridge;
let compiled;

/** The launcher's own `tsc` build emits the whole reachable Protocol-v4 graph under one `outDir`,
 * so the child process can `require()` the real compiled journal/lease modules directly. The
 * compiled bridge deliberately does NOT re-export the journal WRITER (only the reader/reducer), so
 * this test reaches the writer the same way the trusted in-process producer does: through the module
 * itself, never through the launcher-facing surface. */
function compiledModulePath(relativeSourcePath) {
  return path.join(
    REAL_REPO_ROOT,
    'build',
    'resolver-v3-048-live-launcher',
    relativeSourcePath.replace(/\.ts$/, '.js'),
  );
}

before(() => {
  bridge = loadCompiledBridge(REAL_REPO_ROOT);
  const require_ = createRequire(import.meta.url);
  compiled = {
    journalPath: compiledModulePath(
      'src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4RuntimeJournal.ts',
    ),
    leasePath: compiledModulePath(
      'src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionLease.ts',
    ),
  };
  assert.ok(fs.existsSync(compiled.journalPath), 'compiled runtime-journal module must exist');
  assert.ok(fs.existsSync(compiled.leasePath), 'compiled execution-lease module must exist');
  compiled.lease = require_(compiled.leasePath);
});

after(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

function freshRepoRoot() {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-crash-'));
  tempDirs.push(dir);
  return dir;
}

/** Claims a real lease and drives it to `executing` -- exactly the state the real incident's v1/v2
 * evidence is in. */
function executingLease(repoRoot, authorizationId) {
  const root = path.resolve(repoRoot, bridge.PROTOCOL_V4_LIVE_ROOT);
  compiled.lease.claimProtocolV4ExecutionLease({
    artifactStoreRoot: root,
    authorizationId,
    authorizationKind: 'human_live',
    runKind: 'human_live',
    authorizationSchemaVersion: 'resolver-v3-048-development-authorization-v1',
    authorizationRecordHash: 'crash-test-authorization-record-hash',
    phase: 'development',
    planHash: PLAN_HASH,
    executionTreeHash: TREE_HASH,
    candidateScope: ['H0', 'H1', 'H2'],
    maxCalls: 324,
    maxInputTokens: 2654208,
    maxOutputTokens: 497664,
    maxCostUsd: 5.142528,
    maxConcurrentRequests: 1,
    pricingVersion: 'anthropic-messages-2025-10-01-v1',
    modelId: 'claude-haiku-4-5-20251001',
  });
  const lease = compiled.lease.markProtocolV4ExecutionLeaseExecuting(root, authorizationId);
  return { root, lease };
}

const CHILD_SOURCE = `
const journalModule = require(process.argv[2]);
const [, , , mode, repoRoot, root, authorizationId, planHash, treeHash] = process.argv;
const journal = journalModule.openProtocolV4RuntimeJournal({
  artifactStoreRoot: root,
  authorizationId,
  planHash,
  executionTreeHash: treeHash,
  repoRoot,
});
const scope = (n) => ({
  candidateId: 'H0',
  callId: 'development:H0:crash:' + n,
  dispatchId: 'development:H0:crash:' + n + '#1',
  modelId: 'claude-haiku-4-5-20251001',
  pricingVersion: 'anthropic-messages-2025-10-01-v1',
});
const reserved = {
  reservedInputTokensUpperBound: 8192,
  reservedOutputTokensUpperBound: 1536,
  reservedCostUsdUpperBound: 0.015872,
};

journal.appendExecutingStarted();

if (mode === 'after-intent' || mode === 'completed-then-open') {
  if (mode === 'completed-then-open') {
    journal.appendDispatchIntent({ ...scope(0), ...reserved });
    journal.appendDispatchCompleted({
      ...scope(0),
      usage: {
        usageStatus: 'reported',
        inputTokens: 111,
        outputTokens: 22,
        actualCostUsd: 0.000333,
        httpStatus: 200,
      },
    });
  }
  // The durable intent for the dispatch that will never resolve: written strictly BEFORE the
  // (simulated) provider request, exactly as the real counting transport does.
  journal.appendDispatchIntent({ ...scope(1), ...reserved });
}

// Abrupt, uncatchable termination -- no finally block, no exit handler, no flush.
process.kill(process.pid, 'SIGKILL');
// Unreachable; present only so a failure to die is loud rather than silent.
setTimeout(() => process.exit(0), 5000);
`;

function runChildAndKillIt(mode, repoRoot, root, authorizationId) {
  const childPath = path.join(repoRoot, 'crash-child.cjs');
  fs.writeFileSync(childPath, CHILD_SOURCE, 'utf-8');
  const result = spawnSync(
    process.execPath,
    [childPath, compiled.journalPath, mode, repoRoot, root, authorizationId, PLAN_HASH, TREE_HASH],
    { encoding: 'utf-8' },
  );
  // The child must genuinely have been killed, never have exited cleanly.
  assert.notEqual(result.status, 0, `child must not exit cleanly (status ${result.status})`);
  return result;
}

function classify(root, authorizationId, repoRoot) {
  return bridge.classifyProtocolV4DurableAccounting({
    artifactStoreRoot: root,
    authorizationId,
    repoRoot,
  });
}

describe('RESOLVER-V3-048-INCIDENT-002 -- abrupt child-process crash durability', () => {
  test('Crash 1: killed after executing_started, before any dispatch intent -- durable exact zero', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'crash:no-intent';
    const { root } = executingLease(repoRoot, authorizationId);

    runChildAndKillIt('no-intent', repoRoot, root, authorizationId);

    const accounting = classify(root, authorizationId, repoRoot);
    assert.equal(accounting.classification, 'EXACT_ZERO');
    assert.equal(accounting.executionStarted, true);
    assert.equal(accounting.dispatchIntents, 0);
    assert.equal(accounting.openDispatchIntents, 0);
    assert.equal(accounting.providerHttpRequestsLowerBound, 0);
    assert.equal(accounting.providerHttpRequestsUpperBound, 0);
    assert.equal(accounting.confirmedCostUsd, 0);
    // The lease itself is still stuck `executing` -- durability of the journal is independent of it.
    assert.equal(
      compiled.lease.readProtocolV4ExecutionLease(root, authorizationId).status,
      'executing',
    );
  });

  test('Crash 2: killed after a durable dispatch intent, before any response -- POSSIBLE_NONZERO, never exact zero', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'crash:open-intent';
    const { root } = executingLease(repoRoot, authorizationId);

    runChildAndKillIt('after-intent', repoRoot, root, authorizationId);

    const accounting = classify(root, authorizationId, repoRoot);
    assert.equal(accounting.classification, 'POSSIBLE_NONZERO');
    assert.notEqual(accounting.classification, 'EXACT_ZERO');
    assert.equal(accounting.dispatchIntents, 1);
    assert.equal(accounting.openDispatchIntents, 1);
    // An intent proves a request MAY have occurred -- never that one definitely did.
    assert.equal(accounting.providerHttpRequestsLowerBound, 0);
    assert.equal(accounting.providerHttpRequestsUpperBound, 1);
    // Reserved ceilings survive the crash and stay available.
    assert.equal(accounting.reservedInputTokensUpperBound, 8192);
    assert.equal(accounting.reservedOutputTokensUpperBound, 1536);
    assert.ok(Math.abs(accounting.reservedCostUsdUpperBound - 0.015872) < 1e-12);
  });

  test('Crash 3: one durably completed dispatch plus one open intent -- completed usage preserved, unresolved usage unknown', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'crash:completed-then-open';
    const { root } = executingLease(repoRoot, authorizationId);

    runChildAndKillIt('completed-then-open', repoRoot, root, authorizationId);

    const accounting = classify(root, authorizationId, repoRoot);
    assert.equal(accounting.classification, 'POSSIBLE_NONZERO');
    assert.equal(accounting.dispatchIntents, 2);
    assert.equal(accounting.openDispatchIntents, 1);
    // Durable lower bound: the completed dispatch definitely reached a real response.
    assert.equal(accounting.providerHttpRequestsLowerBound, 1);
    assert.equal(accounting.providerHttpRequestsUpperBound, 2);
    // Confirmed usage of the completed dispatch is preserved exactly.
    assert.equal(accounting.confirmedInputTokens, 111);
    assert.equal(accounting.confirmedOutputTokens, 22);
    assert.ok(Math.abs(accounting.confirmedCostUsd - 0.000333) < 1e-12);
    // Reserved upper bounds remain available for the unresolved dispatch.
    assert.ok(Math.abs(accounting.reservedCostUsdUpperBound - 0.031744) < 1e-12);
  });

  test('Crash 7: a legacy uninstrumented executing lease with no journal is POSSIBLE_NONZERO, never exact zero', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'crash:legacy-incident-shape';
    const { root } = executingLease(repoRoot, authorizationId);

    const accounting = classify(root, authorizationId, repoRoot);
    assert.equal(accounting.classification, 'POSSIBLE_NONZERO');
    assert.equal(accounting.journalPresent, false);
    assert.equal(accounting.executionStarted, false);
    assert.equal(accounting.providerHttpRequestsUpperBound, null);
  });
});

describe('RESOLVER-V3-048-INCIDENT-002 -- governed recovery CLI', () => {
  test('--inspect is read-only, reports the durable classification, and never infers liveness', async () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'recovery-cli:inspect';
    const { root, lease } = executingLease(repoRoot, authorizationId);
    runChildAndKillIt('after-intent', repoRoot, root, authorizationId);

    const before = fs.readdirSync(path.join(root, 'leases'), { recursive: true }).length;
    const result = await runInspect(
      { ...parseRecoveryArgs(['--inspect', '--authorization-id', authorizationId]) },
      { repoRootForTests: repoRoot, envForTests: {} },
    );
    assert.equal(result.lease.status, 'executing');
    assert.equal(result.lease.version, lease.version);
    assert.equal(result.durableAccounting.classification, 'POSSIBLE_NONZERO');
    assert.equal(result.artifactRootKind, 'protocol_v4_live');
    assert.equal(result.recoverable, true);
    assert.ok(result.lastRecordedLiveness !== null);
    assert.equal(typeof result.lastRecordedLiveness.pid, 'number');
    assert.match(result.note, /never inferred/i);
    // Read-only: nothing under the lease store changed.
    assert.equal(fs.readdirSync(path.join(root, 'leases'), { recursive: true }).length, before);
    assert.equal(
      compiled.lease.readProtocolV4ExecutionLease(root, authorizationId).status,
      'executing',
    );
  });

  test('--recover appends exactly one abandoned version, records reason/approval, and a second recovery fails closed', async () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'recovery-cli:recover';
    const { root, lease } = executingLease(repoRoot, authorizationId);
    runChildAndKillIt('after-intent', repoRoot, root, authorizationId);

    const args = parseRecoveryArgs([
      '--recover',
      '--authorization-id',
      authorizationId,
      '--expected-lease-version',
      String(lease.version),
      '--expected-lease-status',
      'executing',
      '--expected-lease-hash',
      lease.leaseHash,
      '--reason-code',
      'operator_interrupted_process',
      '--approval-reference',
      APPROVAL,
      '--confirm-executing-process-not-running',
      '--confirmation-token',
      bridge.PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN,
    ]);
    assert.deepEqual(args.errors, []);

    const result = await runRecover(args, { repoRootForTests: repoRoot, envForTests: {} });
    assert.equal(result.recoveredLeaseStatus, 'abandoned');
    assert.equal(result.preRecoveryLeaseVersion, lease.version);
    assert.equal(result.recoveredLeaseVersion, lease.version + 1);
    assert.equal(result.reasonCode, 'operator_interrupted_process');
    assert.equal(result.humanRecoveryApprovalReference, APPROVAL);
    assert.equal(result.usageAccounting, 'POSSIBLE_NONZERO');
    assert.equal(result.authorizationReusable, false);
    assert.equal(result.artifactRootKind, 'protocol_v4_live');
    // Secret-free: the summary never embeds an absolute path.
    assert.equal(JSON.stringify(result).includes(repoRoot), false);

    assert.equal(
      compiled.lease.readProtocolV4ExecutionLease(root, authorizationId).status,
      'abandoned',
    );

    // Fails closed on a second invocation.
    const second = await runRecover(args, {
      repoRootForTests: repoRoot,
      envForTests: {},
    }).catch((e) => e);
    assert.ok(second instanceof Error);
    assert.match(second.message, /PROTOCOL_V4_LEASE_RECOVERY_TERMINAL_VERSION_ALREADY_EXISTS/);
  });

  test('--recover refuses to run when an API key is present in the environment', async () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'recovery-cli:credential';
    const { root, lease } = executingLease(repoRoot, authorizationId);
    const args = parseRecoveryArgs([
      '--recover',
      '--authorization-id',
      authorizationId,
      '--expected-lease-version',
      String(lease.version),
      '--expected-lease-status',
      'executing',
      '--expected-lease-hash',
      lease.leaseHash,
      '--reason-code',
      'operator_interrupted_process',
      '--approval-reference',
      APPROVAL,
      '--confirm-executing-process-not-running',
      '--confirmation-token',
      bridge.PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN,
    ]);
    const error = await runRecover(args, {
      repoRootForTests: repoRoot,
      envForTests: { ANTHROPIC_API_KEY: 'test-key-not-real' },
    }).catch((e) => e);
    assert.ok(error instanceof RecoveryCliError);
    assert.equal(classifyRecoveryError(error).code, 'RECOVERY_CREDENTIAL_PRESENT');
    assert.equal(
      compiled.lease.readProtocolV4ExecutionLease(root, authorizationId).status,
      'executing',
    );
  });

  test('--recover requires the explicit liveness confirmation flag', async () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'recovery-cli:no-liveness-confirmation';
    const { lease } = executingLease(repoRoot, authorizationId);
    const args = parseRecoveryArgs([
      '--recover',
      '--authorization-id',
      authorizationId,
      '--expected-lease-version',
      String(lease.version),
      '--expected-lease-status',
      'executing',
      '--expected-lease-hash',
      lease.leaseHash,
      '--reason-code',
      'operator_interrupted_process',
      '--approval-reference',
      APPROVAL,
      '--confirmation-token',
      bridge.PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN,
    ]);
    const error = await runRecover(args, {
      repoRootForTests: repoRoot,
      envForTests: {},
    }).catch((e) => e);
    assert.ok(error instanceof RecoveryCliError);
    assert.equal(classifyRecoveryError(error).code, 'RECOVERY_MISSING_LIVENESS_CONFIRMATION');
  });

  test('argument parsing requires exactly one mode and rejects unknown flags', () => {
    assert.ok(parseRecoveryArgs([]).errors.includes('RECOVERY_MODE_REQUIRED'));
    assert.ok(
      parseRecoveryArgs(['--inspect', '--recover']).errors.includes('RECOVERY_MODE_REQUIRED'),
    );
    assert.ok(
      parseRecoveryArgs(['--inspect', '--wat']).errors.includes('RECOVERY_UNKNOWN_ARGUMENT'),
    );
    assert.ok(
      parseRecoveryArgs(['--inspect', '--authorization-id']).errors.includes(
        'RECOVERY_MISSING_VALUE',
      ),
    );
  });
});
