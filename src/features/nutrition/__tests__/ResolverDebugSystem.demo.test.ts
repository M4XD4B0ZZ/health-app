import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { FoodCatalogSource, FoodCandidate } from '../domain/catalog/FoodCatalogSource';
import { FoodCatalogConfig } from '../domain/models/FoodCatalogConfig';

describe('Resolver Debug System - Demo', () => {
  const confidenceEngine = new DefaultConfidenceEngine();

  const config: FoodCatalogConfig = {
    offEarlyReturnMinConfidence: 0.7,
    enableDebugLogs: true,
    enableTracing: true,
    resolverBudgetMs: 2000,
    sourceBudgets: { off: 700, usda: 700 },
    negativeCacheTtlMs: 1200000,
    circuitBreaker: {
      failureThreshold: 3,
      cooldownMs: 120000,
      enabled: true,
    },
  };

  const createCandidate = (overrides: Partial<FoodCandidate['food']> & { similarity?: number; exact?: boolean }): FoodCandidate => ({
    food: {
      id: overrides.id || 'test-id',
      name: overrides.name || 'Test Food',
      normalizedName: overrides.normalizedName || 'test food',
      macrosPer100g: {
        kcal: overrides.macrosPer100g?.kcal || 100,
        protein: overrides.macrosPer100g?.protein || 10,
        carbs: overrides.macrosPer100g?.carbs || 10,
        fat: overrides.macrosPer100g?.fat || 5,
      },
      source: overrides.source || 'usda',
    },
    match: {
      exact: overrides.exact || false,
      similarity: overrides.similarity || 0.8,
    },
    confidence: 0,
    reasons: [],
  });

  it('demonstrates the plausibility fix working - OFF early return blocked', async () => {
    // Mock OFF source with high-calorie implausible egg (513 kcal)
    const offSource: FoodCatalogSource = {
      type: 'off',
      search: jest.fn().mockResolvedValue([
        createCandidate({
          id: 'off-egg-processed',
          name: 'EGG POWDER PRODUCT',
          normalizedName: 'egg',
          macrosPer100g: { kcal: 513, protein: 6.41, carbs: 57.7, fat: 28.8 },
          source: 'off',
          similarity: 0.98,
          exact: true,
        }),
      ]),
    };

    // Mock USDA source with plausible egg (143 kcal)
    const usdaSource: FoodCatalogSource = {
      type: 'usda',
      search: jest.fn().mockResolvedValue([
        createCandidate({
          id: 'usda-egg-raw',
          name: 'Egg, whole, raw',
          normalizedName: 'egg',
          macrosPer100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
          source: 'usda',
          similarity: 0.95,
          exact: true,
        }),
      ]),
    };

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine,
      config,
    );

    const result = await resolver.resolve({
      raw: 'egg',
      normalized: 'egg',
      locale: 'en',
    });

    // Verify that the plausibility fix worked:
    // 1. OFF candidate was penalized (low confidence)
    // 2. USDA candidate won instead
    // 3. Final result has plausible calories
    
    expect(result.status).toBe('accepted');
    expect(result.best?.source).toBe('USDA');
    expect(result.best?.food.name).toBe('Egg, whole, raw');
    expect(result.best?.food.macrosPer100g.kcal).toBe(143); // Plausible calories
    
    // Verify both sources were called (no early return)
    expect(offSource.search).toHaveBeenCalled();
    expect(usdaSource.search).toHaveBeenCalled();
    
    console.log('\n=== PLAUSIBILITY FIX DEMONSTRATION ===');
    console.log('Query: "egg"');
    console.log('OFF Candidate: EGG POWDER PRODUCT (513 kcal) - PENALIZED');
    console.log('USDA Candidate: Egg, whole, raw (143 kcal) - WINNER');
    console.log('Result: USDA won with plausible calories!');
    console.log('=====================================\n');
  });

  it('demonstrates debug system structure (manual verification)', async () => {
    const emptySource: FoodCatalogSource = {
      type: 'off',
      search: jest.fn().mockResolvedValue([]),
    };

    const resolver = new SequentialFoodCatalogResolver(
      [emptySource],
      confidenceEngine,
      config,
    );

    const result = await resolver.resolve({
      raw: 'mysteryfood',
      normalized: 'mysteryfood',
      locale: 'en',
    });

    expect(result.status).toBe('rejected');
    
    console.log('\n=== DEBUG SYSTEM STRUCTURE ===');
    console.log('Expected Debug Log Structure:');
    console.log(JSON.stringify({
      query: {
        raw: 'mysteryfood',
        normalized: 'mysteryfood',
        locale: 'en',
        traceId: 'cat-xxx-xxx'
      },
      sources: [{
        source: 'off',
        status: 'success',
        durationMs: 0,
        candidates: []
      }],
      evaluation: [],
      decision: {
        reason: 'no_candidates',
        status: 'rejected',
        reasonCodes: ['NO_CANDIDATES']
      },
      timing: {
        totalMs: 3,
        sourceTimings: { off: 0 }
      }
    }, null, 2));
    console.log('===============================\n');
  });
});