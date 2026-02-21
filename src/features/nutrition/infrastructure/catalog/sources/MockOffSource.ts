import {
  FoodCatalogSource,
  FoodSearchQuery,
  FoodCandidate,
} from '../../../domain/catalog/FoodCatalogSource';

export class MockOffSource implements FoodCatalogSource {
  type = 'off' as const;

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    if (query.normalized === 'apfel') {
      return [
        {
          food: {
            id: 'off-apple-brand',
            name: 'Bio Apfel Marke X',
            normalizedName: 'apfel',
            macrosPer100g: { kcal: 55, protein: 0.4, carbs: 15, fat: 0.3 },
            source: 'off',
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

    return [];
  }
}
