import { FoodSearchQuery } from '../../domain/catalog/FoodCatalogSource';
import { ResolverDecision } from '../../domain/models/ResolverDecision';

export interface FoodCatalogResolver {
  resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision>;
}
