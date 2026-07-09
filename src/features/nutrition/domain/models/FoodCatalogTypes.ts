import { CanonicalFood } from '../catalog/FoodCatalogSource';

export type { CanonicalFood } from '../catalog/FoodCatalogSource';

export interface FoodSearchResult {
  food: CanonicalFood;
  confidence: number;
}
