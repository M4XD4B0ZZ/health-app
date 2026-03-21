import { ResolverFoodRequest } from '../domain/ResolverFoodRequest';

// Import the nutrition resolver types
export interface FoodSearchQuery {
  raw: string;
  normalized: string;
  locale: 'de' | 'en';
  traceId?: string;
}

export function buildNutritionResolverInputs(
  resolverRequests: ResolverFoodRequest[],
  locale: 'de' | 'en' = 'de',
  traceId?: string,
): FoodSearchQuery[] {
  // Only include items with status = "ready"
  const readyRequests = resolverRequests.filter((request) => request.status === 'ready');

  return readyRequests.map((request) => ({
    raw: request.rawName, // Use rawName since rawText is no longer available
    normalized: request.query, // Use the query (canonical name if available, otherwise raw name)
    locale,
    traceId,
  }));
}
