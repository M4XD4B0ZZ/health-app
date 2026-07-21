import type { ResolverDecision, ResolverStatus } from './ResolverDecision';

/**
 * Privacy-safe projection of a full production `ResolverDecision` (RESOLVER-V3-029). The full
 * decision may exist only on the *input* side of `projectResolverDecisionForShadowEvaluation`; the
 * projection it produces is the only representation of production behaviour allowed to cross into
 * the shadow evaluation request/result/metrics/registry boundary.
 */
export const RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION =
  'resolver-production-decision-projection-v1' as const;

/**
 * Closed, non-personal machine reason codes actually observed on `ResolverDecision.reasonCodes`
 * across the resolver/fusion call sites (`ResolverDecisionPolicy`, `SequentialFoodCatalogResolver`,
 * `FusionCandidateResolver`, `FusionResolverAdapter`). Any reason code not in this list is mapped to
 * `UNCLASSIFIED_REASON_CODE` by the projection rather than passed through as free text — new resolver
 * reason codes must be added here explicitly before they can appear in a shadow projection.
 */
export const RESOLVER_PRODUCTION_DECISION_SAFE_REASON_CODES = [
  'NO_CANDIDATES',
  'NO_CANDIDATES_FOUND',
  'ACCEPTED_STRONG_MATCH',
  'ACCEPTED',
  'ACCEPTED_WITH_ASSUMPTION',
  'MULTIPLE_CLOSE_MATCHES',
  'LOW_SCORE',
  'LOW_CONFIDENCE_MATCHES',
  'CONFLICTING_HIGH_SCORES',
  'BLS_GENERIC_TRUTH',
  'USER_SOURCE_PRIORITY',
  'NEGATIVE_CACHE_HIT',
  'FUSION_ERROR',
  'ADAPTER_ERROR',
  'UNCLASSIFIED_REASON_CODE',
] as const;
export type ResolverProductionDecisionSafeReasonCode =
  (typeof RESOLVER_PRODUCTION_DECISION_SAFE_REASON_CODES)[number];

/** Closed source-type classification, deliberately without any source or candidate identifier. */
export const RESOLVER_PRODUCTION_DECISION_SOURCE_TYPES = [
  'bls',
  'off',
  'usda',
  'user',
  'ai',
  'none',
] as const;
export type ResolverProductionDecisionSourceType =
  (typeof RESOLVER_PRODUCTION_DECISION_SOURCE_TYPES)[number];

/**
 * Closed provenance classification derived only from the selected candidate's own closed
 * `source` classification (never from arbitrary food-payload fields). `not_evaluable` is used
 * whenever the decision has no selected candidate to classify, rather than guessing.
 */
export const RESOLVER_PRODUCTION_DECISION_PROVENANCE_CLASSIFICATIONS = [
  'source_grounded',
  'ai_suggested',
  'not_evaluable',
] as const;
export type ResolverProductionDecisionProvenanceClassification =
  (typeof RESOLVER_PRODUCTION_DECISION_PROVENANCE_CLASSIFICATIONS)[number];

export const RESOLVER_PRODUCTION_DECISION_INPUT_CONFIDENCE_LEVELS = [
  'high',
  'medium',
  'low',
  'unknown',
] as const;
export type ResolverProductionDecisionInputConfidenceLevel =
  (typeof RESOLVER_PRODUCTION_DECISION_INPUT_CONFIDENCE_LEVELS)[number];

/**
 * The only representation of a production decision permitted in the shadow evaluation contract.
 * Deliberately excludes: normalizedQuery, raw input, food names/payloads, complete candidates,
 * best/secondBest candidate objects, source IDs, owner/observation/run IDs, notes, assumptions, and
 * any other free text.
 */
export interface ResolverProductionDecisionProjectionV1 {
  projectionVersion: typeof RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION;
  status: ResolverStatus;
  reasonCodes: readonly ResolverProductionDecisionSafeReasonCode[];
  candidateCount: number;
  selectedSourceType: ResolverProductionDecisionSourceType;
  provenanceClassification: ResolverProductionDecisionProvenanceClassification;
  inputConfidenceLevel: ResolverProductionDecisionInputConfidenceLevel;
}

function classifySourceType(decision: ResolverDecision): ResolverProductionDecisionSourceType {
  const source = decision.best?.food.source;
  if (!source) return 'none';
  return (RESOLVER_PRODUCTION_DECISION_SOURCE_TYPES as readonly string[]).includes(source)
    ? (source as ResolverProductionDecisionSourceType)
    : 'none';
}

function classifyProvenance(
  decision: ResolverDecision,
): ResolverProductionDecisionProvenanceClassification {
  const source = decision.best?.food.source;
  if (!source) return 'not_evaluable';
  return source === 'ai' ? 'ai_suggested' : 'source_grounded';
}

function classifyReasonCodes(
  decision: ResolverDecision,
): readonly ResolverProductionDecisionSafeReasonCode[] {
  const safe = new Set<string>(RESOLVER_PRODUCTION_DECISION_SAFE_REASON_CODES);
  return decision.reasonCodes.map((code) =>
    safe.has(code)
      ? (code as ResolverProductionDecisionSafeReasonCode)
      : 'UNCLASSIFIED_REASON_CODE',
  );
}

function classifyInputConfidence(
  decision: ResolverDecision,
): ResolverProductionDecisionInputConfidenceLevel {
  const level = decision.inputConfidence?.level;
  return level === 'high' || level === 'medium' || level === 'low' ? level : 'unknown';
}

/**
 * Deterministic, side-effect-free projection boundary (RESOLVER-V3-029 §2). Never mutates
 * `decision`; maps only known source categories/reason codes; fails closed to `none`/`not_evaluable`/
 * `unknown`/`UNCLASSIFIED_REASON_CODE` for anything the source data cannot support a stronger claim
 * about, rather than guessing or passing through arbitrary payload content.
 */
export function projectResolverDecisionForShadowEvaluation(
  decision: ResolverDecision,
): ResolverProductionDecisionProjectionV1 {
  return {
    projectionVersion: RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION,
    status: decision.status,
    reasonCodes: classifyReasonCodes(decision),
    candidateCount: decision.candidates.length,
    selectedSourceType: classifySourceType(decision),
    provenanceClassification: classifyProvenance(decision),
    inputConfidenceLevel: classifyInputConfidence(decision),
  };
}
