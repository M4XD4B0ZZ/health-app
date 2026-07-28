import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  canonicalizeProtocolV4,
  hashProtocolV4,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import { isProtocolV4ArtifactTargetUnused } from './ResolverV3048ProtocolV4ArtifactStore';

/**
 * RESOLVER-V3-048 Final Phase-A closure remediation, "atomare Execution Lease vor dem ersten
 * Dispatch" (Weiteres Vorgehen item 2/3).
 *
 * Prior to this module, `assertDevelopmentAuthorized`/`assertHoldoutAuthorized` were check-then-act:
 * a caller checked the authorization was not yet consumed, then dispatched every observation, and
 * only marked the authorization consumed via `consumeProtocolV4AuthorizationAtomically` AFTER every
 * dispatch had already completed. Two concurrent callers could both pass the "not yet consumed"
 * check before either one's dispatch loop finished, both proceed to dispatch, and only the second
 * completion-time consumption call would fail -- by then both had already run.
 *
 * This module closes that gap with a real Execution Lease: a single atomic, exclusive-create claim
 * that must succeed BEFORE the first dispatch, backed by an immutable, versioned, persisted record
 * whose identity (phase, plan/execution-tree hash, authorization ID, artifact-store root, candidate
 * scope, budget scope) is re-checked from storage -- never from a caller-supplied in-memory object --
 * immediately before every dispatch. Only `claimed`/`executing` may dispatch; every other status
 * (`terminal_success`, `terminal_failure`, `abandoned`) is permanently inert. Claiming twice for the
 * same `authorizationId` always collides on the same exclusive-create file, so exactly one of two
 * concurrent claimants ever succeeds, full stop -- this is the load-bearing invariant, not merely a
 * convention.
 */

export class ProtocolV4ExecutionLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4ExecutionLeaseError';
  }
}

export const PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION = 'resolver-v3-048-execution-lease-v1';

export type ProtocolV4ExecutionLeaseStatus =
  | 'claimed'
  | 'executing'
  | 'terminal_success'
  | 'terminal_failure'
  | 'abandoned';

export type ProtocolV4ExecutionLeasePhase = 'development' | 'holdout';

export interface ProtocolV4ExecutionLease {
  leaseSchemaVersion: typeof PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION;
  leaseId: string;
  authorizationId: string;
  authorizationKind: 'fake_dry_run' | 'human_live' | 'fake_dry_run_only';
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  /** Required (non-null) for `phase: 'holdout'`; must be `null` for `phase: 'development'` -- a
   * Development lease structurally cannot carry a Development-evidence-root binding that does not
   * yet exist when Development itself is claimed. */
  developmentEvidenceRootHash: string | null;
  candidateScope: readonly ResolverV3047CandidateId[];
  artifactStoreRootIdentity: string;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxConcurrentRequests: number;
  pricingVersion: string;
  modelId: string;
  status: ProtocolV4ExecutionLeaseStatus;
  /** Monotonic version of this lease's lifecycle -- each transition is a new immutable record, never
   * a mutation of a prior one; "current state" is simply the highest version persisted. */
  version: number;
  claimedAtIso: string;
  /** Per-claim random nonce -- proves which single attempt actually won the exclusive create, useful
   * for audit/debugging; never used as a security boundary by itself (the exclusive-create file
   * system operation is). */
  claimNonce: string;
  leaseHash: string;
}

function assertSafeIdComponent(id: string, field: string): void {
  if (!id || /[\\/]|\.\./.test(id))
    throw new ProtocolV4ExecutionLeaseError(`PROTOCOL_V4_EXECUTION_LEASE_UNSAFE_ID:${field}:${id}`);
}

function leaseDirFor(root: string, authorizationId: string): string {
  assertSafeIdComponent(authorizationId, 'authorizationId');
  return path.join(path.resolve(root), 'leases', authorizationId);
}

function leaseVersionPath(root: string, authorizationId: string, version: number): string {
  return path.join(leaseDirFor(root, authorizationId), `v${version}.json`);
}

/** Lists every persisted version file for this authorization ID, in ascending version order. Empty
 * when nothing has ever been claimed for this authorization ID. */
function listLeaseVersions(root: string, authorizationId: string): number[] {
  const dir = leaseDirFor(root, authorizationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((entry) => /^v(\d+)\.json$/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function hashLeaseBody(body: Omit<ProtocolV4ExecutionLease, 'leaseHash'>): string {
  return hashProtocolV4(body);
}

function writeLeaseVersionExclusive(
  root: string,
  authorizationId: string,
  version: number,
  lease: ProtocolV4ExecutionLease,
): void {
  const finalPath = leaseVersionPath(root, authorizationId, version);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempPath = `${finalPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const fd = fs.openSync(tempPath, 'wx');
  try {
    fs.writeSync(fd, JSON.stringify(lease));
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.linkSync(tempPath, finalPath);
  } catch (e) {
    fs.unlinkSync(tempPath);
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ProtocolV4ExecutionLeaseError(
        `PROTOCOL_V4_EXECUTION_LEASE_VERSION_RACE:${authorizationId}:v${version}`,
      );
    throw e;
  }
  fs.unlinkSync(tempPath);
}

/** Reads back the CURRENT persisted lease state for an authorization ID -- the highest-version file
 * on disk -- independently re-parsed and hash-revalidated. Returns `null` only when nothing has ever
 * been claimed for this authorization ID at all. This is the single authoritative read every
 * dispatch-time check must go through; a caller-held in-memory lease object is never trusted on its
 * own. */
export function readProtocolV4ExecutionLease(
  root: string,
  authorizationId: string,
): ProtocolV4ExecutionLease | null {
  const versions = listLeaseVersions(root, authorizationId);
  if (versions.length === 0) return null;
  const latest = versions[versions.length - 1];
  const raw = fs.readFileSync(leaseVersionPath(root, authorizationId, latest), 'utf-8');
  const parsed = JSON.parse(raw) as ProtocolV4ExecutionLease;
  const { leaseHash, ...body } = parsed;
  if (hashLeaseBody(body) !== leaseHash)
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_READBACK_HASH_MISMATCH:${authorizationId}`,
    );
  if (parsed.version !== latest)
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_VERSION_FILENAME_MISMATCH:${authorizationId}`,
    );
  return parsed;
}

export interface ProtocolV4ExecutionLeaseClaimInput {
  artifactStoreRoot: string;
  authorizationId: string;
  authorizationKind: ProtocolV4ExecutionLease['authorizationKind'];
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  developmentEvidenceRootHash?: string | null;
  candidateScope: readonly ResolverV3047CandidateId[];
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxConcurrentRequests: number;
  pricingVersion: string;
  modelId: string;
}

/** Atomically claims a brand-new Execution Lease for `authorizationId`: the ONLY way to obtain a
 * lease in `status: 'claimed'`. Backed by an exclusive-create write of version 1 -- if that file
 * already exists (this authorization ID was ever claimed before, in any lifecycle state, including
 * terminal/abandoned), this throws and the caller gets nothing. Exactly one of two concurrent callers
 * racing this function for the same `authorizationId` can ever observe success; the loser always
 * throws `PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED` (or, in the sub-millisecond directory-creation
 * race, `PROTOCOL_V4_EXECUTION_LEASE_VERSION_RACE`, equally fail-closed). This function itself must be
 * called strictly before the first Development-/Holdout-dispatch attempt -- never after. */
export function claimProtocolV4ExecutionLease(
  input: ProtocolV4ExecutionLeaseClaimInput,
): ProtocolV4ExecutionLease {
  const developmentEvidenceRootHash =
    input.phase === 'holdout' ? (input.developmentEvidenceRootHash ?? null) : null;
  if (input.phase === 'holdout' && !developmentEvidenceRootHash)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_HOLDOUT_REQUIRES_EVIDENCE_ROOT',
    );
  if (input.phase === 'development' && input.developmentEvidenceRootHash)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_FORBIDS_EVIDENCE_ROOT',
    );
  const artifactStoreRootIdentity = path.resolve(input.artifactStoreRoot);
  const candidateScope = [...input.candidateScope].sort();
  const withoutHash: Omit<ProtocolV4ExecutionLease, 'leaseHash'> = {
    leaseSchemaVersion: PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION,
    leaseId: `lease:${input.phase}:${input.authorizationId}`,
    authorizationId: input.authorizationId,
    authorizationKind: input.authorizationKind,
    phase: input.phase,
    planHash: input.planHash,
    executionTreeHash: input.executionTreeHash,
    developmentEvidenceRootHash,
    candidateScope,
    artifactStoreRootIdentity,
    maxCalls: input.maxCalls,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    maxCostUsd: input.maxCostUsd,
    maxConcurrentRequests: input.maxConcurrentRequests,
    pricingVersion: input.pricingVersion,
    modelId: input.modelId,
    status: 'claimed',
    version: 1,
    claimedAtIso: new Date().toISOString(),
    claimNonce: Math.random().toString(36).slice(2),
  };
  const lease: ProtocolV4ExecutionLease = { ...withoutHash, leaseHash: hashLeaseBody(withoutHash) };
  try {
    writeLeaseVersionExclusive(input.artifactStoreRoot, input.authorizationId, 1, lease);
  } catch (e) {
    if (
      e instanceof ProtocolV4ExecutionLeaseError ||
      (e as NodeJS.ErrnoException).code === 'EEXIST'
    )
      throw new ProtocolV4ExecutionLeaseError(
        `PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED:${input.authorizationId}`,
      );
    throw e;
  }
  return lease;
}

const ALLOWED_LEASE_TRANSITIONS: Readonly<
  Record<ProtocolV4ExecutionLeaseStatus, readonly ProtocolV4ExecutionLeaseStatus[]>
> = {
  claimed: ['executing', 'terminal_failure', 'abandoned'],
  executing: ['terminal_success', 'terminal_failure', 'abandoned'],
  terminal_success: [],
  terminal_failure: [],
  abandoned: [],
};

function transitionLease(
  root: string,
  authorizationId: string,
  to: ProtocolV4ExecutionLeaseStatus,
): ProtocolV4ExecutionLease {
  const current = readProtocolV4ExecutionLease(root, authorizationId);
  if (!current)
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND:${authorizationId}`,
    );
  if (!ALLOWED_LEASE_TRANSITIONS[current.status].includes(to))
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_INVALID_TRANSITION:${authorizationId}:${current.status}->${to}`,
    );
  const { leaseHash: _oldHash, ...body } = current;
  void _oldHash;
  const nextBody: Omit<ProtocolV4ExecutionLease, 'leaseHash'> = {
    ...body,
    status: to,
    version: current.version + 1,
    claimNonce: Math.random().toString(36).slice(2),
  };
  const next: ProtocolV4ExecutionLease = { ...nextBody, leaseHash: hashLeaseBody(nextBody) };
  writeLeaseVersionExclusive(root, authorizationId, next.version, next);
  return next;
}

export function markProtocolV4ExecutionLeaseExecuting(
  root: string,
  authorizationId: string,
): ProtocolV4ExecutionLease {
  return transitionLease(root, authorizationId, 'executing');
}

export function markProtocolV4ExecutionLeaseTerminalSuccess(
  root: string,
  authorizationId: string,
): ProtocolV4ExecutionLease {
  return transitionLease(root, authorizationId, 'terminal_success');
}

export function markProtocolV4ExecutionLeaseTerminalFailure(
  root: string,
  authorizationId: string,
): ProtocolV4ExecutionLease {
  return transitionLease(root, authorizationId, 'terminal_failure');
}

/** Explicit, separate recovery action for a lease stuck in `claimed`/`executing` (e.g. after a
 * crashed process) -- NEVER invoked automatically by any dispatch/gate path. Marking a lease
 * `abandoned` does not free its `authorizationId` for reuse: `claimProtocolV4ExecutionLease` always
 * collides on the same exclusive-create v1 file regardless of lifecycle status, so an abandoned
 * authorization stays permanently unusable, exactly like a terminal one. */
export function recoverProtocolV4AbandonedExecutionLease(
  root: string,
  authorizationId: string,
): ProtocolV4ExecutionLease {
  return transitionLease(root, authorizationId, 'abandoned');
}

export interface ProtocolV4ExecutionLeaseExpectedIdentity {
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  authorizationId: string;
  artifactStoreRoot: string;
  candidateScope: readonly ResolverV3047CandidateId[];
  developmentEvidenceRootHash?: string | null;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
}

/** The single gate every Development/Holdout runner must call immediately before dispatching a
 * single observation: reads the CURRENT persisted lease from storage (never trusts a caller-supplied
 * lease object's own `status`/identity fields) and requires it to be `claimed` or `executing`, and
 * requires every identity/scope/budget field to match exactly what the caller is about to execute
 * under. Fails closed on any mismatch -- wrong phase, wrong plan/execution-tree hash, wrong
 * authorization ID, wrong artifact-store root, wrong candidate scope, wrong budget scope, or a
 * terminal/abandoned lease. Returns the validated, persisted lease. */
export function assertProtocolV4ExecutionLeaseActiveForDispatch(
  expected: ProtocolV4ExecutionLeaseExpectedIdentity,
): ProtocolV4ExecutionLease {
  const lease = readProtocolV4ExecutionLease(expected.artifactStoreRoot, expected.authorizationId);
  if (!lease)
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND:${expected.authorizationId}`,
    );
  if (lease.status !== 'claimed' && lease.status !== 'executing')
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE:${expected.authorizationId}:${lease.status}`,
    );
  if (lease.phase !== expected.phase)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_PHASE_MISMATCH');
  if (lease.planHash !== expected.planHash)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_PLAN_HASH_MISMATCH');
  if (lease.executionTreeHash !== expected.executionTreeHash)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_EXECUTION_TREE_MISMATCH');
  if (lease.authorizationId !== expected.authorizationId)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_ID_MISMATCH',
    );
  if (lease.artifactStoreRootIdentity !== path.resolve(expected.artifactStoreRoot))
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_ARTIFACT_ROOT_MISMATCH');
  const expectedScope = [...expected.candidateScope].sort();
  if (canonicalizeProtocolV4(lease.candidateScope) !== canonicalizeProtocolV4(expectedScope))
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_CANDIDATE_SCOPE_MISMATCH');
  const expectedEvidenceRoot =
    expected.phase === 'holdout' ? (expected.developmentEvidenceRootHash ?? null) : null;
  if (lease.developmentEvidenceRootHash !== expectedEvidenceRoot)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_EVIDENCE_ROOT_MISMATCH');
  if (
    lease.maxCalls !== expected.maxCalls ||
    lease.maxInputTokens !== expected.maxInputTokens ||
    lease.maxOutputTokens !== expected.maxOutputTokens ||
    lease.maxCostUsd !== expected.maxCostUsd
  )
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_BUDGET_SCOPE_MISMATCH');
  return lease;
}

/** Convenience: true when the artifact-store root itself has never had any target written under it
 * yet for `relativePath` -- reused by callers that want to combine a lease claim with the existing
 * artifact-target-unused check in a single readable call. Never used as a substitute for the lease
 * check above; both are independently required. */
export function isProtocolV4LeaseArtifactTargetStillUnused(
  root: string,
  relativePath: string,
): boolean {
  return isProtocolV4ArtifactTargetUnused(root, relativePath);
}
