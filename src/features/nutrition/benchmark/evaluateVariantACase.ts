import { BenchmarkCase, ExpectedBehavior, GroundTruthSource } from './BenchmarkCaseTypes';
import { VariantARawResult } from './ResolverV3VariantAAdapter';
import { ResolverStatus } from '../domain/models/ResolverDecision';

/**
 * RESOLVER-V3-003: pure evaluation of one raw resolver result against its benchmark case's
 * ground truth. No network, no I/O -- everything here is a pure function over already-collected
 * data, so it is directly unit-testable with small controlled inputs (task instruction).
 */

export type IdentificationOutcome =
  | 'correct'
  | 'acceptable_equivalent'
  | 'wrong'
  | 'no_resolution'
  | 'not_applicable';

export function evaluateIdentification(
  benchmarkCase: BenchmarkCase,
  raw: VariantARawResult,
): IdentificationOutcome {
  const expected = benchmarkCase.expectedComponents[0];
  if (!expected) {
    // Cases with no expected component (e.g. abstention_expected DACH dishes) have nothing to
    // identify -- identification is not applicable, not "wrong" by default.
    return 'not_applicable';
  }

  if (benchmarkCase.groundTruthSource === 'no_numeric_ground_truth' && !expected.expectedSourceId) {
    // A case can describe *what* is ambiguous (e.g. Speck's three BLS clusters) without naming a
    // single falsifiable "correct" identity -- identification is not a meaningful metric there;
    // only `expectedBehavior`/false-confidence matter for it (spec §6.6's framing, not §6.1's).
    return 'not_applicable';
  }

  const best = raw.decision.best;
  if (!best) {
    return 'no_resolution';
  }

  if (expected.expectedSourceId && best.food.sourceId === expected.expectedSourceId) {
    return 'correct';
  }

  if (expected.canonicalEquivalents?.includes(best.food.sourceId ?? '')) {
    return 'acceptable_equivalent';
  }

  if (!expected.expectedSourceId && best.food.name === expected.expectedName) {
    return 'correct';
  }

  return 'wrong';
}

/** Tri-state expected-behavior comparison result -- see the harness README for the full,
 * documented provisional mapping table this function implements. */
export type ExpectedBehaviorEvaluation = {
  result: 'match' | 'partial' | 'mismatch';
  note: string;
};

export function evaluateExpectedBehavior(
  expectedBehavior: ExpectedBehavior,
  status: ResolverStatus,
  identification: IdentificationOutcome,
): ExpectedBehaviorEvaluation {
  const identificationOk =
    identification === 'correct' || identification === 'acceptable_equivalent';

  switch (expectedBehavior) {
    case 'direct_resolution':
    case 'resolution_with_assumption':
      if (status === 'accepted') return { result: 'match', note: 'accepted_as_expected' };
      if (status === 'ambiguous' && identificationOk) {
        return { result: 'partial', note: 'unnecessary_ambiguous_flag_on_correct_top1' };
      }
      return { result: 'mismatch', note: `status_${status}_but_direct_resolution_expected` };

    case 'clarification_required':
      if (status === 'ambiguous') {
        return { result: 'partial', note: 'resolver_ambiguous_status_used_as_clarification_proxy' };
      }
      if (status === 'rejected') {
        return { result: 'partial', note: 'abstained_instead_of_asking_but_not_falsely_confident' };
      }
      return { result: 'mismatch', note: 'accepted_without_clarification_signal' };

    case 'multiple_candidates_acceptable':
      if (status === 'ambiguous') return { result: 'match', note: 'ambiguous_as_expected' };
      if (status === 'accepted' && identificationOk) {
        return { result: 'partial', note: 'resolved_more_confidently_than_case_expected' };
      }
      return { result: 'mismatch', note: `status_${status}_unexpected` };

    case 'abstention_expected':
      if (status === 'rejected') return { result: 'match', note: 'abstained_as_expected' };
      if (status === 'ambiguous')
        return { result: 'partial', note: 'ambiguous_instead_of_clean_abstention' };
      return { result: 'mismatch', note: 'resolved_confidently_when_abstention_was_expected' };
  }
}

/**
 * Provisional false-confidence rule for Variant A (resolver-only boundary), per the task's
 * explicit instruction not to invent a universal cross-variant confidence threshold: a case is
 * false-confident when the resolver's own *strongest* signal (`status === 'accepted'`) coincides
 * with either a wrong/missing identification, or a case whose ground truth says a confident
 * direct answer was not warranted in the first place. Cases where the resolver itself already
 * signals `ambiguous`/`rejected` are not classified false-confident here, even though that is
 * only a structural proxy for genuine user-facing clarification (see the harness README).
 */
export function isFalseConfident(
  benchmarkCase: BenchmarkCase,
  status: ResolverStatus,
  identification: IdentificationOutcome,
): boolean {
  if (status !== 'accepted') return false;
  if (identification === 'wrong' || identification === 'no_resolution') return true;
  return (
    benchmarkCase.expectedBehavior !== 'direct_resolution' &&
    benchmarkCase.expectedBehavior !== 'resolution_with_assumption'
  );
}

export interface MacroErrorSample {
  nutrient: 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g';
  reference: number;
  predicted: number;
  absoluteError: number;
  /** `null` when the near-zero-denominator guard (spec §6.3/§6.4) applies -- reported separately
   * from "missing", which uses `excluded` below instead. */
  relativeError: number | null;
}

export interface MacroEvaluation {
  samples: MacroErrorSample[];
  /** Nutrients whose reference value was `null` ("not provided by this ground-truth source") --
   * these are never treated as 0 and never enter `samples`. */
  excludedNutrients: string[];
  withinTolerance: boolean | null;
}

const NEAR_ZERO_GUARD: Record<MacroErrorSample['nutrient'], number> = {
  kcal: 20,
  protein_g: 5,
  fat_g: 5,
  carbs_g: 5,
};

/** Tolerance bands, spec §6.4 -- selected by ground-truth level (how the reference number was
 * derived), not by benchmark category, since that is what the spec's own reasoning column keys
 * off ("belastbare Ebene-1/2/3-Ground-Truth erlaubt engere Bänder"). */
export function toleranceBandFor(
  groundTruthSource: GroundTruthSource,
): { kcalPct: number; macroPct: number } | null {
  switch (groundTruthSource) {
    case 'manufacturer_label':
    case 'official_restaurant_data':
    case 'bls_generic':
    case 'other_verified_database':
      return { kcalPct: 0.1, macroPct: 0.15 };
    case 'documented_recipe':
      return { kcalPct: 0.2, macroPct: 0.25 };
    case 'curated_reference_range':
    case 'no_numeric_ground_truth':
      return null;
  }
}

/**
 * Compares the resolved candidate's macros (if any) against `referenceNutrients`. Returns `null`
 * for the whole evaluation when there is no numeric ground truth or no resolved candidate to
 * compare -- never fabricates a zero-error "pass".
 */
export function evaluateMacros(
  benchmarkCase: BenchmarkCase,
  raw: VariantARawResult,
): MacroEvaluation | null {
  const reference = benchmarkCase.referenceNutrients;
  if (!reference) return null;
  const best = raw.decision.best;
  if (!best) return null;

  const macros = best.food.macrosPer100g;
  const predictedByNutrient: Record<MacroErrorSample['nutrient'], number> = {
    kcal: macros.kcal,
    protein_g: macros.protein,
    fat_g: macros.fat,
    carbs_g: macros.carbs,
  };

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
    const predicted = predictedByNutrient[nutrient];
    const absoluteError = Math.abs(predicted - referenceValue);
    const guard = NEAR_ZERO_GUARD[nutrient];
    const relativeError =
      Math.abs(referenceValue) >= guard ? absoluteError / Math.abs(referenceValue) : null;
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

export interface ProvenanceCheck {
  sourceIdPresent: boolean;
  sourceTypePresent: boolean;
  usedAiAsSource: boolean;
  hasUnbackedNumericResult: boolean;
}

export function evaluateProvenance(raw: VariantARawResult): ProvenanceCheck {
  const best = raw.decision.best;
  if (!best) {
    return {
      sourceIdPresent: false,
      sourceTypePresent: false,
      usedAiAsSource: false,
      hasUnbackedNumericResult: false,
    };
  }
  return {
    sourceIdPresent: Boolean(best.food.sourceId),
    sourceTypePresent: Boolean(best.food.source),
    usedAiAsSource: best.food.source === 'ai',
    hasUnbackedNumericResult: !best.food.sourceId,
  };
}

export interface CaseEvaluation {
  caseId: string;
  status: ResolverStatus;
  identification: IdentificationOutcome;
  expectedBehavior: ExpectedBehaviorEvaluation;
  falseConfident: boolean;
  isCriticalFailure: boolean;
  macros: MacroEvaluation | null;
  provenance: ProvenanceCheck;
  latencyMs: number;
}

export function evaluateVariantACase(
  benchmarkCase: BenchmarkCase,
  raw: VariantARawResult,
): CaseEvaluation {
  const identification = evaluateIdentification(benchmarkCase, raw);
  const expectedBehaviorEvaluation = evaluateExpectedBehavior(
    benchmarkCase.expectedBehavior,
    raw.decision.status,
    identification,
  );
  const falseConfident = isFalseConfident(benchmarkCase, raw.decision.status, identification);

  return {
    caseId: benchmarkCase.caseId,
    status: raw.decision.status,
    identification,
    expectedBehavior: expectedBehaviorEvaluation,
    falseConfident,
    // Per spec §7, false confidence is itself always a critical failure; a "wrong" identification
    // under an ambiguous/rejected status is high-severity but not critical (the system did not
    // silently assert it).
    isCriticalFailure: falseConfident,
    macros: evaluateMacros(benchmarkCase, raw),
    provenance: evaluateProvenance(raw),
    latencyMs: raw.latencyMs,
  };
}
