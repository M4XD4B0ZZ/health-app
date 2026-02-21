/**
 * Aggregator for consumed macronutrients.
 * Takes a list of food entry macros and computes total consumed values.
 */

export interface ConsumedMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Aggregate consumed macros from food entries.
 *
 * Rules:
 * - Sum all macro values
 * - Round to whole numbers
 * - Never return negative values
 *
 * @param entries - Array of macro objects from food entries
 * @returns Aggregated consumed macros
 */
export function aggregateConsumed(
  entries: Array<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>,
): ConsumedMacros {
  const totals = entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // Round to whole numbers and ensure non-negative
  return {
    calories: Math.max(0, Math.round(totals.calories)),
    protein: Math.max(0, Math.round(totals.protein)),
    carbs: Math.max(0, Math.round(totals.carbs)),
    fat: Math.max(0, Math.round(totals.fat)),
  };
}
