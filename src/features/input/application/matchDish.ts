import { getCanonicalDishName } from '../infrastructure/dishAliasMap';

export interface DishMatch {
  rawName: string;
  canonicalDishName: string | null;
  status: 'matched' | 'unmatched';
}

/**
 * Prüft, ob der gesamte Roh-Input einem bekannten Gericht entspricht.
 * Liefert ein DishMatch zurück.
 */
export function matchDish(rawInput: string): DishMatch {
  const canonicalDishName = getCanonicalDishName(rawInput);
  return {
    rawName: rawInput,
    canonicalDishName,
    status: canonicalDishName ? 'matched' : 'unmatched',
  };
}
