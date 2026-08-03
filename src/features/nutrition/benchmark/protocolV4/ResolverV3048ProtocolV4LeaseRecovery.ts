import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { hashProtocolV4 } from './ResolverV3048ProtocolV4';
import {
  assertProtocolV4LiveRootMatchesStore,
  isProtocolV4LiveAuthorizationConsumedAtomically,
} from './ResolverV3048ProtocolV4ArtifactStore';
import {
  listProtocolV4ExecutionLeaseVersions,
  readProtocolV4ExecutionLease,
  readProtocolV4ExecutionLeaseVersion,
  recoverProtocolV4AbandonedExecutionLease,
} from './ResolverV3048ProtocolV4ExecutionLease';
import {
  classifyProtocolV4DurableAccounting,
  openProtocolV4RuntimeJournal,
  protocolV4RuntimeJournalDirectory,
  readProtocolV4RuntimeJournal,
  type ProtocolV4DurableAccounting,
  type ProtocolV4DurableAccountingClassification,
  type ProtocolV4RuntimeJournalLiveness,
} from './ResolverV3048ProtocolV4RuntimeJournal';
import { deriveProtocolV4AuthorizationStorageKey } from './ResolverV3048ProtocolV4StorageKey';

/**
 * RESOLVER-V3-048-INCIDENT-002 Remediation C + D -- the ONLY governed, operator-invocable path to
 * `recoverProtocolV4AbandonedExecutionLease`.
 *
 * Defect this module closes: `recoverProtocolV4AbandonedExecutionLease` existed as an internal
 * two-argument primitive (`root`, `authorizationId`) with no operator-facing entry point, no
 * expected-state preconditions, no reason/approval evidence, and no confirmation step -- so an
 * `executing` lease left behind by an abruptly terminated run had no governed way forward at all,
 * while the primitive itself, once exposed, would have been trivially easy to fire at the wrong
 * authorization.
 *
 * This module deliberately does NOT broaden the normal live-execute surface. It is a separate
 * module, driven by a separate executable (`scripts/recover-resolver-v3-048-abandoned-lease.mjs`),
 * and it performs no provider or network operation of any kind: it imports no transport, no
 * interpreter, and no Development/Holdout runner, and it fails closed if an `ANTHROPIC_API_KEY` is
 * present in the environment it is handed at all (a recovery operator should never be running with a
 * live credential loaded).
 *
 * Remediation D (liveness): this path NEVER infers that the process which held the lease is dead. It
 * surfaces the last durable liveness record from the runtime journal (process ID, host identity,
 * process start time, event time) for a human to check, and then requires that human to state
 * explicitly, as a separate mandatory input, that the executing process is not running. Ambiguous
 * liveness therefore stays fail-closed by construction -- there is no code path that resolves it
 * automatically.
 *
 * Recovering a lease never makes its authorization reusable: `claimProtocolV4ExecutionLease` always
 * collides on the same exclusive-create `v1.json` regardless of lifecycle status, so an abandoned
 * authorization stays permanently unusable exactly like a terminal one.
 */

export class ProtocolV4LeaseRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4LeaseRecoveryError';
  }
}

export const PROTOCOL_V4_LEASE_RECOVERY_RECORD_SCHEMA_VERSION =
  'resolver-v3-048-lease-recovery-record-v1';

/** The exact, case-sensitive token an operator must submit. Deliberately not derivable from the
 * authorization ID or any other input the operator already has to type: it exists purely to make an
 * accidental/scripted invocation impossible. */
export const PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN = 'RECOVER-ABANDONED-EXECUTION-LEASE';

/** Enumerated, closed vocabulary -- a free-text reason is never accepted (it would end up in a
 * durable record and could carry a path, a host detail, or a credential fragment). */
export const PROTOCOL_V4_LEASE_RECOVERY_REASON_CODES = [
  'operator_interrupted_process',
  'host_crash',
  'unrecoverable_environment_failure',
  'superseded_by_new_authorization',
] as const;

export type ProtocolV4LeaseRecoveryReasonCode =
  (typeof PROTOCOL_V4_LEASE_RECOVERY_REASON_CODES)[number];

export interface ProtocolV4LeaseRecoveryRecord {
  recoveryRecordSchemaVersion: typeof PROTOCOL_V4_LEASE_RECOVERY_RECORD_SCHEMA_VERSION;
  sequence: number;
  authorizationId: string;
  leaseId: string;
  preRecoveryLeaseVersion: number;
  preRecoveryLeaseStatus: 'executing';
  preRecoveryLeaseHash: string;
  recoveredLeaseVersion: number;
  recoveredLeaseStatus: 'abandoned';
  reasonCode: ProtocolV4LeaseRecoveryReasonCode;
  humanRecoveryApprovalReference: string;
  confirmedExecutingProcessNotRunning: true;
  recoveredAtIso: string;
  durableAccountingClassification: ProtocolV4DurableAccountingClassification;
  durableAccounting: ProtocolV4DurableAccounting;
  /** Last durable liveness record of the INTERRUPTED run (from its runtime journal), or `null` for a
   * legacy/uninstrumented lease that never wrote one. Never used to infer liveness automatically. */
  recordedLiveness: ProtocolV4RuntimeJournalLiveness | null;
  /** Liveness of the RECOVERY operator's own process -- a separate dimension, never conflated with
   * the interrupted run's. */
  recoveryProcessLiveness: ProtocolV4RuntimeJournalLiveness;
  authorizationReusable: false;
  recoveryRecordHash: string;
}

export interface ProtocolV4LeaseRecoveryInput {
  /** Absolute canonical live root, validated against `PROTOCOL_V4_LIVE_ROOT` -- a dry-run or
   * arbitrary root is rejected by the same validator the live artifact store itself uses. */
  artifactStoreRoot: string;
  authorizationId: string;
  expectedLeaseVersion: number;
  expectedLeaseStatus: 'executing';
  expectedLeaseHash: string;
  reasonCode: ProtocolV4LeaseRecoveryReasonCode;
  humanRecoveryApprovalReference: string;
  confirmationToken: string;
  /** Remediation D: an explicit human statement, never an inference. */
  confirmedExecutingProcessNotRunning: boolean;
  /** Defaults to `process.env`. Recovery fails closed if this carries an `ANTHROPIC_API_KEY`. The
   * value is never read into anything printed, logged, or persisted -- presence only. */
  env?: Partial<Record<string, string | undefined>>;
  /** Test-only anchor for where the canonical live root resolves FROM; never changes WHICH relative
   * root is used. */
  repoRoot?: string;
}

export interface ProtocolV4LeaseRecoveryResult {
  authorizationId: string;
  leaseId: string;
  preRecoveryLeaseVersion: number;
  preRecoveryLeaseHash: string;
  recoveredLeaseVersion: number;
  recoveredLeaseStatus: 'abandoned';
  reasonCode: ProtocolV4LeaseRecoveryReasonCode;
  humanRecoveryApprovalReference: string;
  recoveredAtIso: string;
  recoveryRecordHash: string;
  durableAccounting: ProtocolV4DurableAccounting;
  recordedLiveness: ProtocolV4RuntimeJournalLiveness | null;
  preservedLeaseVersions: readonly number[];
  authorizationReusable: false;
}

// ---------------------------------------------------------------------------------------------
// Durable, separately hashed, append-only recovery record store.
// ---------------------------------------------------------------------------------------------

function recoveryDirectory(root: string, authorizationId: string): string {
  return path.join(
    path.resolve(root),
    'lease-recovery',
    deriveProtocolV4AuthorizationStorageKey(authorizationId),
  );
}

function listRecoverySequences(root: string, authorizationId: string): number[] {
  const dir = recoveryDirectory(root, authorizationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((entry) => /^r(\d+)\.json$/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function hashRecordBody(body: Omit<ProtocolV4LeaseRecoveryRecord, 'recoveryRecordHash'>): string {
  return hashProtocolV4(body);
}

function writeRecoveryRecordExclusive(
  root: string,
  authorizationId: string,
  record: ProtocolV4LeaseRecoveryRecord,
): void {
  const finalPath = path.join(recoveryDirectory(root, authorizationId), `r${record.sequence}.json`);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempPath = `${finalPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const fd = fs.openSync(tempPath, 'wx');
  try {
    fs.writeSync(fd, JSON.stringify(record));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.linkSync(tempPath, finalPath);
  } catch (e) {
    fs.unlinkSync(tempPath);
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ProtocolV4LeaseRecoveryError(
        `PROTOCOL_V4_LEASE_RECOVERY_RECORD_ALREADY_EXISTS:${authorizationId}:r${record.sequence}`,
      );
    throw e;
  }
  fs.unlinkSync(tempPath);
}

/** Reads every durable recovery record for an authorization ID, ascending, hash-revalidating each. */
export function readProtocolV4LeaseRecoveryRecords(
  root: string,
  authorizationId: string,
  repoRoot?: string,
): readonly ProtocolV4LeaseRecoveryRecord[] {
  const resolvedRoot = assertProtocolV4LiveRootMatchesStore(root, repoRoot);
  return listRecoverySequences(resolvedRoot, authorizationId).map((sequence) => {
    const filePath = path.join(
      recoveryDirectory(resolvedRoot, authorizationId),
      `r${sequence}.json`,
    );
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProtocolV4LeaseRecoveryRecord;
    const { recoveryRecordHash, ...body } = parsed;
    if (hashRecordBody(body) !== recoveryRecordHash)
      throw new ProtocolV4LeaseRecoveryError(
        `PROTOCOL_V4_LEASE_RECOVERY_RECORD_HASH_MISMATCH:${authorizationId}:r${sequence}`,
      );
    return parsed;
  });
}

// ---------------------------------------------------------------------------------------------
// The governed recovery action itself.
// ---------------------------------------------------------------------------------------------

function currentProcessLiveness(): ProtocolV4RuntimeJournalLiveness {
  const nowMs = Date.now();
  return {
    pid: process.pid,
    hostId: os.hostname(),
    processStartedAtIso: new Date(nowMs - Math.round(process.uptime() * 1000)).toISOString(),
    recordedAtIso: new Date(nowMs).toISOString(),
  };
}

/** Performs every precondition check below, in this exact order, before ANY write happens:
 *
 *  1. no `ANTHROPIC_API_KEY` in the supplied environment;
 *  2. exact confirmation token;
 *  3. enumerated reason code;
 *  4. non-empty human recovery approval reference;
 *  5. explicit human liveness confirmation (never inferred -- Remediation D);
 *  6. the root is the canonical live root;
 *  7. the authorization has NOT been consumed;
 *  8. the current persisted lease exists, is `executing`, and matches the expected version AND hash;
 *  9. no terminal (`terminal_success`/`terminal_failure`/`abandoned`) version already exists.
 *
 * Only then does it write the durable recovery record, append exactly one `abandoned` lease version,
 * and finally prove every pre-existing lease version survived byte-for-byte. A repeat invocation
 * fails at step 8 (the lease is no longer `executing`) before writing anything at all.
 */
export function recoverProtocolV4AbandonedExecutionLeaseGoverned(
  input: ProtocolV4LeaseRecoveryInput,
): ProtocolV4LeaseRecoveryResult {
  const env = input.env ?? process.env;
  // 1. Presence-only. The value is never read into any variable that is printed, logged, or stored.
  if (env.ANTHROPIC_API_KEY) {
    throw new ProtocolV4LeaseRecoveryError('PROTOCOL_V4_LEASE_RECOVERY_CREDENTIAL_PRESENT');
  }
  // 2.
  if (input.confirmationToken !== PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN) {
    throw new ProtocolV4LeaseRecoveryError(
      'PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN_MISMATCH',
    );
  }
  // 3.
  if (!(PROTOCOL_V4_LEASE_RECOVERY_REASON_CODES as readonly string[]).includes(input.reasonCode)) {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_UNKNOWN_REASON_CODE:${input.reasonCode}`,
    );
  }
  // 4.
  if (
    typeof input.humanRecoveryApprovalReference !== 'string' ||
    input.humanRecoveryApprovalReference.trim().length === 0
  ) {
    throw new ProtocolV4LeaseRecoveryError(
      'PROTOCOL_V4_LEASE_RECOVERY_APPROVAL_REFERENCE_REQUIRED',
    );
  }
  // 5. Remediation D -- explicit, never inferred.
  if (input.confirmedExecutingProcessNotRunning !== true) {
    throw new ProtocolV4LeaseRecoveryError(
      'PROTOCOL_V4_LEASE_RECOVERY_LIVENESS_CONFIRMATION_REQUIRED',
    );
  }
  if (input.expectedLeaseStatus !== 'executing') {
    throw new ProtocolV4LeaseRecoveryError(
      'PROTOCOL_V4_LEASE_RECOVERY_EXPECTED_STATUS_MUST_BE_EXECUTING',
    );
  }
  // 6.
  const root = assertProtocolV4LiveRootMatchesStore(input.artifactStoreRoot, input.repoRoot);

  // 7.
  if (
    isProtocolV4LiveAuthorizationConsumedAtomically(root, input.authorizationId, input.repoRoot)
  ) {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_AUTHORIZATION_ALREADY_CONSUMED:${input.authorizationId}`,
    );
  }

  // 8.
  const current = readProtocolV4ExecutionLease(root, input.authorizationId);
  if (!current) {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_LEASE_NOT_FOUND:${input.authorizationId}`,
    );
  }
  // 9. No terminal version ANYWHERE in the history -- checked before the "current is executing"
  // check below, so a lease that already reached `terminal_success`/`terminal_failure`/`abandoned`
  // is refused with the specific, actionable terminal-version code rather than the generic
  // not-executing one. This scan reads every persisted version, not merely the current one, so it
  // also fails closed on an out-of-band history (a terminal version sitting below a later
  // `executing` one) that the normal transition table could never produce.
  const priorVersions = listProtocolV4ExecutionLeaseVersions(root, input.authorizationId);
  const priorBytes = new Map<number, string>();
  for (const version of priorVersions) {
    const lease = readProtocolV4ExecutionLeaseVersion(root, input.authorizationId, version);
    if (
      lease.status === 'terminal_success' ||
      lease.status === 'terminal_failure' ||
      lease.status === 'abandoned'
    ) {
      throw new ProtocolV4LeaseRecoveryError(
        `PROTOCOL_V4_LEASE_RECOVERY_TERMINAL_VERSION_ALREADY_EXISTS:${input.authorizationId}:v${version}:${lease.status}`,
      );
    }
    priorBytes.set(
      version,
      hashProtocolV4(
        fs
          .readFileSync(
            path.join(
              path.resolve(root),
              'leases',
              deriveProtocolV4AuthorizationStorageKey(input.authorizationId),
              `v${version}.json`,
            ),
          )
          .toString('base64'),
      ),
    );
  }

  // 8 (continued). The current lease must still be genuinely `executing`, at exactly the version
  // and content hash the operator stated -- so a lease that moved on between the operator reading
  // its state and invoking this command can never be recovered against stale expectations.
  if (current.status !== 'executing') {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_LEASE_NOT_EXECUTING:${input.authorizationId}:${current.status}`,
    );
  }
  if (current.version !== input.expectedLeaseVersion) {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_LEASE_VERSION_MISMATCH:${input.authorizationId}`,
    );
  }
  if (current.leaseHash !== input.expectedLeaseHash) {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_LEASE_HASH_MISMATCH:${input.authorizationId}`,
    );
  }

  // Durable accounting for the interrupted run -- derived ONLY from the journal, never from memory.
  const durableAccounting = classifyProtocolV4DurableAccounting({
    artifactStoreRoot: root,
    authorizationId: input.authorizationId,
    repoRoot: input.repoRoot,
  });
  const journalEvents = readProtocolV4RuntimeJournal(root, input.authorizationId, input.repoRoot);
  const recordedLiveness =
    journalEvents.length > 0 ? journalEvents[journalEvents.length - 1].liveness : null;

  const recoveredAtIso = new Date().toISOString();
  const sequences = listRecoverySequences(root, input.authorizationId);
  const sequence = (sequences.length === 0 ? 0 : sequences[sequences.length - 1]) + 1;
  const recordBody: Omit<ProtocolV4LeaseRecoveryRecord, 'recoveryRecordHash'> = {
    recoveryRecordSchemaVersion: PROTOCOL_V4_LEASE_RECOVERY_RECORD_SCHEMA_VERSION,
    sequence,
    authorizationId: input.authorizationId,
    leaseId: current.leaseId,
    preRecoveryLeaseVersion: current.version,
    preRecoveryLeaseStatus: 'executing',
    preRecoveryLeaseHash: current.leaseHash,
    // The lease store's own versioning is strictly monotonic by +1, so the resulting version is
    // deterministic and is asserted against the real transition result below.
    recoveredLeaseVersion: current.version + 1,
    recoveredLeaseStatus: 'abandoned',
    reasonCode: input.reasonCode,
    humanRecoveryApprovalReference: input.humanRecoveryApprovalReference,
    confirmedExecutingProcessNotRunning: true,
    recoveredAtIso,
    durableAccountingClassification: durableAccounting.classification,
    durableAccounting,
    recordedLiveness,
    recoveryProcessLiveness: currentProcessLiveness(),
    authorizationReusable: false,
  };
  const record: ProtocolV4LeaseRecoveryRecord = {
    ...recordBody,
    recoveryRecordHash: hashRecordBody(recordBody),
  };
  writeRecoveryRecordExclusive(root, input.authorizationId, record);

  // Append a `recovery_recorded` journal event only when a journal ALREADY exists -- recovery never
  // fabricates a runtime journal for a legacy/uninstrumented run that genuinely never had one.
  if (fs.existsSync(protocolV4RuntimeJournalDirectory(root, input.authorizationId))) {
    openProtocolV4RuntimeJournal({
      artifactStoreRoot: root,
      authorizationId: input.authorizationId,
      planHash: current.planHash,
      executionTreeHash: current.executionTreeHash,
      repoRoot: input.repoRoot,
    }).appendRecoveryRecorded(input.reasonCode);
  }

  // Exactly one new version, via the existing, unmodified lease primitive.
  const recovered = recoverProtocolV4AbandonedExecutionLease(root, input.authorizationId);
  if (recovered.status !== 'abandoned' || recovered.version !== record.recoveredLeaseVersion) {
    throw new ProtocolV4LeaseRecoveryError(
      `PROTOCOL_V4_LEASE_RECOVERY_UNEXPECTED_RESULT_VERSION:${input.authorizationId}`,
    );
  }

  // Every pre-existing version must still be byte-for-byte what it was before this call.
  for (const version of priorVersions) {
    const nowHash = hashProtocolV4(
      fs
        .readFileSync(
          path.join(
            path.resolve(root),
            'leases',
            deriveProtocolV4AuthorizationStorageKey(input.authorizationId),
            `v${version}.json`,
          ),
        )
        .toString('base64'),
    );
    if (nowHash !== priorBytes.get(version)) {
      throw new ProtocolV4LeaseRecoveryError(
        `PROTOCOL_V4_LEASE_RECOVERY_PRIOR_VERSION_MUTATED:${input.authorizationId}:v${version}`,
      );
    }
  }

  return {
    authorizationId: input.authorizationId,
    leaseId: current.leaseId,
    preRecoveryLeaseVersion: current.version,
    preRecoveryLeaseHash: current.leaseHash,
    recoveredLeaseVersion: recovered.version,
    recoveredLeaseStatus: 'abandoned',
    reasonCode: input.reasonCode,
    humanRecoveryApprovalReference: input.humanRecoveryApprovalReference,
    recoveredAtIso,
    recoveryRecordHash: record.recoveryRecordHash,
    durableAccounting,
    recordedLiveness,
    preservedLeaseVersions: priorVersions,
    authorizationReusable: false,
  };
}
