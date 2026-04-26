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
      const map: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
      return map[match] || match;
    })
    .split(/[\s\-_/,]+/)
    .filter((token) => token.length > 1); // Filter out single characters
}

function calculateTokenScore(
  inputTokens: string[],
  recordTokens: string[],
  aliases: string[],
  recordDisplayName: string,
): number {
  // Combine record tokens with alias tokens for matching
  const allRecordTokens = [...recordTokens, ...aliases.flatMap((alias) => tokenize(alias))];
  const uniqueRecordTokens = [...new Set(allRecordTokens)];

  let matchedTokens = 0;
  let totalInputTokens = inputTokens.length;

  for (const inputToken of inputTokens) {
    // Check for exact token match
    if (uniqueRecordTokens.some((recordToken) => recordToken === inputToken)) {
      matchedTokens += 1;
      continue;
    }

    // Check for partial token match (input token contains record token or vice versa)
    if (
      uniqueRecordTokens.some(
        (recordToken) => inputToken.includes(recordToken) || recordToken.includes(inputToken),
      )
    ) {
      matchedTokens += 0.8; // Partial match gets lower score
    }
  }

  const baseScore = totalInputTokens > 0 ? matchedTokens / totalInputTokens : 0;

  // DACH Guard: Prevent overly broad inputs from matching prepared/cooked variants
  // If input is very short (1-2 chars) and matches a prepared food, reduce confidence
  if (inputTokens.length === 1 && inputTokens[0].length <= 2) {
    const isPreparedFood =
      recordDisplayName.toLowerCase().includes('gebraten') ||
      recordDisplayName.toLowerCase().includes('gekocht') ||
      recordDisplayName.toLowerCase().includes('zubereitung') ||
      recordDisplayName.toLowerCase().includes('gebacken');

    if (isPreparedFood && baseScore >= 0.9) {
      console.log(
        `[DEBUG] BLS GUARD: Reducing score for broad input "${inputTokens[0]}" -> "${recordDisplayName}" from ${baseScore} to 0.6`,
      );
      return 0.6; // Lower confidence for broad->prepared matches
    }
  }

  return baseScore;
}

export function searchBlsGenericFoods(normalizedQuery: string): FoodCandidate[] {
  const normalizedInput = normalize(normalizedQuery);
  const inputTokens = tokenize(normalizedInput);

  // First try exact alias match (highest priority)
  const exactMatches = BLS_GENERIC_FOODS.filter((record) =>
    record.aliases.some((alias) => normalize(alias) === normalizedInput),
  ).map((record) => toCandidate(record, true, 1.0));

  if (exactMatches.length > 0) {
    console.log(`[DEBUG] BLS EXACT_MATCH found for "${normalizedInput}"`);
    return exactMatches;
  }

  // DACH Guard: Prevent compound splitting for unknown compounds
  // Check if this looks like a potential compound word (length > 6 chars and no exact/includes match)
  if (normalizedInput.length > 6 && inputTokens.length === 1) {
    // Check if this looks like a compound word that we don't explicitly support
    const hasIncludesMatch = BLS_GENERIC_FOODS.some((record) =>
      record.aliases.some((alias) => normalize(alias).includes(normalizedInput)),
    );

    // If no includes match, check if it could be a compound by seeing if token matching would find multiple different foods
    if (!hasIncludesMatch) {
      // Quick check: if token matching would find results from different base foods, it's likely compound splitting
      const potentialMatches = new Set();
      for (const record of BLS_GENERIC_FOODS) {
        const tokenScore = calculateTokenScore(
          inputTokens,
          record.tokens,
          record.aliases,
          record.displayName,
        );
        if (tokenScore > 0.5) {
          potentialMatches.add(record.normalizedName);
        }
      }

      // If we would match multiple different foods, it's likely unwanted compound splitting
      if (potentialMatches.size > 1) {
        console.log(
          `[DEBUG] BLS COMPOUND_GUARD: Rejecting unknown compound "${normalizedInput}" (would split into ${potentialMatches.size} foods)`,
        );
        return [];
      }
    } else {
      // If we have an includes match, only return that specific match, no token splitting
      const includesMatches = BLS_GENERIC_FOODS.filter((record) =>
        record.aliases.some((alias) => normalize(alias).includes(normalizedInput)),
      ).map((record) => toCandidate(record, false, 0.7));

      if (includesMatches.length > 0) {
        console.log(`[DEBUG] BLS INCLUDES_MATCH found for compound "${normalizedInput}"`);
        return includesMatches;
      }
    }
  }

  // Handle multi-token inputs (space-separated)
  if (inputTokens.length > 1) {
    // Check if this looks like a compound word that we don't explicitly support
    const hasIncludesMatch = BLS_GENERIC_FOODS.some((record) =>
      record.aliases.some((alias) => normalize(alias).includes(normalizedInput)),
    );

    // If no includes match, reject compound splitting entirely
    if (!hasIncludesMatch) {
      console.log(
        `[DEBUG] BLS COMPOUND_GUARD: Rejecting unknown multi-token compound "${normalizedInput}"`,
      );
      return [];
    }

    // If we have an includes match, only return that specific match, no token splitting
    const includesMatches = BLS_GENERIC_FOODS.filter((record) =>
      record.aliases.some((alias) => normalize(alias).includes(normalizedInput)),
    ).map((record) => toCandidate(record, false, 0.7));

    if (includesMatches.length > 0) {
      console.log(`[DEBUG] BLS INCLUDES_MATCH found for multi-token compound "${normalizedInput}"`);
      return includesMatches;
    }

    // If we reach here, it means we have multiple tokens but no known compound
    // Return empty to prevent token splitting
    return [];
  }

  // Token-based matching with scoring (only for single tokens)
  const tokenMatches: { record: BlsFoodRecord; score: number }[] = [];

  for (const record of BLS_GENERIC_FOODS) {
    const tokenScore = calculateTokenScore(
      inputTokens,
      record.tokens,
      record.aliases,
      record.displayName,
    );

    if (tokenScore > 0.5) {
      // Minimum threshold for token matching
      tokenMatches.push({ record, score: tokenScore });
    }
  }

  // Sort by score (highest first) and convert to candidates
  const sortedMatches = tokenMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Return top 3 matches
    .map(({ record, score }) => toCandidate(record, false, score));

  if (sortedMatches.length > 0) {
    console.log(
      `[DEBUG] BLS TOKEN_MATCH found ${sortedMatches.length} candidates for "${normalizedInput}"`,
    );
    sortedMatches.forEach((candidate, index) => {
      console.log(
        `[DEBUG] BLS TOKEN_MATCH [${index}] "${candidate.food.name}" score=${candidate.match.similarity}`,
      );
    });
    return sortedMatches;
  }

  // Fallback: try includes matching (lowest priority, only for single tokens)
  const includesMatches = BLS_GENERIC_FOODS.filter((record) =>
    record.aliases.some((alias) => normalize(alias).includes(normalizedInput)),
  ).map((record) => toCandidate(record, false, 0.7));

  if (includesMatches.length > 0) {
    console.log(`[DEBUG] BLS INCLUDES_MATCH found for "${normalizedInput}"`);
  }

  return includesMatches;
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
