import { describe, it, expect, jest } from '@jest/globals';
import {
  decideComponentCandidate,
  inputTypeForResolutionKind,
  retrieveCandidatesForComponentPlan,
} from '../ResolverV3VariantCRetrieval';
import { FixtureFoodCatalogSource } from '../ResolverV3VariantAAdapter';
import { FoodCatalogSource, FoodSourceType } from '../../domain/catalog/FoodCatalogSource';
import { ComponentSearchPlan } from '../../domain/models/AiInterpretationTypes';
import { ScoreCalculator } from '../../application/services/ScoreCalculator';
import { buildResolverDecision } from '../../application/services/ResolverDecisionPolicy';

function candidate(sourceId: string, name: string, kcal: number) {
  return {
    food: {
      id: sourceId,
      name,
      normalizedName: name.toLowerCase(),
      macrosPer100g: { kcal, protein: 1, carbs: 1, fat: 1 },
      source: 'bls' as const,
      sourceId,
    },
    match: { exact: true, similarity: 1 },
    confidence: 1,
    reasons: [],
  };
}

describe('inputTypeForResolutionKind', () => {
  it('maps generic_food to generic and branded_product/restaurant_product to branded', () => {
    expect(inputTypeForResolutionKind('generic_food')).toBe('generic');
    expect(inputTypeForResolutionKind('branded_product')).toBe('branded');
    expect(inputTypeForResolutionKind('restaurant_product')).toBe('branded');
  });

  it('maps recipe/reusable/unknown to ambiguous', () => {
    expect(inputTypeForResolutionKind('recipe_or_dish')).toBe('ambiguous');
    expect(inputTypeForResolutionKind('reusable_personal_meal')).toBe('ambiguous');
    expect(inputTypeForResolutionKind('unknown')).toBe('ambiguous');
  });
});

describe('retrieveCandidatesForComponentPlan', () => {
  it('queries only the suitable, non-excluded source types with the correct native query per source', async () => {
    const blsSource = new FixtureFoodCatalogSource('bls', {
      'tomate roh': [candidate('G561100', 'Tomate roh', 22)],
    });
    const offSource = new FixtureFoodCatalogSource('off', {});
    const blsSpy = jest.spyOn(blsSource, 'search');
    const offSpy = jest.spyOn(offSource, 'search');

    const plan: ComponentSearchPlan = {
      componentId: 'c1',
      suitableSourceTypes: ['bls', 'off'],
      excludedSourceTypes: ['off'],
      nativeQueries: [
        { sourceType: 'bls', query: 'tomate roh' },
        { sourceType: 'off', query: 'tomato raw' },
      ],
      expectedResolutionKind: 'generic_food',
    };

    const result = await retrieveCandidatesForComponentPlan({
      plan,
      interpretedName: 'Tomate',
      locale: 'de',
      traceId: 'test',
      sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([
        ['bls', blsSource],
        ['off', offSource],
      ]),
    });

    expect(blsSpy).toHaveBeenCalledTimes(1);
    expect(blsSpy.mock.calls[0][0].normalized).toBe('tomate roh');
    expect(offSpy).not.toHaveBeenCalled();
    expect(result.rawCandidates).toHaveLength(1);
    expect(result.rawCandidates[0].food.sourceId).toBe('G561100');
    expect(result.unregisteredSourceTypes).toEqual([]);
  });

  it('falls back to the interpreted name and warns when the plan has no native query for a planned source', async () => {
    const blsSource = new FixtureFoodCatalogSource('bls', {
      gouda: [candidate('M403000', 'Gouda', 356)],
    });
    const plan: ComponentSearchPlan = {
      componentId: 'c1',
      suitableSourceTypes: ['bls'],
      nativeQueries: [],
      expectedResolutionKind: 'generic_food',
    };

    const result = await retrieveCandidatesForComponentPlan({
      plan,
      interpretedName: 'Gouda',
      locale: 'de',
      traceId: 'test',
      sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]),
    });

    expect(result.traces[0].queryUsed).toBe('gouda');
    expect(result.rawCandidates).toHaveLength(1);
  });

  it('reports unregistered source types instead of silently skipping them', async () => {
    const plan: ComponentSearchPlan = {
      componentId: 'c1',
      suitableSourceTypes: ['usda'],
      nativeQueries: [{ sourceType: 'usda', query: 'gouda cheese' }],
      expectedResolutionKind: 'branded_product',
    };
    const result = await retrieveCandidatesForComponentPlan({
      plan,
      interpretedName: 'Gouda',
      locale: 'de',
      traceId: 'test',
      sourcesByType: new Map(),
    });
    expect(result.unregisteredSourceTypes).toEqual(['usda']);
    expect(result.rawCandidates).toHaveLength(0);
  });

  it('records a per-source error instead of throwing when a source rejects', async () => {
    const failingSource: FoodCatalogSource = {
      type: 'bls',
      search: async () => {
        throw new Error('source unavailable');
      },
    };
    const plan: ComponentSearchPlan = {
      componentId: 'c1',
      suitableSourceTypes: ['bls'],
      nativeQueries: [{ sourceType: 'bls', query: 'x' }],
      expectedResolutionKind: 'generic_food',
    };
    const result = await retrieveCandidatesForComponentPlan({
      plan,
      interpretedName: 'X',
      locale: 'de',
      traceId: 'test',
      sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', failingSource]]),
    });
    expect(result.rawCandidates).toHaveLength(0);
    expect(result.traces[0].error).toContain('source unavailable');
  });
});

describe('decideComponentCandidate — reuses ScoreCalculator/ResolverDecisionPolicy, no duplicated ranking logic', () => {
  it('produces the exact same decision as calling ScoreCalculator + buildResolverDecision directly', () => {
    const raw = [
      {
        id: 'BLS:1',
        source: 'BLS' as const,
        food: candidate('A', 'Quark', 66).food,
        match: candidate('A', 'Quark', 66).match,
      },
      {
        id: 'BLS:2',
        source: 'BLS' as const,
        food: candidate('B', 'Anderer Quark', 70).food,
        match: { exact: false, similarity: 0.5 },
      },
    ];

    const viaAdapter = decideComponentCandidate('Quark', raw);

    const calculator = new ScoreCalculator();
    const scored = raw.map((c) => {
      const breakdown = calculator.calculate({
        normalizedQuery: 'quark',
        candidateFood: c.food,
        candidateSource: c.source,
        metadata: { similarity: c.match.similarity, exact: c.match.exact },
      });
      return { id: c.id, source: c.source, food: c.food, score: breakdown.finalScore, breakdown };
    });
    const viaDirectCall = buildResolverDecision({
      normalizedQuery: 'quark',
      candidates: scored,
      topN: 5,
    });

    expect(viaAdapter.status).toBe(viaDirectCall.status);
    expect(viaAdapter.best?.food.sourceId).toBe(viaDirectCall.best?.food.sourceId);
    expect(viaAdapter.best?.score).toBe(viaDirectCall.best?.score);
  });

  it('returns a rejected/empty decision when there are no candidates at all', () => {
    const decision = decideComponentCandidate('Nichts', []);
    expect(decision.status).toBe('rejected');
    expect(decision.best).toBeUndefined();
  });
});
