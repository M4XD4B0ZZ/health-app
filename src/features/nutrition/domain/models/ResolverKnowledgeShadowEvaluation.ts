import type { ResolverStatus } from './ResolverDecision';
import type {
  ResolverKnowledgeCandidatePayload,
  ResolverKnowledgeCandidateType,
} from './ResolverKnowledgeCandidate';
import type { ResolverProductionDecisionProjectionV1 } from './ResolverProductionDecisionProjection';
import type { ResolverKnowledgeShadowGroundTruth } from './ResolverKnowledgeShadowGroundTruth';

/**
 * RESOLVER-V3-029 corrected contract. `resolver-knowledge-shadow-evaluation-v1` (RESOLVER-V3-022) is
 * a **historical, defective boundary**: its `productionDecision` field carried the full
 * `ResolverDecision` (normalized query, complete candidates, source data) into every shadow request
 * and result, and its privacy check only inspected top-level candidate/payload keys. `v1` requests are
 * never reinterpreted as `v2` — the evaluator fails closed on any version other than the exact current
 * one. See `docs/domains/ZERA_RESOLVER_KNOWLEDGE_SHADOW_MODE_CONTRACT_1.md` §"V1 defect and V2
 * correction".
 */
export const RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION_V1 =
  'resolver-knowledge-shadow-evaluation-v1' as const;
export const RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION =
  'resolver-knowledge-shadow-evaluation-v2' as const;

export type ResolverKnowledgeShadowCorpusPartition = 'development' | 'holdout';

export const RESOLVER_KNOWLEDGE_SHADOW_INPUT_TYPES = ['generic', 'branded', 'ambiguous'] as const;
export type ResolverKnowledgeShadowInputType =
  (typeof RESOLVER_KNOWLEDGE_SHADOW_INPUT_TYPES)[number];

export type ResolverKnowledgeShadowDeltaCategory =
  | 'no_change'
  | 'hypothetical_source_change'
  | 'hypothetical_abstention'
  | 'hypothetical_clarification'
  | 'hypothetical_provenance_warning'
  | 'blocked_locale'
  | 'not_evaluable'
  | 'invalid_candidate'
  | 'privacy_blocked';
export type ResolverKnowledgeShadowRisk = 'none' | 'low' | 'medium' | 'high';

/** Deliberately contains no raw input, owner, observation, run, or source identifier. */
export interface ResolverKnowledgeShadowCandidateSnapshot {
  candidateId: string;
  fingerprint: string;
  candidateType: ResolverKnowledgeCandidateType | string;
  candidateVersion: string;
  payload: ResolverKnowledgeCandidatePayload | Record<string, unknown>;
}

/**
 * The full production `ResolverDecision` MUST NOT appear anywhere in this type — only the closed,
 * privacy-safe `ResolverProductionDecisionProjectionV1` produced by
 * `projectResolverDecisionForShadowEvaluation` may cross this boundary.
 */
export interface ResolverKnowledgeShadowEvaluationRequest {
  evaluationVersion: typeof RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION;
  caseId: string;
  locale: 'de' | 'en';
  inputType: ResolverKnowledgeShadowInputType;
  productionDecisionProjection: ResolverProductionDecisionProjectionV1;
  candidate: ResolverKnowledgeShadowCandidateSnapshot;
  resolverVersion: string;
  corpusPartition: ResolverKnowledgeShadowCorpusPartition;
  groundTruth: ResolverKnowledgeShadowGroundTruth;
}

export interface ResolverKnowledgeShadowDelta {
  category: ResolverKnowledgeShadowDeltaCategory;
  candidateId: string;
  candidateFingerprint: string;
  reasonCodes: readonly string[];
  risk: ResolverKnowledgeShadowRisk;
}

/** As with the request, only the closed production-decision projection may appear here. */
export interface ResolverKnowledgeShadowEvaluationResult {
  evaluationVersion: typeof RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION;
  caseId: string;
  registryVersion: string;
  corpusPartition: ResolverKnowledgeShadowCorpusPartition;
  productionDecisionProjection: ResolverProductionDecisionProjectionV1;
  hypotheticalShadowStatus: ResolverStatus;
  delta: ResolverKnowledgeShadowDelta;
  groundTruth: ResolverKnowledgeShadowGroundTruth;
}

export const RESOLVER_KNOWLEDGE_SHADOW_METRIC_REASON_CODES = [
  'NO_USABLE_GROUND_TRUTH_CASES',
  'NO_HYPOTHETICAL_ABSTENTIONS',
  'NO_ELIGIBLE_CLARIFICATION_CASES',
] as const;
export type ResolverKnowledgeShadowMetricReasonCode =
  (typeof RESOLVER_KNOWLEDGE_SHADOW_METRIC_REASON_CODES)[number];

export type ResolverKnowledgeShadowMetricEvidenceClass =
  | 'measured'
  | 'fixture-derived'
  | 'unknown'
  | 'not_evaluable';

/**
 * A count directly observed from the supplied shadow results for this deterministic run. `measured`
 * here means measured within this shadow evaluation run — never production telemetry.
 */
export interface ResolverKnowledgeShadowCountMetric {
  value: number;
  evidenceClass: 'measured';
}

/**
 * A rate/derived metric that may be unavailable. `value`/`numerator`/`denominator` are `null` exactly
 * when the metric cannot be computed for this corpus; a closed `reasonCode` explains why. Never uses
 * `0` to mean "unknown".
 */
export interface ResolverKnowledgeShadowRateMetric {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  evidenceClass: ResolverKnowledgeShadowMetricEvidenceClass;
  reasonCode: ResolverKnowledgeShadowMetricReasonCode | null;
}

export interface ResolverKnowledgeShadowMetrics {
  registryVersion: string;
  evaluatedCaseCount: ResolverKnowledgeShadowCountMetric;
  evaluableCaseCount: ResolverKnowledgeShadowCountMetric;
  noChangeCount: ResolverKnowledgeShadowCountMetric;
  changedDecisionCount: ResolverKnowledgeShadowCountMetric;
  abstentionDeltaCount: ResolverKnowledgeShadowCountMetric;
  clarificationDeltaCount: ResolverKnowledgeShadowCountMetric;
  sourceRoutingDeltaCount: ResolverKnowledgeShadowCountMetric;
  provenanceGapCount: ResolverKnowledgeShadowCountMetric;
  localeBlockedCount: ResolverKnowledgeShadowCountMetric;
  privacyBlockedCount: ResolverKnowledgeShadowCountMetric;
  invalidCandidateCount: ResolverKnowledgeShadowCountMetric;
  notEvaluableCount: ResolverKnowledgeShadowCountMetric;
  usableGroundTruthCaseCount: ResolverKnowledgeShadowCountMetric;
  /**
   * "Accuracy" here means hypothetical-status agreement with fixture-expected status, computed only
   * over cases with usable ground truth — it is NOT proof of correct food identity.
   */
  identificationAccuracy: ResolverKnowledgeShadowRateMetric;
  abstentionPrecision: ResolverKnowledgeShadowRateMetric;
  clarificationRate: ResolverKnowledgeShadowRateMetric;
  falseConfidenceRegressionCount: ResolverKnowledgeShadowRateMetric;
  falseConfidenceImprovementCount: ResolverKnowledgeShadowRateMetric;
  regressionCount: ResolverKnowledgeShadowRateMetric;
}
