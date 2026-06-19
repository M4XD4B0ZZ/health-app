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

  return readyRequests.map((request) => {
    const hasSupportedExplicitQuantity =
      request.quantity !== null &&
      (request.unit === null || ['g', 'piece', 'slice'].includes(request.unit.toLowerCase()));

    return {
      raw: hasSupportedExplicitQuantity ? (request.rawText ?? request.rawName) : request.rawName,
      normalized: request.query, // Use the query (canonical name if available, otherwise raw name)
      locale,
      traceId,
    };
  });
}
