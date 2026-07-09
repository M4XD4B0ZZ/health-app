import { normalizeText } from '../../application/utils/normalizeText';

/**
 * P1-005: curated composite-dish head-words used only for pattern-recognition
 * metadata (e.g. tagging a "<Kopf> mit <Liste>" group as a known composite
 * dish for future ranking/quality signals). This list carries no
 * macro/nutrition data and must never become a nutrition-alias or macro
 * source. Grouping itself (P1-003B/C, `splitMultiItemInput.ts`) already
 * triggers generically for any head word followed by a "mit"-clause comma
 * list of >= 2 items, independent of this list — the list is additive
 * matching metadata, not a gate on grouping behavior. Long-term growth comes
 * from the Resolver V2 knowledge layer (`food_aliases`, `corrections`), not
 * manual list maintenance, mirroring the user-private-hint pattern from
 * P1-004B.
 */
export const COMPOSITE_DISH_HEAD_WORDS: readonly string[] = [
  'fruchtsalat',
  'wurstsalat',
  'nudelauflauf',
  'kartoffelsalat',
  'nudelsalat',
  'reissalat',
  'kartoffelgratin',
  'gemueseauflauf',
  'gemuesepfanne',
  'reispfanne',
  'couscoussalat',
  'quinoasalat',
  'thunfischsalat',
  'huehnersalat',
  'bohnensalat',
  'gemuesesalat',
  'linsensalat',
  'eiersalat',
  'nizzasalat',
  'hirtensalat',
];

/**
 * Matches a raw group label (e.g. "Fruchtsalat") against the curated list,
 * using the same normalization as the canonical food catalog (lowercase,
 * umlaut folding). Returns false for anything not on the seed list — this is
 * a recognition helper only, not a validation gate for grouping.
 */
export function isKnownCompositeDishHeadWord(headWord: string): boolean {
  const normalized = normalizeText(headWord);
  return COMPOSITE_DISH_HEAD_WORDS.includes(normalized);
}
