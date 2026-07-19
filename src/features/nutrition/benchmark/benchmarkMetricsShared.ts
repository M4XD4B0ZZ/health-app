import { GroundTruthSource } from './BenchmarkCaseTypes';

/**
 * RESOLVER-V3-004: pure math/scoring helpers genuinely shared between Variant A
 * (`evaluateVariantACase.ts`/`aggregateVariantAMetrics.ts`) and Variant B
 * (`evaluateVariantBCase.ts`/`aggregateVariantBMetrics.ts`). Extracted from
 * RESOLVER-V3-003's Variant-A-only implementation because both variants apply the exact same
 * near-zero-denominator guard, tolerance bands and percentile/median/mean math against the same
 * `ReferenceNutrients`/`GroundTruthSource` vocabulary (spec §6.3/§6.4/§6.9) -- duplicating it would
 * have been the "unnecessary parallel structure" the task explicitly warns against. Variant A's
 * own modules re-export these symbols unchanged (see their top-of-file imports) so its existing
 * tests and its smoke-run baseline are unaffected by this refactor.
 */

/** Nearest-rank percentile over a list of latency (or other) samples (spec §6.9 p50/p95). Returns
 * `null` for an empty input rather than `0`, since "no data" is not "zero". */
export function percentile(samples: readonly number[], p: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type MacroNutrientKey = 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g';

/** Near-zero-denominator guard (spec §6.3/§6.4): below these reference thresholds, only absolute
 * error is reported -- a relative/percentage error against a near-zero denominator is misleading. */
export const NEAR_ZERO_GUARD: Record<MacroNutrientKey, number> = {
  kcal: 20,
  protein_g: 5,
  fat_g: 5,
  carbs_g: 5,
};

/** Tolerance bands, spec §6.4 -- selected by ground-truth level (how the reference number was
 * derived), not by benchmark category, per the spec's own reasoning column. Shared by both
 * variants since the bands are a property of the ground truth, not of which system produced the
 * prediction being compared against it. */
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

/** Relative error against `referenceValue`, guarded by `NEAR_ZERO_GUARD` -- `null` (not a
 * misleadingly large ratio) when the reference is below the near-zero threshold for `nutrient`. */
export function relativeMacroError(
  nutrient: MacroNutrientKey,
  referenceValue: number,
  absoluteError: number,
): number | null {
  const guard = NEAR_ZERO_GUARD[nutrient];
  return Math.abs(referenceValue) >= guard ? absoluteError / Math.abs(referenceValue) : null;
}
