import { BenchmarkCase } from './BenchmarkCaseTypes';
import { CaseEvaluationC, ComponentMatchResultC } from './evaluateVariantCCase';
import { precisionRecallF1, PrecisionRecallF1 } from './evaluateVariantBCase';
import { VariantCRawCaseResult } from './VariantCTypes';
import { mean, median, percentile } from './benchmarkMetricsShared';

/**
 * RESOLVER-V3-005: pure aggregation of per-case Variant C evaluations into corpus-level metrics.
 * No I/O. Mirrors RESOLVER-V3-003/004's own aggregation modules' shape and reuses
 * `benchmarkMetricsShared.ts`'s math, adding the metrics unique to Variant C's hybrid pipeline:
 * fast-path usage/avoided-AI-call counts, and provenance completeness.
 */

export interface RepeatGroupConsistencyC {
  repeatGroupId: string;
  caseIds: string[];
  consistent: boolean;
  entries: { caseId: string; sourceId: string | null; outcome: string; fastPathUsed: boolean }[];
}

export function evaluateRepeatGroupConsistencyC(
  cases: readonly BenchmarkCase[],
  evaluationsByCaseId: ReadonlyMap<string, CaseEvaluationC>,
  bestSourceIdByCaseId: ReadonlyMap<string, string | null>,
): RepeatGroupConsistencyC[] {
  const groups = new Map<string, BenchmarkCase[]>();
  for (const benchmarkCase of cases) {
    if (!benchmarkCase.repeatGroupId) continue;
    const group = groups.get(benchmarkCase.repeatGroupId) ?? [];
    group.push(benchmarkCase);
    groups.set(benchmarkCase.repeatGroupId, group);
  }

  return [...groups.entries()].map(([repeatGroupId, groupCases]) => {
    const entries = groupCases.map((c) => {
      const evaluation = evaluationsByCaseId.get(c.caseId);
      return {
        caseId: c.caseId,
        sourceId: bestSourceIdByCaseId.get(c.caseId) ?? null,
        outcome: evaluation?.outcome ?? 'error',
        fastPathUsed: evaluation?.fastPathUsed ?? false,
      };
    });
    const [first] = entries;
    const consistent = entries.every(
      (e) => e.sourceId === first.sourceId && e.outcome === first.outcome,
    );
    return { repeatGroupId, caseIds: groupCases.map((c) => c.caseId), consistent, entries };
  });
}

export interface AggregatedVariantCMetrics {
  caseCount: number;
  identification: {
    correct: number;
    acceptableEquivalent: number;
    wrong: number;
    noResolution: number;
    notApplicable: number;
    accuracy: number | null;
  };
  expectedBehavior: { match: number; partial: number; mismatch: number };
  criticalFailures: number;
  falseConfidentCases: string[];
  partialMisreportedAsCompleteCases: string[];
  componentDecomposition: {
    truePositives: number;
    falseNegatives: number;
    falsePositives: number;
    optionalMissing: number;
    aggregate: PrecisionRecallF1;
  };
  macros: {
    perNutrient: Record<
      'kcal' | 'protein_g' | 'fat_g' | 'carbs_g',
      { sampleCount: number; medianAbsoluteError: number | null; meanSignedError: number | null }
    >;
    withinToleranceCount: number;
    outsideToleranceCount: number;
    notEvaluableCount: number;
  };
  provenance: {
    sourceIdPresentRate: number | null;
    unbackedNumericResultCount: number;
  };
  fastPath: {
    usedCount: number;
    avoidedAiCalls: number;
    aiCalledCount: number;
  };
  latency: { p50Ms: number | null; p95Ms: number | null };
  latencyBreakdown: {
    allCases: ReturnType<typeof latencySummary>;
    fastPathCases: ReturnType<typeof latencySummary>;
    aiRoutedCases: ReturnType<typeof latencySummary>;
    provider: ReturnType<typeof latencySummary>;
    retrieval: ReturnType<typeof latencySummary>;
    endToEnd: ReturnType<typeof latencySummary>;
  };
  cost: {
    totalKnownOrEstimatedUsd: number | null;
    unknownPricingCallCount: number;
    perEvaluableCaseUsd: number | null;
    totalAiCalls: number;
    totalExternalRequests: number;
  };
  outcomes: Record<string, number>;
  repeatGroups: RepeatGroupConsistencyC[];
}

export function aggregateVariantCMetrics(
  cases: readonly BenchmarkCase[],
  evaluations: readonly CaseEvaluationC[],
  rawByCaseId: ReadonlyMap<string, VariantCRawCaseResult>,
  bestSourceIdByCaseId: ReadonlyMap<string, string | null>,
): AggregatedVariantCMetrics {
  const evaluationsByCaseId = new Map(evaluations.map((e) => [e.caseId, e]));

  const identificationCounts = {
    correct: 0,
    acceptableEquivalent: 0,
    wrong: 0,
    noResolution: 0,
    notApplicable: 0,
  };
  const expectedBehaviorCounts = { match: 0, partial: 0, mismatch: 0 };
  const falseConfidentCases: string[] = [];
  const partialMisreportedAsCompleteCases: string[] = [];
  const outcomes: Record<string, number> = {};

  let tp = 0;
  let fn = 0;
  let fp = 0;
  let optionalMissing = 0;

  let sourceIdPresentCount = 0;
  let sourceApplicableCount = 0;
  let unbackedNumericResultCount = 0;

  let withinToleranceCount = 0;
  let outsideToleranceCount = 0;
  let notEvaluableCount = 0;
  const nutrientSamples: Record<
    'kcal' | 'protein_g' | 'fat_g' | 'carbs_g',
    { abs: number[]; signed: number[] }
  > = {
    kcal: { abs: [], signed: [] },
    protein_g: { abs: [], signed: [] },
    fat_g: { abs: [], signed: [] },
    carbs_g: { abs: [], signed: [] },
  };

  let fastPathUsedCount = 0;
  let avoidedAiCalls = 0;
  let aiCalledCount = 0;
  const latencySamples: number[] = [];
  let totalExternalRequests = 0;

  for (const evaluation of evaluations) {
    switch (evaluation.identification) {
      case 'correct':
        identificationCounts.correct += 1;
        break;
      case 'acceptable_equivalent':
        identificationCounts.acceptableEquivalent += 1;
        break;
      case 'wrong':
        identificationCounts.wrong += 1;
        break;
      case 'no_resolution':
        identificationCounts.noResolution += 1;
        break;
      case 'not_applicable':
        identificationCounts.notApplicable += 1;
        break;
    }

    expectedBehaviorCounts[evaluation.expectedBehavior.result] += 1;
    if (evaluation.falseConfident) falseConfidentCases.push(evaluation.caseId);
    if (evaluation.partialMisreportedAsComplete)
      partialMisreportedAsCompleteCases.push(evaluation.caseId);
    outcomes[evaluation.outcome] = (outcomes[evaluation.outcome] ?? 0) + 1;

    tp += evaluation.componentMatch.truePositives;
    fn += evaluation.componentMatch.falseNegatives;
    fp += evaluation.componentMatch.falsePositives;
    optionalMissing += evaluation.componentMatch.optionalMissing;

    if (evaluation.identification !== 'not_applicable') {
      sourceApplicableCount += 1;
      if (evaluation.provenance.sourceIdPresent) sourceIdPresentCount += 1;
    }
    if (evaluation.provenance.hasUnbackedNumericResult) unbackedNumericResultCount += 1;

    if (evaluation.macros === null) {
      notEvaluableCount += 1;
    } else if (evaluation.macros.withinTolerance === null) {
      notEvaluableCount += 1;
    } else if (evaluation.macros.withinTolerance) {
      withinToleranceCount += 1;
    } else {
      outsideToleranceCount += 1;
    }
    evaluation.macros?.samples.forEach((sample) => {
      nutrientSamples[sample.nutrient].abs.push(sample.absoluteError);
      nutrientSamples[sample.nutrient].signed.push(sample.predicted - sample.reference);
    });

    if (evaluation.fastPathUsed) {
      fastPathUsedCount += 1;
      const raw = rawByCaseId.get(evaluation.caseId);
      avoidedAiCalls += raw?.mealResult.fastPath.avoidedAiCalls ?? 0;
    }
    if (evaluation.aiCalled) aiCalledCount += 1;
    latencySamples.push(evaluation.latencyMs);
    const raw = rawByCaseId.get(evaluation.caseId);
    totalExternalRequests += raw?.mealResult.externalRequestCount ?? 0;
  }

  const identificationApplicableCount =
    identificationCounts.correct +
    identificationCounts.acceptableEquivalent +
    identificationCounts.wrong +
    identificationCounts.noResolution;

  const allRaw = [...rawByCaseId.values()];
  const costSamples = allRaw
    .map((r) => r.mealResult.cost.costUsd)
    .filter((v): v is number => v !== null);
  const unknownPricingCallCount = allRaw.filter(
    (r) => r.mealResult.cost.pricingStatus === 'unknown',
  ).length;
  const totalKnownOrEstimatedUsd =
    costSamples.length > 0 ? costSamples.reduce((a, b) => a + b, 0) : null;
  const evaluableCaseCount = cases.length;

  const componentMatchTotals: Pick<
    ComponentMatchResultC,
    'truePositives' | 'falseNegatives' | 'falsePositives'
  > = { truePositives: tp, falseNegatives: fn, falsePositives: fp };

  const latencyBreakdown = {
    allCases: latencySummary(allRaw.map((raw) => raw.mealResult.latencyMs.totalMs)),
    fastPathCases: latencySummary(
      allRaw
        .filter((raw) => raw.mealResult.fastPath.used)
        .map((raw) => raw.mealResult.latencyMs.totalMs),
    ),
    aiRoutedCases: latencySummary(
      allRaw
        .filter((raw) => raw.mealResult.aiInterpretation.called)
        .map((raw) => raw.mealResult.latencyMs.totalMs),
    ),
    provider: latencySummary(
      allRaw
        .map((raw) => raw.mealResult.cost.providerLatencyMs)
        .filter((v): v is number => v !== null && v !== undefined),
    ),
    retrieval: latencySummary(allRaw.map((raw) => raw.mealResult.latencyMs.retrievalMs)),
    endToEnd: latencySummary(allRaw.map((raw) => raw.mealResult.latencyMs.totalMs)),
  };

  return {
    caseCount: cases.length,
    identification: {
      ...identificationCounts,
      accuracy:
        identificationApplicableCount === 0
          ? null
          : (identificationCounts.correct + identificationCounts.acceptableEquivalent) /
            identificationApplicableCount,
    },
    expectedBehavior: expectedBehaviorCounts,
    criticalFailures: [...new Set([...falseConfidentCases, ...partialMisreportedAsCompleteCases])]
      .length,
    falseConfidentCases,
    partialMisreportedAsCompleteCases,
    componentDecomposition: {
      truePositives: tp,
      falseNegatives: fn,
      falsePositives: fp,
      optionalMissing,
      aggregate: precisionRecallF1(componentMatchTotals),
    },
    macros: {
      perNutrient: {
        kcal: {
          sampleCount: nutrientSamples.kcal.abs.length,
          medianAbsoluteError: median(nutrientSamples.kcal.abs),
          meanSignedError: mean(nutrientSamples.kcal.signed),
        },
        protein_g: {
          sampleCount: nutrientSamples.protein_g.abs.length,
          medianAbsoluteError: median(nutrientSamples.protein_g.abs),
          meanSignedError: mean(nutrientSamples.protein_g.signed),
        },
        fat_g: {
          sampleCount: nutrientSamples.fat_g.abs.length,
          medianAbsoluteError: median(nutrientSamples.fat_g.abs),
          meanSignedError: mean(nutrientSamples.fat_g.signed),
        },
        carbs_g: {
          sampleCount: nutrientSamples.carbs_g.abs.length,
          medianAbsoluteError: median(nutrientSamples.carbs_g.abs),
          meanSignedError: mean(nutrientSamples.carbs_g.signed),
        },
      },
      withinToleranceCount,
      outsideToleranceCount,
      notEvaluableCount,
    },
    provenance: {
      sourceIdPresentRate:
        sourceApplicableCount === 0 ? null : sourceIdPresentCount / sourceApplicableCount,
      unbackedNumericResultCount,
    },
    fastPath: { usedCount: fastPathUsedCount, avoidedAiCalls, aiCalledCount },
    latency: { p50Ms: percentile(latencySamples, 50), p95Ms: percentile(latencySamples, 95) },
    latencyBreakdown,
    cost: {
      totalKnownOrEstimatedUsd,
      unknownPricingCallCount,
      perEvaluableCaseUsd:
        totalKnownOrEstimatedUsd === null || evaluableCaseCount === 0
          ? null
          : totalKnownOrEstimatedUsd / evaluableCaseCount,
      totalAiCalls: aiCalledCount,
      totalExternalRequests,
    },
    outcomes,
    repeatGroups: evaluateRepeatGroupConsistencyC(cases, evaluationsByCaseId, bestSourceIdByCaseId),
  };
}

function latencySummary(values: readonly number[]) {
  return {
    sampleCount: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
  };
}
