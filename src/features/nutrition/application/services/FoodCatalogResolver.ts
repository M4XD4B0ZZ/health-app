import { FoodSearchQuery, FoodCandidate } from '../../domain/catalog/FoodCatalogSource'

export interface FoodCatalogResolver {
  resolve(query: FoodSearchQuery): Promise<FoodCandidate | null>
}
