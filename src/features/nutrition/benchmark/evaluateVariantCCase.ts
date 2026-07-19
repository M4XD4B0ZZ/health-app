import { BenchmarkCase, ExpectedBehavior, ExpectedComponent } from './BenchmarkCaseTypes';
import {
  VariantCComponentResult,
  VariantCMealResult,
  VariantCRawCaseResult,
} from './VariantCTypes';
import { IdentificationOutcome } from './evaluateVariantACase';
import { namesMatch, precisionRecallF1, PrecisionRecallF1 } from './evaluateVariantBCase';
import {
  MacroNutrientKey,
  NEAR_ZERO_GUARD,
  relativeMacroError,
  toleranceBandFor,
} from './benchmarkMetricsShared';

/**
 * RESOLVER-V3-005: pure evaluation of one normalized Variant C meal result against its benchmark
 * case's ground truth. No network, no I/O -- mirrors RESOLVER-V3-003/004's own
 * `evaluateVariantACase.ts`/`evaluateVariantBCase.ts` structural role, reusing their genuinely
 * shared pieces (`namesMatch`/`precisionRecallF1` from Variant B's module, `IdentificationOutcome`
 * from Variant A's, near-zero-guard/tolerance-band math from `benchmarkMetricsShared.ts`) instead
 * of re-deriving them.
 *
 * The shared 14-case corpus (`resolverV3VariantASmokeCorpus.ts`) is single-component (SIMPLE/
 * HOUSEHOLD/DACH only, per its own committed scope note) and its `referenceNutrients` are, like
 * Variant A's own evaluation, per-100g figures -- so identification/macro comparison here targets
 * the FIRST meal component (fast path's synthetic component, or the AI-routed run's first
 * component) exactly like Variant A/B's own single-target scope. Full component-array
 * precision/recall/F1 is still computed generically (`matchComponentsC`) so it is meaningful for a
 * genuinely multi-component input (see the dedicated multi-component unit test).
 */

// -------------------------------------------------------------------------------------------
// Component decomposition: precision/recall/F1 (spec §6.2), reusing Variant B's exact formula
// -------------------------------------------------------------------------------------------

export interface ComponentMatchResultC {
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  optionalMissing: number;
  hallucinatedComponentNames: string[];
  missingComponentNames: string[];
}

function predictedNameOf(component: VariantCComponentResult): string {
  return component.chosenCandidateName ?? component.interpretedName;
}

export function matchComponentsC(
  expected: readonly ExpectedComponent[],
  predicted: readonly VariantCComponentResult[],
): ComponentMatchResultC {
  const unmatchedPredicted = [...predicted];
  let truePositives = 0;
  let falseNegatives = 0;
  let optionalMissing = 0;
  const missingComponentNames: string[] = [];

  for (const expectedComponent of expected) {
    const idx = unmatchedPredicted.findIndex((p) =>
      namesMatch(predictedNameOf(p), expectedComponent.expectedName),
    );
    if (idx >= 0) {
      truePositives += 1;
      unmatchedPredicted.splice(idx, 1);
    } else if (expectedComponent.required) {
      falseNegatives += 1;
      missingComponentNames.push(expectedComponent.expectedName);
    } else {
      optionalMissing += 1;
    }
  }

  return {
    truePositives,
    falseNegatives,
    falsePositives: unmatchedPredicted.length,
    optionalMissing,
    hallucinatedComponentNames: unmatchedPredicted.map(predictedNameOf),
    missingComponentNames,
  };
}

// -------------------------------------------------------------------------------------------
// Identification (single-target, mirroring Variant A/B's own scope for this corpus)
// -------------------------------------------------------------------------------------------

function firstComponent(mealResult: VariantCMealResult): VariantCComponentResult | null {
  return mealResult.components[0] ?? null;
}

export function evaluateIdentificationC(
  benchmarkCase: BenchmarkCase,
  mealResult: VariantCMealResult,
): IdentificationOutcome {
  const expected = benchmarkCase.expectedComponents[0];
  if (!expected) return 'not_applicable';
  if (benchmarkCase.groundTruthSource === 'no_numeric_ground_truth' && !expected.expectedSourceId) {
    return 'not_applicable';
  }

  const component = firstComponent(mealResult);
  if (!component || !component.provenance.sourceGrounded) {
    return component?.chosenCandidateName ? 'wrong' : 'no_resolution';
  }

  if (expected.expectedSourceId && component.provenance.sourceId === expected.expectedSourceId) {
    return 'correct';
  }
  if (expected.canonicalEquivalents?.includes(component.provenance.sourceId ?? '')) {
    return 'acceptable_equivalent';
  }
  if (!expected.expectedSourceId && namesMatch(predictedNameOf(component), expected.expectedName)) {
    return 'correct';
  }
  return 'wrong';
}

// -------------------------------------------------------------------------------------------
// Expected-behavior mapping (provisional, documented -- Variant C's own 10-outcome vocabulary)
// -------------------------------------------------------------------------------------------

export type ExpectedBehaviorEvaluationC = {
  result: 'match' | 'partial' | 'mismatch';
  note: string;
};

export function evaluateExpectedBehaviorC(
  expectedBehavior: ExpectedBehavior,
  outcome: VariantCMealResult['outcome'],
  identification: IdentificationOutcome,
): ExpectedBehaviorEvaluationC {
  const identificationOk =
    identification === 'correct' || identification === 'acceptable_equivalent';
  const resolvedLike = outcome === 'resolved' || outcome === 'resolved_with_assumptions';

  switch (expectedBehavior) {
    case 'direct_resolution':
      if (outcome === 'resolved') return { result: 'match', note: 'resolved_as_expected' };
      if (outcome === 'resolved_with_assumptions') {
        return { result: 'partial', note: 'resolved_but_with_assumptions_not_strictly_expected' };
      }
      if (outcome === 'multiple_candidates' && identificationOk) {
        return { result: 'partial', note: 'unnecessary_multiple_candidates_flag_on_correct_top1' };
      }
      return { result: 'mismatch', note: `outcome_${outcome}_but_direct_resolution_expected` };

    case 'resolution_with_assumption':
      if (resolvedLike) return { result: 'match', note: 'resolved_as_expected' };
      return {
        result: 'mismatch',
        note: `outcome_${outcome}_but_resolution_with_assumption_expected`,
      };

    case 'clarification_required':
      if (outcome === 'clarification_required')
        return { result: 'match', note: 'asked_as_expected' };
      if (outcome === 'abstained' || outcome === 'partially_resolved') {
        return {
          result: 'partial',
          note: 'abstained_or_partial_instead_of_asking_but_not_falsely_confident',
        };
      }
      if (resolvedLike) return { result: 'mismatch', note: 'resolved_without_clarification' };
      return { result: 'mismatch', note: `outcome_${outcome}_unexpected` };

    case 'multiple_candidates_acceptable':
      if (outcome === 'multiple_candidates')
        return { result: 'match', note: 'multiple_candidates_as_expected' };
      if (resolvedLike && identificationOk) {
        return { result: 'partial', note: 'resolved_more_confidently_than_case_expected' };
      }
      return { result: 'mismatch', note: `outcome_${outcome}_unexpected` };

    case 'abstention_expected':
      if (outcome === 'abstained') return { result: 'match', note: 'abstained_as_expected' };
      if (outcome === 'clarification_required' || outcome === 'not_interpretable') {
        return {
          result: 'partial',
          note: 'asked_or_not_interpretable_instead_of_clean_abstention',
        };
      }
      return { result: 'mismatch', note: `outcome_${outcome}_when_abstention_was_expected` };
  }
}

// -------------------------------------------------------------------------------------------
// False confidence (spec §6.6/§7) -- provisional, documented, Variant-C-internal rule (distinct
// from Variant A's and Variant B's own rules, per task instruction not to invent a shared scale).
// -------------------------------------------------------------------------------------------

export function isFalseConfidentC(
  benchmarkCase: BenchmarkCase,
  outcome: VariantCMealResult['outcome'],
  identification: IdentificationOutcome,
): boolean {
  const resolvedLike = outcome === 'resolved' || outcome === 'resolved_with_assumptions';
  if (!resolvedLike) return false;
  if (identification === 'wrong' || identification === 'no_resolution') return true;
  return (
    benchmarkCase.expectedBehavior !== 'direct_resolution' &&
    benchmarkCase.expectedBehavior !== 'resolution_with_assumption'
  );
}

/** A "partially_resolved" meal is, by construction, never `resolved`/`resolved_with_assumptions`
 * -- this check exists as an explicit, tested guarantee (spec: "Eine teilweise aufgelöste
 * Mahlzeit darf nicht als sichere vollständige Auflösung gewertet werden"), not a derived value. */
export function isPartialMealMisreportedAsComplete(mealResult: VariantCMealResult): boolean {
  return (
    (mealResult.outcome === 'resolved' || mealResult.outcome === 'resolved_with_assumptions') &&
    mealResult.unresolvedComponentIds.length > 0
  );
}

// -------------------------------------------------------------------------------------------
// Provenance (spec §6.8)
// -------------------------------------------------------------------------------------------

export interface ProvenanceCheckC {
  sourceIdPresent: boolean;
  sourceTypePresent: boolean;
  hasUnbackedNumericResult: boolean;
  missingProvenanceComponentIds: string[];
}

export function evaluateProvenanceC(mealResult: VariantCMealResult): ProvenanceCheckC {
  const resolvedLike =
    mealResult.outcome === 'resolved' || mealResult.outcome === 'resolved_with_assumptions';
  const missingProvenanceComponentIds = mealResult.components
    .filter((c) => c.scaledNutrients !== null && !c.provenance.sourceGrounded)
    .map((c) => c.componentId);

  const component = firstComponent(mealResult);
  return {
    sourceIdPresent: Boolean(component?.provenance.sourceId),
    sourceTypePresent: Boolean(component?.provenance.sourceType),
    hasUnbackedNumericResult: resolvedLike && missingProvenanceComponentIds.length > 0,
    missingProvenanceComponentIds,
  };
}

// -------------------------------------------------------------------------------------------
// Macro evaluation (spec §6.4) -- per-100g comparison against the first component's chosen
// candidate, matching this corpus's own per-100g `referenceNutrients` convention (see module
// docstring; identical convention to Variant A's `evaluateMacros`).
// -------------------------------------------------------------------------------------------

export interface MacroErrorSampleC {
  nutrient: MacroNutrientKey;
  reference: number;
  predicted: number;
  absoluteError: number;
  relativeError: number | null;
}

export interface MacroEvaluationC {
  samples: MacroErrorSampleC[];
  excludedNutrients: string[];
  withinTolerance: boolean | null;
}

export function evaluateMacrosC(
  benchmarkCase: BenchmarkCase,
  mealResult: VariantCMealResult,
): MacroEvaluationC | null {
  const reference = benchmarkCase.referenceNutrients;
  if (!reference) return null;
  const component = firstComponent(mealResult);
  if (!component || !component.macrosPer100g) return null;

  const macros = component.macrosPer100g;
  const predictedByNutrient: Record<MacroNutrientKey, number | null> = {
    kcal: macros.kcal,
    protein_g: macros.protein_g,
    fat_g: macros.fat_g,
    carbs_g: macros.carbs_g,
  };

  const samples: MacroErrorSampleC[] = [];
  const excludedNutrients: string[] = [];
  const tolerance = toleranceBandFor(benchmarkCase.groundTruthSource);
  let withinTolerance: boolean | null = tolerance ? true : null;

  (['kcal', 'protein_g', 'fat_g', 'carbs_g'] as const).forEach((nutrient) => {
    const referenceValue = reference[nutrient];
    if (referenceValue === null || referenceValue === undefined) {
      excludedNutrients.push(nutrient);
      return;
    }
    const predicted = predictedByNutrient[nutrient];
    if (predicted === null) {
      // Structurally not expected today (source adapters always provide finite core-4 macros),
      // but never silently treated as 0 if it ever occurs.
      excludedNutrients.push(nutrient);
      return;
    }
    const absoluteError = Math.abs(predicted - referenceValue);
    const guard = NEAR_ZERO_GUARD[nutrient];
    const relativeError = relativeMacroError(nutrient, referenceValue, absoluteError);
    samples.push({ nutrient, reference: referenceValue, predicted, absoluteError, relativeError });

    if (tolerance && withinTolerance) {
      const pctLimit = nutrient === 'kcal' ? tolerance.kcalPct : tolerance.macroPct;
      const withinThisNutrient =
        relativeError !== null ? relativeError <= pctLimit : absoluteError <= guard * pctLimit;
      if (!withinThisNutrient) withinTolerance = false;
    }
  });

  return { samples, excludedNutrients, withinTolerance };
}

// -------------------------------------------------------------------------------------------
// Per-case integration
// -------------------------------------------------------------------------------------------

export interface CaseEvaluationC {
  caseId: string;
  outcome: VariantCMealResult['outcome'];
  identification: IdentificationOutcome;
  expectedBehavior: ExpectedBehaviorEvaluationC;
  falseConfident: boolean;
  partialMisreportedAsComplete: boolean;
  isCriticalFailure: boolean;
  componentMatch: ComponentMatchResultC;
  precisionRecallF1: PrecisionRecallF1;
  macros: MacroEvaluationC | null;
  provenance: ProvenanceCheckC;
  fastPathUsed: boolean;
  aiCalled: boolean;
  latencyMs: number;
}

export function evaluateVariantCCase(
  benchmarkCase: BenchmarkCase,
  raw: VariantCRawCaseResult,
): CaseEvaluationC {
  const { mealResult } = raw;
  const identification = evaluateIdentificationC(benchmarkCase, mealResult);
  const expectedBehavior = evaluateExpectedBehaviorC(
    benchmarkCase.expectedBehavior,
    mealResult.outcome,
    identification,
  );
  const falseConfident = isFalseConfidentC(benchmarkCase, mealResult.outcome, identification);
  const partialMisreportedAsComplete = isPartialMealMisreportedAsComplete(mealResult);
  const componentMatch = matchComponentsC(benchmarkCase.expectedComponents, mealResult.components);

  return {
    caseId: benchmarkCase.caseId,
    outcome: mealResult.outcome,
    identification,
    expectedBehavior,
    falseConfident,
    partialMisreportedAsComplete,
    isCriticalFailure: falseConfident || partialMisreportedAsComplete,
    componentMatch,
    precisionRecallF1: precisionRecallF1(componentMatch),
    macros: evaluateMacrosC(benchmarkCase, mealResult),
    provenance: evaluateProvenanceC(mealResult),
    fastPathUsed: mealResult.fastPath.used,
    aiCalled: mealResult.aiInterpretation.called,
    latencyMs: mealResult.latencyMs.totalMs,
  };
}
