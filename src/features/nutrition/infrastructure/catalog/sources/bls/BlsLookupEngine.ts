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

/**
 * RESOLVER-V3-049: `PROCESSED_QUALIFIER_TOKENS` extended with explicit frozen/preservation-state
 * markers ("raw/cooked/fried/frozen or equivalent preparation-state conflicts" per
 * ROADMAP.md's RESOLVER-V3-049 policy concepts) -- kept as its own derived set, not merged into
 * the original, so this task's additions are scoped to the new family-extension/ambiguity-policy
 * logic below and never change the existing Stage-2 ranked-token scoring behavior that
 * `PROCESSED_QUALIFIER_TOKENS` already governs.
 */
const PREPARATION_STATE_TOKENS: ReadonlySet<string> = new Set([
  ...PROCESSED_QUALIFIER_TOKENS,
  'tiefgefroren',
  'gefroren',
]);

/**
 * RESOLVER-V3-049: every token in `suffix` (the part of a candidate's name after the query root)
 * is either a connector word or a recognized preparation/processing qualifier -- i.e. the suffix
 * adds no new, unrecognized food-identity content (an ingredient, a brand, a dish name). Used to
 * tell a genuine preparation-state extension ("tiefgefroren, gebacken") from an arbitrary
 * composite addition ("mit Mayonnaise", "in Butter", "(Halbfettstufe) mit Konfitüre") that forms a
 * materially different dish, not a same-food preparation variant.
 */
function isPureQualifierSuffix(suffix: string): boolean {
  const tokens = suffix
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return false;
  return tokens.every((t) => STOPWORD_TOKENS.has(t) || PREPARATION_STATE_TOKENS.has(t));
}

/**
 * RESOLVER-V3-049: minimum relative kcal/100g spread (max/min) required among a set of
 * preparation-state-conflicting BLS candidates before that conflict is treated as *material*
 * rather than ordinary same-cut/same-preparation-family variance. Justified independently of the
 * three owned cases against real BLS data found while auditing this task's blast radius:
 * - Floor side: must exceed raw-vs-boiled egg (~137 vs. 135 kcal, ratio 1.01 -- boiling a shell
 *   egg doesn't meaningfully change its caloric content) and the real "Schinkenspeck" BLS cluster
 *   (127/156/167 kcal across roh/gebraten/geschmort sub-records of the *same* approved,
 *   deterministic RESOLVER-V2-010 clarification choice, ratio 1.31 -- normal cooking-method
 *   variance within one specific cut, not a different-identity conflict).
 * - Ceiling side: must not exceed the smallest real target-case gap (the Pommes/Holdout frozen-
 *   fries family, 123/167/203 kcal, ratio 1.65) or any owned case would stop being detected.
 * 1.4 sits roughly in the middle of the resulting (1.31, 1.65] safe window, with the same
 * qualitative conclusion holding for any value in that window -- the exact value is not
 * outcome-determinative for any diagnosed case, which is what makes it a materiality floor rather
 * than a reverse-engineered threshold. Full case-by-case numbers:
 * `reports/RESOLVER_V3_049_BLS_GENERIC_FAST_PATH_AMBIGUITY_POLICY.md`.
 */
const MATERIALITY_KCAL_RATIO = 1.4;

function isMaterialKcalSpread(kcalValues: readonly number[]): boolean {
  const valid = kcalValues.filter((k) => Number.isFinite(k) && k > 0);
  if (valid.length < 2) return false;
  const ratio = Math.max(...valid) / Math.min(...valid);
  return ratio >= MATERIALITY_KCAL_RATIO;
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
      // RESOLVER-V3-049: a single exact match must not always hide a materially plausible,
      // same-family preparation-state sibling (e.g. "Pommes frites" exact-matches X654042, but
      // "Pommes frites tiefgefroren, frittiert" et al. are never scored at all otherwise -- see
      // BlsLookupEngine's findFamilyExtensionMatches doc). Multiple exact ties (e.g. D771900's
      // resolved Brötchen ambiguity) already surface every tied record and need no help here.
      if (exactMatches.length === 1) {
        const familyExtensions = this.findFamilyExtensionMatches(
          exactMatches[0].record,
          normalizedInput,
        );
        if (familyExtensions.length > 0) {
          console.log(
            `[DEBUG] BLS EXACT_MATCH_WITH_FAMILY_EXTENSIONS count=${familyExtensions.length}`,
          );
          return [...exactMatches, ...familyExtensions];
        }
      }
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

  /**
   * RESOLVER-V3-049: when a bare query resolves to exactly one exact-alias record
   * (`exactRecord`), other BLS records whose whole normalized name is that same *query* extended
   * with further qualifying word(s) -- e.g. "pommes frites" -> "pommes frites tiefgefroren,
   * frittiert" -- are materially plausible preparation-state siblings that Stage 1's
   * short-circuit would otherwise hide entirely, before they are ever scored (see
   * RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md §6). Rooted on the query
   * itself (`normalizedInput`), never on `exactRecord.normalizedName` -- a record's own
   * `normalizedName` can be a shorter, paren-stripped canonical form (e.g. D771900's is just
   * "broetchen", though the query that exact-matched it was "broetchen blaetterteig" via its
   * alias list), so rooting on the record's own name would wrongly treat every other same-head
   * record as a "family extension" of it. Scoped narrowly to a strict word-boundary prefix of the
   * query (never an arbitrary substring), so an unrelated composite dish that merely mentions the
   * query word (e.g. "Schaschlik mit Pommes frites") is never pulled in -- only records that are
   * structurally *this exact query, plus more*. Checked against `displayName` through
   * `looseNormalize` (which keeps hyphens as literal characters), never against `normalizedName`
   * (which collapses hyphens to spaces) -- otherwise a hyphen-fused compound product name like
   * "Quark-Frucht-Plunder" (a sweet pastry, 378 kcal) would wrongly look like a space-qualified
   * extension of "Quark" (66 kcal), even though the hyphen means it is one fused word, a
   * different food entirely, not "Quark" plus a preparation qualifier. Also requires the suffix
   * after the root to be a *pure qualifier suffix* (`isPureQualifierSuffix`, above) -- e.g.
   * "Quark (Halbfettstufe) mit Konfitüre" or "Rührei gebraten in Butter" are excluded because
   * "halbfettstufe"/"konfituere"/"butter" are unrecognized ingredient/descriptor content, not
   * preparation-state qualifiers, forming a materially different composite dish rather than a
   * same-food preparation variant. Finally, the whole extension set is included only if it is
   * *collectively* materially divergent from the exact match (`isMaterialKcalSpread`, above) --
   * e.g. "Eier" (137 kcal) and "Eier gekocht" (135 kcal) pass every other check here but differ
   * by only ~1.5%, so no family extension is surfaced for that query at all (an all-or-nothing
   * decision on the extension set as a whole, not a per-candidate filter, so a genuinely material
   * family like the Pommes-frites trio is never partially hidden just because one sibling's own
   * gap to the exact match happens to be smaller than another's). Reuses the existing 'includes'
   * match tier/score (0.7), not a new value.
   */
  private findFamilyExtensionMatches(
    exactRecord: BlsFoodRecord,
    normalizedInput: string,
  ): BlsLookupResult[] {
    const root = this.normalize(normalizedInput);
    const candidates = this.records
      .filter((record) => record.sourceId !== exactRecord.sourceId)
      .filter((record) => !this.isIncompatibleGenericQuery(record, normalizedInput))
      .filter((record) => {
        const loose = this.looseNormalize(record.displayName);
        if (!loose.startsWith(`${root} `)) return false;
        return isPureQualifierSuffix(loose.slice(root.length));
      });

    if (candidates.length === 0) return [];

    const kcalValues = [
      exactRecord.macrosPer100g.kcal,
      ...candidates.map((r) => r.macrosPer100g.kcal),
    ];
    if (!isMaterialKcalSpread(kcalValues)) return [];

    return candidates.map((record) => ({
      record,
      matchKind: 'includes' as BlsMatchKind,
      score: 0.7,
    }));
  }

  /**
   * Lowercased, umlaut-folded like `normalize()`, but -- unlike `normalizedName`, which collapses
   * every non-alphanumeric run (including hyphens) to a single space -- keeps hyphens as literal
   * characters. Needed only by `findFamilyExtensionMatches` to tell a genuine word-boundary
   * qualifier extension ("pommes frites tiefgefroren, frittiert") from an unrelated hyphen-fused
   * compound word ("quark-frucht-plunder", one word, not "quark" + qualifier).
   */
  private looseNormalize(s: string): string {
    return s
      .toLowerCase()
      .replace(/[äöüß]/g, (match) => {
        const map: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
        return map[match] || match;
      })
      .replace(/[()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

/**
 * RESOLVER-V3-051: true when `winner` -- the single BLS candidate the resolver's generic fast-path
 * is about to confidently accept for a bare, unqualified `normalizedQuery` -- carries no genuine
 * exact/whole-alias identity for that query (`winner.exact` is false) *and* the query is not even
 * a whole-token match against the candidate's own `normalizedName` (every query token present as
 * a complete, space-delimited token of the candidate name -- e.g. "pommes frites" against "pommes
 * frites tiefgefroren", or "bauchspeck" against "bauchspeck roh") *and* the query text is still
 * textually a strict substring fragment of the candidate's (whitespace-collapsed) name. That last
 * combination is exactly a generic word or short phrase fused/embedded inside a more specific
 * German compound noun -- e.g. "snack" inside "kichererbsensnack gebacken" -- where the query
 * itself never named the extra ingredient/preparation/subtype the candidate actually is. A
 * substring-only candidate found this way may still surface for discovery/ranking (this function
 * does not touch `BlsLookupEngine.search()`); it must simply not be promoted to a confidently
 * `accepted` identity by the resolver's BLS generic-truth early-return -- see
 * `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md` for the full audit and
 * rejected alternatives (a hand-curated generic-word list, a reverse-engineered score threshold).
 * General and source-grounded: no per-food, per-word, or per-sourceId list; works identically for
 * every BLS record and every possible query, driven only by the winning candidate's own name.
 */
export function hasBlsGenericSubstringOnlyIdentity(
  normalizedQuery: string,
  winner: { normalizedName: string; exact: boolean },
): boolean {
  if (winner.exact) return false;

  const queryTokens = normalizedQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return false;

  const candidateTokens = new Set(
    winner.normalizedName.toLowerCase().trim().split(/\s+/).filter(Boolean),
  );
  const isWholeTokenIdentity = queryTokens.every((token) => candidateTokens.has(token));
  if (isWholeTokenIdentity) return false;

  const collapsedQuery = normalizedQuery.toLowerCase().replace(/\s+/g, '');
  const collapsedCandidate = winner.normalizedName.toLowerCase().replace(/\s+/g, '');
  return collapsedCandidate !== collapsedQuery && collapsedCandidate.includes(collapsedQuery);
}

export interface BlsGenericCandidateForConflictCheck {
  normalizedName: string;
  kcalPer100g: number;
}

/**
 * RESOLVER-V3-049: true when `candidates` -- the BLS records currently competing to win a bare,
 * unqualified generic query at the BLS fast-path early-return -- disagree on preparation state
 * (e.g. one is the plain/unqualified record, another carries a "gekocht" / "gebacken" /
 * "frittiert" / ... qualifier the query itself never asked for) *and* that disagreement is
 * nutritionally material (`isMaterialKcalSpread`, above) -- e.g. raw vs. boiled egg (~137 vs.
 * 135 kcal) disagree on preparation state in name only, not in substance, and must not be flagged.
 * Reuses the exact same general, already-reviewed `PROCESSED_QUALIFIER_TOKENS` lexicon that
 * already governs BLS Stage-2 ranked-token scoring above -- not a new, per-case-tuned list, and
 * not a score-delta threshold. A query that itself already contains one of these qualifier tokens
 * is "qualified" and exempt -- it already disambiguated itself (Phase 3's "whether the query is
 * qualified enough to choose one variant safely" concept), so explicit preparation-state queries
 * (e.g. "Haferflocken gekocht") remain fully resolvable.
 */
export function hasBlsGenericPreparationStateConflict(
  normalizedQuery: string,
  candidates: readonly BlsGenericCandidateForConflictCheck[],
): boolean {
  if (candidates.length < 2) return false;

  const queryTokens = normalizedQuery.toLowerCase().trim().split(/\s+/);
  const queryIsQualified = queryTokens.some((token) => PREPARATION_STATE_TOKENS.has(token));
  if (queryIsQualified) return false;

  const signatures = new Set(
    candidates.map((c) => {
      const tokens = c.normalizedName.toLowerCase().trim().split(/\s+/);
      const present = tokens.filter((token) => PREPARATION_STATE_TOKENS.has(token));
      return present.length === 0 ? '__unqualified__' : [...new Set(present)].sort().join('+');
    }),
  );
  if (signatures.size <= 1) return false;

  return isMaterialKcalSpread(candidates.map((c) => c.kcalPer100g));
}
