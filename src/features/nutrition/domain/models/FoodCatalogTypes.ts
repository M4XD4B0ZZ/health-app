import { NutritionPer100g } from './NutritionTypes';

export interface CanonicalFood {
  id: string; // stable canonical ID (e.g. "banana")
  displayName: string; // human readable
  per100g: NutritionPer100g; // reuse existing type
}

export interface FoodSearchResult {
  food: CanonicalFood;
  confidence: number;
}
