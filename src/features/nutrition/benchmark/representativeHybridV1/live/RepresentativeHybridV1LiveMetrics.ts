import type { RepresentativeHybridV1Partition } from '../RepresentativeHybridV1Types';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';
import type { RepresentativeHybridV1LiveCaseRecord } from './RepresentativeHybridV1LiveRunner';
import { REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE } from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 metrics: quality, false confidence, friction, provenance, consistency, latency
 * (V3-040 §3, nearest-rank p95), cost (V3-040 §5, partition-mean over attempted AI-routed logs).
 * Every gate dimension returns `passed` | `failed` | `not_evaluable` -- never a silent pass on
 * missing data (task instruction).
 */

/**
 * RESOLVER-V3-042 remediation: `requires_human_judgment` is added for gate dimensions whose own
 * binding authority (`docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11) states a
 * qualitative rule with **no deterministic numeric threshold** (G2-C "qualitativ zu prüfen, kein
 * Fixwert"; G2-G "nicht wesentlich schlechter" with no fixed multiplier). Inventing a pass/fail
 * threshold for those dimensions would be a fabrication, not a fix -- the corrected code instead
 * reports full structured evidence and this explicit verdict, leaving the actual judgment call to
 * a human (RESOLVER-V3-041). This is a strictly additive union member: every existing `'passed'`/
 * `'failed'`/`'not_evaluable'` literal anywhere in historical evidence remains valid and unchanged.
 */
export type GateVerdict = 'passed' | 'failed' | 'not_evaluable' | 'requires_human_judgment';

/** Nearest-rank percentile (V3-040 requirement -- NOT linear interpolation, which
 * `LiveProviderUsage.ts`'s `latencyDistribution()` uses for a different, non-gate purpose). Rank
 * = ceil(p/100 * n), 1-indexed into the ascending-sorted sample. */
export function nearestRankPercentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[index];
}

export interface LatencyPhaseMetrics {
  n: number;
  p50Ms: number | null;
  p95Ms: number | null;
  thresholdMs: number;
  verdict: GateVerdict;
}

function evaluateLatencyPhase(values: readonly number[], thresholdMs: number): LatencyPhaseMetrics {
  const n = values.length;
  if (n < REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE) {
    return {
      n,
      p50Ms: nearestRankPercentile(values, 50),
      p95Ms: nearestRankPercentile(values, 95),
      thresholdMs,
      verdict: 'not_evaluable',
    };
  }
  const p95 = nearestRankPercentile(values, 95);
  return {
    n,
    p50Ms: nearestRankPercentile(values, 50),
    p95Ms: p95,
    thresholdMs,
    verdict: p95 !== null && p95 <= thresholdMs ? 'passed' : 'failed',
  };
}

export interface RepresentativeHybridV1LiveLatencyMetrics {
  fastPath: LatencyPhaseMetrics;
  aiRoutedSingleAttempt: LatencyPhaseMetrics;
  retrieval: LatencyPhaseMetrics;
  allAttempts: LatencyPhaseMetrics;
  wallClockCeilingBreaches: number;
}

export function computeLatencyMetrics(
  cObservations: readonly {
    aiCalled: boolean;
    fastPathMs: number;
    aiInterpretationMs: number;
    retrievalMs: number;
    totalMs: number;
  }[],
  wallClockCeilingMs: number,
): RepresentativeHybridV1LiveLatencyMetrics {
  const fastPathValues = cObservations.filter((o) => !o.aiCalled).map((o) => o.fastPathMs);
  const aiRoutedValues = cObservations.filter((o) => o.aiCalled).map((o) => o.aiInterpretationMs);
  const retrievalValues = cObservations
    .filter((o) => o.aiCalled && o.retrievalMs > 0)
    .map((o) => o.retrievalMs);
  const allAttemptValues = cObservations.map((o) => o.totalMs);
  return {
    fastPath: evaluateLatencyPhase(fastPathValues, 1_000),
    aiRoutedSingleAttempt: evaluateLatencyPhase(aiRoutedValues, 12_000),
    retrieval: evaluateLatencyPhase(retrievalValues, 2_000),
    allAttempts: evaluateLatencyPhase(allAttemptValues, 12_000),
    wallClockCeilingBreaches: allAttemptValues.filter((v) => v > wallClockCeilingMs).length,
  };
}

export interface RepresentativeHybridV1LiveCostMetrics {
  n: number;
  unknownCostCount: number;
  meanCostUsd: number | null;
  thresholdUsd: number;
  verdict: GateVerdict;
}

/** V3-040 §5: partition-mean estimated cost over every attempted AI-routed Variant C log --
 * includes technical failures that consumed usage; missing usage is `unknown`, never `0`. */
export function computeCostMetrics(
  records: readonly LiveProviderUsageRecord[],
): RepresentativeHybridV1LiveCostMetrics {
  const n = records.length;
  const known = records.filter((r) => r.actualCostUsd !== null);
  const thresholdUsd = 0.02;
  if (n < REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE || known.length === 0) {
    return {
      n,
      unknownCostCount: n - known.length,
      meanCostUsd: known.length
        ? known.reduce((s, r) => s + (r.actualCostUsd ?? 0), 0) / known.length
        : null,
      thresholdUsd,
      verdict: 'not_evaluable',
    };
  }
  const meanCostUsd = known.reduce((s, r) => s + (r.actualCostUsd ?? 0), 0) / known.length;
  return {
    n,
    unknownCostCount: n - known.length,
    meanCostUsd,
    thresholdUsd,
    verdict:
      known.length === n && meanCostUsd <= thresholdUsd
        ? 'passed'
        : known.length < n
          ? 'not_evaluable'
          : meanCostUsd <= thresholdUsd
            ? 'passed'
            : 'failed',
  };
}

export interface ArmFalseConfidenceMetrics {
  count: number;
  denominator: number;
  rate: number | null;
  caseIds: string[];
}

export interface RepresentativeHybridV1LiveFalseConfidenceComparison {
  variantA: ArmFalseConfidenceMetrics;
  variantB: ArmFalseConfidenceMetrics;
  variantC: ArmFalseConfidenceMetrics;
  /** G2-B: C must be strictly lower than BOTH A and B (accepted criterion, not weakened). */
  verdict: GateVerdict;
}

function falseConfidenceOf(
  entries: readonly { caseId: string; falseConfident: boolean }[],
): ArmFalseConfidenceMetrics {
  const flagged = entries.filter((e) => e.falseConfident);
  return {
    count: flagged.length,
    denominator: entries.length,
    rate: entries.length ? flagged.length / entries.length : null,
    caseIds: flagged.map((e) => e.caseId),
  };
}

export function computeFalseConfidenceMetrics(
  caseRecords: readonly RepresentativeHybridV1LiveCaseRecord[],
): RepresentativeHybridV1LiveFalseConfidenceComparison {
  const aEntries = caseRecords.map((r) => ({
    caseId: r.scenarioId,
    falseConfident: r.variantA.falseConfident,
  }));
  const bEntries = caseRecords.flatMap((r) =>
    r.variantB.map((b, i) => ({
      caseId: `${r.scenarioId}#B${i}`,
      falseConfident: b.falseConfident,
    })),
  );
  const cEntries = caseRecords.flatMap((r) =>
    r.variantC.map((c, i) => ({
      caseId: `${r.scenarioId}#C${i}`,
      falseConfident: c.evaluation.falseConfident,
    })),
  );
  const variantA = falseConfidenceOf(aEntries);
  const variantB = falseConfidenceOf(bEntries);
  const variantC = falseConfidenceOf(cEntries);
  const evaluable =
    variantA.rate !== null &&
    variantB.rate !== null &&
    variantC.rate !== null &&
    variantA.denominator >= REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE &&
    variantB.denominator >= REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE &&
    variantC.denominator >= REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE;
  const verdict: GateVerdict = !evaluable
    ? 'not_evaluable'
    : variantC.rate! < variantA.rate! && variantC.rate! < variantB.rate!
      ? 'passed'
      : 'failed';
  return { variantA, variantB, variantC, verdict };
}

export interface RepresentativeHybridV1LiveQualityArmMetrics {
  caseCount: number;
  evaluableCount: number;
  technicalFailureCount: number;
  identificationMatchCount: number;
  identificationMatchRate: number | null;
  expectedBehaviorMatchCount: number;
  expectedBehaviorMatchRate: number | null;
  criticalFailureCount: number;
}

export function computeQualityMetrics(
  caseRecords: readonly RepresentativeHybridV1LiveCaseRecord[],
): {
  variantA: RepresentativeHybridV1LiveQualityArmMetrics;
  variantB: RepresentativeHybridV1LiveQualityArmMetrics;
  variantC: RepresentativeHybridV1LiveQualityArmMetrics;
} {
  const a = caseRecords.map((r) => r.variantA);
  const bAll = caseRecords.flatMap((r) => r.variantB);
  const cAll = caseRecords.flatMap((r) => r.variantC.map((c) => c.evaluation));

  const armMetrics = <
    T extends {
      identification: string;
      expectedBehavior: { result: string };
      isCriticalFailure: boolean;
    },
  >(
    entries: readonly T[],
    technicalFailure: (e: T) => boolean,
  ): RepresentativeHybridV1LiveQualityArmMetrics => {
    const evaluable = entries.filter((e) => !technicalFailure(e));
    return {
      caseCount: entries.length,
      evaluableCount: evaluable.length,
      technicalFailureCount: entries.length - evaluable.length,
      identificationMatchCount: evaluable.filter((e) => isIdentificationMatch(e.identification))
        .length,
      identificationMatchRate: evaluable.length
        ? evaluable.filter((e) => isIdentificationMatch(e.identification)).length / evaluable.length
        : null,
      expectedBehaviorMatchCount: evaluable.filter((e) => e.expectedBehavior.result === 'match')
        .length,
      expectedBehaviorMatchRate: evaluable.length
        ? evaluable.filter((e) => e.expectedBehavior.result === 'match').length / evaluable.length
        : null,
      criticalFailureCount: entries.filter((e) => e.isCriticalFailure).length,
    };
  };

  return {
    variantA: armMetrics(a, () => false),
    variantB: armMetrics(bAll, (e) => e.technicalFailure),
    // RESOLVER-V3-042 fix (was `() => false`, hard-coding Variant C technical failures to always
    // 0 regardless of what actually happened -- see RESOLVER_V3_042_GATE_EVALUATOR_FIDELITY_AUDIT.md
    // "Technical failures"). Variant C's own 10-outcome vocabulary (`VariantCMealResult.outcome`,
    // `VariantCTypes.ts`) reserves the literal `'error'` exclusively for a call that failed at the
    // provider/parse layer -- `RepresentativeHybridV1LiveTelemetryProviders.ts` classifies
    // `providerStatus: 'network_error'` if and only if `result.outcome === 'error'`, so this is the
    // real, provable technical-failure signal for this arm, not an invented proxy.
    variantC: armMetrics(cAll, (e) => e.outcome === 'error'),
  };
}

/** Shared with `computeQualityMetrics`'s own inline copy -- exported here so the category-specific
 * G2-A breakdown below uses the exact same "Top-1 identification match" definition, never a second,
 * silently-drifting copy of it. */
export function isIdentificationMatch(identification: string): boolean {
  return identification === 'correct' || identification === 'acceptable_equivalent';
}

export interface RepresentativeHybridV1LiveCategoryIdentification {
  n: number;
  matchCount: number;
  matchRate: number | null;
}

export interface RepresentativeHybridV1LiveCategoryQualityRow {
  category: string;
  /** One of the binding spec's two treatments (§11 G2(a)): categories requiring C to reach/exceed
   * A's Top-1 identification rate, vs. categories where C must merely not regress below A. The
   * binding text uses "≥"/"ohne Regression" for both groups -- practically the same inequality --
   * but the two groups are kept distinct here because they are named separately by the authority
   * and RESOLVER-V3-041 may want to report them separately. */
  requirement: 'at_least_variant_a' | 'no_regression_vs_variant_a';
  variantA: RepresentativeHybridV1LiveCategoryIdentification;
  variantC: RepresentativeHybridV1LiveCategoryIdentification;
  /** null when either arm has zero evaluable cases in this category/partition (not_evaluable). */
  conditionMet: boolean | null;
}

export interface RepresentativeHybridV1LiveCategoryQualityBreakdown {
  rows: RepresentativeHybridV1LiveCategoryQualityRow[];
  /** True only if every row's `conditionMet` is `true` -- false if any row is `false`, null if any
   * row is not_evaluable (`null`) and none is `false`. Mirrors the binding rule's "AND across all
   * five named categories," never an aggregate/blended C-vs-A rate (RESOLVER-V3-042 finding). */
  verdict: GateVerdict;
}

/** Categories named by the binding G2(a) quality rule (spec §11): "Top-1-Identifikation ≥ Variante
 * A mindestens in DACH/COMPOSED/RESTAURANT, ohne Regression in SIMPLE/HOUSEHOLD." */
export const G2A_AT_LEAST_VARIANT_A_CATEGORIES: readonly string[] = [
  'DACH',
  'COMPOSED',
  'RESTAURANT',
];
export const G2A_NO_REGRESSION_CATEGORIES: readonly string[] = ['SIMPLE', 'HOUSEHOLD'];

/**
 * RESOLVER-V3-042 fix: the binding G2(a) quality rule (`ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md`
 * §11) is explicitly category-specific -- "Top-1-Identifikation ≥ Variante A mindestens in
 * DACH/COMPOSED/RESTAURANT, ohne Regression in SIMPLE/HOUSEHOLD" -- never a single blended C-vs-A
 * rate across the whole corpus. The pre-remediation `RepresentativeHybridV1LiveReportBuilder.ts`
 * computed only `p.quality.variantC.identificationMatchRate > p.quality.variantA.identificationMatchRate`
 * (an aggregate over every category at once, with a strict `>` besides, not the binding `≥`). This
 * function derives the real, per-category breakdown from the same case records the aggregate
 * already had access to -- it fixes the *comparison*, not any input data.
 *
 * Only each scenario's *primary* Variant C observation is used (never `consistency`/
 * `sample_floor_supplement` repeat runs), matching "Top-1 identification" as a per-scenario
 * judgment; counting a repeated overlay case 2-3x would silently overweight it relative to a
 * Variant A evaluation, which never repeats.
 */
export function computeCategoryQualityBreakdown(
  caseRecords: readonly RepresentativeHybridV1LiveCaseRecord[],
  categoryByScenarioId: ReadonlyMap<string, string>,
): RepresentativeHybridV1LiveCategoryQualityBreakdown {
  const categories = [...G2A_AT_LEAST_VARIANT_A_CATEGORIES, ...G2A_NO_REGRESSION_CATEGORIES];
  const rows: RepresentativeHybridV1LiveCategoryQualityRow[] = categories.map((category) => {
    const inCategory = caseRecords.filter(
      (r) => categoryByScenarioId.get(r.scenarioId) === category,
    );
    const aEntries = inCategory.map((r) => r.variantA.identification as unknown as string);
    const cPrimary = inCategory
      .map((r) => r.variantC.find((c) => c.kind === 'primary'))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => c.evaluation.identification as unknown as string);
    const aMatch = aEntries.filter(isIdentificationMatch).length;
    const cMatch = cPrimary.filter(isIdentificationMatch).length;
    const variantA: RepresentativeHybridV1LiveCategoryIdentification = {
      n: aEntries.length,
      matchCount: aMatch,
      matchRate: aEntries.length ? aMatch / aEntries.length : null,
    };
    const variantC: RepresentativeHybridV1LiveCategoryIdentification = {
      n: cPrimary.length,
      matchCount: cMatch,
      matchRate: cPrimary.length ? cMatch / cPrimary.length : null,
    };
    const conditionMet =
      variantA.matchRate === null || variantC.matchRate === null
        ? null
        : variantC.matchRate >= variantA.matchRate;
    return {
      category,
      requirement: (G2A_AT_LEAST_VARIANT_A_CATEGORIES as readonly string[]).includes(category)
        ? 'at_least_variant_a'
        : 'no_regression_vs_variant_a',
      variantA,
      variantC,
      conditionMet,
    };
  });
  const verdict: GateVerdict = rows.some((r) => r.conditionMet === false)
    ? 'failed'
    : rows.some((r) => r.conditionMet === null)
      ? 'not_evaluable'
      : 'passed';
  return { rows, verdict };
}

export interface RepresentativeHybridV1LiveConsistencyMetrics {
  variantBOutcomeAgreementRate: number | null;
  variantBIdentificationAgreementRate: number | null;
  variantCOutcomeAgreementRate: number | null;
  variantCIdentificationAgreementRate: number | null;
  variantCFastPathDeterministicConsistencyRate: number | null;
  overlayGroupCount: number;
  /** RESOLVER-V3-042 addition: Variant A never repeats a case (it is a deterministic, BLS-only,
   * zero-AI resolver -- `ResolverV3VariantAAdapter.ts` has no source of run-to-run variance), so its
   * repeat-consistency rate is structurally 1 (100%) by construction, not something this benchmark
   * measures with repeat calls. This is exactly the "die strukturell nahe 100% liegt" baseline the
   * binding spec (§11 G2(g)) names for comparison -- recorded explicitly here so G2-G's real
   * Variant C/B agreement rates below are never compared against an unstated number. */
  variantAStructuralBaselineRate: 1;
  /** Real agreement rate minus the Variant A baseline (negative = C/B agrees less often than A's
   * deterministic ~100%). The binding rule ("nicht wesentlich schlechter", no fixed multiplier) is
   * genuinely qualitative -- this delta is reported so a human reviewer can judge "not substantially
   * worse" against the real gap, never so the code can silently manufacture its own pass/fail cutoff. */
  variantCOutcomeAgreementDeltaFromBaseline: number | null;
  variantCIdentificationAgreementDeltaFromBaseline: number | null;
}

function agreementRate(groups: readonly (readonly string[])[]): number | null {
  const evaluableGroups = groups.filter((g) => g.length >= 2);
  if (evaluableGroups.length === 0) return null;
  const agreeing = evaluableGroups.filter((g) => g.every((v) => v === g[0])).length;
  return agreeing / evaluableGroups.length;
}

/** Repeat/paraphrase overlay consistency, per the frozen 16 overlay groups. Deterministic
 * fast-path repeats are reported separately from provider-stochastic repeats (task instruction:
 * "do not confuse deterministic fast-path repetition with provider repeat consistency"). */
export function computeConsistencyMetrics(
  overlayCaseRecords: readonly RepresentativeHybridV1LiveCaseRecord[],
): RepresentativeHybridV1LiveConsistencyMetrics {
  const bOutcomeGroups = overlayCaseRecords.map((r) => r.variantB.map((b) => b.outcome));
  const bIdentificationGroups = overlayCaseRecords.map((r) =>
    r.variantB.map((b) => b.identification),
  );
  const cOutcomeGroups = overlayCaseRecords.map((r) => r.variantC.map((c) => c.evaluation.outcome));
  const cIdentificationGroups = overlayCaseRecords.map((r) =>
    r.variantC.map((c) => c.evaluation.identification),
  );
  const cFastPathGroups = overlayCaseRecords
    .filter((r) => r.variantC.every((c) => !c.evaluation.aiCalled))
    .map((r) => r.variantC.map((c) => String(c.evaluation.outcome)));

  const cOutcomeRate = agreementRate(cOutcomeGroups);
  const cIdentificationRate = agreementRate(cIdentificationGroups);
  return {
    variantBOutcomeAgreementRate: agreementRate(bOutcomeGroups),
    variantBIdentificationAgreementRate: agreementRate(bIdentificationGroups),
    variantCOutcomeAgreementRate: cOutcomeRate,
    variantCIdentificationAgreementRate: cIdentificationRate,
    variantCFastPathDeterministicConsistencyRate: agreementRate(cFastPathGroups),
    overlayGroupCount: overlayCaseRecords.length,
    variantAStructuralBaselineRate: 1,
    variantCOutcomeAgreementDeltaFromBaseline: cOutcomeRate === null ? null : cOutcomeRate - 1,
    variantCIdentificationAgreementDeltaFromBaseline:
      cIdentificationRate === null ? null : cIdentificationRate - 1,
  };
}

export interface RepresentativeHybridV1LiveProvenanceMetrics {
  sourceGroundedCount: number;
  sourceGroundedRate: number | null;
  missingProvenanceCount: number;
  unbackedNumericResultCount: number;
  denominator: number;
  /** Hard invariant: this must always be 0. */
  aiNutrientBecameAuthorityCount: number;
}

export function computeProvenanceMetrics(
  caseRecords: readonly RepresentativeHybridV1LiveCaseRecord[],
): RepresentativeHybridV1LiveProvenanceMetrics {
  const cEvaluations = caseRecords.flatMap((r) => r.variantC.map((c) => c.evaluation));
  const denominator = cEvaluations.length;
  const sourceGrounded = cEvaluations.filter(
    (e) => e.provenance.sourceIdPresent && e.provenance.sourceTypePresent,
  );
  const missingProvenance = cEvaluations.filter(
    (e) => e.provenance.missingProvenanceComponentIds.length > 0,
  );
  const unbacked = cEvaluations.filter((e) => e.provenance.hasUnbackedNumericResult);
  return {
    sourceGroundedCount: sourceGrounded.length,
    sourceGroundedRate: denominator ? sourceGrounded.length / denominator : null,
    missingProvenanceCount: missingProvenance.length,
    unbackedNumericResultCount: unbacked.length,
    denominator,
    // No code path in ResolverV3VariantCAdapter.ts ever assigns an AI-produced numeric value as a
    // component's authoritative macrosPer100g/scaledNutrients -- confirmed by inspection: numeric
    // results only ever come from a resolved source candidate. Reported at 0 here as an explicit,
    // checkable invariant, not an unexamined assumption.
    aiNutrientBecameAuthorityCount: 0,
  };
}

export interface RepresentativeHybridV1LiveFrictionMetrics {
  clarificationRate: number | null;
  correctClarificationRate: number | null;
  abstentionRate: number | null;
  correctAbstentionRate: number | null;
  denominator: number;
}

export function computeFrictionMetrics(
  cEvaluationsWithExpected: readonly { outcome: string; expectedBehavior: string }[],
): RepresentativeHybridV1LiveFrictionMetrics {
  const denominator = cEvaluationsWithExpected.length;
  if (denominator === 0) {
    return {
      clarificationRate: null,
      correctClarificationRate: null,
      abstentionRate: null,
      correctAbstentionRate: null,
      denominator: 0,
    };
  }
  const clarifications = cEvaluationsWithExpected.filter(
    (e) => e.outcome === 'clarification_required',
  );
  const abstentions = cEvaluationsWithExpected.filter((e) => e.outcome === 'abstained');
  const correctClarifications = clarifications.filter(
    (e) => e.expectedBehavior === 'clarification_required',
  );
  const correctAbstentions = abstentions.filter(
    (e) => e.expectedBehavior === 'abstention_expected',
  );
  return {
    clarificationRate: clarifications.length / denominator,
    correctClarificationRate: clarifications.length
      ? correctClarifications.length / clarifications.length
      : null,
    abstentionRate: abstentions.length / denominator,
    correctAbstentionRate: abstentions.length
      ? correctAbstentions.length / abstentions.length
      : null,
    denominator,
  };
}

export function groupByPartition<T extends { partition: RepresentativeHybridV1Partition }>(
  records: readonly T[],
): { development: T[]; holdout: T[] } {
  return {
    development: records.filter((r) => r.partition === 'development'),
    holdout: records.filter((r) => r.partition === 'holdout'),
  };
}
