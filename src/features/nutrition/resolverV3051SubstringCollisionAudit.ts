import {
  BLS_GENERIC_FOODS,
  BLS_CANONICAL_SHORTCUTS,
} from './infrastructure/catalog/sources/blsGenericFoods';
import {
  BlsFoodRecord,
  BlsLookupEngine,
} from './infrastructure/catalog/sources/bls/BlsLookupEngine';
import { BlsStaticSource } from './infrastructure/catalog/sources/BlsStaticSource';
import { SequentialFoodCatalogResolver } from './application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from './domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from './domain/models/FoodCatalogConfig';
import { NoopResolverRunLogger } from './application/ports/ResolverRunLogger';
import { DeterministicFoodParser } from './infrastructure/parsers/DeterministicFoodParser';
import { normalizeText } from './application/utils/normalizeText';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from './benchmark/representativeHybridV1/RepresentativeHybridV1Manifest';
import type { RepresentativeHybridV1ResolutionScenario } from './benchmark/representativeHybridV1/RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-051 §Phase 3/6: deterministic, reproducible, offline substring-collision audit over
 * the real BLS runtime population, extending the RESOLVER-V3-049 14,690-query methodology
 * specifically for substring containment. Zero provider calls; only real, committed, deterministic
 * data (`BLS_GENERIC_FOODS`, the frozen representative corpus).
 *
 * "Before" (pre-RESOLVER-V3-051) status is derived analytically from the *current* (post-fix)
 * decision rather than by reverting the fix: `guardAgainstBlsGenericSubstringCollision`
 * (`SequentialFoodCatalogResolver.ts`) only ever downgrades a decision that would otherwise have
 * been `accepted` -- when it fires, it preserves `decision.candidates` (the original ranked list,
 * unmodified) and only clears `status`/`best`/`secondBest`/`reasonCodes`. So for any decision whose
 * `reasonCodes` contain `BLS_GENERIC_SUBSTRING_COLLISION_RISK`, the pre-fix decision is
 * reconstructible exactly: status `accepted`, winner `candidates[0]`. This avoids duplicating (and
 * risking silent drift from) the resolver's real acceptance logic, matching the spirit of
 * RESOLVER-V3-050's own precedent of keeping historical-boundary reproduction faithful to the real
 * code wherever possible.
 */

export type SubstringAuditQuerySource =
  | 'bls_display_name'
  | 'bls_alias'
  | 'bls_single_token'
  | 'representative_corpus';

export type SubstringMatchClassification =
  | 'exact_identity'
  | 'whole_token'
  | 'sub_token_substring_record_specific'
  | 'sub_token_substring_query_specific'
  | 'alias_substring'
  | 'no_relation'
  | 'no_candidates';

export interface SubstringAuditQueryResult {
  query: string;
  querySource: SubstringAuditQuerySource;
  candidateCount: number;
  winnerSourceIdBefore: string | null;
  winnerSourceIdAfter: string | null;
  winnerNormalizedName: string | null;
  classification: SubstringMatchClassification;
  statusBefore: 'accepted' | 'ambiguous' | 'rejected';
  statusAfter: 'accepted' | 'ambiguous' | 'rejected';
  changed: boolean;
  transition:
    | 'unchanged'
    | 'accepted_to_ambiguous'
    | 'accepted_to_no_match'
    | 'ambiguous_to_accepted'
    | 'no_match_to_accepted';
  queryLessSpecificThanWinner: boolean;
  winnerKcal: number | null;
}

export interface SubstringAuditTotals {
  totalQueries: number;
  candidateFound: number;
  bySource: Record<SubstringAuditQuerySource, number>;
  byClassification: Record<SubstringMatchClassification, number>;
  acceptedBefore: number;
  ambiguousBefore: number;
  rejectedBefore: number;
  acceptedAfter: number;
  ambiguousAfter: number;
  rejectedAfter: number;
  changedOutcomes: number;
  acceptedToAmbiguous: number;
  acceptedToNoMatch: number;
  ambiguousToAccepted: number;
  noMatchToAccepted: number;
  winnerSourceIdChanges: number;
  substringOnlyAcceptedBefore: number;
  substringOnlyAcceptedAfter: number;
  singleSubstringCandidateQueries: number;
  multipleSubstringCandidateQueries: number;
}

export interface SubstringAuditReport {
  generatedAt: string;
  totals: SubstringAuditTotals;
  results: SubstringAuditQueryResult[];
}

function buildDisplayNameQueries(records: readonly BlsFoodRecord[]): Set<string> {
  return new Set(records.map((r) => r.normalizedName).filter((n) => n.length > 0));
}

function buildAliasQueries(records: readonly BlsFoodRecord[]): Set<string> {
  const out = new Set<string>();
  for (const r of records) {
    for (const alias of r.aliases) {
      const normalized = normalizeText(alias);
      if (normalized.length > 0) out.add(normalized);
    }
  }
  return out;
}

function buildSingleTokenQueries(records: readonly BlsFoodRecord[]): Set<string> {
  const out = new Set<string>();
  for (const r of records) {
    for (const token of r.tokens) {
      if (token.length > 1) out.add(token);
    }
  }
  return out;
}

function isResolutionScenario(
  scenario: (typeof REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS)[number],
): scenario is RepresentativeHybridV1ResolutionScenario {
  return scenario.scenarioType === 'resolution_decomposition';
}

function buildRepresentativeCorpusQueries(): Set<string> {
  const parser = new DeterministicFoodParser();
  const out = new Set<string>();
  for (const scenario of REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS) {
    if (!isResolutionScenario(scenario)) continue;
    const parsed = parser.parse(scenario.case.rawInput);
    const normalized = normalizeText(parsed.name);
    if (normalized.length > 0) out.add(normalized);
  }
  return out;
}

/**
 * Classifies the textual relationship between `query` and the winning BLS record's identity
 * (aliases/tokens), independent of which BlsLookupEngine stage produced the match. Mirrors the
 * exemption logic of `hasBlsGenericSubstringOnlyIdentity` but distinguishes the two substring
 * directions and the "no textual relation at all" case for audit reporting.
 */
function classifyMatch(query: string, record: BlsFoodRecord): SubstringMatchClassification {
  const collapsedQuery = query.toLowerCase().replace(/\s+/g, '');
  const aliasesNormalized = record.aliases.map((a) => a.toLowerCase().trim());
  if (aliasesNormalized.some((a) => a === query || a.replace(/\s+/g, '') === collapsedQuery)) {
    return 'exact_identity';
  }

  const queryTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const recordWholeTokens = new Set(record.tokens.map((t) => t.toLowerCase()));
  if (queryTokens.length > 0 && queryTokens.every((t) => recordWholeTokens.has(t))) {
    return 'whole_token';
  }

  const recordTokenIsSuperstring = record.tokens.some(
    (t) => t.toLowerCase() !== query && t.toLowerCase().includes(query),
  );
  if (recordTokenIsSuperstring) return 'sub_token_substring_record_specific';

  const queryIsSuperstringOfRecordToken = record.tokens.some(
    (t) => t.toLowerCase() !== query && query.includes(t.toLowerCase()),
  );
  if (queryIsSuperstringOfRecordToken) return 'sub_token_substring_query_specific';

  const aliasSubstring = aliasesNormalized.some((a) => a !== query && a.includes(query));
  if (aliasSubstring) return 'alias_substring';

  return 'no_relation';
}

export async function runResolverV3051SubstringCollisionAudit(): Promise<SubstringAuditReport> {
  const querySets: [SubstringAuditQuerySource, Set<string>][] = [
    ['bls_display_name', buildDisplayNameQueries(BLS_GENERIC_FOODS)],
    ['bls_alias', buildAliasQueries(BLS_GENERIC_FOODS)],
    ['bls_single_token', buildSingleTokenQueries(BLS_GENERIC_FOODS)],
    ['representative_corpus', buildRepresentativeCorpusQueries()],
  ];

  const seen = new Map<string, SubstringAuditQuerySource>();
  const orderedQueries: { query: string; source: SubstringAuditQuerySource }[] = [];
  for (const [source, set] of querySets) {
    for (const query of set) {
      if (seen.has(query)) continue;
      seen.set(query, source);
      orderedQueries.push({ query, source });
    }
  }

  const engine = new BlsLookupEngine(BLS_GENERIC_FOODS, BLS_CANONICAL_SHORTCUTS);
  const recordsBySourceId = new Map(BLS_GENERIC_FOODS.map((r) => [r.sourceId, r]));

  function buildResolver() {
    return new SequentialFoodCatalogResolver(
      [new BlsStaticSource()],
      new DefaultConfidenceEngine(),
      DEFAULT_CATALOG_CONFIG,
      undefined,
      new NoopResolverRunLogger(),
    );
  }

  const results: SubstringAuditQueryResult[] = [];

  for (const { query, source } of orderedQueries) {
    const rawResults = engine.search(query);
    const candidateCount = rawResults.length;

    const decision = await buildResolver().resolve({
      raw: query,
      normalized: query,
      locale: 'de',
      inputType: 'generic',
    });

    const wasSubstringGuarded = decision.reasonCodes.includes(
      'BLS_GENERIC_SUBSTRING_COLLISION_RISK',
    );
    const statusAfter = decision.status;
    const statusBefore = wasSubstringGuarded ? 'accepted' : decision.status;
    const winnerAfter = decision.best?.food.sourceId ?? null;
    const winnerBefore = wasSubstringGuarded
      ? (decision.candidates[0]?.food.sourceId ?? null)
      : winnerAfter;

    const winnerRecord = winnerBefore ? recordsBySourceId.get(winnerBefore) : undefined;
    const classification: SubstringMatchClassification = winnerRecord
      ? classifyMatch(query, winnerRecord)
      : candidateCount === 0
        ? 'no_candidates'
        : 'no_relation';

    let transition: SubstringAuditQueryResult['transition'] = 'unchanged';
    if (statusBefore === 'accepted' && statusAfter === 'ambiguous')
      transition = 'accepted_to_ambiguous';
    else if (statusBefore === 'accepted' && statusAfter === 'rejected')
      transition = 'accepted_to_no_match';
    else if (statusBefore !== 'accepted' && statusAfter === 'accepted')
      transition = statusBefore === 'ambiguous' ? 'ambiguous_to_accepted' : 'no_match_to_accepted';

    results.push({
      query,
      querySource: source,
      candidateCount,
      winnerSourceIdBefore: winnerBefore,
      winnerSourceIdAfter: winnerAfter,
      winnerNormalizedName: winnerRecord?.normalizedName ?? null,
      classification,
      statusBefore,
      statusAfter,
      changed: statusBefore !== statusAfter || winnerBefore !== winnerAfter,
      transition,
      queryLessSpecificThanWinner:
        classification === 'sub_token_substring_record_specific' ||
        classification === 'alias_substring',
      winnerKcal: winnerRecord?.macrosPer100g.kcal ?? null,
    });
  }

  const totals: SubstringAuditTotals = {
    totalQueries: results.length,
    candidateFound: results.filter((r) => r.candidateCount > 0).length,
    bySource: {
      bls_display_name: 0,
      bls_alias: 0,
      bls_single_token: 0,
      representative_corpus: 0,
    },
    byClassification: {
      exact_identity: 0,
      whole_token: 0,
      sub_token_substring_record_specific: 0,
      sub_token_substring_query_specific: 0,
      alias_substring: 0,
      no_relation: 0,
      no_candidates: 0,
    },
    acceptedBefore: 0,
    ambiguousBefore: 0,
    rejectedBefore: 0,
    acceptedAfter: 0,
    ambiguousAfter: 0,
    rejectedAfter: 0,
    changedOutcomes: 0,
    acceptedToAmbiguous: 0,
    acceptedToNoMatch: 0,
    ambiguousToAccepted: 0,
    noMatchToAccepted: 0,
    winnerSourceIdChanges: 0,
    substringOnlyAcceptedBefore: 0,
    substringOnlyAcceptedAfter: 0,
    singleSubstringCandidateQueries: 0,
    multipleSubstringCandidateQueries: 0,
  };

  for (const r of results) {
    totals.bySource[r.querySource] += 1;
    totals.byClassification[r.classification] += 1;
    if (r.statusBefore === 'accepted') totals.acceptedBefore += 1;
    if (r.statusBefore === 'ambiguous') totals.ambiguousBefore += 1;
    if (r.statusBefore === 'rejected') totals.rejectedBefore += 1;
    if (r.statusAfter === 'accepted') totals.acceptedAfter += 1;
    if (r.statusAfter === 'ambiguous') totals.ambiguousAfter += 1;
    if (r.statusAfter === 'rejected') totals.rejectedAfter += 1;
    if (r.statusBefore !== r.statusAfter) totals.changedOutcomes += 1;
    if (r.transition === 'accepted_to_ambiguous') totals.acceptedToAmbiguous += 1;
    if (r.transition === 'accepted_to_no_match') totals.acceptedToNoMatch += 1;
    if (r.transition === 'ambiguous_to_accepted') totals.ambiguousToAccepted += 1;
    if (r.transition === 'no_match_to_accepted') totals.noMatchToAccepted += 1;
    if (
      r.winnerSourceIdBefore &&
      r.winnerSourceIdAfter &&
      r.winnerSourceIdBefore !== r.winnerSourceIdAfter
    ) {
      totals.winnerSourceIdChanges += 1;
    }
    if (r.queryLessSpecificThanWinner && r.statusBefore === 'accepted') {
      totals.substringOnlyAcceptedBefore += 1;
    }
    if (r.queryLessSpecificThanWinner && r.statusAfter === 'accepted') {
      totals.substringOnlyAcceptedAfter += 1;
    }
    if (r.queryLessSpecificThanWinner) {
      if (r.candidateCount === 1) totals.singleSubstringCandidateQueries += 1;
      else if (r.candidateCount > 1) totals.multipleSubstringCandidateQueries += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    results,
  };
}

/** Test/diagnostic accessor for direct unit coverage of the classification function. */
export { classifyMatch as classifyBlsSubstringMatch };
