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
  /**
   * RESOLVER-V3-043: bare, already-normalized generic queries this record must never win an
   * exact/includes/token/ranked-token match for (see `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID`
   * in `BlsCompactRuntimeAdapter.ts`). Optional -- absent/empty for every record with no known
   * false-confidence collision.
   */
  incompatibleGenericQueries?: readonly string[];
}

export type BlsMatchKind = 'exact' | 'alias' | 'token' | 'includes' | 'shortcut_legacy';

export interface BlsLookupResult {
  record: BlsFoodRecord;
  matchKind: BlsMatchKind;
  score: number;
}

// RESOLVER-V2-009: general German processing/preparation/dish qualifiers. Their presence in a
// record (but not in the query) signals a processed/composite variant that should be
// de-preferred for a bare generic query — a general lexicon, not per-food overrides. Tokens are
// stored umlaut-folded (ü→ue) to match `tokenize()`.
const PROCESSED_QUALIFIER_TOKENS: ReadonlySet<string> = new Set([
  'gezuckert',
  'getrocknet',
  'geduenstet',
  'gekocht',
  'gebraten',
  'gebacken',
  'frittiert',
  'geraeuchert',
  'gesuesst',
  'konserve',
  'abgetropft',
  'plaetzchen',
  'suppe',
  'milchsuppe',
  'kompott',
  'eis',
  'sahne',
  'creme',
  'kuchen',
  'torte',
  'roulade',
  'biskuitrolle',
  'biskuitroulade',
  'krapfen',
  'brei',
  'mus',
  'saft',
  'konfituere',
  'marmelade',
  'gelee',
]);

// Connector words that carry no food identity — excluded from head detection and token count.
const STOPWORD_TOKENS: ReadonlySet<string> = new Set([
  'mit',
  'und',
  'in',
  'aus',
  'ohne',
  'oder',
  'mind',
]);

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
      console.log('[DEBUG] BLS EXACT_MATCH');
      return exactMatches;
    }

    // Stage 2: Single-token compound guard, preserving legacy BLS mini-source behavior
    if (normalizedInput.length > 6 && inputTokens.length === 1) {
      const includesMatches = this.findIncludesMatches(normalizedInput);
      if (includesMatches.length > 0) {
        // RESOLVER-V2-009: a weak `includes` match (a processed/compound record that merely
        // contains the query word — "…mit Himbeeren und Sahne", "…mit Haferflocken") must not
        // suppress a materially stronger token match on the plain generic food. Compute a
        // ranked token match (singular/plural- and head-aware, de-preferring processed
        // qualifiers) and prefer it when it is strictly stronger than the includes score.
        // Scoped to this single-long-token branch only, so Stage 4 (e.g. "speck") is untouched.
        const rankedTokenMatches = this.findRankedTokenMatches(inputTokens, normalizedInput);
        const bestIncludes = Math.max(...includesMatches.map((m) => m.score));
        const bestToken = rankedTokenMatches.length > 0 ? rankedTokenMatches[0].score : 0;
        if (bestToken > bestIncludes) {
          console.log(
            `[DEBUG] BLS TOKEN_OVER_INCLUDES token=${bestToken} includes=${bestIncludes}`,
          );
          return rankedTokenMatches;
        }
        console.log('[DEBUG] BLS INCLUDES_MATCH compound');
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
        console.log('[DEBUG] BLS COMPOUND_GUARD multi_token');
        return [];
      }

      console.log('[DEBUG] BLS INCLUDES_MATCH multi_token');
      return includesMatches;
    }

    // Stage 4: Token-based matching (only for single tokens after compound guard)
    const tokenMatches = this.findTokenMatches(inputTokens, normalizedInput);
    if (tokenMatches.length > 0) {
      console.log(`[DEBUG] BLS TOKEN_MATCH candidates=${tokenMatches.length}`);
      return tokenMatches;
    }

    // Stage 5: Fallback includes matching (lowest priority, single tokens only)
    const fallbackIncludes = this.findIncludesMatches(normalizedInput);
    if (fallbackIncludes.length > 0) {
      console.log('[DEBUG] BLS INCLUDES_MATCH');
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

  /**
   * RESOLVER-V3-043: true when `record` has been explicitly marked (via
   * `incompatibleGenericQueries`, populated from `BlsCompactRuntimeAdapter`'s
   * `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID`) as unable to claim this exact, already-
   * normalized bare query -- regardless of which stage (exact/includes/token/ranked-token) would
   * otherwise have matched it. A longer, qualified query (e.g. "broetchen blaetterteig") is a
   * different string and is unaffected.
   */
  private isIncompatibleGenericQuery(record: BlsFoodRecord, normalizedInput: string): boolean {
    const excluded = record.incompatibleGenericQueries;
    if (!excluded || excluded.length === 0) return false;
    return excluded.includes(this.normalize(normalizedInput));
  }

  // RESOLVER-V2-009: space-insensitive form so a one-word query ("haferflocken") can match a
  // multi-word BLS displayName alias ("hafer flocken") — a normalization rule, not a per-food
  // alias. Used only for exact matching, where equality after collapsing whitespace is still an
  // exact identity ("query IS the food name, modulo spacing").
  private collapseWhitespace(s: string): string {
    return this.normalize(s).replace(/\s+/g, '');
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
    const collapsedInput = this.collapseWhitespace(normalizedInput);
    const matches = this.records
      .filter((record) => !this.isIncompatibleGenericQuery(record, normalizedInput))
      .filter((record) =>
        record.aliases.some((alias) => {
          const normalizedAlias = this.normalize(alias);
          return (
            normalizedAlias === normalizedInput ||
            this.collapseWhitespace(normalizedAlias) === collapsedInput
          );
        }),
      );

    // RESOLVER-V2-009: when several records match exactly (e.g. "Hafer Flocken" vs. the
    // comma-split "Hafer Flocken, gekocht"), prefer the plain one — a record whose *whole* name
    // is the query (not just a split-off segment) and that carries no processed qualifier —
    // deterministically ahead of a preparation variant. All keep score 1.0.
    const ranked = [...matches].sort((a, b) => {
      const wholeNameDelta =
        this.wholeNameMatchRank(a, collapsedInput) - this.wholeNameMatchRank(b, collapsedInput);
      if (wholeNameDelta !== 0) return wholeNameDelta;
      const qualifierDelta = this.processedQualifierPenalty(a) - this.processedQualifierPenalty(b);
      if (qualifierDelta !== 0) return qualifierDelta;
      return this.contentTokens(a).length - this.contentTokens(b).length;
    });

    return ranked.map((record) => ({
      record,
      matchKind: 'exact' as BlsMatchKind,
      score: 1.0,
    }));
  }

  /** 0 when the record's whole (collapsed) name is the query, 1 when only a split-off alias is. */
  private wholeNameMatchRank(record: BlsFoodRecord, collapsedInput: string): number {
    return this.collapseWhitespace(record.normalizedName) === collapsedInput ? 0 : 1;
  }

  private findIncludesMatches(normalizedInput: string): BlsLookupResult[] {
    return this.records
      .filter((record) => !this.isIncompatibleGenericQuery(record, normalizedInput))
      .filter((record) =>
        record.aliases.some((alias) => this.normalize(alias).includes(normalizedInput)),
      )
      .map((record) => ({
        record,
        matchKind: 'includes' as BlsMatchKind,
        score: 0.7,
      }));
  }

  private findTokenMatches(inputTokens: string[], normalizedInput: string): BlsLookupResult[] {
    const tokenMatches: BlsLookupResult[] = [];

    for (const record of this.records) {
      if (this.isIncompatibleGenericQuery(record, normalizedInput)) {
        continue;
      }
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

  /**
   * RESOLVER-V2-009: a ranked token match used *only* by the Stage-2 single-long-token override,
   * to surface the plain generic food over processed/compound records that merely contain the
   * query word. The returned `score` stays the plain recall (so the Stage-2 comparison against
   * the includes score is apples-to-apples); ordering uses a richer rank:
   *   rank = fold-aware recall + head-match bonus − processed-qualifier penalty,
   * with fewer content tokens breaking ties (a plainer record wins). Stage 4's `findTokenMatches`
   * is intentionally left unchanged, so ambiguous short queries like "speck" are unaffected.
   */
  private findRankedTokenMatches(
    inputTokens: string[],
    normalizedInput: string,
  ): BlsLookupResult[] {
    const scored = this.records
      .filter((record) => !this.isIncompatibleGenericQuery(record, normalizedInput))
      .map((record) => {
        const recall = this.tokenRecall(inputTokens, record);
        const rank =
          recall +
          this.headMatchBonus(inputTokens, record) -
          this.processedQualifierPenalty(record);
        return { record, recall, rank };
      })
      .filter((entry) => entry.recall > 0.5);

    scored.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return this.contentTokens(a.record).length - this.contentTokens(b.record).length;
    });

    return scored.slice(0, 3).map((entry) => ({
      record: entry.record,
      matchKind: 'token' as BlsMatchKind,
      score: Math.min(1, entry.recall),
    }));
  }

  /** Fold-aware recall (matched input tokens / input tokens), tolerant of German plural forms. */
  private tokenRecall(inputTokens: string[], record: BlsFoodRecord): number {
    const recordTokens = this.rankRecordTokens(record);
    let matched = 0;
    for (const inputToken of inputTokens) {
      const foldedInput = this.foldToken(inputToken);
      if (recordTokens.some((rt) => rt === inputToken || this.foldToken(rt) === foldedInput)) {
        matched += 1;
        continue;
      }
      if (recordTokens.some((rt) => inputToken.includes(rt) || rt.includes(inputToken))) {
        matched += 0.8;
      }
    }
    return inputTokens.length > 0 ? matched / inputTokens.length : 0;
  }

  private rankRecordTokens(record: BlsFoodRecord): string[] {
    return [
      ...new Set([...record.tokens, ...record.aliases.flatMap((alias) => this.tokenize(alias))]),
    ];
  }

  /** Light German plural fold: drop a single trailing "n" (himbeeren→himbeere, flocken→flocke). */
  private foldToken(token: string): string {
    return token.length > 4 && token.endsWith('n') ? token.slice(0, -1) : token;
  }

  /** Meaningful (non-stopword) tokens of the record's displayName, in order. */
  private contentTokens(record: BlsFoodRecord): string[] {
    return this.tokenize(record.displayName).filter((token) => !STOPWORD_TOKENS.has(token));
  }

  /** +0.5 when the query matches the record's head noun (its first content token). */
  private headMatchBonus(inputTokens: string[], record: BlsFoodRecord): number {
    const head = this.contentTokens(record)[0];
    if (!head) return 0;
    const foldedHead = this.foldToken(head);
    const matchesHead = inputTokens.some(
      (token) =>
        this.foldToken(token) === foldedHead || token.includes(head) || head.includes(token),
    );
    return matchesHead ? 0.5 : 0;
  }

  /** Penalty for processed/preparation/dish qualifiers present in the record. */
  private processedQualifierPenalty(record: BlsFoodRecord): number {
    const count = this.contentTokens(record).filter((token) =>
      PROCESSED_QUALIFIER_TOKENS.has(token),
    ).length;
    return Math.min(0.45, count * 0.15);
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
        console.log(`[DEBUG] BLS GUARD score=${baseScore} adjusted=0.6`);
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
      console.log(`[DEBUG] BLS COMPOUND_GUARD candidates=${potentialMatches.size}`);
      return true;
    }

    return false;
  }
}
