import { FoodCandidate } from '../../../domain/catalog/FoodCatalogSource';

interface BlsFoodRecord {
  id: string;
  sourceId: string;
  displayName: string;
  normalizedName: string;
  aliases: string[];
  macrosPer100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

const BLS_GENERIC_FOODS: readonly BlsFoodRecord[] = [
  {
    id: 'bls-magerquark',
    sourceId: 'M713100',
    displayName: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
    normalizedName: 'magerquark',
    aliases: ['magerquark', 'quark', 'speisequark'],
    macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
  },
  {
    id: 'bls-frischkaese',
    sourceId: 'M820100',
    displayName: 'Frischkaesezubereitung Natur < 10 % Fett i. Tr.',
    normalizedName: 'frischkaese',
    aliases: ['frischkaese', 'frischkäse', 'cream cheese'],
    macrosPer100g: { kcal: 64, protein: 11.9, carbs: 3, fat: 0.2 },
  },
  {
    id: 'bls-ruehrei',
    sourceId: 'Y720143',
    displayName: 'Ruehrei gebraten',
    normalizedName: 'ruehrei',
    aliases: ['ruehrei', 'ruehei'],
    macrosPer100g: { kcal: 203, protein: 12.88, carbs: 0.39, fat: 16.61 },
  },
  {
    id: 'bls-toast',
    sourceId: 'B314000',
    displayName: 'Weizentoastbrot/Buttertoastbrot',
    normalizedName: 'toast',
    aliases: ['toast', 'toastbrot', 'weizentoastbrot', 'buttertoast'],
    macrosPer100g: { kcal: 261, protein: 8.29, carbs: 46.8, fat: 3.59 },
  },
];

const BLS_CANONICAL_SHORTCUTS: Readonly<Record<string, BlsFoodRecord>> = {
  buttertoast: {
    id: 'bls-shortcut-buttertoast',
    sourceId: 'shortcut:buttertoast-default',
    displayName: 'Buttertoast (Default-Shortcut aus BLS-Toast + Butter-Annahme)',
    normalizedName: 'buttertoast',
    aliases: ['buttertoast'],
    // Transparent default assumption: 85 g BLS toastbrot + 15 g butter per 100 g.
    macrosPer100g: { kcal: 334, protein: 7.23, carbs: 39.87, fat: 15.38 },
  },
};

export function getBlsShortcutCandidate(normalizedQuery: string): FoodCandidate | null {
  const record = BLS_CANONICAL_SHORTCUTS[normalizedQuery];
  return record ? toCandidate(record, true, 'alias') : null;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function searchBlsGenericFoods(normalizedQuery: string): FoodCandidate[] {
  const normalizedInput = normalize(normalizedQuery);
  
  // First try exact match
  const exactMatches = BLS_GENERIC_FOODS.filter((record) =>
    record.aliases.some(alias => normalize(alias) === normalizedInput)
  ).map((record) => toCandidate(record, normalizedInput === normalize(record.normalizedName)));
  
  if (exactMatches.length > 0) {
    return exactMatches;
  }
  
  // Fallback: try includes matching
  const includesMatches = BLS_GENERIC_FOODS.filter((record) =>
    record.aliases.some(alias => normalize(alias).includes(normalizedInput))
  ).map((record) => toCandidate(record, false));
  
  return includesMatches;
}

function toCandidate(
  record: BlsFoodRecord,
  exact: boolean,
  usedHeuristic?: 'alias',
): FoodCandidate {
  return {
    food: {
      id: record.id,
      name: record.displayName,
      normalizedName: record.normalizedName,
      macrosPer100g: record.macrosPer100g,
      source: 'bls',
      sourceId: record.sourceId,
    },
    match: {
      exact,
      similarity: exact ? 1 : 0.98,
      usedHeuristic,
    },
    confidence: 0,
    reasons: [],
  };
}
