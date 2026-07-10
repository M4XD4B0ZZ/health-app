import { SavedMealTemplate } from '../../../features/nutrition/domain/models/SavedMealTypes';

/**
 * SM-005: approximate total calories for a template, computed from the frozen per100g
 * snapshots (SM-002) of its items. Purely factual (no evaluation) — items without a
 * snapshot are skipped rather than treated as zero. Returns null if no item has one.
 */
export function templateTotalCalories(template: SavedMealTemplate): number | null {
  const known = template.items.filter((item) => item.per100g);
  if (known.length === 0) {
    return null;
  }
  return known.reduce((sum, item) => sum + (item.per100g!.calories * item.quantityGrams) / 100, 0);
}
