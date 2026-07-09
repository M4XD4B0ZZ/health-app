import { normalizeText } from '../../application/utils/normalizeText';

// ---------------------------------------------------------------------------
// P1-005: Curated Composite-Dish Pattern List (Non-Growing Alias Strategy)
// ---------------------------------------------------------------------------
//
// A small, static seed list of composite-dish head-words used only to *trigger*
// P1-003B/C label+children grouping (e.g. "Fruchtsalat mit Bananen, Kirschen").
// This list carries no macro/nutrition data and its entries must never be sent
// to BLS/OFF/USDA as a standalone query - that would defeat the purpose of the
// P1-003C label exclusion. See CanonicalFood.ts (P1-002) for the actual
// macro-carrying food dictionary.
//
// Gating on this list (instead of grouping on *any* "<head> mit <list>" input)
// prevents misclassifying an ordinary food as a non-resolvable label, e.g.
// "Haehnchen mit Reis, Brokkoli" is three separate foods, not a composite dish
// - "Haehnchen" must still be resolved and contribute macros on its own.
//
// This is intentionally small and static, analogous to the ~20 Canonical Food
// Entities from P1-002. Long-term growth must come from the Resolver V2
// knowledge layer (`food_aliases`, `corrections` - RESOLVER-V2-005/006), not
// manual list maintenance - mirrors the user-private-hint pattern from
// P1-004B (user-confirmed dish patterns apply privately first, never
// auto-promoted to global truth).

export const COMPOSITE_DISH_HEAD_WORDS: readonly string[] = [
  'Fruchtsalat',
  'Obstsalat',
  'Wurstsalat',
  'Kartoffelsalat',
  'Nudelsalat',
  'Reissalat',
  'Gemüsesalat',
  'Schichtsalat',
  'Auflauf',
  'Nudelauflauf',
  'Kartoffelauflauf',
  'Gemüseauflauf',
  'Nudelgratin',
  'Eintopf',
  'Linseneintopf',
  'Gemüsepfanne',
  'Salatteller',
  'Antipastiteller',
];

const NORMALIZED_HEAD_WORDS = new Set(
  COMPOSITE_DISH_HEAD_WORDS.map((headWord) => normalizeText(headWord)),
);

/**
 * Matches when the head text's last token is a known composite-dish head-word,
 * e.g. "Fruchtsalat" or an adjective-prefixed "gemischter Fruchtsalat".
 * Case-insensitive and umlaut-normalized via `normalizeText`.
 */
export function isCompositeDishHeadWord(headText: string): boolean {
  const tokens = normalizeText(headText)
    .split(' ')
    .filter((token) => token.length > 0);
  const lastToken = tokens[tokens.length - 1];
  return lastToken !== undefined && NORMALIZED_HEAD_WORDS.has(lastToken);
}
