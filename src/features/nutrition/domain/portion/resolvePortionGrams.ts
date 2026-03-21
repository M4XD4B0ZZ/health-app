import { detectCanonicalEntity } from '../detectCanonicalEntity';

/**
 * Resolves the target grams for a food item, considering unit-based portions.
 *
 * For unit-based foods like "egg", uses the canonical default portion.
 * Falls back to 100g only if no canonical portion is available.
 *
 * @param parsedName - The parsed food name (e.g., "egg", "eier")
 * @param quantityGrams - Explicit grams from parser (if any)
 * @param quantityCount - Count from parser (e.g., 2 for "2 eggs")
 * @returns Target grams for calculation
 */
export function resolvePortionGrams(
  parsedName: string,
  quantityGrams: number,
  quantityCount?: number,
): number {
  // If explicit grams are provided, use them (e.g., "200g ei")
  if (quantityGrams > 0) {
    return quantityGrams;
  }

  // Check if this is a canonical food with a default portion
  const canonicalEntity = detectCanonicalEntity(parsedName);
  if (canonicalEntity?.defaultPortion?.grams) {
    const count = quantityCount ?? 1; // Default to 1 if no count specified, but allow 0
    return count * canonicalEntity.defaultPortion.grams;
  }

  // Fallback to 100g for non-canonical foods
  return 100;
}
