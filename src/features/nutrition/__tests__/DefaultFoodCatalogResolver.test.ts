import { DefaultFoodCatalogResolver } from '../application/services/DefaultFoodCatalogResolver';
import { MockUsdaSource } from '../infrastructure/catalog/sources/MockUsdaSource';
import { MockOffSource } from '../infrastructure/catalog/sources/MockOffSource';
import { FoodCatalogSource, FoodCandidate } from '../domain/catalog/FoodCatalogSource';

function createCandidate(input: {
  id: string;
  source: 'off' | 'usda' | 'user' | 'ai';
  normalizedName: string;
  name?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  similarity?: number;
  exact?: boolean;
  usedHeuristic?: 'plural' | 'alias' | 'fuzzy';
}): FoodCandidate {
  return {
    food: {
      id: input.id,
      name: input.name ?? input.normalizedName,
      normalizedName: input.normalizedName,
      macrosPer100g: {
        kcal: input.kcal ?? 100,
        protein: input.protein ?? 10,
        carbs: input.carbs ?? 10,
        fat: input.fat ?? 2,
      },
      source: input.source,
    },
    match: {
      exact: input.exact ?? false,
      similarity: input.similarity ?? 0.5,
      usedHeuristic: input.usedHeuristic,
    },
    confidence: 0,
    reasons: [],
  };
}

describe('DefaultFoodCatalogResolver', () => {
  it('returns structured decision and USDA wins generic "apfel"', async () => {
    const resolver = new DefaultFoodCatalogResolver([new MockOffSource(), new MockUsdaSource()]);

    const result = await resolver.resolve({
      raw: 'apfel',
      normalized: 'apfel',
      locale: 'de',
    });

    expect(['accepted', 'ambiguous']).toContain(result.status);
    expect(result.best?.source).toBe('MOCK_USDA');
    expect(result.secondBest?.source).toBe('MOCK_OFF');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score);
  });

  it('returns OFF as best for branded "haribo goldbaren"', async () => {
    const resolver = new DefaultFoodCatalogResolver([new MockOffSource(), new MockUsdaSource()]);

    const result = await resolver.resolve({
      raw: 'haribo goldbaren',
      normalized: 'haribo goldbaren',
      locale: 'de',
    });

    expect(result.status).toBe('accepted');
    expect(result.best?.source).toBe('MOCK_OFF');
  });

  it('penalizes candidate with missing macros in dataQualityScore', async () => {
    const source: FoodCatalogSource = {
      type: 'usda',
      search: async () => [
        createCandidate({
          id: 'good',
          source: 'usda',
          normalizedName: 'oats',
          exact: true,
          similarity: 1,
          kcal: 389,
          protein: 17,
          carbs: 66,
          fat: 7,
        }),
        createCandidate({
          id: 'missing',
          source: 'usda',
          normalizedName: 'oats',
          exact: true,
          similarity: 1,
          kcal: NaN,
          protein: 17,
          carbs: 66,
          fat: NaN,
        }),
      ],
    };

    const resolver = new DefaultFoodCatalogResolver([source]);
    const result = await resolver.resolve({ raw: 'oats', normalized: 'oats', locale: 'en' });

    expect(result.best?.id).toBe('USDA:good');
    expect(result.best?.breakdown.dataQualityScore).toBe(1);
    expect(result.secondBest?.breakdown.dataQualityScore).toBeLessThan(1);
  });

  it('penalizes kcal inconsistency', async () => {
    const source: FoodCatalogSource = {
      type: 'off',
      search: async () => [
        createCandidate({
          id: 'consistent',
          source: 'off',
          normalizedName: 'protein bar',
          exact: true,
          similarity: 1,
          kcal: 200,
          protein: 20,
          carbs: 15,
          fat: 6,
        }),
        createCandidate({
          id: 'inconsistent',
          source: 'off',
          normalizedName: 'protein bar',
          exact: true,
          similarity: 1,
          kcal: 200,
          protein: 40,
          carbs: 40,
          fat: 20,
        }),
      ],
    };

    const resolver = new DefaultFoodCatalogResolver([source]);
    const result = await resolver.resolve({
      raw: 'protein bar',
      normalized: 'protein bar',
      locale: 'en',
    });

    expect(result.best?.id).toBe('OFF:consistent');
    expect(result.best?.breakdown.kcalConsistencyScore).toBeGreaterThan(
      result.secondBest?.breakdown.kcalConsistencyScore ?? 0,
    );
  });

  it('returns ambiguous for close scores', async () => {
    const source: FoodCatalogSource = {
      type: 'usda',
      search: async () => [
        createCandidate({
          id: 'close-a',
          source: 'usda',
          normalizedName: 'rice',
          exact: true,
          similarity: 1,
          kcal: 360,
          protein: 7,
          carbs: 78,
          fat: 1,
        }),
        createCandidate({
          id: 'close-b',
          source: 'usda',
          normalizedName: 'rice',
          exact: true,
          similarity: 1,
          kcal: 358,
          protein: 7,
          carbs: 78,
          fat: 1,
        }),
      ],
    };

    const resolver = new DefaultFoodCatalogResolver([source]);
    const result = await resolver.resolve({ raw: 'rice', normalized: 'rice', locale: 'en' });

    expect(result.status).toBe('ambiguous');
    expect(result.reasonCodes).toEqual(['MULTIPLE_CLOSE_MATCHES']);
  });

  it('returns rejected for low score', async () => {
    const source: FoodCatalogSource = {
      type: 'off',
      search: async () => [
        createCandidate({
          id: 'weak',
          source: 'off',
          normalizedName: 'xylophone',
          exact: false,
          similarity: 0,
          usedHeuristic: 'fuzzy',
        }),
      ],
    };

    const resolver = new DefaultFoodCatalogResolver([source]);
    const result = await resolver.resolve({
      raw: 'haribo',
      normalized: 'haribo',
      locale: 'en',
    });

    expect(result.status).toBe('rejected');
    expect(result.reasonCodes).toEqual(['LOW_SCORE']);
  });

  it('uses deterministic tie-breaker by id as final fallback', async () => {
    const source: FoodCatalogSource = {
      type: 'usda',
      search: async () => [
        createCandidate({
          id: 'b-id',
          source: 'usda',
          normalizedName: 'banana',
          exact: true,
          similarity: 1,
          kcal: 100,
          protein: 10,
          carbs: 10,
          fat: 2,
        }),
        createCandidate({
          id: 'a-id',
          source: 'usda',
          normalizedName: 'banana',
          exact: true,
          similarity: 1,
          kcal: 100,
          protein: 10,
          carbs: 10,
          fat: 2,
        }),
      ],
    };

    const resolver = new DefaultFoodCatalogResolver([source]);
    const result = await resolver.resolve({ raw: 'banana', normalized: 'banana', locale: 'en' });

    expect(result.candidates[0].id).toBe('USDA:a-id');
    expect(result.candidates[1].id).toBe('USDA:b-id');
  });
});
