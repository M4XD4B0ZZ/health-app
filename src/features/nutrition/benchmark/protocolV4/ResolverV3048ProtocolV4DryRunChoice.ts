import {
  hashProtocolV4,
  validateProtocolV4DevelopmentEvidence,
  validateProtocolV4MasterPlan,
  computeDevelopmentEvidenceRootHash,
  SELECTION_RULE,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type CandidateEvaluation,
  type CandidateIdentity,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import {
  isProtocolV4ArtifactTargetUnused,
  isProtocolV4AuthorizationConsumedAtomically,
} from './ResolverV3048ProtocolV4ArtifactStore';

/**
 * RESOLVER-V3-048 Final Phase-A closure remediation, "Selection-Rule-Vertrag wiederherstellen" +
 * "getrennter, nichtautoritativer Dry-Run-Choice-Vertrag" (Weiteres Vorgehen items 4/10).
 *
 * `selectCandidate`/`selectCandidateFromDevelopmentEvidence` in `ResolverV3048ProtocolV4.ts` are once
 * again the strict, hashed `SELECTION_RULE.eligibility` contract, which a Development-only run against
 * the real, pinned evaluator can never satisfy (the evaluator's joint gate combinator cannot resolve a
 * mandatory gate to `passed` before Holdout evidence exists). That is correct and load-bearing: this
 * task must not weaken the live rule to make the technical zero-network Mini-Run "work".
 *
 * Instead, this module is a fully separate, parallel, explicitly non-authoritative contract the
 * Mini-Run uses ONLY to exercise the rest of the Holdout infrastructure end to end (persistence,
 * readback, budget/lease gating, Holdout observation dispatch) without ever claiming a live winner,
 * a passed G2 verdict, or authorization for a `human_live` Holdout. It intentionally does not reuse
 * `CandidateSelectionRecord`/`HoldoutExecutionPlan`/`HoldoutAuthorizationRecord`/`assertHoldoutAuthorized`
 * at all -- a distinct schema/record type at every layer means a `ProtocolV4DryRunCandidateChoice` can
 * never be silently accepted where a real `CandidateSelectionRecord` is required (structurally, not
 * merely by a runtime flag), and vice versa.
 */

export class ProtocolV4DryRunChoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4DryRunChoiceError';
  }
}

export const PROTOCOL_V4_DRY_RUN_CHOICE_SCHEMA_VERSION = 'resolver-v3-048-dry-run-choice-v1';
export const PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_SCHEMA_VERSION =
  'resolver-v3-048-dry-run-holdout-plan-v1';
export const PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_SCHEMA_VERSION =
  'resolver-v3-048-dry-run-holdout-authorization-v1';

export interface ProtocolV4DryRunCandidateChoice {
  dryRunChoiceSchemaVersion: typeof PROTOCOL_V4_DRY_RUN_CHOICE_SCHEMA_VERSION;
  kind: 'fake_dry_run_only';
  authoritative: false;
  masterPlanHash: string;
  developmentExecutionTreeHash: string;
  developmentEvidenceRootHash: string;
  selectionRuleVersion: string;
  evaluations: Readonly<Record<ResolverV3047CandidateId, CandidateEvaluation>>;
  candidateId: ResolverV3047CandidateId;
  tieBreakTrace: readonly string[];
  choiceHash: string;
}

/** Same ordered-comparison field order as `SELECTION_RULE.orderedComparison`/`selectCandidate`'s own
 * comparator, for technical determinism across dry runs -- deliberately WITHOUT any eligibility
 * screen. This never claims any candidate is "eligible": it is a pure ranking used solely to pick
 * which one candidate's Holdout template gets exercised technically. */
function compareCandidatesForDryRunChoice(a: CandidateEvaluation, b: CandidateEvaluation): number {
  return (
    b.complexComponentQuality - a.complexComponentQuality ||
    b.identificationQuality - a.identificationQuality ||
    b.clarificationAbstentionQuality - a.clarificationAbstentionQuality ||
    b.repeatConsistency - a.repeatConsistency ||
    a.costPerValidatedLogUsd - b.costPerValidatedLogUsd ||
    a.p95Ms - b.p95Ms ||
    a.p50Ms - b.p50Ms ||
    a.failureRate - b.failureRate ||
    a.aiCalls - b.aiCalls ||
    a.sourceCalls - b.sourceCalls ||
    a.criticalFalseConfidenceCount - b.criticalFalseConfidenceCount ||
    a.candidateId.localeCompare(b.candidateId)
  );
}

/** Builds a `ProtocolV4DryRunCandidateChoice` from real, validated Development evidence -- never from
 * free-form input. Explicitly, structurally non-authoritative: `authoritative: false`,
 * `kind: 'fake_dry_run_only'`, a distinct schema version and hash from `CandidateSelectionRecord`. */
export function chooseProtocolV4DryRunCandidate(
  plan: ProtocolV4MasterPlan,
  evidence: ProtocolV4DevelopmentEvidence,
): ProtocolV4DryRunCandidateChoice {
  validateProtocolV4DevelopmentEvidence(plan, evidence);
  const developmentEvidenceRootHash = computeDevelopmentEvidenceRootHash(evidence);
  const evaluations = evidence.candidateEvaluationTable.content;
  const byId = Object.fromEntries(evaluations.map((e) => [e.candidateId, e])) as Record<
    ResolverV3047CandidateId,
    CandidateEvaluation
  >;
  const sorted = [...evaluations].sort(compareCandidatesForDryRunChoice);
  const candidateId = sorted[0].candidateId;
  const withoutHash: Omit<ProtocolV4DryRunCandidateChoice, 'choiceHash'> = {
    dryRunChoiceSchemaVersion: PROTOCOL_V4_DRY_RUN_CHOICE_SCHEMA_VERSION,
    kind: 'fake_dry_run_only',
    authoritative: false,
    masterPlanHash: plan.planHash,
    developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
    developmentEvidenceRootHash,
    selectionRuleVersion: SELECTION_RULE.version,
    evaluations: byId,
    candidateId,
    tieBreakTrace: SELECTION_RULE.orderedComparison,
  };
  return { ...withoutHash, choiceHash: hashProtocolV4(withoutHash) };
}

export function validateProtocolV4DryRunCandidateChoice(
  plan: ProtocolV4MasterPlan,
  choice: ProtocolV4DryRunCandidateChoice,
): void {
  const { choiceHash, ...body } = choice;
  if (hashProtocolV4(body) !== choiceHash)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_CHOICE_HASH_MISMATCH');
  if (choice.dryRunChoiceSchemaVersion !== PROTOCOL_V4_DRY_RUN_CHOICE_SCHEMA_VERSION)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_CHOICE_SCHEMA_MISMATCH');
  if (choice.kind !== 'fake_dry_run_only' || choice.authoritative !== false)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_CHOICE_NOT_NON_AUTHORITATIVE');
  if (
    choice.masterPlanHash !== plan.planHash ||
    choice.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_CHOICE_PLAN_MISMATCH');
}

export interface ProtocolV4DryRunHoldoutExecutionPlan {
  dryRunHoldoutPlanSchemaVersion: typeof PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_SCHEMA_VERSION;
  authoritative: false;
  masterPlanHash: string;
  developmentEvidenceRootHash: string;
  dryRunChoiceHash: string;
  candidateId: ResolverV3047CandidateId;
  candidateIdentity: CandidateIdentity;
  holdoutObservations: readonly ProtocolV4Observation[];
  holdoutExecutionTreeHash: string;
  holdoutCalls: number;
  holdoutMaxInputTokens: number;
  holdoutMaxOutputTokens: number;
  holdoutMaxTokens: number;
  holdoutMaxCostUsd: number;
  maxConcurrentRequests: 1;
  transportTimeoutMs: 15000;
  wallClockCeilingMs: 20000;
  dryRunHoldoutPlanHash: string;
}

export function deriveProtocolV4DryRunHoldoutExecutionPlan(
  plan: ProtocolV4MasterPlan,
  developmentEvidenceRootHash: string,
  choice: ProtocolV4DryRunCandidateChoice,
): ProtocolV4DryRunHoldoutExecutionPlan {
  validateProtocolV4DryRunCandidateChoice(plan, choice);
  if (choice.developmentEvidenceRootHash !== developmentEvidenceRootHash)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_EVIDENCE_ROOT_MISMATCH');
  const candidateIdentity = plan.candidates.find((c) => c.id === choice.candidateId);
  if (!candidateIdentity)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_UNKNOWN_CANDIDATE');
  const holdoutObservations: ProtocolV4Observation[] = plan.holdoutTemplate.observations.map(
    (o) => ({ ...o, candidateId: choice.candidateId }),
  );
  const holdoutExecutionTreeHash = hashProtocolV4({
    candidateIdentity,
    holdoutObservations,
    selectionRuleVersion: SELECTION_RULE.version,
    nonAuthoritativeDryRun: true,
  });
  const perCallTokens =
    PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS + PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS;
  const perCallCost =
    (PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS / 1e6) * plan.pricing.inputPerMillion +
    (PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS / 1e6) * plan.pricing.outputPerMillion;
  const holdoutCalls = holdoutObservations.length;
  const withoutHash: Omit<ProtocolV4DryRunHoldoutExecutionPlan, 'dryRunHoldoutPlanHash'> = {
    dryRunHoldoutPlanSchemaVersion: PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_SCHEMA_VERSION,
    authoritative: false,
    masterPlanHash: plan.planHash,
    developmentEvidenceRootHash,
    dryRunChoiceHash: choice.choiceHash,
    candidateId: choice.candidateId,
    candidateIdentity,
    holdoutObservations,
    holdoutExecutionTreeHash,
    holdoutCalls,
    holdoutMaxInputTokens: holdoutCalls * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    holdoutMaxOutputTokens: holdoutCalls * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    holdoutMaxTokens: holdoutCalls * perCallTokens,
    holdoutMaxCostUsd: holdoutCalls * perCallCost,
    maxConcurrentRequests: 1,
    transportTimeoutMs: 15000,
    wallClockCeilingMs: 20000,
  };
  return { ...withoutHash, dryRunHoldoutPlanHash: hashProtocolV4(withoutHash) };
}

export function validateProtocolV4DryRunHoldoutExecutionPlan(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan,
  developmentEvidenceRootHash: string,
  choice: ProtocolV4DryRunCandidateChoice,
): void {
  const { dryRunHoldoutPlanHash, ...body } = holdoutPlan;
  if (hashProtocolV4(body) !== dryRunHoldoutPlanHash)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_HASH_MISMATCH');
  if (holdoutPlan.masterPlanHash !== plan.planHash)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_MASTER_MISMATCH');
  if (holdoutPlan.developmentEvidenceRootHash !== developmentEvidenceRootHash)
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_EVIDENCE_ROOT_MISMATCH',
    );
  const rederived = deriveProtocolV4DryRunHoldoutExecutionPlan(
    plan,
    developmentEvidenceRootHash,
    choice,
  );
  if (rederived.dryRunHoldoutPlanHash !== dryRunHoldoutPlanHash)
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_PLAN_REDERIVATION_MISMATCH');
}

export interface ProtocolV4DryRunHoldoutAuthorization {
  dryRunAuthorizationSchemaVersion: typeof PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_SCHEMA_VERSION;
  kind: 'fake_dry_run_only';
  authoritative: false;
  masterPlanHash: string;
  dryRunHoldoutPlanHash: string;
  developmentEvidenceRootHash: string;
  dryRunChoiceHash: string;
  candidateId: ResolverV3047CandidateId;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  maxCostUsd: number;
  currency: 'USD';
  maxConcurrency: number;
  authorizedPhase: 'holdout';
  authorizationId: string;
  consumed: boolean;
}

export function buildProtocolV4DryRunHoldoutAuthorization(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan,
  choice: ProtocolV4DryRunCandidateChoice,
  authorizationId: string,
): ProtocolV4DryRunHoldoutAuthorization {
  return {
    dryRunAuthorizationSchemaVersion: PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_SCHEMA_VERSION,
    kind: 'fake_dry_run_only',
    authoritative: false,
    masterPlanHash: plan.planHash,
    dryRunHoldoutPlanHash: holdoutPlan.dryRunHoldoutPlanHash,
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    dryRunChoiceHash: choice.choiceHash,
    candidateId: holdoutPlan.candidateId,
    maxCalls: holdoutPlan.holdoutCalls,
    maxInputTokens: holdoutPlan.holdoutMaxInputTokens,
    maxOutputTokens: holdoutPlan.holdoutMaxOutputTokens,
    maxTotalTokens: holdoutPlan.holdoutMaxTokens,
    maxCostUsd: holdoutPlan.holdoutMaxCostUsd,
    currency: 'USD',
    maxConcurrency: holdoutPlan.maxConcurrentRequests,
    authorizedPhase: 'holdout',
    authorizationId,
    consumed: false,
  };
}

/** Gate for the non-authoritative dry-run Holdout path -- structurally cannot authorize live
 * execution: there is no `liveExecution`/`kind: 'human_live'` option anywhere in this type or this
 * function's signature at all, unlike `assertHoldoutAuthorized`. A `ProtocolV4DryRunCandidateChoice`
 * can therefore never be converted into a live-execution authorization through this path -- doing so
 * would require fabricating an entirely different, real `CandidateSelectionRecord`/
 * `HoldoutAuthorizationRecord` first, which itself requires genuinely eligible Development+Holdout
 * evidence per the strict `SELECTION_RULE`. */
export function assertProtocolV4DryRunHoldoutAuthorized(input: {
  plan: ProtocolV4MasterPlan;
  holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan;
  choice: ProtocolV4DryRunCandidateChoice;
  authorization: ProtocolV4DryRunHoldoutAuthorization;
  artifactStoreRoot: string;
  artifactRelativePath: string;
  consumedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  plannedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
}): void {
  const { plan, holdoutPlan, choice, authorization } = input;
  validateProtocolV4MasterPlan(plan);
  validateProtocolV4DryRunHoldoutExecutionPlan(
    plan,
    holdoutPlan,
    holdoutPlan.developmentEvidenceRootHash,
    choice,
  );
  if (
    authorization.dryRunAuthorizationSchemaVersion !==
    PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_SCHEMA_VERSION
  )
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_SCHEMA_MISMATCH',
    );
  if (authorization.kind !== 'fake_dry_run_only' || authorization.authoritative !== false)
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_NOT_NON_AUTHORITATIVE',
    );
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.dryRunHoldoutPlanHash !== holdoutPlan.dryRunHoldoutPlanHash ||
    authorization.developmentEvidenceRootHash !== holdoutPlan.developmentEvidenceRootHash ||
    authorization.dryRunChoiceHash !== choice.choiceHash ||
    authorization.candidateId !== holdoutPlan.candidateId
  )
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_IDENTITY_MISMATCH');
  if (authorization.authorizedPhase !== 'holdout')
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_PHASE_MISMATCH',
    );
  if (authorization.currency !== 'USD')
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_CURRENCY_MISMATCH',
    );
  if (
    authorization.consumed ||
    isProtocolV4AuthorizationConsumedAtomically(
      input.artifactStoreRoot,
      authorization.authorizationId,
    )
  )
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_ALREADY_CONSUMED',
    );
  if (!isProtocolV4ArtifactTargetUnused(input.artifactStoreRoot, input.artifactRelativePath))
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_ARTIFACT_TARGET_REUSED');
  if (
    authorization.maxCalls < holdoutPlan.holdoutCalls ||
    authorization.maxInputTokens < holdoutPlan.holdoutMaxInputTokens ||
    authorization.maxOutputTokens < holdoutPlan.holdoutMaxOutputTokens ||
    authorization.maxTotalTokens < holdoutPlan.holdoutMaxTokens ||
    authorization.maxCostUsd < holdoutPlan.holdoutMaxCostUsd
  )
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_LIMITS_INSUFFICIENT',
    );
  if (authorization.maxConcurrency !== holdoutPlan.maxConcurrentRequests)
    throw new ProtocolV4DryRunChoiceError(
      'PROTOCOL_V4_DRY_RUN_HOLDOUT_AUTHORIZATION_CONCURRENCY_MISMATCH',
    );
  const { consumedBudget: c, plannedBudget: p } = input;
  if (
    c.calls + p.calls > authorization.maxCalls ||
    c.inputTokens + p.inputTokens > authorization.maxInputTokens ||
    c.outputTokens + p.outputTokens > authorization.maxOutputTokens ||
    c.costUsd + p.costUsd > authorization.maxCostUsd
  )
    throw new ProtocolV4DryRunChoiceError('PROTOCOL_V4_DRY_RUN_HOLDOUT_BUDGET_INSUFFICIENT');
}
