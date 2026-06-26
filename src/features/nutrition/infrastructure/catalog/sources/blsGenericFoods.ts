import { FoodCandidate } from '../../../domain/catalog/FoodCatalogSource';
import { BlsFoodRecord, BlsLookupEngine } from './bls/BlsLookupEngine';

export const BLS_GENERIC_FOODS: readonly BlsFoodRecord[] = [
  {
    id: 'bls-magerquark',
    sourceId: 'M713100',
    displayName: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
    normalizedName: 'magerquark',
    aliases: ['magerquark', 'quark', 'speisequark', 'magerstufe'],
    tokens: ['mager', 'quark', 'speise', 'magerstufe'],
    macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
  },
  {
    id: 'bls-frischkaese',
    sourceId: 'M820100',
    displayName: 'Frischkaesezubereitung Natur < 10 % Fett i. Tr.',
    normalizedName: 'frischkaese',
    aliases: ['frischkaese', 'frischkäse', 'cream cheese'],
    tokens: ['frisch', 'kaese', 'käse', 'zubereitung', 'natur'],
    macrosPer100g: { kcal: 64, protein: 11.9, carbs: 3, fat: 0.2 },
  },
  {
    id: 'bls-ei-roh',
    sourceId: 'Y720100',
    displayName: 'Huehnerei ganz roh',
    normalizedName: 'ei',
    aliases: ['ei', 'eier', 'huehnerei', 'hühnerei'],
    tokens: ['huhn', 'hühn', 'ei', 'eier', 'roh'],
    macrosPer100g: { kcal: 137, protein: 11.9, carbs: 1.5, fat: 9.3 },
  },
  {
    id: 'bls-ruehrei',
    sourceId: 'Y720143',
    displayName: 'Ruehrei gebraten',
    normalizedName: 'ruehrei',
    aliases: ['ruehrei', 'rührei', 'ruehei'],
    tokens: ['ruehr', 'rühr', 'ei', 'gebraten'],
    macrosPer100g: { kcal: 203, protein: 12.88, carbs: 0.39, fat: 16.61 },
  },
  {
    id: 'bls-toast',
    sourceId: 'B314000',
    displayName: 'Weizentoastbrot/Buttertoastbrot',
    normalizedName: 'toast',
    aliases: ['toast', 'toastbrot', 'weizentoastbrot', 'buttertoast'],
    tokens: ['weizen', 'toast', 'brot', 'butter'],
    macrosPer100g: { kcal: 261, protein: 8.29, carbs: 46.8, fat: 3.59 },
  },
];

export const BLS_CANONICAL_SHORTCUTS: Readonly<Record<string, BlsFoodRecord>> = {
  buttertoast: {
    id: 'bls-shortcut-buttertoast',
    sourceId: 'shortcut:buttertoast-default',
    displayName: 'Buttertoast (Default-Shortcut aus BLS-Toast + Butter-Annahme)',
    normalizedName: 'buttertoast',
    aliases: ['buttertoast'],
    tokens: ['butter', 'toast'],
    // Transparent default assumption: 85 g BLS toastbrot + 15 g butter per 100 g.
    macrosPer100g: { kcal: 334, protein: 7.23, carbs: 39.87, fat: 15.38 },
  },
};

export const BLS_LOOKUP_ENGINE = new BlsLookupEngine(BLS_GENERIC_FOODS, BLS_CANONICAL_SHORTCUTS);

export function getBlsShortcutCandidate(normalizedQuery: string): FoodCandidate | null {
  const result = BLS_LOOKUP_ENGINE.lookupShortcut(normalizedQuery);
  return result ? BLS_LOOKUP_ENGINE.toCandidate(result) : null;
}

export function searchBlsGenericFoods(normalizedQuery: string): FoodCandidate[] {
  return BLS_LOOKUP_ENGINE.search(normalizedQuery).map((result) =>
    BLS_LOOKUP_ENGINE.toCandidate(result),
  );
}
