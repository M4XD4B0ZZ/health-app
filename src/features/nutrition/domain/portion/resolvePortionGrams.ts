import { detectCanonicalEntity } from '../detectCanonicalEntity';
import { PortionHintUnit } from './PortionHint';
import { InMemoryPortionHintRepository, PortionKnowledgeService } from './PortionKnowledgeService';
import { resolveFoodIdentityKey } from './foodIdentity';
import { SEED_PORTION_HINTS } from './seedPortionHints';

export type PortionGramsReasonCode =
  | 'EXPLICIT_GRAMS'
  | 'PORTION_KNOWLEDGE_HINT'
  | 'KNOWN_DEFAULT_PORTION'
  | 'COUNT_WITHOUT_PORTION_HINT'
  | 'NO_QUANTITY_LEGACY_100G_FALLBACK';

export type ResolvePortionGramsResult =
  | {
      status: 'resolved';
      grams: number;
      reasonCode: PortionGramsReasonCode;
      gramsPerUnit?: number;
      foodIdentityKey?: string;
    }
  | {
      status: 'needs_edit';
      reasonCode: PortionGramsReasonCode;
    };

export interface ResolvePortionGramsOptions {
  unit?: string;
  userId?: string;
  portionKnowledgeService?: PortionKnowledgeService;
}

const defaultPortionKnowledgeService = new PortionKnowledgeService(
  new InMemoryPortionHintRepository(SEED_PORTION_HINTS),
);

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
  options: ResolvePortionGramsOptions = {},
): ResolvePortionGramsResult {
  // If explicit grams are provided, use them (e.g., "200g ei")
  if (quantityGrams > 0) {
    return {
      status: 'resolved',
      grams: quantityGrams,
      reasonCode: 'EXPLICIT_GRAMS',
    };
  }

  const portionUnit = normalizePortionUnit(options.unit);
  const foodIdentityKey = resolveFoodIdentityKey(parsedName);
  if (foodIdentityKey && portionUnit) {
    const portionKnowledgeService =
      options.portionKnowledgeService ?? defaultPortionKnowledgeService;
    const hint = portionKnowledgeService.lookup({
      foodIdentityKey,
      unit: portionUnit,
      userId: options.userId,
    });

    if (hint) {
      const count = quantityCount ?? 1;
      return {
        status: 'resolved',
        grams: count * hint.gramsPerUnit,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: hint.gramsPerUnit,
        foodIdentityKey,
      };
    }
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

function normalizePortionUnit(unit?: string): PortionHintUnit | null {
  if (unit === 'slice') {
    return 'slice';
  }

  if (unit === undefined || unit === 'count' || unit === 'piece') {
    return 'piece';
  }

  return null;
}
