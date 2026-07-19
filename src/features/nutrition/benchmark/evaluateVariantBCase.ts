import {
  BenchmarkCase,
  ExpectedBehavior,
  ExpectedComponent,
  ExpectedQuantityUnit,
} from './BenchmarkCaseTypes';
import { IdentificationOutcome } from './evaluateVariantACase';
import {
  VariantBComponentEstimate,
  VariantBEstimationResult,
  VariantBRawCaseResult,
} from './VariantBTypes';
import {
  checkComponentTotalsConsistency,
  ComponentTotalsConsistency,
} from './validateVariantBResponse';
import {
  MacroNutrientKey,
  NEAR_ZERO_GUARD,
  relativeMacroError,
  toleranceBandFor,
} from './benchmarkMetricsShared';

/**
 * RESOLVER-V3-004: pure evaluation of one normalized Variant B result against its benchmark
 * case's ground truth. No network, no I/O -- mirrors RESOLVER-V3-003's `evaluateVariantACase.ts`
 * structural role, but adapted for Variant B's different result shape (no BLS `sourceId`, a
 * component *list* rather than a single "best" candidate, and its own outcome vocabulary).
 */

// -------------------------------------------------------------------------------------------
// Food-name matching (Variant B has no sourceId to compare -- only free-text names)
// -------------------------------------------------------------------------------------------

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Provisional, documented Variant-B-internal name-matching heuristic (there is no BLS/OFF/USDA
 * `sourceId` on a free-text AI estimate to compare exactly, unlike Variant A's
 * `evaluateIdentification`). Three progressively looser checks, in order:
 * 1. Exact match after normalization.
 * 2. "Compact form" (spaces removed) substring match either direction -- handles German
 *    compound-vs-split-word variance (e.g. "Haferflocken" vs "Hafer Flocken").
 * 3. Token-overlap ratio > 0.5 of the shorter name's significant (length >= 3) tokens -- handles
 *    a shorter/less-qualified predicted name still referring to the same food (e.g. "Reis (roh)"
 *    vs "Reis poliert, roh"), while a materially different food that merely shares one generic
 *    token (e.g. "Tomate mit Mozzarella" vs "Tomate roh") stays below the 0.5 threshold and is
 *    correctly classified as a different food.
 * Not NLP-grade; good enough for a smoke corpus, documented as provisional (ROADMAP.md does not
 * prescribe an exact algorithm here).
 */
export function namesMatch(predictedName: string, expectedName: string): boolean {
  const a = normalizeForMatch(predictedName);
  const b = normalizeForMatch(expectedName);
  if (!a || !b) return false;
  if (a === b) return true;

  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');
  if (
    compactA.length >= 4 &&
    compactB.length >= 4 &&
    (compactA.includes(compactB) || compactB.includes(compactA))
  ) {
    return true;
  }

  const tokensA = a.split(' ').filter((t) => t.length >= 3);
  const tokensB = b.split(' ').filter((t) => t.length >= 3);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  const ratio = overlap / Math.min(tokensA.length, tokensB.length);
  return ratio > 0.5;
}

// -------------------------------------------------------------------------------------------
// Component decomposition: precision/recall/F1 (spec §6.2)
// -------------------------------------------------------------------------------------------

export interface ComponentMatchResult {
  truePositives: number;
  /** `required: true` expected components with no matching predicted component (FN). */
  falseNegatives: number;
  /** Predicted components matching no expected component at all (FP/hallucination). */
  falsePositives: number;
  /** `required: false` expected components with no matching predicted component -- tracked
   * separately, never counted into FN (spec §6.2). */
  optionalMissing: number;
  matchedExpectedIds: string[];
  hallucinatedComponentNames: string[];
  missingComponentNames: string[];
}

export function matchComponents(
  expected: readonly ExpectedComponent[],
  predicted: readonly VariantBComponentEstimate[],
): ComponentMatchResult {
  const unmatchedPredicted = [...predicted];
  let truePositives = 0;
  let falseNegatives = 0;
  let optionalMissing = 0;
  const matchedExpectedIds: string[] = [];
  const missingComponentNames: string[] = [];

  for (const expectedComponent of expected) {
    const idx = unmatchedPredicted.findIndex((p) =>
      namesMatch(p.name, expectedComponent.expectedName),
    );
    if (idx >= 0) {
      truePositives += 1;
      matchedExpectedIds.push(expectedComponent.componentId);
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
    matchedExpectedIds,
    hallucinatedComponentNames: unmatchedPredicted.map((p) => p.name),
    missingComponentNames,
  };
}

export interface PrecisionRecallF1 {
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

/** `null` (never a fabricated 0/1) when the denominator is 0 -- e.g. no components predicted and
 * none expected. Accepts any object carrying the three counters (not necessarily a full
 * `ComponentMatchResult`), so aggregated corpus-wide totals can reuse this same formula. */
export function precisionRecallF1(
  match: Pick<ComponentMatchResult, 'truePositives' | 'falseNegatives' | 'falsePositives'>,
): PrecisionRecallF1 {
  const predictedPositives = match.truePositives + match.falsePositives;
  const actualPositives = match.truePositives + match.falseNegatives;
  const precision = predictedPositives === 0 ? null : match.truePositives / predictedPositives;
  const recall = actualPositives === 0 ? null : match.truePositives / actualPositives;
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

// -------------------------------------------------------------------------------------------
// Quantity / unit evaluation (spec §6.3)
// -------------------------------------------------------------------------------------------

const PIECE_LIKE_GUARD: Record<ExpectedQuantityUnit, number> = {
  g: 5,
  ml: 5,
  piece: 1,
  portion: 1,
};

export interface QuantityEvaluation {
  componentId: string;
  unitCorrect: boolean | null;
  absoluteDeviation: number | null;
  relativeDeviation: number | null;
  /** `true` when the ground truth itself has no fixed number (only a `portionDescription`) and
   * the prediction either also gave no fixed number, or gave one but flagged an assumption about
   * it -- i.e. did not present an unbacked number as certain (spec §6.3). `null` when not
   * applicable (ground truth has a concrete numeric quantity). */
  handledUnknownQuantityAppropriately: boolean | null;
}

/** Evaluates one matched (expected, predicted) component pair's quantity. `null` when the
 * expected component has no `expectedQuantity` at all (nothing to evaluate). */
export function evaluateQuantity(
  expectedComponent: ExpectedComponent,
  predictedComponent: VariantBComponentEstimate,
): QuantityEvaluation | null {
  const expectedQuantity = expectedComponent.expectedQuantity;
  if (!expectedQuantity) return null;

  const predictedQuantity = predictedComponent.quantity;
  const unitCorrect =
    expectedQuantity.unit === undefined || predictedQuantity.unit === undefined
      ? null
      : predictedQuantity.unit === expectedQuantity.unit;

  let absoluteDeviation: number | null = null;
  let relativeDeviation: number | null = null;
  if (
    expectedQuantity.value !== undefined &&
    predictedQuantity.value !== undefined &&
    expectedQuantity.unit !== undefined &&
    predictedQuantity.unit === expectedQuantity.unit
  ) {
    absoluteDeviation = Math.abs(predictedQuantity.value - expectedQuantity.value);
    const guard = PIECE_LIKE_GUARD[expectedQuantity.unit];
    relativeDeviation =
      Math.abs(expectedQuantity.value) >= guard
        ? absoluteDeviation / Math.abs(expectedQuantity.value)
        : null;
  }

  let handledUnknownQuantityAppropriately: boolean | null = null;
  if (expectedQuantity.value === undefined && expectedQuantity.portionDescription !== undefined) {
    handledUnknownQuantityAppropriately =
      predictedQuantity.value === undefined || predictedComponent.assumptions.length > 0;
  }

  return {
    componentId: expectedComponent.componentId,
    unitCorrect,
    absoluteDeviation,
    relativeDeviation,
    handledUnknownQuantityAppropriately,
  };
}

// -------------------------------------------------------------------------------------------
// Macro evaluation (spec §6.4) -- normalized to per-100g so it is comparable to the same
// per-100g `referenceNutrients` Variant A is scored against (see module docstring below).
// -------------------------------------------------------------------------------------------

export interface MacroErrorSample {
  nutrient: MacroNutrientKey;
  reference: number;
  predicted: number;
  absoluteError: number;
  relativeError: number | null;
}

export interface MacroEvaluationB {
  samples: MacroErrorSample[];
  excludedNutrients: string[];
  withinTolerance: boolean | null;
  /** `false` when macro comparison could not be normalized to a per-100g basis at all (no gram
   * quantity on the matched component) -- distinct from "no numeric ground truth". Per
   * ROADMAP.md's "not_evaluable" instruction, this is surfaced explicitly, never silently
   * skipped. */
  normalizable: boolean;
}

/**
 * Normalizes one component's predicted macros to a per-100g basis using the component's *own*
 * reported quantity, only when it reported the quantity in grams. This is required to fairly
 * compare against `referenceNutrients`, which is always a per-100g BLS-style figure (the same
 * convention Variant A's `evaluateMacros` compares `CanonicalFood.macrosPer100g` against
 * directly) -- Variant B instead naturally estimates a *portion* total, so simply comparing its
 * raw numbers against `referenceNutrients` would conflate "wrong calorie density" with "wrong
 * portion size" (already covered separately by `evaluateQuantity`/spec §6.3). When the component
 * used a non-gram unit (`piece`/`portion`) with no gram equivalent given, there is no reliable
 * way to back out a per-100g density -- this is reported as `not evaluable`, never guessed.
 */
export function predictedPer100g(
  component: VariantBComponentEstimate,
): Record<MacroNutrientKey, number | null> | null {
  const { value, unit } = component.quantity;
  if (unit !== 'g' || value === undefined || value <= 0) return null;
  const scale = 100 / value;
  const scaleOrNull = (v: number | null): number | null => (v === null ? null : v * scale);
  return {
    kcal: scaleOrNull(component.kcal),
    protein_g: scaleOrNull(component.protein_g),
    fat_g: scaleOrNull(component.fat_g),
    carbs_g: scaleOrNull(component.carbs_g),
  };
}

/**
 * Compares one matched component's per-100g-normalized macros against `referenceNutrients`.
 * Only defined for cases with exactly one expected component (matching Variant A's own scope:
 * `referenceNutrients` is a single object, not per-component) that was actually matched by a
 * predicted component. Returns `null` when there is no numeric ground truth, no matched
 * component, or (see `normalizable`) the component's quantity could not be expressed in grams.
 */
export function evaluateMacrosB(
  benchmarkCase: BenchmarkCase,
  matchedComponent: VariantBComponentEstimate | null,
): MacroEvaluationB | null {
  const reference = benchmarkCase.referenceNutrients;
  if (!reference || !matchedComponent) return null;

  const normalized = predictedPer100g(matchedComponent);
  if (!normalized) {
    return { samples: [], excludedNutrients: [], withinTolerance: null, normalizable: false };
  }

  const samples: MacroErrorSample[] = [];
  const excludedNutrients: string[] = [];
  const tolerance = toleranceBandFor(benchmarkCase.groundTruthSource);
  let withinTolerance: boolean | null = tolerance ? true : null;

  (['kcal', 'protein_g', 'fat_g', 'carbs_g'] as const).forEach((nutrient) => {
    const referenceValue = reference[nutrient];
    if (referenceValue === null || referenceValue === undefined) {
      excludedNutrients.push(nutrient);
      return;
    }
    const predicted = normalized[nutrient];
    if (predicted === null) {
      // The AI did not provide this macro for the matched component -- missing, not zero; not a
      // sample, but also not silently ignored: callers can see it is absent from `samples` while
      // the reference expected it (surfaced in reports as a "missing predicted value" case).
      return;
    }
    const absoluteError = Math.abs(predicted - referenceValue);
    const relativeError = relativeMacroError(nutrient, referenceValue, absoluteError);
    samples.push({ nutrient, reference: referenceValue, predicted, absoluteError, relativeError });

    if (tolerance && withinTolerance) {
      const guard = NEAR_ZERO_GUARD[nutrient];
      const pctLimit = nutrient === 'kcal' ? tolerance.kcalPct : tolerance.macroPct;
      const withinThisNutrient =
        relativeError !== null ? relativeError <= pctLimit : absoluteError <= guard * pctLimit;
      if (!withinThisNutrient) withinTolerance = false;
    }
  });

  return { samples, excludedNutrients, withinTolerance, normalizable: true };
}

// -------------------------------------------------------------------------------------------
// Identification (single-target cases only, mirroring Variant A's own scope)
// -------------------------------------------------------------------------------------------

/** Components carried by whichever outcome variant actually has them -- `estimated` nests them
 * under `meal.components`, `clarification_required`/`abstained` carry a top-level (possibly
 * partial) `components` list, the rest carry none. */
function resultComponents(result: VariantBEstimationResult): readonly VariantBComponentEstimate[] {
  if (result.outcome === 'estimated') return result.meal.components;
  if (result.outcome === 'clarification_required' || result.outcome === 'abstained') {
    return result.components;
  }
  return [];
}

export function evaluateIdentificationB(
  benchmarkCase: BenchmarkCase,
  result: VariantBEstimationResult,
): IdentificationOutcome {
  if (benchmarkCase.expectedComponents.length !== 1) return 'not_applicable';
  if (benchmarkCase.groundTruthSource === 'no_numeric_ground_truth') return 'not_applicable';

  const expected = benchmarkCase.expectedComponents[0];
  const predictedComponents = resultComponents(result);
  if (result.outcome !== 'estimated') {
    return predictedComponents.length === 0 ? 'no_resolution' : 'wrong';
  }
  if (predictedComponents.length === 0) return 'no_resolution';

  const matched = predictedComponents.find((p) => namesMatch(p.name, expected.expectedName));
  return matched ? 'correct' : 'wrong';
}

function findMatchedComponent(
  benchmarkCase: BenchmarkCase,
  result: VariantBEstimationResult,
): VariantBComponentEstimate | null {
  if (benchmarkCase.expectedComponents.length !== 1 || result.outcome !== 'estimated') return null;
  const expected = benchmarkCase.expectedComponents[0];
  return result.meal.components.find((p) => namesMatch(p.name, expected.expectedName)) ?? null;
}

// -------------------------------------------------------------------------------------------
// Expected-behavior mapping (provisional, documented tri-state table for Variant B's own
// outcome vocabulary -- distinct from Variant A's table since the outcome vocabularies differ)
// -------------------------------------------------------------------------------------------

export type ExpectedBehaviorEvaluationB = {
  result: 'match' | 'partial' | 'mismatch';
  note: string;
};

export function evaluateExpectedBehaviorB(
  expectedBehavior: ExpectedBehavior,
  outcome: VariantBEstimationResult['outcome'],
  identification: IdentificationOutcome,
): ExpectedBehaviorEvaluationB {
  const identificationOk =
    identification === 'correct' || identification === 'acceptable_equivalent';

  switch (expectedBehavior) {
    case 'direct_resolution':
      if (outcome === 'estimated') return { result: 'match', note: 'estimated_as_expected' };
      return { result: 'mismatch', note: `outcome_${outcome}_but_direct_resolution_expected` };

    case 'resolution_with_assumption':
      if (outcome === 'estimated')
        return { result: 'match', note: 'estimated_with_or_without_assumptions' };
      return {
        result: 'mismatch',
        note: `outcome_${outcome}_but_resolution_with_assumption_expected`,
      };

    case 'clarification_required':
      if (outcome === 'clarification_required')
        return { result: 'match', note: 'asked_as_expected' };
      if (outcome === 'abstained') {
        return { result: 'partial', note: 'abstained_instead_of_asking_but_not_falsely_confident' };
      }
      if (outcome === 'estimated')
        return { result: 'mismatch', note: 'answered_without_clarification' };
      return { result: 'mismatch', note: `outcome_${outcome}_unexpected` };

    case 'multiple_candidates_acceptable':
      if (outcome === 'estimated' && identificationOk)
        return { result: 'match', note: 'estimated_correctly' };
      if (outcome === 'clarification_required') {
        return { result: 'partial', note: 'asked_when_any_acceptable_candidate_would_have_done' };
      }
      return { result: 'mismatch', note: `outcome_${outcome}_unexpected` };

    case 'abstention_expected':
      if (outcome === 'abstained') return { result: 'match', note: 'abstained_as_expected' };
      if (outcome === 'clarification_required') {
        return {
          result: 'partial',
          note: 'asked_instead_of_clean_abstention_but_not_falsely_confident',
        };
      }
      return { result: 'mismatch', note: `outcome_${outcome}_when_abstention_was_expected` };
  }
}

// -------------------------------------------------------------------------------------------
// False confidence (spec §6.6/§7) -- provisional, documented Variant-B-internal rule, distinct
// from Variant A's (ROADMAP.md: do not invent a universal cross-variant threshold here).
// -------------------------------------------------------------------------------------------

/** Native-confidence threshold above which a macro result outside tolerance is treated as false
 * confidence, even when identification was correct (Variant B can hallucinate plausible-looking
 * numbers for the right food, unlike Variant A whose numbers come directly from the BLS record it
 * selected) -- a provisional, documented Variant-B-internal threshold (ROADMAP.md: "verwende eine
 * klar dokumentierte, vorläufige Variante-B-interne Regel"). */
export const FALSE_CONFIDENCE_NATIVE_CONFIDENCE_THRESHOLD = 0.7;

export function isFalseConfidentB(
  benchmarkCase: BenchmarkCase,
  outcome: VariantBEstimationResult['outcome'],
  identification: IdentificationOutcome,
  macros: MacroEvaluationB | null,
  overallConfidence: number | null,
): boolean {
  if (outcome !== 'estimated') return false;
  if (identification === 'wrong' || identification === 'no_resolution') return true;
  if (
    benchmarkCase.expectedBehavior === 'clarification_required' ||
    benchmarkCase.expectedBehavior === 'abstention_expected'
  ) {
    // A confident direct estimate when the ground truth says a targeted question or an honest
    // abstention was warranted is false confidence, regardless of identification correctness.
    // `multiple_candidates_acceptable` is deliberately NOT included here (unlike Variant A's
    // structurally different rule): picking any one of several acceptable answers confidently is
    // not false confidence for a free-text AI estimator the way it is for Variant A's single-
    // candidate "accepted" status -- it is only false confidence if that pick was also wrong
    // (already covered by the identification check above).
    return true;
  }
  if (
    macros &&
    macros.withinTolerance === false &&
    overallConfidence !== null &&
    overallConfidence >= FALSE_CONFIDENCE_NATIVE_CONFIDENCE_THRESHOLD
  ) {
    return true;
  }
  return false;
}

/** A confidently-asserted brand/preparation not present in any expected component -- "erfundenes
 * Markenprodukt" (spec §7, critical). Only meaningful for `estimated` results. */
export function hasHallucinatedBrand(
  benchmarkCase: BenchmarkCase,
  result: VariantBEstimationResult,
): boolean {
  if (result.outcome !== 'estimated') return false;
  const expectedBrands = new Set(
    benchmarkCase.expectedComponents
      .map((c) => c.expectedBrand)
      .filter((b): b is string => Boolean(b)),
  );
  return result.meal.components.some((c) => c.brand && !expectedBrands.has(c.brand));
}

// -------------------------------------------------------------------------------------------
// Provenance (spec §6.8) -- Variant B is, by design, never source-grounded.
// -------------------------------------------------------------------------------------------

export interface ProvenanceCheckB {
  provenanceType: 'ai_estimate';
  /** Structurally always `false` -- `VariantBComponentEstimate` has no `sourceId`-shaped field,
   * so a fabricated BLS/OFF/USDA reference cannot even be expressed by this contract. Kept as an
   * explicit, tested field for report symmetry with Variant A rather than assumed silently. */
  hasFabricatedSourceReference: boolean;
}

export function evaluateProvenanceB(): ProvenanceCheckB {
  return { provenanceType: 'ai_estimate', hasFabricatedSourceReference: false };
}

// -------------------------------------------------------------------------------------------
// Per-case integration
// -------------------------------------------------------------------------------------------

export interface CaseEvaluationB {
  caseId: string;
  runIndex: number;
  outcome: VariantBEstimationResult['outcome'];
  identification: IdentificationOutcome;
  expectedBehavior: ExpectedBehaviorEvaluationB;
  falseConfident: boolean;
  hallucinatedBrand: boolean;
  isCriticalFailure: boolean;
  componentMatch: ComponentMatchResult;
  precisionRecallF1: PrecisionRecallF1;
  quantities: QuantityEvaluation[];
  macros: MacroEvaluationB | null;
  componentTotalsConsistency: ComponentTotalsConsistency;
  provenance: ProvenanceCheckB;
  overallConfidence: number | null;
  latencyMs: number;
  /** `true` for a technical-failure outcome (`error`/`invalid_response`/`unavailable`) -- these
   * are counted transparently but excluded from identification/macro aggregation (ROADMAP.md
   * "not_evaluable", never silently dropped). */
  technicalFailure: boolean;
}

function overallConfidenceOf(result: VariantBEstimationResult): number | null {
  return result.outcome === 'estimated' ? result.meal.overallConfidence : null;
}

export function evaluateVariantBCase(
  benchmarkCase: BenchmarkCase,
  raw: VariantBRawCaseResult,
): CaseEvaluationB {
  const { result } = raw;
  const identification = evaluateIdentificationB(benchmarkCase, result);
  const expectedBehavior = evaluateExpectedBehaviorB(
    benchmarkCase.expectedBehavior,
    result.outcome,
    identification,
  );
  const matchedComponent = findMatchedComponent(benchmarkCase, result);
  const macros = evaluateMacrosB(benchmarkCase, matchedComponent);
  const overallConfidence = overallConfidenceOf(result);
  const falseConfident = isFalseConfidentB(
    benchmarkCase,
    result.outcome,
    identification,
    macros,
    overallConfidence,
  );
  const hallucinatedBrand = hasHallucinatedBrand(benchmarkCase, result);

  const predictedComponents = result.outcome === 'estimated' ? result.meal.components : [];
  const componentMatch = matchComponents(benchmarkCase.expectedComponents, predictedComponents);
  const quantities = benchmarkCase.expectedComponents
    .map((expectedComponent) => {
      const predicted = predictedComponents.find((p) =>
        namesMatch(p.name, expectedComponent.expectedName),
      );
      return predicted ? evaluateQuantity(expectedComponent, predicted) : null;
    })
    .filter((q): q is QuantityEvaluation => q !== null);

  const componentTotalsConsistency =
    result.outcome === 'estimated'
      ? checkComponentTotalsConsistency(result.meal.components, result.meal.totals)
      : { checked: false, mismatched: false, componentSumKcal: null, assertedTotalKcal: null };

  return {
    caseId: benchmarkCase.caseId,
    runIndex: raw.request.runIndex,
    outcome: result.outcome,
    identification,
    expectedBehavior,
    falseConfident,
    hallucinatedBrand,
    isCriticalFailure: falseConfident || hallucinatedBrand,
    componentMatch,
    precisionRecallF1: precisionRecallF1(componentMatch),
    quantities,
    macros,
    componentTotalsConsistency,
    provenance: evaluateProvenanceB(),
    overallConfidence,
    latencyMs: result.meta.latencyMs,
    technicalFailure:
      result.outcome === 'error' ||
      result.outcome === 'invalid_response' ||
      result.outcome === 'unavailable',
  };
}
