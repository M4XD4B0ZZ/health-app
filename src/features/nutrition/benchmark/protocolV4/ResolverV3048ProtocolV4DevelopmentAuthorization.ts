import {
  hashProtocolV4,
  validateProtocolV4MasterPlan,
  PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type ProtocolV4MasterPlan,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import {
  isProtocolV4ArtifactTargetUnused,
  isProtocolV4AuthorizationConsumedAtomically,
} from './ResolverV3048ProtocolV4ArtifactStore';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 12 ("Development Authorization Record").
 *
 * The PR #191 merge had a strict `HoldoutAuthorizationRecord`/`assertHoldoutAuthorized` gate but NO
 * equivalent for Development at all -- the (fake) Development dispatch loop in the dry run had
 * nothing gating it before running. This module is the symmetric Development-phase counterpart: a
 * `ProtocolV4DevelopmentAuthorizationRecord` bound to the Master Plan and Development execution tree,
 * covering the full three-candidate set, and an `assertDevelopmentAuthorized` gate the Development
 * runner must pass before it may dispatch a single call. Only `kind: 'fake_dry_run'` authorizations
 * are produced or exercised by this task; no `human_live` authorization is ever created here.
 */

export class ProtocolV4DevelopmentAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4DevelopmentAuthorizationError';
  }
}

export interface ProtocolV4DevelopmentAuthorizationRecord {
  authorizationSchemaVersion: typeof PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION;
  kind: 'fake_dry_run' | 'human_live';
  authorizedPhase: 'development';
  masterPlanHash: string;
  developmentExecutionTreeHash: string;
  candidateSet: readonly ResolverV3047CandidateId[];
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  maxCostUsd: number;
  currency: 'USD';
  maxConcurrency: number;
  authorizationId: string;
  humanApprovalReference: string | null;
  status: 'issued' | 'consumed';
  consumptionVersion: number;
  authorizationRecordHash: string;
}

/** Builds a Development Authorization Record whose limits are derived directly from the Master
 * Plan's own Development budget (never independently re-typed numbers). `kind: 'human_live'` requires
 * a non-null `humanApprovalReference`; this task only ever constructs `kind: 'fake_dry_run'`. */
export function buildProtocolV4DevelopmentAuthorization(input: {
  plan: ProtocolV4MasterPlan;
  kind: 'fake_dry_run' | 'human_live';
  authorizationId: string;
  humanApprovalReference?: string | null;
}): ProtocolV4DevelopmentAuthorizationRecord {
  validateProtocolV4MasterPlan(input.plan);
  const humanApprovalReference = input.humanApprovalReference ?? null;
  if (input.kind === 'human_live' && !humanApprovalReference)
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_HUMAN_APPROVAL_REFERENCE_REQUIRED',
    );
  const withoutHash: Omit<ProtocolV4DevelopmentAuthorizationRecord, 'authorizationRecordHash'> = {
    authorizationSchemaVersion: PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
    kind: input.kind,
    authorizedPhase: 'development',
    masterPlanHash: input.plan.planHash,
    developmentExecutionTreeHash: input.plan.developmentExecutionTreeHash,
    candidateSet: input.plan.candidates.map((c) => c.id),
    maxCalls: input.plan.budget.developmentCalls,
    maxInputTokens: input.plan.budget.developmentCalls * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    maxOutputTokens: input.plan.budget.developmentCalls * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    maxTotalTokens: input.plan.budget.developmentMaxTokens,
    maxCostUsd: input.plan.budget.developmentMaxCostUsd,
    currency: 'USD',
    maxConcurrency: input.plan.budget.maxConcurrentRequests,
    authorizationId: input.authorizationId,
    humanApprovalReference,
    status: 'issued',
    consumptionVersion: 0,
  };
  return { ...withoutHash, authorizationRecordHash: hashProtocolV4(withoutHash) };
}

/** Gate the Development runner must pass before dispatching a single call: identities and limits are
 * checked individually against the Master Plan's own Development budget (not merely a boolean),
 * `status !== 'consumed'` AND the real atomic consumption marker, the artifact target's real absence
 * on disk (queried directly from the Artifact Store), and a `fake_dry_run` authorization can never
 * satisfy `liveExecution: true`.
 *
 * Storage-authoritative (Final Phase-A Execution Closure remediation): `artifactTargetUnused` and
 * `remainingCalls`/`remainingInputTokens`/`remainingOutputTokens`/`remainingCostUsd` no longer exist
 * as caller-supplied fields the gate simply trusts. This function itself queries
 * `isProtocolV4ArtifactTargetUnused`/`isProtocolV4AuthorizationConsumedAtomically` against the real
 * store, and requires `consumedBudget` (an INDEPENDENTLY tracked cumulative-consumption figure --
 * e.g. a live `LiveProviderBudgetGate.snapshot()`, never derived from the authorization's own `max*`
 * fields) plus `plannedBudget` (what the caller is about to dispatch, computed from the real planned
 * observation set) to still fit under the authorization's ceiling -- closing the "remaining always
 * equals max" tautology the prior gate had. */
export function assertDevelopmentAuthorized(input: {
  plan: ProtocolV4MasterPlan;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  artifactStoreRoot: string;
  artifactRelativePath: string;
  consumedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  plannedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  liveExecution: boolean;
}): void {
  validateProtocolV4MasterPlan(input.plan);
  const { plan, authorization } = input;
  const { authorizationRecordHash, ...body } = authorization;
  if (hashProtocolV4(body) !== authorizationRecordHash)
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_HASH_MISMATCH',
    );
  if (authorization.authorizationSchemaVersion !== PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION)
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_SCHEMA_MISMATCH',
    );
  if (authorization.authorizedPhase !== 'development')
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_PHASE_MISMATCH',
    );
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_IDENTITY_MISMATCH',
    );
  const expectedCandidates = plan.candidates
    .map((c) => c.id)
    .slice()
    .sort();
  const gotCandidates = [...authorization.candidateSet].sort();
  if (
    expectedCandidates.length !== gotCandidates.length ||
    expectedCandidates.some((id, i) => id !== gotCandidates[i])
  )
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_CANDIDATE_SET_MISMATCH',
    );
  if (authorization.currency !== 'USD')
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_CURRENCY_MISMATCH',
    );
  if (
    authorization.status === 'consumed' ||
    isProtocolV4AuthorizationConsumedAtomically(
      input.artifactStoreRoot,
      authorization.authorizationId,
    )
  )
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED',
    );
  if (!isProtocolV4ArtifactTargetUnused(input.artifactStoreRoot, input.artifactRelativePath))
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_ARTIFACT_TARGET_REUSED',
    );
  if (
    authorization.maxCalls < plan.budget.developmentCalls ||
    authorization.maxInputTokens <
      plan.budget.developmentCalls * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS ||
    authorization.maxOutputTokens <
      plan.budget.developmentCalls * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS ||
    authorization.maxTotalTokens < plan.budget.developmentMaxTokens ||
    authorization.maxCostUsd < plan.budget.developmentMaxCostUsd
  )
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_LIMITS_INSUFFICIENT',
    );
  if (authorization.maxConcurrency !== plan.budget.maxConcurrentRequests)
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_CONCURRENCY_MISMATCH',
    );
  const { consumedBudget: c, plannedBudget: p } = input;
  if (
    c.calls + p.calls > authorization.maxCalls ||
    c.inputTokens + p.inputTokens > authorization.maxInputTokens ||
    c.outputTokens + p.outputTokens > authorization.maxOutputTokens ||
    c.costUsd + p.costUsd > authorization.maxCostUsd
  )
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_BUDGET_INSUFFICIENT',
    );
  if (authorization.kind === 'fake_dry_run' && input.liveExecution)
    throw new ProtocolV4DevelopmentAuthorizationError('PROTOCOL_V4_FAKE_AUTHORIZATION_CANNOT_LIVE');
  if (input.liveExecution) {
    if (authorization.kind !== 'human_live')
      throw new ProtocolV4DevelopmentAuthorizationError(
        'PROTOCOL_V4_HUMAN_LIVE_AUTHORIZATION_REQUIRED',
      );
    if (!authorization.humanApprovalReference)
      throw new ProtocolV4DevelopmentAuthorizationError(
        'PROTOCOL_V4_HUMAN_APPROVAL_REFERENCE_REQUIRED',
      );
  }
}

/** Atomically (in the sense of "the only supported state transition function": never mutates the
 * input, always returns a freshly-hashed record) marks an authorization consumed. A second
 * consumption attempt on an already-consumed record throws. */
export function consumeProtocolV4DevelopmentAuthorization(
  authorization: ProtocolV4DevelopmentAuthorizationRecord,
): ProtocolV4DevelopmentAuthorizationRecord {
  if (authorization.status === 'consumed')
    throw new ProtocolV4DevelopmentAuthorizationError(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED',
    );
  const { authorizationRecordHash: _oldHash, ...body } = authorization;
  void _oldHash;
  const consumedBody = {
    ...body,
    status: 'consumed' as const,
    consumptionVersion: body.consumptionVersion + 1,
  };
  return { ...consumedBody, authorizationRecordHash: hashProtocolV4(consumedBody) };
}
