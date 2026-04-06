import { FoodCandidate } from '../../../domain/catalog/FoodCatalogSource';

interface BlsFoodRecord {
  id: string;
  sourceId: string;
  displayName: string;
  normalizedName: string;
  aliases: string[];
  tokens: string[]; // For token-based matching
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

const BLS_CANONICAL_SHORTCUTS: Readonly<Record<string, BlsFoodRecord>> = {
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

export function getBlsShortcutCandidate(normalizedQuery: string): FoodCandidate | null {
  const record = BLS_CANONICAL_SHORTCUTS[normalizedQuery];
  return record ? toCandidate(record, true, 'alias') : null;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (match) => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[match] || match;
    })
    .split(/[\s\-_/,]+/)
    .filter(token => token.length > 1); // Filter out single characters
}

function calculateTokenScore(inputTokens: string[], recordTokens: string[], aliases: string[]): number {
  // Combine record tokens with alias tokens for matching
  const allRecordTokens = [...recordTokens, ...aliases.flatMap(alias => tokenize(alias))];
  const uniqueRecordTokens = [...new Set(allRecordTokens)];
  
  let matchedTokens = 0;
  let totalInputTokens = inputTokens.length;
  
  for (const inputToken of inputTokens) {
    // Check for exact token match
    if (uniqueRecordTokens.some(recordToken => recordToken === inputToken)) {
      matchedTokens += 1;
      continue;
    }
    
    // Check for partial token match (input token contains record token or vice versa)
    if (uniqueRecordTokens.some(recordToken =>
      inputToken.includes(recordToken) || recordToken.includes(inputToken)
    )) {
      matchedTokens += 0.8; // Partial match gets lower score
    }
  }
  
  return totalInputTokens > 0 ? matchedTokens / totalInputTokens : 0;
}

export function searchBlsGenericFoods(normalizedQuery: string): FoodCandidate[] {
  const normalizedInput = normalize(normalizedQuery);
  const inputTokens = tokenize(normalizedInput);
  
  // First try exact alias match (highest priority)
  const exactMatches = BLS_GENERIC_FOODS.filter((record) =>
    record.aliases.some(alias => normalize(alias) === normalizedInput)
  ).map((record) => toCandidate(record, true, 1.0));
  
  if (exactMatches.length > 0) {
    console.log(`[DEBUG] BLS EXACT_MATCH found for "${normalizedInput}"`);
    return exactMatches;
  }
  
  // Token-based matching with scoring
  const tokenMatches: Array<{ record: BlsFoodRecord; score: number }> = [];
  
  for (const record of BLS_GENERIC_FOODS) {
    const tokenScore = calculateTokenScore(inputTokens, record.tokens, record.aliases);
    
    if (tokenScore > 0.5) { // Minimum threshold for token matching
      tokenMatches.push({ record, score: tokenScore });
    }
  }
  
  // Sort by score (highest first) and convert to candidates
  const sortedMatches = tokenMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Return top 3 matches
    .map(({ record, score }) => toCandidate(record, false, score));
  
  if (sortedMatches.length > 0) {
    console.log(`[DEBUG] BLS TOKEN_MATCH found ${sortedMatches.length} candidates for "${normalizedInput}"`);
    sortedMatches.forEach((candidate, index) => {
      console.log(`[DEBUG] BLS TOKEN_MATCH [${index}] "${candidate.food.name}" score=${candidate.match.similarity}`);
    });
  }
  
  // Fallback: try includes matching (lowest priority)
  if (sortedMatches.length === 0) {
    const includesMatches = BLS_GENERIC_FOODS.filter((record) =>
      record.aliases.some(alias => normalize(alias).includes(normalizedInput))
    ).map((record) => toCandidate(record, false, 0.7));
    
    if (includesMatches.length > 0) {
      console.log(`[DEBUG] BLS INCLUDES_MATCH found for "${normalizedInput}"`);
    }
    
    return includesMatches;
  }
  
  return sortedMatches;
}

function toCandidate(
  record: BlsFoodRecord,
  exact: boolean,
  similarityOrHeuristic?: number | 'alias',
): FoodCandidate {
  let similarity: number;
  let usedHeuristic: 'alias' | undefined;
  
  if (typeof similarityOrHeuristic === 'number') {
    similarity = similarityOrHeuristic;
    usedHeuristic = exact ? 'alias' : undefined;
  } else {
    similarity = exact ? 1 : 0.98;
    usedHeuristic = similarityOrHeuristic;
  }
  
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
      similarity,
      usedHeuristic,
    },
    confidence: 0,
    reasons: [],
  };
}
