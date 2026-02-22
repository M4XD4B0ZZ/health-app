import {
  FoodCatalogSource,
  FoodSearchQuery,
  FoodCandidate,
} from '../../../domain/catalog/FoodCatalogSource';

export class MockUsdaSource implements FoodCatalogSource {
  type = 'usda' as const;

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    if (query.normalized === 'apfel') {
      return [
        {
          food: {
            id: 'usda-apple',
            name: 'Apple, raw',
            normalizedName: 'apfel',
            macrosPer100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
            source: 'usda',
          },
          match: {
            exact: true,
            similarity: 1,
          },
          confidence: 0,
          reasons: [],
        },
      ];
    }

    if (query.normalized === 'haribo goldbaren') {
      return [
        {
          food: {
            id: 'usda-gummy-candy',
            name: 'Candy, gummies',
            normalizedName: 'gummy candy',
            macrosPer100g: { kcal: 340, protein: 6.8, carbs: 76, fat: 0.2 },
            source: 'usda',
          },
          match: {
            exact: false,
            similarity: 0.2,
            usedHeuristic: 'fuzzy',
          },
          confidence: 0,
          reasons: [],
        },
      ];
    }

    return [];
  }
}
