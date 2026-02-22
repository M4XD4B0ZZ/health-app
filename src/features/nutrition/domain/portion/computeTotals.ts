import { NutritionPer100g } from '../models/NutritionTypes';

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionTotalsBreakdown {
  per100g: NutritionPer100g;
  gramsUsed: number;
  multiplier: number;
  totals: NutritionTotals;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeTotals(
  per100g: NutritionPer100g,
  grams: number,
  multiplier: number,
): NutritionTotalsBreakdown {
  const gramsUsed = Math.max(0, grams) * Math.max(0, multiplier);
  const factor = gramsUsed / 100;
  const totals: NutritionTotals = {
    calories: round2(per100g.calories * factor),
    protein: round2(per100g.protein * factor),
    carbs: round2(per100g.carbs * factor),
    fat: round2(per100g.fat * factor),
  };

  return {
    per100g,
    gramsUsed: round2(gramsUsed),
    multiplier: round2(multiplier),
    totals,
  };
}
