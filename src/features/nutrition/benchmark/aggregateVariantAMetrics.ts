import { BenchmarkCase } from './BenchmarkCaseTypes';
import { CaseEvaluation } from './evaluateVariantACase';

/**
 * RESOLVER-V3-003: pure aggregation of per-case evaluations into corpus-level metrics. No I/O --
 * every function here takes already-computed data and returns a plain object, so it is directly
 * unit-testable with small controlled inputs (task instruction).
 */

/** Nearest-rank percentile over a list of latency samples (spec §6.9 p50/p95). Returns `null`
 * for an empty input rather than `0`, since "no data" is not "zero latency". */
export function percentile(samples: readonly number[], p: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
}

export interface RepeatGroupConsistency {
  repeatGroupId: string;
  caseIds: string[];
  /** `true` when every case in the group resolved to the same canonical identity (allowing for
   * `canonicalEquivalents`) and the same `status`. */
  consistent: boolean;
  identities: { caseId: string; sourceId: string | null; status: string }[];
}

/** Groups cases sharing a `repeatGroupId` (spec §3 `REPEAT_CONSISTENCY` overlay, §6.7) and checks
 * whether Variant A resolved them to the same canonical identity and status. */
export function evaluateRepeatGroupConsistency(
  cases: readonly BenchmarkCase[],
  evaluationsByCaseId: ReadonlyMap<string, CaseEvaluation>,
  bestSourceIdByCaseId: ReadonlyMap<string, string | null>,
): RepeatGroupConsistency[] {
  const groups = new Map<string, BenchmarkCase[]>();
  for (const benchmarkCase of cases) {
    if (!benchmarkCase.repeatGroupId) continue;
    const group = groups.get(benchmarkCase.repeatGroupId) ?? [];
    group.push(benchmarkCase);
    groups.set(benchmarkCase.repeatGroupId, group);
  }

  return [...groups.entries()].map(([repeatGroupId, groupCases]) => {
    const identities = groupCases.map((benchmarkCase) => ({
      caseId: benchmarkCase.caseId,
      sourceId: bestSourceIdByCaseId.get(benchmarkCase.caseId) ?? null,
      status: evaluationsByCaseId.get(benchmarkCase.caseId)?.status ?? 'rejected',
    }));

    const firstIdentity = identities[0];
    const consistent = identities.every(
      (identity) =>
        identity.sourceId === firstIdentity.sourceId && identity.status === firstIdentity.status,
    );

    return {
      repeatGroupId,
      caseIds: groupCases.map((c) => c.caseId),
      consistent,
      identities,
    };
  });
}

export interface AggregatedVariantAMetrics {
  caseCount: number;
  identification: {
    correct: number;
    acceptableEquivalent: number;
    wrong: number;
    noResolution: number;
    notApplicable: number;
    /** Accuracy over cases where identification was actually applicable -- `null` when no case
     * had an applicable identification target (never divides by zero silently). */
    accuracy: number | null;
  };
  expectedBehavior: {
    match: number;
    partial: number;
    mismatch: number;
  };
  criticalFailures: number;
  falseConfidentCases: string[];
  provenance: {
    sourceIdPresentRate: number | null;
    aiUsedAsSourceCount: number;
    unbackedNumericResultCount: number;
  };
  macros: {
    /** Per-nutrient absolute/relative error summaries, only over cases where that nutrient had a
     * non-null reference value (spec §6: "schließt Fälle mit referenceNutrients = null ... aus"). */
    perNutrient: Record<
      'kcal' | 'protein_g' | 'fat_g' | 'carbs_g',
      { sampleCount: number; medianAbsoluteError: number | null; meanSignedError: number | null }
    >;
    withinToleranceCount: number;
    outsideToleranceCount: number;
    notEvaluableCount: number;
  };
  latency: {
    p50Ms: number | null;
    p95Ms: number | null;
  };
  repeatGroups: RepeatGroupConsistency[];
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function aggregateVariantAMetrics(
  cases: readonly BenchmarkCase[],
  evaluations: readonly CaseEvaluation[],
  bestSourceIdByCaseId: ReadonlyMap<string, string | null>,
): AggregatedVariantAMetrics {
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
  let sourceIdPresentCount = 0;
  let sourceApplicableCount = 0;
  let aiUsedAsSourceCount = 0;
  let unbackedNumericResultCount = 0;
  let withinToleranceCount = 0;
  let outsideToleranceCount = 0;
  let notEvaluableCount = 0;
  const latencySamples: number[] = [];

  const nutrientSamples: Record<
    'kcal' | 'protein_g' | 'fat_g' | 'carbs_g',
    { abs: number[]; signed: number[] }
  > = {
    kcal: { abs: [], signed: [] },
    protein_g: { abs: [], signed: [] },
    fat_g: { abs: [], signed: [] },
    carbs_g: { abs: [], signed: [] },
  };

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

    if (evaluation.identification !== 'not_applicable') {
      sourceApplicableCount += 1;
      if (evaluation.provenance.sourceIdPresent) sourceIdPresentCount += 1;
    }
    if (evaluation.provenance.usedAiAsSource) aiUsedAsSourceCount += 1;
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

    latencySamples.push(evaluation.latencyMs);
  }

  const identificationApplicableCount =
    identificationCounts.correct +
    identificationCounts.acceptableEquivalent +
    identificationCounts.wrong +
    identificationCounts.noResolution;

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
    criticalFailures: evaluations.filter((e) => e.isCriticalFailure).length,
    falseConfidentCases,
    provenance: {
      sourceIdPresentRate:
        sourceApplicableCount === 0 ? null : sourceIdPresentCount / sourceApplicableCount,
      aiUsedAsSourceCount,
      unbackedNumericResultCount,
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
    latency: {
      p50Ms: percentile(latencySamples, 50),
      p95Ms: percentile(latencySamples, 95),
    },
    repeatGroups: evaluateRepeatGroupConsistency(cases, evaluationsByCaseId, bestSourceIdByCaseId),
  };
}
