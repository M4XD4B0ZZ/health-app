import { BenchmarkCase } from './BenchmarkCaseTypes';
import { CaseEvaluationB, precisionRecallF1, PrecisionRecallF1 } from './evaluateVariantBCase';
import { VariantBRawCaseResult } from './VariantBTypes';
import { mean, median, percentile } from './benchmarkMetricsShared';

/**
 * RESOLVER-V3-004: pure aggregation of per-case Variant B evaluations (across every run, primary
 * + consistency repeats) into corpus-level metrics. No I/O. Mirrors RESOLVER-V3-003's
 * `aggregateVariantAMetrics.ts` structural role and reuses its shared math
 * (`benchmarkMetricsShared.ts`), but Variant B additionally needs: component decomposition
 * precision/recall/F1 aggregation, quantity/unit accuracy, same-input repeat-run variance (spec
 * §6.7, distinct from the paraphrase repeat-group check both variants share), and cost (spec
 * §6.9) -- none of which apply to Variant A's resolver-only boundary.
 */

const COMPLEX_CATEGORIES = new Set<BenchmarkCase['category']>([
  'COMPOSED',
  'HOMEMADE',
  'RESTAURANT',
]);

export interface RepeatGroupConsistencyB {
  repeatGroupId: string;
  caseIds: string[];
  consistent: boolean;
  entries: { caseId: string; outcome: string; identification: string }[];
}

/** Cross-case paraphrase/synonym consistency (spec §3 `REPEAT_CONSISTENCY` overlay, §6.7),
 * evaluated on each case's *primary* (first) run -- mirrors Variant A's
 * `evaluateRepeatGroupConsistency`, adapted for Variant B's identity representation (no
 * `sourceId`; outcome + identification result stand in for "same resolved identity"). */
export function evaluateRepeatGroupConsistencyB(
  cases: readonly BenchmarkCase[],
  primaryEvaluationByCaseId: ReadonlyMap<string, CaseEvaluationB>,
): RepeatGroupConsistencyB[] {
  const groups = new Map<string, BenchmarkCase[]>();
  for (const benchmarkCase of cases) {
    if (!benchmarkCase.repeatGroupId) continue;
    const group = groups.get(benchmarkCase.repeatGroupId) ?? [];
    group.push(benchmarkCase);
    groups.set(benchmarkCase.repeatGroupId, group);
  }

  return [...groups.entries()].map(([repeatGroupId, groupCases]) => {
    const entries = groupCases.map((c) => {
      const evaluation = primaryEvaluationByCaseId.get(c.caseId);
      return {
        caseId: c.caseId,
        outcome: evaluation?.outcome ?? 'unavailable',
        identification: evaluation?.identification ?? 'not_applicable',
      };
    });
    const [first] = entries;
    const consistent = entries.every(
      (e) => e.outcome === first.outcome && e.identification === first.identification,
    );
    return { repeatGroupId, caseIds: groupCases.map((c) => c.caseId), consistent, entries };
  });
}

export interface SameInputConsistency {
  caseId: string;
  runCount: number;
  outcomeConsistent: boolean;
  identificationConsistent: boolean;
  /** `null` when fewer than 2 runs had a normalizable kcal sample to compare. */
  kcalRangeAcrossRuns: number | null;
  /** `null` when fewer than 2 runs reported a native `overallConfidence`. */
  confidenceRangeAcrossRuns: number | null;
}

/** Same-input repeat-run variance (spec §6.7 "gleiche Eingabe, mehrere Durchläufe") -- distinct
 * from `evaluateRepeatGroupConsistencyB` above, which compares *different* (paraphrase) inputs.
 * This compares the *same* input run `runCount` times. */
export function evaluateSameInputConsistency(
  caseId: string,
  evaluations: readonly CaseEvaluationB[],
): SameInputConsistency {
  const outcomes = evaluations.map((e) => e.outcome);
  const identifications = evaluations.map((e) => e.identification);
  const kcalSamples = evaluations
    .map((e) => e.macros?.samples.find((s) => s.nutrient === 'kcal')?.predicted)
    .filter((v): v is number => typeof v === 'number');
  const confidenceSamples = evaluations
    .map((e) => e.overallConfidence)
    .filter((v): v is number => typeof v === 'number');

  return {
    caseId,
    runCount: evaluations.length,
    outcomeConsistent: outcomes.every((o) => o === outcomes[0]),
    identificationConsistent: identifications.every((i) => i === identifications[0]),
    kcalRangeAcrossRuns:
      kcalSamples.length >= 2 ? Math.max(...kcalSamples) - Math.min(...kcalSamples) : null,
    confidenceRangeAcrossRuns:
      confidenceSamples.length >= 2
        ? Math.max(...confidenceSamples) - Math.min(...confidenceSamples)
        : null,
  };
}

export interface NotEvaluableCase {
  caseId: string;
  reason: string;
}

export interface AggregatedVariantBMetrics {
  caseCount: number;
  notEvaluableCases: NotEvaluableCase[];
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
  hallucinatedBrandCases: string[];
  componentDecomposition: {
    truePositives: number;
    falseNegatives: number;
    falsePositives: number;
    optionalMissing: number;
    aggregate: PrecisionRecallF1;
  };
  quantity: {
    unitCorrectCount: number;
    unitIncorrectCount: number;
    unitNotEvaluableCount: number;
    medianAbsoluteDeviation: number | null;
  };
  macros: {
    perNutrient: Record<
      'kcal' | 'protein_g' | 'fat_g' | 'carbs_g',
      { sampleCount: number; medianAbsoluteError: number | null; meanSignedError: number | null }
    >;
    withinToleranceCount: number;
    outsideToleranceCount: number;
    notEvaluableCount: number;
    notNormalizableCount: number;
    componentTotalsMismatchCount: number;
  };
  latency: { p50Ms: number | null; p95Ms: number | null };
  cost: {
    totalKnownOrEstimatedUsd: number | null;
    unknownPricingCallCount: number;
    perEvaluableCaseUsd: number | null;
    perCorrectCaseUsd: number | null;
    perCorrectComplexCaseUsd: number | null;
    totalAiCalls: number;
    totalExternalRequests: number;
    totalInputTokens: number | null;
    totalOutputTokens: number | null;
  };
  repeatGroups: RepeatGroupConsistencyB[];
  sameInputConsistency: SameInputConsistency[];
}

export function aggregateVariantBMetrics(
  cases: readonly BenchmarkCase[],
  evaluationsByCaseId: ReadonlyMap<string, readonly CaseEvaluationB[]>,
  rawByCaseId: ReadonlyMap<string, readonly VariantBRawCaseResult[]>,
): AggregatedVariantBMetrics {
  const primaryEvaluationByCaseId = new Map<string, CaseEvaluationB>();
  for (const [caseId, evaluations] of evaluationsByCaseId) {
    if (evaluations[0]) primaryEvaluationByCaseId.set(caseId, evaluations[0]);
  }

  const identificationCounts = {
    correct: 0,
    acceptableEquivalent: 0,
    wrong: 0,
    noResolution: 0,
    notApplicable: 0,
  };
  const expectedBehaviorCounts = { match: 0, partial: 0, mismatch: 0 };
  const falseConfidentCases: string[] = [];
  const hallucinatedBrandCases: string[] = [];
  const notEvaluableCases: NotEvaluableCase[] = [];

  let tp = 0;
  let fn = 0;
  let fp = 0;
  let optionalMissing = 0;
  let unitCorrectCount = 0;
  let unitIncorrectCount = 0;
  let unitNotEvaluableCount = 0;
  const quantityDeviations: number[] = [];

  let withinToleranceCount = 0;
  let outsideToleranceCount = 0;
  let macroNotEvaluableCount = 0;
  let notNormalizableCount = 0;
  let componentTotalsMismatchCount = 0;
  const nutrientSamples: Record<
    'kcal' | 'protein_g' | 'fat_g' | 'carbs_g',
    { abs: number[]; signed: number[] }
  > = {
    kcal: { abs: [], signed: [] },
    protein_g: { abs: [], signed: [] },
    fat_g: { abs: [], signed: [] },
    carbs_g: { abs: [], signed: [] },
  };

  let costPerCorrectCaseSum = 0;
  let correctCaseCount = 0;
  let costPerCorrectComplexCaseSum = 0;
  let correctComplexCaseCount = 0;

  for (const benchmarkCase of cases) {
    const evaluation = primaryEvaluationByCaseId.get(benchmarkCase.caseId);
    if (!evaluation) {
      notEvaluableCases.push({ caseId: benchmarkCase.caseId, reason: 'no primary run recorded' });
      continue;
    }
    if (evaluation.technicalFailure) {
      notEvaluableCases.push({
        caseId: benchmarkCase.caseId,
        reason: `technical failure: outcome=${evaluation.outcome}`,
      });
    }

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
    if (evaluation.hallucinatedBrand) hallucinatedBrandCases.push(evaluation.caseId);

    tp += evaluation.componentMatch.truePositives;
    fn += evaluation.componentMatch.falseNegatives;
    fp += evaluation.componentMatch.falsePositives;
    optionalMissing += evaluation.componentMatch.optionalMissing;

    evaluation.quantities.forEach((q) => {
      if (q.unitCorrect === true) unitCorrectCount += 1;
      else if (q.unitCorrect === false) unitIncorrectCount += 1;
      else unitNotEvaluableCount += 1;
      if (q.absoluteDeviation !== null) quantityDeviations.push(q.absoluteDeviation);
    });

    if (evaluation.componentTotalsConsistency.mismatched) componentTotalsMismatchCount += 1;

    if (evaluation.macros === null) {
      macroNotEvaluableCount += 1;
    } else if (!evaluation.macros.normalizable) {
      notNormalizableCount += 1;
    } else if (evaluation.macros.withinTolerance === null) {
      macroNotEvaluableCount += 1;
    } else if (evaluation.macros.withinTolerance) {
      withinToleranceCount += 1;
    } else {
      outsideToleranceCount += 1;
    }

    evaluation.macros?.samples.forEach((sample) => {
      nutrientSamples[sample.nutrient].abs.push(sample.absoluteError);
      nutrientSamples[sample.nutrient].signed.push(sample.predicted - sample.reference);
    });

    const raw = rawByCaseId.get(benchmarkCase.caseId)?.[0];
    const primaryCostUsd = raw?.runMeta.costUsd ?? null;
    if (
      evaluation.identification === 'correct' ||
      evaluation.identification === 'acceptable_equivalent'
    ) {
      correctCaseCount += 1;
      if (primaryCostUsd !== null) costPerCorrectCaseSum += primaryCostUsd;
      if (COMPLEX_CATEGORIES.has(benchmarkCase.category)) {
        correctComplexCaseCount += 1;
        if (primaryCostUsd !== null) costPerCorrectComplexCaseSum += primaryCostUsd;
      }
    }
  }

  const identificationApplicableCount =
    identificationCounts.correct +
    identificationCounts.acceptableEquivalent +
    identificationCounts.wrong +
    identificationCounts.noResolution;

  // Cost/latency/tokens: aggregated over *every* recorded run (primary + consistency repeats),
  // since every call has a real cost regardless of whether it was the primary scoring run.
  const allRuns = [...rawByCaseId.values()].flat();
  const latencySamples = allRuns.map((r) => r.runMeta.latencyMs);
  const costSamples = allRuns.map((r) => r.runMeta.costUsd).filter((v): v is number => v !== null);
  const unknownPricingCallCount = allRuns.filter(
    (r) => r.runMeta.pricingStatus === 'unknown',
  ).length;
  const totalInputTokens = allRuns.some((r) => r.runMeta.inputTokens !== null)
    ? allRuns.reduce((sum, r) => sum + (r.runMeta.inputTokens ?? 0), 0)
    : null;
  const totalOutputTokens = allRuns.some((r) => r.runMeta.outputTokens !== null)
    ? allRuns.reduce((sum, r) => sum + (r.runMeta.outputTokens ?? 0), 0)
    : null;
  const totalKnownOrEstimatedUsd =
    costSamples.length > 0 ? costSamples.reduce((a, b) => a + b, 0) : null;

  const evaluableCaseCount = cases.length - notEvaluableCases.length;

  const componentMatchTotals = {
    truePositives: tp,
    falseNegatives: fn,
    falsePositives: fp,
    optionalMissing,
  };

  const sameInputConsistency = [...evaluationsByCaseId.entries()]
    .filter(([, evaluations]) => evaluations.length > 1)
    .map(([caseId, evaluations]) => evaluateSameInputConsistency(caseId, evaluations));

  return {
    caseCount: cases.length,
    notEvaluableCases,
    identification: {
      ...identificationCounts,
      accuracy:
        identificationApplicableCount === 0
          ? null
          : (identificationCounts.correct + identificationCounts.acceptableEquivalent) /
            identificationApplicableCount,
    },
    expectedBehavior: expectedBehaviorCounts,
    criticalFailures: [...new Set([...falseConfidentCases, ...hallucinatedBrandCases])].length,
    falseConfidentCases,
    hallucinatedBrandCases,
    componentDecomposition: {
      ...componentMatchTotals,
      aggregate: precisionRecallF1(componentMatchTotals),
    },
    quantity: {
      unitCorrectCount,
      unitIncorrectCount,
      unitNotEvaluableCount,
      medianAbsoluteDeviation: median(quantityDeviations),
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
      notEvaluableCount: macroNotEvaluableCount,
      notNormalizableCount,
      componentTotalsMismatchCount,
    },
    latency: { p50Ms: percentile(latencySamples, 50), p95Ms: percentile(latencySamples, 95) },
    cost: {
      totalKnownOrEstimatedUsd,
      unknownPricingCallCount,
      perEvaluableCaseUsd:
        totalKnownOrEstimatedUsd === null || evaluableCaseCount === 0
          ? null
          : totalKnownOrEstimatedUsd / evaluableCaseCount,
      perCorrectCaseUsd: correctCaseCount === 0 ? null : costPerCorrectCaseSum / correctCaseCount,
      perCorrectComplexCaseUsd:
        correctComplexCaseCount === 0
          ? null
          : costPerCorrectComplexCaseSum / correctComplexCaseCount,
      totalAiCalls: allRuns.length,
      totalExternalRequests: allRuns.length,
      totalInputTokens,
      totalOutputTokens,
    },
    repeatGroups: evaluateRepeatGroupConsistencyB(cases, primaryEvaluationByCaseId),
    sameInputConsistency,
  };
}
