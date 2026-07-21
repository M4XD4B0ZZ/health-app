import {
  RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
  type ResolverKnowledgeShadowDeltaCategory,
  type ResolverKnowledgeShadowEvaluationRequest,
  type ResolverKnowledgeShadowEvaluationResult,
  type ResolverKnowledgeShadowMetrics,
} from '../../domain/models/ResolverKnowledgeShadowEvaluation';

const privateKeys = [
  'ownerId',
  'owner_id',
  'observationId',
  'runId',
  'rawInput',
  'normalizedInput',
  'sourceId',
];
const supported = new Set([
  'source-routing-pattern',
  'abstention-policy-signal',
  'clarification-policy-signal',
  'provenance-gap',
  'negative-source-routing-rule',
]);
const result = (
  request: ResolverKnowledgeShadowEvaluationRequest,
  category: ResolverKnowledgeShadowDeltaCategory,
  status = request.productionDecision.status,
  reasonCodes: string[] = [],
): ResolverKnowledgeShadowEvaluationResult => ({
  evaluationVersion: RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
  caseId: request.caseId,
  corpusPartition: request.corpusPartition,
  productionDecision: request.productionDecision,
  hypotheticalShadowStatus: status,
  fixtureExpectedStatus: request.fixtureExpectedStatus,
  delta: {
    category,
    candidateId: request.candidate.candidateId,
    candidateFingerprint: request.candidate.fingerprint,
    reasonCodes,
    risk:
      category === 'no_change'
        ? 'none'
        : category === 'hypothetical_provenance_warning'
          ? 'low'
          : 'medium',
  },
});
/** Pure read-only evaluator with no external execution ports. */
export class ResolverKnowledgeShadowEvaluator {
  evaluate(
    request: ResolverKnowledgeShadowEvaluationRequest,
  ): ResolverKnowledgeShadowEvaluationResult {
    if (request.evaluationVersion !== RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION)
      throw new Error('SHADOW_UNKNOWN_EVALUATION_VERSION');
    if (
      Object.keys(request.candidate).some((key) => privateKeys.includes(key)) ||
      Object.keys(request.candidate.payload).some((key) => privateKeys.includes(key))
    )
      return result(request, 'privacy_blocked', request.productionDecision.status, [
        'PRIVATE_FIELD_BLOCKED',
      ]);
    const payload = request.candidate.payload as Record<string, unknown>;
    if (
      !supported.has(request.candidate.candidateType) ||
      payload.type !== request.candidate.candidateType
    )
      return result(request, 'not_evaluable', request.productionDecision.status, [
        'UNSUPPORTED_CANDIDATE',
      ]);
    if (request.candidate.candidateVersion !== 'resolver-knowledge-candidate-v1')
      return result(request, 'invalid_candidate', request.productionDecision.status, [
        'UNKNOWN_CANDIDATE_VERSION',
      ]);
    if (payload.locale !== request.locale || payload.inputType !== request.inputType)
      return result(request, 'blocked_locale', request.productionDecision.status, [
        'LOCALE_OR_INPUT_TYPE_MISMATCH',
      ]);
    switch (payload.type) {
      case 'abstention-policy-signal':
        return result(request, 'hypothetical_abstention', 'rejected', ['HYPOTHETICAL_ABSTENTION']);
      case 'clarification-policy-signal':
        return result(request, 'hypothetical_clarification', 'ambiguous', [
          'HYPOTHETICAL_CLARIFICATION',
        ]);
      case 'provenance-gap':
        return result(
          request,
          'hypothetical_provenance_warning',
          request.productionDecision.status,
          ['HYPOTHETICAL_PROVENANCE_WARNING'],
        );
      case 'negative-source-routing-rule':
        return result(request, 'hypothetical_source_change', 'ambiguous', [
          'HYPOTHETICAL_NEGATIVE_ROUTE',
        ]);
      case 'source-routing-pattern':
        return result(request, 'no_change', request.productionDecision.status, [
          'ROUTING_PAYLOAD_HAS_NO_TERM_OR_ALIAS',
        ]);
      default:
        return result(request, 'not_evaluable', request.productionDecision.status);
    }
  }
}
export function aggregateResolverKnowledgeShadowMetrics(
  results: readonly ResolverKnowledgeShadowEvaluationResult[],
): ResolverKnowledgeShadowMetrics {
  const count = (category: string) =>
    results.filter((value) => value.delta.category === category).length;
  const changed = results.filter(
    (value) =>
      value.delta.category.startsWith('hypothetical_') &&
      value.hypotheticalShadowStatus !== value.productionDecision.status,
  ).length;
  return {
    evaluatedCaseCount: results.length,
    noChangeCount: count('no_change'),
    changedDecisionCount: changed,
    abstentionDeltaCount: count('hypothetical_abstention'),
    clarificationDeltaCount: count('hypothetical_clarification'),
    sourceRoutingDeltaCount: count('hypothetical_source_change'),
    provenanceGapCount: count('hypothetical_provenance_warning'),
    falseConfidenceRegressionCount: 0,
    falseConfidenceImprovementCount: 0,
    localeBlockedCount: count('blocked_locale'),
    notEvaluableCount: count('not_evaluable'),
    invalidCandidateCount: count('invalid_candidate'),
    identificationAccuracy: 'unknown',
    abstentionPrecision: 'unknown',
    clarificationRate: 'unknown',
    regressionCount: 0,
  };
}
export function evaluateShadowCorpus(
  evaluator: ResolverKnowledgeShadowEvaluator,
  requests: readonly ResolverKnowledgeShadowEvaluationRequest[],
): Readonly<Record<'development' | 'holdout', readonly ResolverKnowledgeShadowEvaluationResult[]>> {
  const seen = new Set<string>();
  const partitions: Record<'development' | 'holdout', ResolverKnowledgeShadowEvaluationResult[]> = {
    development: [],
    holdout: [],
  };
  for (const request of requests) {
    if (seen.has(request.caseId)) throw new Error('SHADOW_CASE_IN_MULTIPLE_PARTITIONS');
    seen.add(request.caseId);
    partitions[request.corpusPartition].push(evaluator.evaluate(request));
  }
  return partitions;
}
