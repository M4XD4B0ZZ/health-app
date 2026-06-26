import { FoodCandidate } from '../../../../domain/catalog/FoodCatalogSource';

/**
 * BLS Lookup Engine
 *
 * Extracted lookup logic for BLS mini-source.
 * Prepares for future replacement by generated BLS index.
 *
 * Match kinds:
 * - exact: exact alias match
 * - alias: shortcut/canonical alias
 * - token: token-based fuzzy matching
 * - includes: substring matching
 * - shortcut_legacy: legacy buttertoast shortcut
 */

export interface BlsFoodRecord {
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

export type BlsMatchKind = 'exact' | 'alias' | 'token' | 'includes' | 'shortcut_legacy';

export interface BlsLookupResult {
  record: BlsFoodRecord;
  matchKind: BlsMatchKind;
  score: number;
}

export class BlsLookupEngine {
  constructor(
    private readonly records: readonly BlsFoodRecord[],
    private readonly shortcuts: Readonly<Record<string, BlsFoodRecord>>,
  ) {}

  /**
   * Lookup shortcut by normalized query.
   * Returns null if no shortcut found.
   */
  lookupShortcut(normalizedQuery: string): BlsLookupResult | null {
    const record = this.shortcuts[normalizedQuery];
    if (!record) {
      return null;
    }
    return {
      record,
      matchKind: 'shortcut_legacy',
      score: 1.0,
    };
  }

  /**
   * Search BLS records by normalized query.
   * Returns ranked lookup results.
   */
  search(normalizedQuery: string): BlsLookupResult[] {
    const normalizedInput = this.normalize(normalizedQuery);
    const inputTokens = this.tokenize(normalizedInput);

    // Stage 1: Exact alias match (highest priority)
    const exactMatches = this.findExactMatches(normalizedInput);
    if (exactMatches.length > 0) {
      console.log(`[DEBUG] BLS EXACT_MATCH found for '${normalizedInput}'`);
      return exactMatches;
    }

    // Stage 2: Single-token compound guard, preserving legacy BLS mini-source behavior
    if (normalizedInput.length > 6 && inputTokens.length === 1) {
      const includesMatches = this.findIncludesMatches(normalizedInput);
      if (includesMatches.length > 0) {
        console.log(`[DEBUG] BLS INCLUDES_MATCH found for compound '${normalizedInput}'`);
        return includesMatches;
      }

      if (this.wouldSplitIntoMultipleFoods(normalizedInput, inputTokens)) {
        return [];
      }
    }

    // Stage 3: Multi-token compound guard, preserving legacy no-splitting behavior
    if (inputTokens.length > 1) {
      const includesMatches = this.findIncludesMatches(normalizedInput);
      if (includesMatches.length === 0) {
        console.log(
          `[DEBUG] BLS COMPOUND_GUARD: Rejecting unknown multi-token compound '${normalizedInput}'`,
        );
        return [];
      }

      console.log(`[DEBUG] BLS INCLUDES_MATCH found for multi-token compound '${normalizedInput}'`);
      return includesMatches;
    }

    // Stage 4: Token-based matching (only for single tokens after compound guard)
    const tokenMatches = this.findTokenMatches(inputTokens);
    if (tokenMatches.length > 0) {
      console.log(
        `[DEBUG] BLS TOKEN_MATCH found ${tokenMatches.length} candidates for '${normalizedInput}'`,
      );
      tokenMatches.forEach((result, index) => {
        console.log(
          `[DEBUG] BLS TOKEN_MATCH [${index}] '${result.record.displayName}' score=${result.score}`,
        );
      });
      return tokenMatches;
    }

    // Stage 5: Fallback includes matching (lowest priority, single tokens only)
    const fallbackIncludes = this.findIncludesMatches(normalizedInput);
    if (fallbackIncludes.length > 0) {
      console.log(`[DEBUG] BLS INCLUDES_MATCH found for '${normalizedInput}'`);
      return fallbackIncludes;
    }

    return [];
  }

  /**
   * Convert lookup result to FoodCandidate.
   */
  toCandidate(result: BlsLookupResult): FoodCandidate {
    const { record, matchKind, score } = result;
    const exact = matchKind === 'exact' || matchKind === 'shortcut_legacy';
    const usedHeuristic = exact || matchKind === 'alias' ? 'alias' : undefined;

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
        similarity: score,
        usedHeuristic,
      },
      confidence: 0,
      reasons: [],
    };
  }

  // ========== Private Methods ==========

  private normalize(s: string): string {
    return s.toLowerCase().trim();
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[äöüß]/g, (match) => {
        const map: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
        return map[match] || match;
      })
      .split(/[\s\-_/,]+/)
      .filter((token) => token.length > 1); // Filter out single characters
  }

  private findExactMatches(normalizedInput: string): BlsLookupResult[] {
    return this.records
      .filter((record) => record.aliases.some((alias) => this.normalize(alias) === normalizedInput))
      .map((record) => ({
        record,
        matchKind: 'exact' as BlsMatchKind,
        score: 1.0,
      }));
  }

  private findIncludesMatches(normalizedInput: string): BlsLookupResult[] {
    return this.records
      .filter((record) =>
        record.aliases.some((alias) => this.normalize(alias).includes(normalizedInput)),
      )
      .map((record) => ({
        record,
        matchKind: 'includes' as BlsMatchKind,
        score: 0.7,
      }));
  }

  private findTokenMatches(inputTokens: string[]): BlsLookupResult[] {
    const tokenMatches: BlsLookupResult[] = [];

    for (const record of this.records) {
      const tokenScore = this.calculateTokenScore(
        inputTokens,
        record.tokens,
        record.aliases,
        record.displayName,
      );

      if (tokenScore > 0.5) {
        // Minimum threshold for token matching
        tokenMatches.push({
          record,
          matchKind: 'token',
          score: tokenScore,
        });
      }
    }

    // Sort by score (highest first) and return top 3 matches
    return tokenMatches.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private calculateTokenScore(
    inputTokens: string[],
    recordTokens: string[],
    aliases: string[],
    recordDisplayName: string,
  ): number {
    // Combine record tokens with alias tokens for matching
    const allRecordTokens = [...recordTokens, ...aliases.flatMap((alias) => this.tokenize(alias))];
    const uniqueRecordTokens = [...new Set(allRecordTokens)];

    let matchedTokens = 0;
    const totalInputTokens = inputTokens.length;

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
          `[DEBUG] BLS GUARD: Reducing score for broad input '${inputTokens[0]}' -> '${recordDisplayName}' from ${baseScore} to 0.6`,
        );
        return 0.6; // Lower confidence for broad->prepared matches
      }
    }

    return baseScore;
  }

  private wouldSplitIntoMultipleFoods(normalizedInput: string, inputTokens: string[]): boolean {
    const potentialMatches = new Set<string>();
    for (const record of this.records) {
      const tokenScore = this.calculateTokenScore(
        inputTokens,
        record.tokens,
        record.aliases,
        record.displayName,
      );
      if (tokenScore > 0.5) {
        potentialMatches.add(record.normalizedName);
      }
    }

    if (potentialMatches.size > 1) {
      console.log(
        `[DEBUG] BLS COMPOUND_GUARD: Rejecting unknown compound '${normalizedInput}' (would split into ${potentialMatches.size} foods)`,
      );
      return true;
    }

    return false;
  }
}
