import { CanonicalFood, FoodSearchResult } from '../../domain/models/FoodCatalogTypes';

export interface FoodCatalog {
  searchByName(normalized: string): Promise<FoodSearchResult | null>;
  getById(id: string): Promise<CanonicalFood | null>;
}
