import {
  hashProtocolV4,
  canonicalizeProtocolV4,
  validateProtocolV4DevelopmentEvidence,
  validateProtocolV4MasterPlan,
  computeDevelopmentEvidenceRootHash,
  PROTOCOL_V4_G2_GATES,
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
 * RESOLVER-V3-048 Phase-A closure, "Holdout Admission Gate" (explicit Development-to-Holdout
 * transition rule).
 *
 * The canonical `SELECTION_RULE`/`selectCandidateFromDevelopmentEvidence`
 * (`ResolverV3048ProtocolV4.ts`) requires `allMandatoryG2CriteriaPass` to be literally `true` --
 * which the real, pinned evaluator's joint gate combinator can never produce from Development-only
 * evidence, because several mandatory G2 gates are joint-only and structurally stay `not_evaluable`
 * until Holdout evidence for the same candidate also exists (see that file's extensive comments on
 * `isProtocolV4CandidateEligibleAtDevelopmentTime`/`recomputeEligibility`). That rule is correct and
 * must stay strict: it is the final, binding G2/production verdict, and weakening it to "make
 * Development alone work" would let a candidate reach production on an average or a partially-
 * evaluated gate set, which the repository's governance explicitly forbids
 * (`SELECTION_RULE.averagesMayMaskMandatoryGate: false`).
 *
 * That leaves a genuine, separate, non-fabricated question this module answers: given ONLY real,
 * validated Development evidence, which single candidate (if any) is admitted into a real, live,
 * `human_live` Holdout run at all? The existing `ProtocolV4DryRunCandidateChoice`
 * (`ResolverV3048ProtocolV4DryRunChoice.ts`) is NOT that answer -- it is explicitly
 * `kind: 'fake_dry_run_only'`/`authoritative: false` and structurally cannot ever produce a
 * `liveExecution`/`human_live` authorization (see that module's `assertProtocolV4DryRunHoldoutAuthorized`
 * docstring). Before this module, there was therefore no legal path from genuine live Development
 * evidence to a real Holdout dispatch at all -- `selectCandidate` always throws
 * `PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE` pre-Holdout, and the Dry-Run Choice path can never authorize
 * live execution. `ProtocolV4HoldoutAdmissionRecord` is a third, parallel, honestly-named contract
 * that closes exactly that gap:
 *
 * - it is real (built only from genuine, artifact-validated `ProtocolV4DevelopmentEvidence`, never a
 *   fake/zero-network stand-in) and CAN legally back a `human_live` Holdout authorization/execution
 *   lease -- unlike the Dry-Run Choice path;
 * - it is explicitly NOT a final production decision and NOT a claim that G2 has passed:
 *   `g2Passed: false` and `productionAuthorized: false` are literal, type-pinned fields on every
 *   record and every derived plan/authorization, and every validator fails closed if either is ever
 *   anything else;
 * - admission requires zero critical false-confidence cases, complete contracts/telemetry (both
 *   already enforced structurally by `validateProtocolV4DevelopmentEvidence`), and no mandatory G2
 *   gate having already read an explicit `failed` verdict from the real Development-only data that
 *   DOES exist -- `not_evaluable`/`requires_human_judgment` joint-only gates are expected and do not
 *   disqualify a candidate here, since disqualifying on them would make admission structurally
 *   impossible for exactly the same reason `selectCandidate` is structurally impossible pre-Holdout;
 * - ranking among admissible candidates uses a separate, pre-frozen, hashed rule
 *   (`HOLDOUT_ADMISSION_RULE`) with its own version, independent of `SELECTION_RULE`;
 * - admission additionally requires an explicit, structurally-mandatory human review record (a
 *   non-empty reviewer reference and a literal `approved: true`) -- unlike the Dry-Run Choice path,
 *   which is fully automatic because it can never reach live execution;
 * - admission selects exactly one candidate.
 *
 * The real, binding G2 pass/fail decision remains exclusively `deriveProtocolV4FinalG2Report`'s job,
 * once genuine Development AND Holdout evidence for the admitted candidate both exist
 * (`ResolverV3048ProtocolV4Evaluation.ts`). Nothing in this module can produce, substitute for, or be
 * mistaken for that report.
 */

export class ProtocolV4HoldoutAdmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4HoldoutAdmissionError';
  }
}

export const PROTOCOL_V4_HOLDOUT_ADMISSION_SCHEMA_VERSION = 'resolver-v3-048-holdout-admission-v1';
export const PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_SCHEMA_VERSION =
  'resolver-v3-048-holdout-admission-plan-v1';
export const PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_VERSION =
  'resolver-v3-048-holdout-admission-authorization-v1';

/** Separate, pre-frozen, hashed Development-to-Holdout transition rule -- never conflated with the
 * final `SELECTION_RULE`. Same ordered-comparison/tie-break field order as `SELECTION_RULE` for
 * methodological consistency (a single, already-reviewed ranking methodology), but independently
 * versioned and independently hashed, so a future change to either rule can never silently affect
 * the other. */
export const HOLDOUT_ADMISSION_RULE = {
  version: 'resolver-v3-048-holdout-admission-rule-v1',
  purpose: 'development_to_holdout_transition_only',
  admissionCriteria: [
    'zero_critical_false_confidence',
    'contracts_and_telemetry_complete',
    'no_mandatory_g2_gate_explicitly_failed',
  ] as const,
  orderedComparison: [
    'identification_and_complex_component_quality',
    'clarification_and_abstention',
    'repeat_consistency',
    'cost_per_successful_validated_log',
    'p50_then_p95',
    'failure_rate',
    'ai_then_source_call_counts',
  ] as const,
  direction: [
    'existing_g2_contract',
    'existing_g2_contract',
    'existing_g2_contract',
    'lower',
    'lower',
    'lower',
    'lower',
  ] as const,
  tieBreakers: [
    'lower_critical_failure_count',
    'higher_complex_component_quality',
    'higher_identification_quality',
    'lower_validated_log_cost',
    'lower_p95',
    'lower_p50',
    'lower_candidate_id_lexicographic',
  ] as const,
  requiresHumanReview: true,
  admitsExactlyOneCandidate: true,
  isFinalProductionDecision: false,
  claimsG2Passed: false,
} as const;

/** Admission-time screen -- deliberately distinct from
 * `isProtocolV4CandidateEligibleAtDevelopmentTime` (`ResolverV3048ProtocolV4.ts`), which requires the
 * literal `allMandatoryG2CriteriaPass` boolean the real evaluator can never set `true` pre-Holdout.
 * This screen instead requires that no mandatory gate has already read an explicit `failed` verdict
 * from real Development-only evidence -- `not_evaluable`/`requires_human_judgment` are expected and
 * admissible, `failed` is not. */
export function isProtocolV4CandidateAdmissibleForHoldout(e: CandidateEvaluation): boolean {
  return (
    e.criticalFalseConfidenceCount === 0 &&
    e.contractsComplete &&
    PROTOCOL_V4_G2_GATES.every((gate) => e.g2Results[gate] !== 'failed')
  );
}

/** Same field order as `SELECTION_RULE.orderedComparison`/`selectCandidate`'s own comparator, reused
 * for methodological consistency -- deliberately applied only AFTER the admission screen above, never
 * used to rank an inadmissible candidate above an admissible one. */
function compareCandidatesForHoldoutAdmission(
  a: CandidateEvaluation,
  b: CandidateEvaluation,
): number {
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

/** Mandatory human review evidence for a Holdout Admission decision -- structurally required
 * (`approved` is typed as the literal `true`, not `boolean`; `reviewerReference` is runtime-checked
 * non-empty below), unlike the fully-automatic, never-live Dry-Run Choice path. */
export interface ProtocolV4HoldoutAdmissionHumanReview {
  reviewerReference: string;
  approved: true;
  reviewedAt: string;
  notes: string | null;
}

export interface ProtocolV4HoldoutAdmissionRecord {
  holdoutAdmissionSchemaVersion: typeof PROTOCOL_V4_HOLDOUT_ADMISSION_SCHEMA_VERSION;
  kind: 'holdout_admission';
  /** Real, artifact-validated Development evidence backs this record -- unlike
   * `ProtocolV4DryRunCandidateChoice.authoritative === false`, this decision genuinely governs which
   * candidate a real Holdout run may dispatch for. It is authoritative for THAT narrow purpose only:
   * `g2Passed`/`productionAuthorized` below make explicit what it is NOT authoritative for. */
  authoritative: true;
  g2Passed: false;
  productionAuthorized: false;
  masterPlanHash: string;
  developmentExecutionTreeHash: string;
  developmentEvidenceRootHash: string;
  admissionRuleVersion: string;
  admissionRuleHash: string;
  evaluations: Readonly<Record<ResolverV3047CandidateId, CandidateEvaluation>>;
  admissible: Readonly<Record<ResolverV3047CandidateId, boolean>>;
  candidateId: ResolverV3047CandidateId;
  tieBreakTrace: readonly string[];
  humanReview: ProtocolV4HoldoutAdmissionHumanReview;
  admissionRecordHash: string;
}

function recomputeAdmissibility(
  evaluations: Readonly<Record<ResolverV3047CandidateId, CandidateEvaluation>>,
): Record<ResolverV3047CandidateId, boolean> {
  return Object.fromEntries(
    (['H0', 'H1', 'H2'] as const).map((id) => {
      const e = evaluations[id];
      return [id, !!e && isProtocolV4CandidateAdmissibleForHoldout(e)];
    }),
  ) as Record<ResolverV3047CandidateId, boolean>;
}

function assertValidHumanReview(humanReview: ProtocolV4HoldoutAdmissionHumanReview): void {
  if (!humanReview.reviewerReference || !humanReview.reviewerReference.trim())
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_REVIEWER_REQUIRED');
  if (humanReview.approved !== true)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_NOT_APPROVED');
  if (!humanReview.reviewedAt || Number.isNaN(Date.parse(humanReview.reviewedAt)))
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_REVIEWED_AT_INVALID');
}

/** The single supported entry point for admitting exactly one candidate into a real, live Holdout
 * run from real Development evidence. Requires all three candidates' full, artifact-validated
 * Development evidence (never freely-constructed evaluations) and an explicit, valid human review.
 * Throws `PROTOCOL_V4_NO_HOLDOUT_ADMISSION_CANDIDATE` if no candidate is admissible -- this is the
 * honest result whenever every candidate has an explicit `failed` mandatory gate or a critical
 * false-confidence case; it never falls back to picking an inadmissible candidate. */
export function admitCandidateForHoldout(
  plan: ProtocolV4MasterPlan,
  evidence: ProtocolV4DevelopmentEvidence,
  humanReview: ProtocolV4HoldoutAdmissionHumanReview,
): ProtocolV4HoldoutAdmissionRecord {
  assertValidHumanReview(humanReview);
  validateProtocolV4DevelopmentEvidence(plan, evidence);
  const developmentEvidenceRootHash = computeDevelopmentEvidenceRootHash(evidence);
  const evaluations = evidence.candidateEvaluationTable.content;
  const byId = Object.fromEntries(evaluations.map((e) => [e.candidateId, e])) as Record<
    ResolverV3047CandidateId,
    CandidateEvaluation
  >;
  const admissible = recomputeAdmissibility(byId);
  const admissibleEvaluations = evaluations.filter((e) => admissible[e.candidateId]);
  if (!admissibleEvaluations.length)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_NO_HOLDOUT_ADMISSION_CANDIDATE');
  const sorted = [...admissibleEvaluations].sort(compareCandidatesForHoldoutAdmission);
  const candidateId = sorted[0].candidateId;

  const withoutHash: Omit<ProtocolV4HoldoutAdmissionRecord, 'admissionRecordHash'> = {
    holdoutAdmissionSchemaVersion: PROTOCOL_V4_HOLDOUT_ADMISSION_SCHEMA_VERSION,
    kind: 'holdout_admission',
    authoritative: true,
    g2Passed: false,
    productionAuthorized: false,
    masterPlanHash: plan.planHash,
    developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
    developmentEvidenceRootHash,
    admissionRuleVersion: HOLDOUT_ADMISSION_RULE.version,
    admissionRuleHash: hashProtocolV4(HOLDOUT_ADMISSION_RULE),
    evaluations: byId,
    admissible,
    candidateId,
    tieBreakTrace: HOLDOUT_ADMISSION_RULE.orderedComparison,
    humanReview,
  };
  return { ...withoutHash, admissionRecordHash: hashProtocolV4(withoutHash) };
}

/** Rejects a record unless every self-proving claim is independently recomputable from its own
 * stored evaluations -- a semantically manipulated-but-rehashed record (e.g. a different winner, a
 * `g2Passed`/`productionAuthorized` flipped to `true`, or admissibility that doesn't match the stored
 * evaluations) is still rejected, matching `validateCandidateSelectionRecord`'s own contract. */
export function validateProtocolV4HoldoutAdmissionRecord(
  plan: ProtocolV4MasterPlan,
  record: ProtocolV4HoldoutAdmissionRecord,
): void {
  const { admissionRecordHash, ...body } = record;
  if (hashProtocolV4(body) !== admissionRecordHash)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_HASH_MISMATCH');
  if (record.holdoutAdmissionSchemaVersion !== PROTOCOL_V4_HOLDOUT_ADMISSION_SCHEMA_VERSION)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_SCHEMA_MISMATCH');
  if (record.kind !== 'holdout_admission' || record.authoritative !== true)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_KIND_MISMATCH');
  if (record.g2Passed !== false || record.productionAuthorized !== false)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_MUST_NOT_CLAIM_PRODUCTION_DECISION',
    );
  if (
    record.masterPlanHash !== plan.planHash ||
    record.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_MISMATCH');
  if (record.admissionRuleVersion !== HOLDOUT_ADMISSION_RULE.version)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_RULE_VERSION_MISMATCH',
    );
  if (record.admissionRuleHash !== hashProtocolV4(HOLDOUT_ADMISSION_RULE))
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_RULE_HASH_MISMATCH');
  assertValidHumanReview(record.humanReview);

  const ids = (['H0', 'H1', 'H2'] as const).filter((id) => id in record.evaluations);
  if (ids.length !== 3)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_EVALUATIONS_INCOMPLETE',
    );
  ids.forEach((id) => {
    if (record.evaluations[id].candidateId !== id)
      throw new ProtocolV4HoldoutAdmissionError(
        'PROTOCOL_V4_HOLDOUT_ADMISSION_EVALUATION_CANDIDATE_MISMATCH',
      );
  });
  const recomputedAdmissible = recomputeAdmissibility(record.evaluations);
  for (const id of ids)
    if (record.admissible[id] !== recomputedAdmissible[id])
      throw new ProtocolV4HoldoutAdmissionError(
        `PROTOCOL_V4_HOLDOUT_ADMISSION_ADMISSIBILITY_MISMATCH:${id}`,
      );
  if (!record.admissible[record.candidateId])
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_CANDIDATE_NOT_ADMISSIBLE',
    );
  const recomputedWinner = [...ids.map((id) => record.evaluations[id])]
    .filter((e) => record.admissible[e.candidateId])
    .sort(compareCandidatesForHoldoutAdmission)[0]?.candidateId;
  if (recomputedWinner !== record.candidateId)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_WINNER_MISMATCH');
}

/** Strengthens `validateProtocolV4HoldoutAdmissionRecord` by additionally requiring
 * `developmentEvidenceRootHash` and every stored per-candidate evaluation to be re-derived, byte-
 * identical (canonical), from the real underlying `ProtocolV4DevelopmentEvidence` -- not merely
 * self-consistent with the record's own stored fields. Mirrors
 * `validateCandidateSelectionRecordAgainstEvidence`'s stronger evidence-binding contract. */
export function validateProtocolV4HoldoutAdmissionRecordAgainstEvidence(
  plan: ProtocolV4MasterPlan,
  record: ProtocolV4HoldoutAdmissionRecord,
  evidence: ProtocolV4DevelopmentEvidence,
): void {
  validateProtocolV4HoldoutAdmissionRecord(plan, record);
  validateProtocolV4DevelopmentEvidence(plan, evidence);
  const recomputedEvidenceRootHash = computeDevelopmentEvidenceRootHash(evidence);
  if (record.developmentEvidenceRootHash !== recomputedEvidenceRootHash)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_EVIDENCE_ROOT_NOT_DERIVED',
    );
  const byId = Object.fromEntries(evidence.candidates.map((c) => [c.candidateId, c])) as Record<
    ResolverV3047CandidateId,
    (typeof evidence.candidates)[number]
  >;
  for (const id of ['H0', 'H1', 'H2'] as const) {
    const c = byId[id];
    if (!c)
      throw new ProtocolV4HoldoutAdmissionError(
        `PROTOCOL_V4_HOLDOUT_ADMISSION_EVIDENCE_CANDIDATE_MISSING:${id}`,
      );
    if (
      canonicalizeProtocolV4(record.evaluations[id]) !==
      canonicalizeProtocolV4(c.evaluation.content)
    )
      throw new ProtocolV4HoldoutAdmissionError(
        `PROTOCOL_V4_HOLDOUT_ADMISSION_EVALUATION_NOT_BOUND_TO_EVIDENCE:${id}`,
      );
  }
}

// -------------------------------------------------------------------------------------------------
// Holdout Execution Plan derived from an Admission Record -- real (can legally back live execution),
// structurally distinct from both `HoldoutExecutionPlan` (SELECTION_RULE-bound, currently
// unreachable pre-Holdout) and `ProtocolV4DryRunHoldoutExecutionPlan` (never live).
// -------------------------------------------------------------------------------------------------

export interface ProtocolV4HoldoutAdmissionExecutionPlan {
  holdoutAdmissionPlanSchemaVersion: typeof PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_SCHEMA_VERSION;
  g2Passed: false;
  productionAuthorized: false;
  masterPlanHash: string;
  developmentEvidenceRootHash: string;
  holdoutAdmissionRecordHash: string;
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
  holdoutAdmissionPlanHash: string;
}

export function deriveProtocolV4HoldoutAdmissionExecutionPlan(
  plan: ProtocolV4MasterPlan,
  developmentEvidenceRootHash: string,
  record: ProtocolV4HoldoutAdmissionRecord,
): ProtocolV4HoldoutAdmissionExecutionPlan {
  validateProtocolV4HoldoutAdmissionRecord(plan, record);
  if (record.developmentEvidenceRootHash !== developmentEvidenceRootHash)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_EVIDENCE_ROOT_MISMATCH',
    );
  const candidateIdentity = plan.candidates.find((c) => c.id === record.candidateId);
  if (!candidateIdentity)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_UNKNOWN_CANDIDATE',
    );
  const holdoutObservations: ProtocolV4Observation[] = plan.holdoutTemplate.observations.map(
    (o) => ({
      ...o,
      candidateId: record.candidateId,
    }),
  );
  const holdoutExecutionTreeHash = hashProtocolV4({
    candidateIdentity,
    holdoutObservations,
    admissionRuleVersion: HOLDOUT_ADMISSION_RULE.version,
    liveAdmission: true,
  });
  const perCallTokens =
    PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS + PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS;
  const perCallCost =
    (PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS / 1e6) * plan.pricing.inputPerMillion +
    (PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS / 1e6) * plan.pricing.outputPerMillion;
  const holdoutCalls = holdoutObservations.length;
  const withoutHash: Omit<ProtocolV4HoldoutAdmissionExecutionPlan, 'holdoutAdmissionPlanHash'> = {
    holdoutAdmissionPlanSchemaVersion: PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_SCHEMA_VERSION,
    g2Passed: false,
    productionAuthorized: false,
    masterPlanHash: plan.planHash,
    developmentEvidenceRootHash,
    holdoutAdmissionRecordHash: record.admissionRecordHash,
    candidateId: record.candidateId,
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
  return { ...withoutHash, holdoutAdmissionPlanHash: hashProtocolV4(withoutHash) };
}

export function validateProtocolV4HoldoutAdmissionExecutionPlan(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ProtocolV4HoldoutAdmissionExecutionPlan,
  developmentEvidenceRootHash: string,
  record: ProtocolV4HoldoutAdmissionRecord,
): void {
  const { holdoutAdmissionPlanHash, ...body } = holdoutPlan;
  if (hashProtocolV4(body) !== holdoutAdmissionPlanHash)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_HASH_MISMATCH');
  if (holdoutPlan.g2Passed !== false || holdoutPlan.productionAuthorized !== false)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_MUST_NOT_CLAIM_PRODUCTION_DECISION',
    );
  if (holdoutPlan.masterPlanHash !== plan.planHash)
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_MASTER_MISMATCH');
  if (holdoutPlan.developmentEvidenceRootHash !== developmentEvidenceRootHash)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_EVIDENCE_ROOT_MISMATCH_VALIDATE',
    );
  const rederived = deriveProtocolV4HoldoutAdmissionExecutionPlan(
    plan,
    developmentEvidenceRootHash,
    record,
  );
  if (rederived.holdoutAdmissionPlanHash !== holdoutAdmissionPlanHash)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_PLAN_REDERIVATION_MISMATCH',
    );
}

// -------------------------------------------------------------------------------------------------
// Authorization gate for the Admission-derived plan -- the only path by which a genuine, real
// `human_live` Holdout execution/lease can legally be authorized before this task's separate,
// explicit human budget authorization exists. Reuses the execution lease's existing
// `authorizationKind: 'human_live'` literal (`ResolverV3048ProtocolV4ExecutionLease.ts`) so no
// change to that already-reviewed module is required; `g2Passed`/`productionAuthorized` stay
// literal `false` throughout and are re-verified by every check below.
// -------------------------------------------------------------------------------------------------

export interface ProtocolV4HoldoutAdmissionAuthorization {
  holdoutAdmissionAuthorizationSchemaVersion: typeof PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_VERSION;
  kind: 'human_live';
  g2Passed: false;
  productionAuthorized: false;
  masterPlanHash: string;
  holdoutAdmissionPlanHash: string;
  developmentEvidenceRootHash: string;
  holdoutAdmissionRecordHash: string;
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
  /** Non-optional (unlike `HoldoutAuthorizationRecord.humanApprovalReference`, which is nullable for
   * a `fake_dry_run` authorization): every Admission Authorization is inherently a live-execution
   * authorization, so a human approval reference is always mandatory, never conditional. */
  humanApprovalReference: string;
  consumed: boolean;
}

export function buildProtocolV4HoldoutAdmissionAuthorization(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ProtocolV4HoldoutAdmissionExecutionPlan,
  record: ProtocolV4HoldoutAdmissionRecord,
  authorizationId: string,
  humanApprovalReference: string,
): ProtocolV4HoldoutAdmissionAuthorization {
  return {
    holdoutAdmissionAuthorizationSchemaVersion:
      PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_VERSION,
    kind: 'human_live',
    g2Passed: false,
    productionAuthorized: false,
    masterPlanHash: plan.planHash,
    holdoutAdmissionPlanHash: holdoutPlan.holdoutAdmissionPlanHash,
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    holdoutAdmissionRecordHash: record.admissionRecordHash,
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
    humanApprovalReference,
    consumed: false,
  };
}

/** Gate for the real, Admission-derived Holdout path. Requires the same storage-authoritative
 * consumed/artifact-target/budget checks as `assertHoldoutAuthorized`, plus an explicit,
 * non-optional human approval reference and a hard re-check that neither the plan nor the
 * authorization ever claims `g2Passed`/`productionAuthorized`. */
export function assertProtocolV4HoldoutAdmissionAuthorized(input: {
  plan: ProtocolV4MasterPlan;
  holdoutPlan: ProtocolV4HoldoutAdmissionExecutionPlan;
  record: ProtocolV4HoldoutAdmissionRecord;
  authorization: ProtocolV4HoldoutAdmissionAuthorization;
  artifactStoreRoot: string;
  artifactRelativePath: string;
  consumedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  plannedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  /** The maximum a human has actually, separately approved for this live Holdout run -- authorization
   * limits may never exceed this ceiling even if the plan/budget would technically allow more. */
  humanApprovedCeiling: { maxCalls: number; maxTotalTokens: number; maxCostUsd: number };
}): void {
  const { plan, holdoutPlan, record, authorization } = input;
  validateProtocolV4MasterPlan(plan);
  validateProtocolV4HoldoutAdmissionExecutionPlan(
    plan,
    holdoutPlan,
    holdoutPlan.developmentEvidenceRootHash,
    record,
  );
  if (
    authorization.holdoutAdmissionAuthorizationSchemaVersion !==
    PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_VERSION
  )
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_MISMATCH',
    );
  if (authorization.kind !== 'human_live')
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_KIND_MISMATCH',
    );
  if (authorization.g2Passed !== false || authorization.productionAuthorized !== false)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_MUST_NOT_CLAIM_PRODUCTION_DECISION',
    );
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.holdoutAdmissionPlanHash !== holdoutPlan.holdoutAdmissionPlanHash ||
    authorization.developmentEvidenceRootHash !== holdoutPlan.developmentEvidenceRootHash ||
    authorization.holdoutAdmissionRecordHash !== record.admissionRecordHash ||
    authorization.candidateId !== holdoutPlan.candidateId
  )
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_IDENTITY_MISMATCH',
    );
  if (authorization.authorizedPhase !== 'holdout')
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_PHASE_MISMATCH',
    );
  if (authorization.currency !== 'USD')
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_CURRENCY_MISMATCH',
    );
  if (!authorization.humanApprovalReference || !authorization.humanApprovalReference.trim())
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_HUMAN_APPROVAL_REFERENCE_REQUIRED',
    );
  if (
    authorization.consumed ||
    isProtocolV4AuthorizationConsumedAtomically(
      input.artifactStoreRoot,
      authorization.authorizationId,
    )
  )
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_ALREADY_CONSUMED',
    );
  if (!isProtocolV4ArtifactTargetUnused(input.artifactStoreRoot, input.artifactRelativePath))
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_ARTIFACT_TARGET_REUSED',
    );
  if (
    authorization.maxCalls < holdoutPlan.holdoutCalls ||
    authorization.maxInputTokens < holdoutPlan.holdoutMaxInputTokens ||
    authorization.maxOutputTokens < holdoutPlan.holdoutMaxOutputTokens ||
    authorization.maxTotalTokens < holdoutPlan.holdoutMaxTokens ||
    authorization.maxCostUsd < holdoutPlan.holdoutMaxCostUsd
  )
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_LIMITS_INSUFFICIENT',
    );
  if (authorization.maxConcurrency !== holdoutPlan.maxConcurrentRequests)
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_CONCURRENCY_MISMATCH',
    );
  if (
    authorization.maxCalls > input.humanApprovedCeiling.maxCalls ||
    authorization.maxTotalTokens > input.humanApprovedCeiling.maxTotalTokens ||
    authorization.maxCostUsd > input.humanApprovedCeiling.maxCostUsd
  )
    throw new ProtocolV4HoldoutAdmissionError(
      'PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_EXCEEDS_HUMAN_CEILING',
    );
  const { consumedBudget: c, plannedBudget: p } = input;
  if (
    c.calls + p.calls > authorization.maxCalls ||
    c.inputTokens + p.inputTokens > authorization.maxInputTokens ||
    c.outputTokens + p.outputTokens > authorization.maxOutputTokens ||
    c.costUsd + p.costUsd > authorization.maxCostUsd
  )
    throw new ProtocolV4HoldoutAdmissionError('PROTOCOL_V4_HOLDOUT_ADMISSION_BUDGET_INSUFFICIENT');
}
