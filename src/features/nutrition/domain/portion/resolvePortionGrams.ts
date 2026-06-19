import { detectCanonicalEntity } from '../detectCanonicalEntity';

export type PortionGramsReasonCode =
  | 'EXPLICIT_GRAMS'
  | 'KNOWN_DEFAULT_PORTION'
  | 'COUNT_WITHOUT_PORTION_HINT'
  | 'NO_QUANTITY_LEGACY_100G_FALLBACK';

export type ResolvePortionGramsResult =
  | {
      status: 'resolved';
      grams: number;
      reasonCode: PortionGramsReasonCode;
      gramsPerUnit?: number;
    }
  | {
      status: 'needs_edit';
      reasonCode: PortionGramsReasonCode;
    };

/**
 * Resolves the target grams for a food item, considering unit-based portions.
 *
 * For unit-based foods like "egg", uses the canonical default portion.
 * Explicit count/slice/piece inputs never fall back to 100g when no known portion exists.
 *
 * @param parsedName - The parsed food name (e.g., "egg", "eier")
 * @param quantityGrams - Explicit grams from parser (if any)
 * @param quantityCount - Count from parser (e.g., 2 for "2 eggs")
 * @returns Safe portion resolution result for calculation or needs-edit handling
 */
export function resolvePortionGrams(
  parsedName: string,
  quantityGrams: number,
  quantityCount?: number,
): ResolvePortionGramsResult {
  // If explicit grams are provided, use them (e.g., "200g ei")
  if (quantityGrams > 0) {
    return {
      status: 'resolved',
      grams: quantityGrams,
      reasonCode: 'EXPLICIT_GRAMS',
    };
  }

  // Check if this is a canonical food with a default portion
  const canonicalEntity = detectCanonicalEntity(parsedName);
  if (canonicalEntity?.defaultPortion?.grams) {
    const count = quantityCount ?? 1; // Default to 1 if no count specified, but allow 0
    return {
      status: 'resolved',
      grams: count * canonicalEntity.defaultPortion.grams,
      reasonCode: 'KNOWN_DEFAULT_PORTION',
      gramsPerUnit: canonicalEntity.defaultPortion.grams,
    };
  }

  if (quantityCount !== undefined) {
    return {
      status: 'needs_edit',
      reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
    };
  }

  // Preserve existing no-quantity legacy behavior for now; explicit count/slice/piece is blocked above.
  return {
    status: 'resolved',
    grams: 100,
    reasonCode: 'NO_QUANTITY_LEGACY_100G_FALLBACK',
  };
}
