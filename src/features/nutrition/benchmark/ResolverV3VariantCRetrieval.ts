import {
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
  FoodSourceType,
} from '../domain/catalog/FoodCatalogSource';
import {
  ComponentSearchPlan,
  ExpectedResolutionKind,
} from '../domain/models/AiInterpretationTypes';
import { ResolvedFoodCandidate, ResolverDecision } from '../domain/models/ResolverDecision';
import { ScoreCalculator } from '../application/services/ScoreCalculator';
import { buildResolverDecision } from '../application/services/ResolverDecisionPolicy';
import {
  ResolverSourceLabel,
  toResolverSourceLabel,
} from '../application/services/ResolverSourceLabel';
import { normalizeText } from '../application/utils/normalizeText';
import { ComponentSourceTrace } from './VariantCTypes';

/**
 * RESOLVER-V3-005: the smallest benchmark-local adapter between RESOLVER-V3-002's
 * `ComponentSearchPlan` and the resolver's existing, reused ranking/decision layer
 * (`ScoreCalculator`/`ResolverDecisionPolicy.buildResolverDecision`). This module deliberately
 * does NOT duplicate any scoring or decision logic -- both are imported from the exact same
 * modules `SequentialFoodCatalogResolver` itself uses.
 *
 * Documented semantic gap vs. `SequentialFoodCatalogResolver`'s own loop: that resolver queries
 * sources in one fixed, config-driven priority order with a single normalized query string
 * (`getSourceQuery()`, alias-dictionary-based translation). A `ComponentSearchPlan` instead names
 * a per-component, AI-chosen *subset* of source types plus a distinct native query *per source
 * type* (`nativeQueries`) -- something the production resolver boundary has no way to express
 * today. Rather than forking/modifying that resolver (out of scope, DoD explicitly forbids
 * touching `container.ts`'s production wiring), this module queries each planned source directly
 * with its own native query, then feeds the combined candidate set through the exact same
 * scoring/decision functions -- i.e. the "small benchmark-local adapter" the task explicitly
 * allows when the production boundary cannot directly consume a `ComponentSearchPlan`.
 */

/** Maps an AI-proposed `ExpectedResolutionKind` to the resolver's existing `inputType` vocabulary
 * (`FoodSearchQuery.inputType`), which sources such as `BlsStaticSource` gate on. This is a
 * deterministic vocabulary mapping only -- it does not classify raw text (that remains
 * `detectInputType`'s job for the fast path); it interprets the AI's own structured field. */
export function inputTypeForResolutionKind(
  kind: ExpectedResolutionKind,
): 'generic' | 'branded' | 'ambiguous' {
  switch (kind) {
    case 'generic_food':
      return 'generic';
    case 'branded_product':
      return 'branded';
    case 'restaurant_product':
      return 'branded';
    case 'recipe_or_dish':
    case 'reusable_personal_meal':
    case 'unknown':
      return 'ambiguous';
  }
}

export interface RetrievalRawCandidate {
  id: string;
  source: ResolverSourceLabel;
  food: FoodCandidate['food'];
  match: FoodCandidate['match'];
}

export interface ComponentRetrievalResult {
  traces: ComponentSourceTrace[];
  rawCandidates: RetrievalRawCandidate[];
  /** Source types the plan named but that had no registered adapter in this run -- surfaced as a
   * warning, never silently ignored. */
  unregisteredSourceTypes: FoodSourceType[];
}

export interface TieredComponentRetrievalResult extends ComponentRetrievalResult {
  decision: ResolverDecision;
  avoidedSourceTypes: FoodSourceType[];
  stopReason: 'authoritative_accepted' | 'tiers_exhausted';
}

/** R1-min executes source tiers one at a time and reuses the canonical scorer/decision policy
 * after every tier. An accepted result stops only when its selected source is the current
 * authoritative tier, preventing a lower-priority source from overriding it. */
export async function retrieveCandidatesForComponentPlanTiered(
  input: Parameters<typeof retrieveCandidatesForComponentPlan>[0],
): Promise<TieredComponentRetrievalResult> {
  const planned = input.plan.suitableSourceTypes.filter(
    (type) => !(input.plan.excludedSourceTypes ?? []).includes(type),
  );
  const traces: ComponentSourceTrace[] = [];
  const rawCandidates: RetrievalRawCandidate[] = [];
  const unregisteredSourceTypes: FoodSourceType[] = [];
  for (let index = 0; index < planned.length; index += 1) {
    const sourceType = planned[index];
    const tier = await retrieveCandidatesForComponentPlan({
      ...input,
      plan: {
        ...input.plan,
        suitableSourceTypes: [sourceType],
        nativeQueries: input.plan.nativeQueries.filter((query) => query.sourceType === sourceType),
        excludedSourceTypes: [],
      },
    });
    traces.push(...tier.traces);
    rawCandidates.push(...tier.rawCandidates);
    unregisteredSourceTypes.push(...tier.unregisteredSourceTypes);
    const decision = decideComponentCandidate(input.interpretedName, rawCandidates);
    if (decision.status === 'accepted' && decision.best?.food.source === sourceType) {
      return {
        traces,
        rawCandidates,
        unregisteredSourceTypes,
        decision,
        avoidedSourceTypes: planned.slice(index + 1),
        stopReason: 'authoritative_accepted',
      };
    }
  }
  return {
    traces,
    rawCandidates,
    unregisteredSourceTypes,
    decision: decideComponentCandidate(input.interpretedName, rawCandidates),
    avoidedSourceTypes: [],
    stopReason: 'tiers_exhausted',
  };
}

/** Executes one component's search plan: queries only the planned (minus excluded) source types,
 * each with its own native query (falling back to the component's interpreted name, with a
 * warning, if the plan did not supply a native query for that source type -- a documented
 * contract gap, see module docstring). Never touches a source type outside the plan. */
export async function retrieveCandidatesForComponentPlan(input: {
  plan: ComponentSearchPlan;
  interpretedName: string;
  locale: 'de' | 'en';
  traceId: string;
  sourcesByType: ReadonlyMap<FoodSourceType, FoodCatalogSource>;
  sourceBudgetMs?: Record<string, number>;
}): Promise<ComponentRetrievalResult> {
  const excluded = new Set(input.plan.excludedSourceTypes ?? []);
  const plannedTypes = input.plan.suitableSourceTypes.filter((type) => !excluded.has(type));
  const nativeQueryByType = new Map(input.plan.nativeQueries.map((q) => [q.sourceType, q.query]));
  const inputType = inputTypeForResolutionKind(input.plan.expectedResolutionKind);

  const traces: ComponentSourceTrace[] = [];
  const rawCandidates: RetrievalRawCandidate[] = [];
  const unregisteredSourceTypes: FoodSourceType[] = [];

  for (const sourceType of plannedTypes) {
    const source = input.sourcesByType.get(sourceType);
    if (!source) {
      unregisteredSourceTypes.push(sourceType);
      continue;
    }

    const queryText = nativeQueryByType.get(sourceType) ?? input.interpretedName;
    const normalizedQuery = normalizeText(queryText);
    const budgetMs = input.sourceBudgetMs?.[sourceType] ?? 1000;
    const query: FoodSearchQuery = {
      raw: queryText,
      normalized: normalizedQuery,
      locale: input.locale,
      inputType,
      traceId: input.traceId,
    };

    const startedAt = Date.now();
    try {
      const candidates = await executeWithTimeout(source.search(query), budgetMs, sourceType);
      const latencyMs = Date.now() - startedAt;
      traces.push({
        sourceType,
        queryUsed: normalizedQuery,
        candidateCount: candidates.length,
        latencyMs,
        error: null,
      });
      const sourceLabel = toResolverSourceLabel(source.type, source.constructor.name);
      candidates.forEach((candidate) => {
        rawCandidates.push({
          id: `${sourceLabel}:${candidate.food.id}`,
          source: sourceLabel,
          food: candidate.food,
          match: candidate.match,
        });
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      traces.push({
        sourceType,
        queryUsed: normalizedQuery,
        candidateCount: 0,
        latencyMs,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  return { traces, rawCandidates, unregisteredSourceTypes };
}

function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  sourceType: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Source ${sourceType} exceeded budget of ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]);
}

const scoreCalculator = new ScoreCalculator();

/** Scores every candidate via the reused `ScoreCalculator` and builds a `ResolverDecision` via the
 * reused `ResolverDecisionPolicy` -- identical functions to the ones `SequentialFoodCatalogResolver`
 * itself calls (no ranking/decision logic re-implemented here). `scoringAnchor` is the text scored
 * against (the AI's own interpreted canonical name, since candidates in this adapter can come from
 * multiple distinct native queries for the same component -- a single common anchor keeps the
 * comparison fair across sources). */
export function decideComponentCandidate(
  scoringAnchor: string,
  rawCandidates: readonly RetrievalRawCandidate[],
): ResolverDecision {
  const normalizedAnchor = normalizeText(scoringAnchor);
  const scored: ResolvedFoodCandidate[] = rawCandidates.map((candidate) => {
    const breakdown = scoreCalculator.calculate({
      normalizedQuery: normalizedAnchor,
      candidateFood: candidate.food,
      candidateSource: candidate.source,
      metadata: {
        similarity: candidate.match.similarity,
        exact: candidate.match.exact,
        usedHeuristic: candidate.match.usedHeuristic,
      },
    });
    return {
      id: candidate.id,
      source: candidate.source,
      food: candidate.food,
      score: breakdown.finalScore,
      breakdown,
    };
  });

  return buildResolverDecision({ normalizedQuery: normalizedAnchor, candidates: scored, topN: 5 });
}
