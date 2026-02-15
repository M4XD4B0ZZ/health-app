import { FoodCatalog } from '../../application/ports/FoodCatalog';
import { CanonicalFood, FoodSearchResult } from '../../domain/models/FoodCatalogTypes';

export class InMemoryFoodCatalog implements FoodCatalog {
  private foods: Map<string, CanonicalFood>;

  constructor() {
    this.foods = new Map();
    this.seedCatalog();
  }

  private seedCatalog(): void {
    const seedFoods: CanonicalFood[] = [
      {
        id: 'banana',
        displayName: 'Banana',
        per100g: {
          calories: 89,
          protein: 1.1,
          carbs: 22.8,
          fat: 0.3,
        },
      },
      {
        id: 'apple',
        displayName: 'Apple',
        per100g: {
          calories: 52,
          protein: 0.3,
          carbs: 14,
          fat: 0.2,
        },
      },
      {
        id: 'egg',
        displayName: 'Egg',
        per100g: {
          calories: 155,
          protein: 13,
          carbs: 1.1,
          fat: 11,
        },
      },
      {
        id: 'chicken breast',
        displayName: 'Chicken Breast',
        per100g: {
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        },
      },
      {
        id: 'fries',
        displayName: 'Fries',
        per100g: {
          calories: 312,
          protein: 3.4,
          carbs: 41,
          fat: 15,
        },
      },
      {
        id: 'cola',
        displayName: 'Cola',
        per100g: {
          calories: 42,
          protein: 0,
          carbs: 10.6,
          fat: 0,
        },
      },
    ];

    for (const food of seedFoods) {
      this.foods.set(food.id, food);
    }
  }

  async searchByName(normalized: string): Promise<FoodSearchResult | null> {
    if (!normalized || normalized.trim() === '') {
      return null;
    }

    const tokens = normalized.toLowerCase().split(/\s+/);
    
    let bestMatch: { food: CanonicalFood; score: number } | null = null;

    for (const [id, food] of this.foods.entries()) {
      const foodTokens = id.toLowerCase().split(/\s+/);
      const displayTokens = food.displayName.toLowerCase().split(/\s+/);
      
      // Calculate match score
      let score = 0;
      
      // Exact ID match
      if (id === normalized) {
        score = 1.0;
      }
      // Exact display name match
      else if (food.displayName.toLowerCase() === normalized) {
        score = 0.95;
      }
      // Contains all tokens
      else {
        const matchedTokens = tokens.filter(token => 
          foodTokens.some(ft => ft.includes(token) || token.includes(ft)) ||
          displayTokens.some(dt => dt.includes(token) || token.includes(dt))
        );
        
        if (matchedTokens.length > 0) {
          score = matchedTokens.length / tokens.length * 0.8;
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { food, score };
      }
    }

    if (bestMatch && bestMatch.score >= 0.3) {
      return {
        food: bestMatch.food,
        confidence: bestMatch.score,
      };
    }

    return null;
  }

  async getById(id: string): Promise<CanonicalFood | null> {
    return this.foods.get(id) || null;
  }
}
