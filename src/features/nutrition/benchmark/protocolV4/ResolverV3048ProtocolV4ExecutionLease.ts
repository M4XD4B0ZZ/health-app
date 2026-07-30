import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  canonicalizeProtocolV4,
  hashProtocolV4,
  type ProtocolV4MasterPlan,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import {
  assertProtocolV4DryRunRootMatchesStore,
  assertProtocolV4LiveRootMatchesStore,
  isProtocolV4ArtifactTargetUnused,
} from './ResolverV3048ProtocolV4ArtifactStore';
import { type ProtocolV4DevelopmentAuthorizationRecord } from './ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  type ProtocolV4DryRunCandidateChoice,
  type ProtocolV4DryRunHoldoutExecutionPlan,
  type ProtocolV4DryRunHoldoutAuthorization,
  validateProtocolV4DryRunCandidateChoice,
  validateProtocolV4DryRunHoldoutExecutionPlan,
} from './ResolverV3048ProtocolV4DryRunChoice';
import {
  type ProtocolV4HoldoutAdmissionExecutionPlan,
  type ProtocolV4HoldoutAdmissionAuthorization,
  type ProtocolV4HoldoutAdmissionRecord,
  validateProtocolV4HoldoutAdmissionExecutionPlan,
} from './ResolverV3048ProtocolV4HoldoutAdmission';

/**
 * RESOLVER-V3-048 Final Dispatch-Lease, Authorization-Binding and G2-Evidence Closure remediation.
 *
 * Two independent gaps existed in the previously-merged Execution Lease module:
 *
 * 1. `assertProtocolV4ExecutionLeaseActiveForDispatch` was called ONCE, before the whole
 *    Development/Holdout candidate dispatch loop -- never again before each individual
 *    `runOneObservation` call. A lease terminalized/abandoned between observation 1 and observation
 *    2 of the same run did not stop observation 2 (or any later observation) from dispatching. This
 *    module still only checks identity; the fix (re-checking inside `runOneObservation` itself,
 *    immediately before every fast-path AND AI-path dispatch) lives in
 *    `ResolverV3048ProtocolV4DevelopmentRunner.ts`, which both the Development and Holdout Runners
 *    share.
 * 2. The persisted lease's own claim input (`ProtocolV4ExecutionLeaseClaimInput`) accepted freely
 *    settable primitive numbers/strings for `authorizationKind`/`maxConcurrentRequests`/
 *    `pricingVersion`/`modelId` with no requirement that they were ever validated against a real
 *    Authorization Record, and the persisted lease never stored the Authorization Record's own hash
 *    at all -- so a caller could claim (and every dispatch would happily accept) a lease built from
 *    copied ID/budget fields alone, never a genuinely validated record. This module now (a) stores
 *    `authorizationRecordHash`/`authorizationSchemaVersion`/`runKind` (plus, for Holdout leases,
 *    `holdoutPlanHash`/`selectionOrChoiceHash`) as load-bearing identity fields checked on every
 *    dispatch, exactly like `planHash`/`executionTreeHash`, and (b) adds
 *    `claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`/
 *    `claimProtocolV4ExecutionLeaseForHoldoutAuthorization` as the only RECOMMENDED entry points,
 *    which independently validate the real Authorization Record (recomputing its own self-hash, or
 *    -- for the real Holdout path -- calling the real `assertHoldoutAuthorized`/`validateHoldoutExecutionPlan`
 *    contracts) and derive every identity field from that validated record and the Master Plan,
 *    never from caller-supplied overrides. The low-level `claimProtocolV4ExecutionLease` primitive
 *    remains exported (existing negative-path/race tests exercise it directly), but every production
 *    call site in `ResolverV3048ProtocolV4DryRun.ts` now goes through the validated wrappers.
 *
 * This module also closes the lease-store's own crash-detection gap: a `vN.json.tmp-*` file with no
 * matching final `vN.json` is now an explicit crash state (`ProtocolV4ExecutionLeaseCrashError`),
 * checked on every read/claim/transition -- never silently treated as "no lease" nor silently
 * ignored as an unrelated leftover next to a valid current version. A dedicated
 * `recoverProtocolV4ExecutionLeaseCrash` function is the only way past it, and it always leaves the
 * authorization ID permanently `abandoned` (never reusable), matching the Artifact Store's own
 * crash-recovery contract.
 */

export class ProtocolV4ExecutionLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4ExecutionLeaseError';
  }
}

/** Thrown when a leftover `vN.json.tmp-*` sibling with no matching final `vN.json` is found for an
 * authorization ID -- an explicit crash state, never silently treated as "no lease" (when it is the
 * very first version) nor silently ignored (when a later version's temp file sits next to an
 * otherwise-valid earlier current version). */
export class ProtocolV4ExecutionLeaseCrashError extends ProtocolV4ExecutionLeaseError {}

export const PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION = 'resolver-v3-048-execution-lease-v1';

export type ProtocolV4ExecutionLeaseStatus =
  | 'claimed'
  | 'executing'
  | 'terminal_success'
  | 'terminal_failure'
  | 'abandoned';

export type ProtocolV4ExecutionLeasePhase = 'development' | 'holdout';

export type ProtocolV4ExecutionLeaseRunKind = 'fake_dry_run' | 'human_live' | 'fake_dry_run_only';

export interface ProtocolV4ExecutionLease {
  leaseSchemaVersion: typeof PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION;
  leaseId: string;
  authorizationId: string;
  authorizationKind: ProtocolV4ExecutionLeaseRunKind;
  /** Same vocabulary as `authorizationKind`, kept as an independently-named, independently-checked
   * field per the task's explicit "runKind" identity requirement -- never silently merged with
   * `authorizationKind` even though the two happen to carry the same value today, so a future
   * divergence between "what kind of authorization record this is" and "what kind of run this lease
   * is scoped to" would be structurally representable and independently checked. */
  runKind: ProtocolV4ExecutionLeaseRunKind;
  authorizationSchemaVersion: string;
  /** Content hash of the validated Authorization Record this lease was claimed for -- never a
   * freely-settable string; `claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`/
   * `claimProtocolV4ExecutionLeaseForHoldoutAuthorization` derive it from the record itself. */
  authorizationRecordHash: string;
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  /** Required (non-null) for `phase: 'holdout'`; must be `null` for `phase: 'development'` -- a
   * Development lease structurally cannot carry a Development-evidence-root binding that does not
   * yet exist when Development itself is claimed. */
  developmentEvidenceRootHash: string | null;
  /** Holdout-only: the Holdout (or dry-run Holdout) Execution Plan's own hash. `null` for
   * `phase: 'development'`. */
  holdoutPlanHash: string | null;
  /** Holdout-only: the Candidate Selection Record hash (authoritative Holdout) or the Dry-Run
   * Candidate Choice hash (non-authoritative Holdout) this lease's Holdout plan was derived from.
   * `null` for `phase: 'development'`. */
  selectionOrChoiceHash: string | null;
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

/** Lists every persisted FINAL version file for this authorization ID, in ascending version order.
 * Empty when nothing has ever been committed for this authorization ID (which may still mean a
 * crashed claim attempt exists -- see `detectProtocolV4ExecutionLeaseCrash`). */
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

/** Lists every version number that has an orphaned `vN.json.tmp-*` sibling, regardless of whether
 * that version was ever finally committed. */
function listLeaseTmpVersions(root: string, authorizationId: string): number[] {
  const dir = leaseDirFor(root, authorizationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((entry) => /^v(\d+)\.json\.tmp-/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
}

/** Detects a crashed-mid-write lease transition: a leftover `vN.json.tmp-*` sibling with no
 * corresponding final `vN.json` -- for ANY version, not merely the next expected one. This
 * deliberately does not distinguish "crash on the very first claim" (no final version exists at
 * all) from "crash on a later transition" (an otherwise-valid earlier version exists): both are
 * equally a crash state under the task's explicit requirement that a temp file for an expected
 * follow-up transition must never be silently ignored just because an earlier version still reads
 * back fine. */
export function detectProtocolV4ExecutionLeaseCrash(
  root: string,
  authorizationId: string,
): boolean {
  const finalVersions = new Set(listLeaseVersions(root, authorizationId));
  const tmpVersions = listLeaseTmpVersions(root, authorizationId);
  return tmpVersions.some((v) => !finalVersions.has(v));
}

function assertNoLeaseCrash(root: string, authorizationId: string): void {
  if (detectProtocolV4ExecutionLeaseCrash(root, authorizationId))
    throw new ProtocolV4ExecutionLeaseCrashError(
      `PROTOCOL_V4_EXECUTION_LEASE_CRASH_EVIDENCE_DETECTED:${authorizationId}`,
    );
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
 * been claimed for this authorization ID at all AND no crash evidence exists either. Throws
 * `ProtocolV4ExecutionLeaseCrashError` if any orphaned `vN.json.tmp-*` exists (whether or not any
 * final version has ever been committed) -- this is the single authoritative read every dispatch-time
 * check must go through; a caller-held in-memory lease object is never trusted on its own. */
export function readProtocolV4ExecutionLease(
  root: string,
  authorizationId: string,
): ProtocolV4ExecutionLease | null {
  assertNoLeaseCrash(root, authorizationId);
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
  authorizationKind: ProtocolV4ExecutionLeaseRunKind;
  runKind: ProtocolV4ExecutionLeaseRunKind;
  authorizationSchemaVersion: string;
  authorizationRecordHash: string;
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  developmentEvidenceRootHash?: string | null;
  holdoutPlanHash?: string | null;
  selectionOrChoiceHash?: string | null;
  candidateScope: readonly ResolverV3047CandidateId[];
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxConcurrentRequests: number;
  pricingVersion: string;
  modelId: string;
}

/** Low-level primitive: atomically claims a brand-new Execution Lease for `authorizationId` from
 * caller-supplied identity fields. Backed by an exclusive-create write of version 1 -- if that file
 * already exists (this authorization ID was ever claimed before, in any lifecycle state, including
 * terminal/abandoned), this throws and the caller gets nothing. Exactly one of two concurrent callers
 * racing this function for the same `authorizationId` can ever observe success. Also fails closed if
 * crash evidence (an orphaned `vN.json.tmp-*`) already exists for this authorization ID.
 *
 * This function does NOT itself validate that `authorizationKind`/`maxConcurrentRequests`/
 * `pricingVersion`/`modelId`/`authorizationRecordHash` were derived from a genuinely validated
 * Authorization Record -- callers that have one should prefer
 * `claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`/
 * `claimProtocolV4ExecutionLeaseForHoldoutAuthorization` below, which do. This primitive remains
 * exported for lower-level lifecycle/race tests that construct lease identities directly. */
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
  const holdoutPlanHash = input.phase === 'holdout' ? (input.holdoutPlanHash ?? null) : null;
  const selectionOrChoiceHash =
    input.phase === 'holdout' ? (input.selectionOrChoiceHash ?? null) : null;
  if (input.phase === 'development' && (input.holdoutPlanHash || input.selectionOrChoiceHash))
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_FORBIDS_HOLDOUT_PLAN_BINDING',
    );
  assertNoLeaseCrash(input.artifactStoreRoot, input.authorizationId);
  const artifactStoreRootIdentity = path.resolve(input.artifactStoreRoot);
  const candidateScope = [...input.candidateScope].sort();
  const withoutHash: Omit<ProtocolV4ExecutionLease, 'leaseHash'> = {
    leaseSchemaVersion: PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION,
    leaseId: `lease:${input.phase}:${input.authorizationId}`,
    authorizationId: input.authorizationId,
    authorizationKind: input.authorizationKind,
    runKind: input.runKind,
    authorizationSchemaVersion: input.authorizationSchemaVersion,
    authorizationRecordHash: input.authorizationRecordHash,
    phase: input.phase,
    planHash: input.planHash,
    executionTreeHash: input.executionTreeHash,
    developmentEvidenceRootHash,
    holdoutPlanHash,
    selectionOrChoiceHash,
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

/** Recomputes a Development Authorization Record's own self-hash and requires it to match the
 * stored `authorizationRecordHash` -- the same check `assertDevelopmentAuthorized` performs,
 * duplicated here (not imported, to avoid a circular module dependency) so a lease can be claimed
 * from a genuinely validated record without first requiring the full authorization gate (which also
 * needs storage-authoritative consumed/target-unused state that is not yet meaningful before the
 * very first dispatch). */
function assertDevelopmentAuthorizationRecordSelfConsistent(
  authorization: ProtocolV4DevelopmentAuthorizationRecord,
): void {
  const { authorizationRecordHash, ...body } = authorization;
  if (hashProtocolV4(body) !== authorizationRecordHash)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_AUTHORIZATION_HASH_MISMATCH',
    );
}

/** RESOLVER-V3-048 Phase B1: the Execution Lease module itself previously had NO root restriction at
 * all (confirmed by direct read -- `claimProtocolV4ExecutionLease` writes via plain `fs`/
 * `path.resolve(root)` to any root). Its root binding existed only after the fact, via
 * `artifactStoreRootIdentity`/`assertProtocolV4ExecutionLeaseActiveForDispatch`'s equality check at
 * dispatch time. This closes the claim-time gap for the Development-phase wrapper specifically: a
 * `fake_dry_run` authorization may only claim a lease under a root the dry-run Artifact Store itself
 * would accept (a subpath of `PROTOCOL_V4_DRY_RUN_ROOT`); a `human_live` authorization may only claim
 * one under a root the live Artifact Store would accept (a subpath of `PROTOCOL_V4_LIVE_ROOT`) --
 * reusing the exact same two validators the Artifact Store itself uses, never a separately
 * re-implemented check that could drift. */
function assertProtocolV4DevelopmentLeaseRootMatchesAuthorizationKind(
  kind: ProtocolV4DevelopmentAuthorizationRecord['kind'],
  artifactStoreRoot: string,
  repoRoot?: string,
): void {
  try {
    if (kind === 'human_live') assertProtocolV4LiveRootMatchesStore(artifactStoreRoot, repoRoot);
    else assertProtocolV4DryRunRootMatchesStore(artifactStoreRoot, repoRoot);
  } catch (e) {
    throw new ProtocolV4ExecutionLeaseError(
      `PROTOCOL_V4_EXECUTION_LEASE_ROOT_DOES_NOT_MATCH_AUTHORIZATION_KIND:${kind}:${artifactStoreRoot}:${(e as Error).message}`,
    );
  }
}

/** The recommended entry point for claiming a Development-phase Execution Lease: every identity
 * field (`authorizationKind`, `maxConcurrentRequests`, `pricingVersion`, `modelId`,
 * `authorizationRecordHash`, `authorizationSchemaVersion`, `candidateScope`, budget) is derived
 * DIRECTLY from the validated `authorization` record and the Master Plan -- never from a
 * caller-supplied override. Closes "a Development lease can be claimed solely from copied budget/ID
 * fields": a caller without a genuine `ProtocolV4DevelopmentAuthorizationRecord` (whose own
 * self-hash validates) cannot reach this function at all. */
export function claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
  plan: ProtocolV4MasterPlan,
  authorization: ProtocolV4DevelopmentAuthorizationRecord,
  artifactStoreRoot: string,
  repoRoot?: string,
): ProtocolV4ExecutionLease {
  assertDevelopmentAuthorizationRecordSelfConsistent(authorization);
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_AUTHORIZATION_PLAN_MISMATCH',
    );
  // Storage/root preflight BEFORE any write: a `human_live` authorization can only claim under the
  // live-bound root, a `fake_dry_run` authorization only under the dry-run-bound root -- checked here,
  // not only implicitly discovered later when `assertDevelopmentAuthorized`'s own storage checks run.
  assertProtocolV4DevelopmentLeaseRootMatchesAuthorizationKind(
    authorization.kind,
    artifactStoreRoot,
    repoRoot,
  );
  return claimProtocolV4ExecutionLease({
    artifactStoreRoot,
    authorizationId: authorization.authorizationId,
    authorizationKind: authorization.kind,
    runKind: authorization.kind,
    authorizationSchemaVersion: authorization.authorizationSchemaVersion,
    authorizationRecordHash: authorization.authorizationRecordHash,
    phase: 'development',
    planHash: plan.planHash,
    executionTreeHash: plan.developmentExecutionTreeHash,
    candidateScope: plan.candidates.map((c) => c.id),
    maxCalls: authorization.maxCalls,
    maxInputTokens: authorization.maxInputTokens,
    maxOutputTokens: authorization.maxOutputTokens,
    maxCostUsd: authorization.maxCostUsd,
    maxConcurrentRequests: authorization.maxConcurrency,
    pricingVersion: plan.pricing.pricingVersion,
    modelId: plan.modelId,
  });
}

/** The recommended entry point for claiming a Holdout-phase Execution Lease under the
 * non-authoritative, zero-network Dry-Run contract (`kind: 'fake_dry_run_only'`). Every identity
 * field is derived from the validated `choice`/`holdoutPlan`/`authorization` chain (re-validated
 * here via the same `validateProtocolV4DryRunCandidateChoice`/`validateProtocolV4DryRunHoldoutExecutionPlan`
 * functions the real gate uses), never from a caller override. A real, authoritative
 * `HoldoutAuthorizationRecord`/`HoldoutExecutionPlan`/`CandidateSelectionRecord` (`kind:
 * 'fake_dry_run' | 'human_live'`) is structurally a completely different type and is never accepted
 * here -- see `ResolverV3048ProtocolV4HoldoutRunner.ts`'s discriminated
 * `ProtocolV4HoldoutAuthorizationInput` for the parallel real-authorization path, which this task
 * never exercises with `kind: 'human_live'`. */
export function claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan,
  choice: ProtocolV4DryRunCandidateChoice,
  authorization: ProtocolV4DryRunHoldoutAuthorization,
  artifactStoreRoot: string,
): ProtocolV4ExecutionLease {
  validateProtocolV4DryRunCandidateChoice(plan, choice);
  validateProtocolV4DryRunHoldoutExecutionPlan(
    plan,
    holdoutPlan,
    holdoutPlan.developmentEvidenceRootHash,
    choice,
  );
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.dryRunHoldoutPlanHash !== holdoutPlan.dryRunHoldoutPlanHash ||
    authorization.developmentEvidenceRootHash !== holdoutPlan.developmentEvidenceRootHash ||
    authorization.dryRunChoiceHash !== choice.choiceHash ||
    authorization.candidateId !== holdoutPlan.candidateId
  )
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_DRY_RUN_HOLDOUT_AUTHORIZATION_IDENTITY_MISMATCH',
    );
  return claimProtocolV4ExecutionLease({
    artifactStoreRoot,
    authorizationId: authorization.authorizationId,
    authorizationKind: authorization.kind,
    runKind: authorization.kind,
    authorizationSchemaVersion: authorization.dryRunAuthorizationSchemaVersion,
    authorizationRecordHash: hashProtocolV4(authorization),
    phase: 'holdout',
    planHash: plan.planHash,
    executionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    holdoutPlanHash: holdoutPlan.dryRunHoldoutPlanHash,
    selectionOrChoiceHash: choice.choiceHash,
    candidateScope: [holdoutPlan.candidateId],
    maxCalls: authorization.maxCalls,
    maxInputTokens: authorization.maxInputTokens,
    maxOutputTokens: authorization.maxOutputTokens,
    maxCostUsd: authorization.maxCostUsd,
    maxConcurrentRequests: authorization.maxConcurrency,
    pricingVersion: plan.pricing.pricingVersion,
    modelId: plan.modelId,
  });
}

/** The recommended entry point for claiming a Holdout-phase Execution Lease under the real,
 * artifact-validated Holdout Admission Gate contract (`kind: 'human_live'`,
 * `ResolverV3048ProtocolV4HoldoutAdmission.ts`). Every identity field is derived from the validated
 * `record`/`holdoutPlan`/`authorization` chain (re-validated here via
 * `validateProtocolV4HoldoutAdmissionExecutionPlan`, which itself re-derives the plan from the
 * Admission Record), never from a caller override. Structurally present alongside the Development/
 * Dry-Run-Holdout wrappers above; this task's own zero-network Mini-Run never calls it (no
 * `human_live` execution is ever authorized or exercised by this task). */
export function claimProtocolV4ExecutionLeaseForHoldoutAdmissionAuthorization(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ProtocolV4HoldoutAdmissionExecutionPlan,
  record: ProtocolV4HoldoutAdmissionRecord,
  authorization: ProtocolV4HoldoutAdmissionAuthorization,
  artifactStoreRoot: string,
): ProtocolV4ExecutionLease {
  validateProtocolV4HoldoutAdmissionExecutionPlan(
    plan,
    holdoutPlan,
    holdoutPlan.developmentEvidenceRootHash,
    record,
  );
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.holdoutAdmissionPlanHash !== holdoutPlan.holdoutAdmissionPlanHash ||
    authorization.developmentEvidenceRootHash !== holdoutPlan.developmentEvidenceRootHash ||
    authorization.holdoutAdmissionRecordHash !== record.admissionRecordHash ||
    authorization.candidateId !== holdoutPlan.candidateId
  )
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_HOLDOUT_ADMISSION_AUTHORIZATION_IDENTITY_MISMATCH',
    );
  return claimProtocolV4ExecutionLease({
    artifactStoreRoot,
    authorizationId: authorization.authorizationId,
    authorizationKind: authorization.kind,
    runKind: authorization.kind,
    authorizationSchemaVersion: authorization.holdoutAdmissionAuthorizationSchemaVersion,
    authorizationRecordHash: hashProtocolV4(authorization),
    phase: 'holdout',
    planHash: plan.planHash,
    executionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    holdoutPlanHash: holdoutPlan.holdoutAdmissionPlanHash,
    selectionOrChoiceHash: record.admissionRecordHash,
    candidateScope: [holdoutPlan.candidateId],
    maxCalls: authorization.maxCalls,
    maxInputTokens: authorization.maxInputTokens,
    maxOutputTokens: authorization.maxOutputTokens,
    maxCostUsd: authorization.maxCostUsd,
    maxConcurrentRequests: authorization.maxConcurrency,
    pricingVersion: plan.pricing.pricingVersion,
    modelId: plan.modelId,
  });
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
  // `readProtocolV4ExecutionLease` itself performs the crash check before returning current state,
  // so a transition can never proceed from a state that has unexamined crash evidence sitting next
  // to it -- whether that evidence belongs to the version being read or to an orphaned attempt at
  // the version this transition is about to write.
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
  // Two concurrent transitions racing from the identical `current` read both compute the SAME next
  // version number; `writeLeaseVersionExclusive` uses an exclusive-create temp file followed by
  // `fs.linkSync` (itself exclusive -- fails `EEXIST` if the target already exists), so exactly one
  // of them ever wins that final commit. The loser gets a distinct, explicit
  // `PROTOCOL_V4_EXECUTION_LEASE_VERSION_RACE` error (via `writeLeaseVersionExclusive`'s own
  // `EEXIST` handling) -- never a silent overwrite, never a fallback to a different "next" version
  // number computed from stale state, and never an automatic retry.
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

/** Explicit, separate recovery action for a CRASHED lease: removes every orphaned `vN.json.tmp-*`
 * sibling for `authorizationId` (never a final `vN.json`, which this function never touches), then
 * permanently poisons the authorization ID so it can never be claimed or dispatched under again --
 * exactly the same terminal guarantee `recoverProtocolV4AbandonedExecutionLease` gives a
 * non-crashed stuck lease. Two cases:
 *
 * 1. A final version was already committed (the crash happened on a LATER transition attempt): the
 *    orphaned temp file(s) are removed, then the current committed version is transitioned to
 *    `abandoned` via the normal, versioned transition path.
 * 2. No final version was EVER committed (the crash happened on the very first claim attempt, so
 *    `readProtocolV4ExecutionLease` would otherwise have reported "no lease" once the crash
 *    evidence is gone): the orphaned temp file(s) are removed, then a terminal `abandoned` v1
 *    placeholder is written directly (bypassing the normal `claimed` first state, since this is an
 *    explicit administrative action, never a real claim) using the caller-supplied identity fields,
 *    so the authorization ID is permanently consumed even though no real dispatch ever happened
 *    under it.
 *
 * Never invoked automatically by any read/claim/transition/dispatch path -- a caller must explicitly
 * call this after inspecting the crash for themselves. */
export function recoverProtocolV4ExecutionLeaseCrash(input: {
  artifactStoreRoot: string;
  authorizationId: string;
  authorizationKind: ProtocolV4ExecutionLeaseRunKind;
  runKind: ProtocolV4ExecutionLeaseRunKind;
  authorizationSchemaVersion: string;
  authorizationRecordHash: string;
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  developmentEvidenceRootHash?: string | null;
  holdoutPlanHash?: string | null;
  selectionOrChoiceHash?: string | null;
  candidateScope: readonly ResolverV3047CandidateId[];
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxConcurrentRequests: number;
  pricingVersion: string;
  modelId: string;
}): ProtocolV4ExecutionLease {
  const { artifactStoreRoot, authorizationId } = input;
  const dir = leaseDirFor(artifactStoreRoot, authorizationId);
  const hadFinalVersion = listLeaseVersions(artifactStoreRoot, authorizationId).length > 0;
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      if (/\.json\.tmp-/.test(entry)) fs.unlinkSync(path.join(dir, entry));
    }
  }
  if (hadFinalVersion) return transitionLease(artifactStoreRoot, authorizationId, 'abandoned');

  const developmentEvidenceRootHash =
    input.phase === 'holdout' ? (input.developmentEvidenceRootHash ?? null) : null;
  const holdoutPlanHash = input.phase === 'holdout' ? (input.holdoutPlanHash ?? null) : null;
  const selectionOrChoiceHash =
    input.phase === 'holdout' ? (input.selectionOrChoiceHash ?? null) : null;
  const withoutHash: Omit<ProtocolV4ExecutionLease, 'leaseHash'> = {
    leaseSchemaVersion: PROTOCOL_V4_EXECUTION_LEASE_SCHEMA_VERSION,
    leaseId: `lease:${input.phase}:${authorizationId}`,
    authorizationId,
    authorizationKind: input.authorizationKind,
    runKind: input.runKind,
    authorizationSchemaVersion: input.authorizationSchemaVersion,
    authorizationRecordHash: input.authorizationRecordHash,
    phase: input.phase,
    planHash: input.planHash,
    executionTreeHash: input.executionTreeHash,
    developmentEvidenceRootHash,
    holdoutPlanHash,
    selectionOrChoiceHash,
    candidateScope: [...input.candidateScope].sort(),
    artifactStoreRootIdentity: path.resolve(artifactStoreRoot),
    maxCalls: input.maxCalls,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    maxCostUsd: input.maxCostUsd,
    maxConcurrentRequests: input.maxConcurrentRequests,
    pricingVersion: input.pricingVersion,
    modelId: input.modelId,
    status: 'abandoned',
    version: 1,
    claimedAtIso: new Date().toISOString(),
    claimNonce: Math.random().toString(36).slice(2),
  };
  const lease: ProtocolV4ExecutionLease = { ...withoutHash, leaseHash: hashLeaseBody(withoutHash) };
  writeLeaseVersionExclusive(artifactStoreRoot, authorizationId, 1, lease);
  return lease;
}

export interface ProtocolV4ExecutionLeaseExpectedIdentity {
  phase: ProtocolV4ExecutionLeasePhase;
  planHash: string;
  executionTreeHash: string;
  authorizationId: string;
  artifactStoreRoot: string;
  candidateScope: readonly ResolverV3047CandidateId[];
  developmentEvidenceRootHash?: string | null;
  holdoutPlanHash?: string | null;
  selectionOrChoiceHash?: string | null;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxConcurrentRequests: number;
  pricingVersion: string;
  modelId: string;
  authorizationKind: ProtocolV4ExecutionLeaseRunKind;
  runKind: ProtocolV4ExecutionLeaseRunKind;
  authorizationSchemaVersion: string;
  authorizationRecordHash: string;
}

/** The single gate every Development/Holdout dispatch must call IMMEDIATELY before dispatching --
 * fresh, for every single observation, never once per candidate/phase: reads the CURRENT persisted
 * lease from storage (never trusts a caller-supplied lease object's own `status`/identity fields)
 * and requires it to be `claimed` or `executing`, and requires every identity/scope/budget/
 * authorization-binding field to match exactly what the caller is about to execute under. Fails
 * closed on any mismatch -- wrong phase, wrong plan/execution-tree hash, wrong authorization ID,
 * wrong artifact-store root, wrong candidate scope, wrong budget scope, wrong authorization kind/
 * record hash/schema version/run kind/concurrency/pricing/model, or a terminal/abandoned/crashed
 * lease. Returns the validated, persisted lease. */
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
  const expectedHoldoutPlanHash =
    expected.phase === 'holdout' ? (expected.holdoutPlanHash ?? null) : null;
  if ((lease.holdoutPlanHash ?? null) !== expectedHoldoutPlanHash)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_HOLDOUT_PLAN_HASH_MISMATCH',
    );
  const expectedSelectionOrChoiceHash =
    expected.phase === 'holdout' ? (expected.selectionOrChoiceHash ?? null) : null;
  if ((lease.selectionOrChoiceHash ?? null) !== expectedSelectionOrChoiceHash)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_SELECTION_OR_CHOICE_HASH_MISMATCH',
    );
  if (
    lease.maxCalls !== expected.maxCalls ||
    lease.maxInputTokens !== expected.maxInputTokens ||
    lease.maxOutputTokens !== expected.maxOutputTokens ||
    lease.maxCostUsd !== expected.maxCostUsd
  )
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_BUDGET_SCOPE_MISMATCH');
  if (lease.maxConcurrentRequests !== expected.maxConcurrentRequests)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_CONCURRENCY_MISMATCH');
  if (lease.pricingVersion !== expected.pricingVersion)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_PRICING_VERSION_MISMATCH');
  if (lease.modelId !== expected.modelId)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_MODEL_ID_MISMATCH');
  if (lease.authorizationKind !== expected.authorizationKind)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_KIND_MISMATCH',
    );
  if (lease.runKind !== expected.runKind)
    throw new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_RUN_KIND_MISMATCH');
  if (lease.authorizationSchemaVersion !== expected.authorizationSchemaVersion)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_SCHEMA_VERSION_MISMATCH',
    );
  if (lease.authorizationRecordHash !== expected.authorizationRecordHash)
    throw new ProtocolV4ExecutionLeaseError(
      'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_RECORD_HASH_MISMATCH',
    );
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
