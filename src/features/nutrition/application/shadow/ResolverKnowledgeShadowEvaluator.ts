import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeCandidate';
import {
  RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
  type ResolverKnowledgeShadowDeltaCategory,
  type ResolverKnowledgeShadowEvaluationRequest,
  type ResolverKnowledgeShadowEvaluationResult,
  type ResolverKnowledgeShadowMetricEvidenceClass,
  type ResolverKnowledgeShadowMetrics,
  type ResolverKnowledgeShadowRateMetric,
} from '../../domain/models/ResolverKnowledgeShadowEvaluation';
import { hasUsableExpectedStatus } from '../../domain/models/ResolverKnowledgeShadowGroundTruth';
import {
  containsDenylistedField,
  validateResolverKnowledgeShadowCandidateSnapshot,
  validateResolverKnowledgeShadowGroundTruth,
  validateResolverProductionDecisionProjection,
} from './ResolverKnowledgeShadowPrivacyValidator';
import { ResolverKnowledgeShadowCorpusRegistry } from './ResolverKnowledgeShadowCorpusRegistry';

const supported = new Set([
  'source-routing-pattern',
  'abstention-policy-signal',
  'clarification-policy-signal',
  'provenance-gap',
  'negative-source-routing-rule',
]);

const NOT_EVALUABLE_DELTA_CATEGORIES: readonly ResolverKnowledgeShadowDeltaCategory[] = [
  'privacy_blocked',
  'invalid_candidate',
  'blocked_locale',
  'not_evaluable',
];

function buildResult(
  request: ResolverKnowledgeShadowEvaluationRequest,
  registryVersion: string,
  category: ResolverKnowledgeShadowDeltaCategory,
  status = request.productionDecisionProjection.status,
  reasonCodes: string[] = [],
): ResolverKnowledgeShadowEvaluationResult {
  return {
    evaluationVersion: RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
    caseId: request.caseId,
    registryVersion,
    corpusPartition: request.corpusPartition,
    productionDecisionProjection: request.productionDecisionProjection,
    hypotheticalShadowStatus: status,
    groundTruth: request.groundTruth,
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
  };
}

/**
 * Pure read-only evaluator with no external execution ports (RESOLVER-V3-029 §10). No resolver,
 * AI/model backend, network, source, persistence, ranking, query, fast-path, approval, or
 * feature-flag dependency. `registry` is a plain in-memory value object, not a persistence adapter.
 */
export class ResolverKnowledgeShadowEvaluator {
  evaluate(
    request: ResolverKnowledgeShadowEvaluationRequest,
    registry: ResolverKnowledgeShadowCorpusRegistry,
  ): ResolverKnowledgeShadowEvaluationResult {
    if (request.evaluationVersion !== RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION) {
      throw new Error('SHADOW_UNKNOWN_EVALUATION_VERSION');
    }
    const registeredPartition = registry.partitionFor(request.caseId);
    if (registeredPartition === undefined) throw new Error('SHADOW_REGISTRY_UNKNOWN_CASE_ID');
    if (registeredPartition !== request.corpusPartition) {
      throw new Error('SHADOW_REGISTRY_PARTITION_MISMATCH');
    }

    const schemaViolations = [
      ...validateResolverKnowledgeShadowCandidateSnapshot(request.candidate),
      ...validateResolverProductionDecisionProjection(request.productionDecisionProjection),
      ...validateResolverKnowledgeShadowGroundTruth(request.groundTruth),
    ];
    const denylistHit =
      containsDenylistedField(request.candidate) ||
      containsDenylistedField(request.productionDecisionProjection) ||
      containsDenylistedField(request.groundTruth);
    if (schemaViolations.length > 0 || denylistHit) {
      return buildResult(
        request,
        registry.version,
        'privacy_blocked',
        request.productionDecisionProjection.status,
        [schemaViolations.length > 0 ? 'SCHEMA_VALIDATION_FAILED' : 'PRIVATE_FIELD_BLOCKED'],
      );
    }

    const payload = request.candidate.payload as Record<string, unknown>;
    if (
      !supported.has(request.candidate.candidateType) ||
      payload.type !== request.candidate.candidateType
    ) {
      return buildResult(
        request,
        registry.version,
        'not_evaluable',
        request.productionDecisionProjection.status,
        ['UNSUPPORTED_CANDIDATE'],
      );
    }
    if (request.candidate.candidateVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION) {
      return buildResult(
        request,
        registry.version,
        'invalid_candidate',
        request.productionDecisionProjection.status,
        ['UNKNOWN_CANDIDATE_VERSION'],
      );
    }
    if (payload.locale !== request.locale || payload.inputType !== request.inputType) {
      return buildResult(
        request,
        registry.version,
        'blocked_locale',
        request.productionDecisionProjection.status,
        ['LOCALE_OR_INPUT_TYPE_MISMATCH'],
      );
    }
    switch (payload.type) {
      case 'abstention-policy-signal':
        return buildResult(request, registry.version, 'hypothetical_abstention', 'rejected', [
          'HYPOTHETICAL_ABSTENTION',
        ]);
      case 'clarification-policy-signal':
        return buildResult(request, registry.version, 'hypothetical_clarification', 'ambiguous', [
          'HYPOTHETICAL_CLARIFICATION',
        ]);
      case 'provenance-gap':
        return buildResult(
          request,
          registry.version,
          'hypothetical_provenance_warning',
          request.productionDecisionProjection.status,
          ['HYPOTHETICAL_PROVENANCE_WARNING'],
        );
      case 'negative-source-routing-rule':
        return buildResult(request, registry.version, 'hypothetical_source_change', 'ambiguous', [
          'HYPOTHETICAL_NEGATIVE_ROUTE',
        ]);
      case 'source-routing-pattern':
        return buildResult(
          request,
          registry.version,
          'no_change',
          request.productionDecisionProjection.status,
          ['ROUTING_PAYLOAD_HAS_NO_TERM_OR_ALIAS'],
        );
      default:
        return buildResult(
          request,
          registry.version,
          'not_evaluable',
          request.productionDecisionProjection.status,
        );
    }
  }
}

function isEvaluable(result: ResolverKnowledgeShadowEvaluationResult): boolean {
  return !NOT_EVALUABLE_DELTA_CATEGORIES.includes(result.delta.category);
}

function count(
  results: readonly ResolverKnowledgeShadowEvaluationResult[],
  category: ResolverKnowledgeShadowDeltaCategory,
) {
  return {
    value: results.filter((r) => r.delta.category === category).length,
    evidenceClass: 'measured' as const,
  };
}

function groundTruthEvidenceClass(
  usable: readonly ResolverKnowledgeShadowEvaluationResult[],
): ResolverKnowledgeShadowMetricEvidenceClass {
  return usable.some((r) => r.groundTruth.evidenceClass === 'fixture-derived')
    ? 'fixture-derived'
    : 'measured';
}

function nullRateMetric(
  evidenceClass: ResolverKnowledgeShadowMetricEvidenceClass,
  reasonCode: ResolverKnowledgeShadowRateMetric['reasonCode'],
): ResolverKnowledgeShadowRateMetric {
  return { value: null, numerator: null, denominator: null, evidenceClass, reasonCode };
}

function computedRateMetric(
  numerator: number,
  denominator: number,
  evidenceClass: ResolverKnowledgeShadowMetricEvidenceClass,
): ResolverKnowledgeShadowRateMetric {
  return {
    value: numerator / denominator,
    numerator,
    denominator,
    evidenceClass,
    reasonCode: null,
  };
}

/**
 * Implements the RESOLVER-V3-029 metric formulas. Every count directly observed from the supplied
 * `results` is `measured` (measured within this deterministic shadow run — never production
 * telemetry). Every metric depending on ground truth is computed only over the usable-ground-truth
 * subset and tagged `fixture-derived` whenever fixture evidence contributed; missing evidence never
 * becomes `0`.
 */
export function aggregateResolverKnowledgeShadowMetrics(
  results: readonly ResolverKnowledgeShadowEvaluationResult[],
  registryVersion: string,
): ResolverKnowledgeShadowMetrics {
  const evaluable = results.filter(isEvaluable);
  const changedDecisionCount = results.filter(
    (r) =>
      r.delta.category.startsWith('hypothetical_') &&
      r.hypotheticalShadowStatus !== r.productionDecisionProjection.status,
  ).length;

  const usableGroundTruth = results.filter(
    (r) => isEvaluable(r) && hasUsableExpectedStatus(r.groundTruth),
  );

  let identificationAccuracy: ResolverKnowledgeShadowRateMetric;
  let falseConfidenceRegressionCount: ResolverKnowledgeShadowRateMetric;
  let falseConfidenceImprovementCount: ResolverKnowledgeShadowRateMetric;
  let regressionCount: ResolverKnowledgeShadowRateMetric;

  if (usableGroundTruth.length === 0) {
    identificationAccuracy = nullRateMetric('unknown', 'NO_USABLE_GROUND_TRUTH_CASES');
    falseConfidenceRegressionCount = nullRateMetric('unknown', 'NO_USABLE_GROUND_TRUTH_CASES');
    falseConfidenceImprovementCount = nullRateMetric('unknown', 'NO_USABLE_GROUND_TRUTH_CASES');
    regressionCount = nullRateMetric('unknown', 'NO_USABLE_GROUND_TRUTH_CASES');
  } else {
    const evidenceClass = groundTruthEvidenceClass(usableGroundTruth);
    const agreementCount = usableGroundTruth.filter(
      (r) =>
        hasUsableExpectedStatus(r.groundTruth) &&
        r.hypotheticalShadowStatus === r.groundTruth.expectedStatus,
    ).length;
    identificationAccuracy = computedRateMetric(
      agreementCount,
      usableGroundTruth.length,
      evidenceClass,
    );

    const falseConfidenceRegressions = usableGroundTruth.filter(
      (r) =>
        hasUsableExpectedStatus(r.groundTruth) &&
        r.productionDecisionProjection.status !== 'accepted' &&
        r.hypotheticalShadowStatus === 'accepted' &&
        r.groundTruth.expectedStatus !== 'accepted',
    ).length;
    falseConfidenceRegressionCount = computedRateMetric(
      falseConfidenceRegressions,
      usableGroundTruth.length,
      evidenceClass,
    );

    const falseConfidenceImprovements = usableGroundTruth.filter(
      (r) =>
        hasUsableExpectedStatus(r.groundTruth) &&
        r.productionDecisionProjection.status === 'accepted' &&
        r.groundTruth.expectedStatus !== 'accepted' &&
        r.hypotheticalShadowStatus !== 'accepted',
    ).length;
    falseConfidenceImprovementCount = computedRateMetric(
      falseConfidenceImprovements,
      usableGroundTruth.length,
      evidenceClass,
    );

    const regressions = usableGroundTruth.filter(
      (r) =>
        hasUsableExpectedStatus(r.groundTruth) &&
        r.productionDecisionProjection.status === r.groundTruth.expectedStatus &&
        r.hypotheticalShadowStatus !== r.groundTruth.expectedStatus,
    ).length;
    regressionCount = computedRateMetric(regressions, usableGroundTruth.length, evidenceClass);
  }

  const abstentionsWithGroundTruth = usableGroundTruth.filter(
    (r) => r.hypotheticalShadowStatus === 'rejected',
  );
  const abstentionPrecision =
    abstentionsWithGroundTruth.length === 0
      ? nullRateMetric('unknown', 'NO_HYPOTHETICAL_ABSTENTIONS')
      : computedRateMetric(
          abstentionsWithGroundTruth.filter(
            (r) =>
              hasUsableExpectedStatus(r.groundTruth) && r.groundTruth.expectedStatus === 'rejected',
          ).length,
          abstentionsWithGroundTruth.length,
          groundTruthEvidenceClass(abstentionsWithGroundTruth),
        );

  const clarificationRate =
    evaluable.length === 0
      ? nullRateMetric('not_evaluable', 'NO_ELIGIBLE_CLARIFICATION_CASES')
      : computedRateMetric(
          evaluable.filter((r) => r.delta.category === 'hypothetical_clarification').length,
          evaluable.length,
          'measured',
        );

  return {
    registryVersion,
    evaluatedCaseCount: { value: results.length, evidenceClass: 'measured' },
    evaluableCaseCount: { value: evaluable.length, evidenceClass: 'measured' },
    noChangeCount: count(results, 'no_change'),
    changedDecisionCount: { value: changedDecisionCount, evidenceClass: 'measured' },
    abstentionDeltaCount: count(results, 'hypothetical_abstention'),
    clarificationDeltaCount: count(results, 'hypothetical_clarification'),
    sourceRoutingDeltaCount: count(results, 'hypothetical_source_change'),
    provenanceGapCount: count(results, 'hypothetical_provenance_warning'),
    localeBlockedCount: count(results, 'blocked_locale'),
    privacyBlockedCount: count(results, 'privacy_blocked'),
    invalidCandidateCount: count(results, 'invalid_candidate'),
    notEvaluableCount: count(results, 'not_evaluable'),
    usableGroundTruthCaseCount: { value: usableGroundTruth.length, evidenceClass: 'measured' },
    identificationAccuracy,
    abstentionPrecision,
    clarificationRate,
    falseConfidenceRegressionCount,
    falseConfidenceImprovementCount,
    regressionCount,
  };
}

export function evaluateShadowCorpus(
  evaluator: ResolverKnowledgeShadowEvaluator,
  registry: ResolverKnowledgeShadowCorpusRegistry,
  requests: readonly ResolverKnowledgeShadowEvaluationRequest[],
): Readonly<Record<'development' | 'holdout', readonly ResolverKnowledgeShadowEvaluationResult[]>> {
  const seen = new Set<string>();
  const partitions: Record<'development' | 'holdout', ResolverKnowledgeShadowEvaluationResult[]> = {
    development: [],
    holdout: [],
  };
  for (const request of requests) {
    if (seen.has(request.caseId)) throw new Error('SHADOW_DUPLICATE_CASE_ID_IN_REQUEST_BATCH');
    seen.add(request.caseId);
    const result = evaluator.evaluate(request, registry);
    partitions[result.corpusPartition].push(result);
  }
  return partitions;
}
