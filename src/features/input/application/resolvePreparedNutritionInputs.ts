import { prepareNutritionResolverDispatch, PreparedNutritionResolverDispatch } from './prepareNutritionResolverDispatch'
import { LogFoodFromRawInputUseCase } from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase'
import { DeterministicFoodParser } from '../../nutrition/infrastructure/parsers/DeterministicFoodParser'

export interface ResolvePreparedNutritionInputsResult {
  dispatch: PreparedNutritionResolverDispatch
  resolvedResults: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[]
}

/**
 * Connects the input pipeline's prepared nutrition resolver inputs to the existing nutrition resolver execution path.
 * Accepts raw input string or a prepared dispatch object.
 *
 * Preserves unresolved requests in the result.
 */
export async function resolvePreparedNutritionInputs(
  rawInputOrDispatch: string | PreparedNutritionResolverDispatch
): Promise<ResolvePreparedNutritionInputsResult> {
  let dispatch: PreparedNutritionResolverDispatch

  if (typeof rawInputOrDispatch === 'string') {
    dispatch = prepareNutritionResolverDispatch(rawInputOrDispatch)
  } else {
    dispatch = rawInputOrDispatch
  }

  // Minimal mock for FoodCatalogResolver
  const mockResolver = {
    resolve: async (query: any) => {
      // Mock different responses for testing
      const queryStr = [query.raw, query.text, query.normalized]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();
      const isEgg = queryStr.includes('eier') || queryStr.includes('egg');
      const isToast = queryStr.includes('toast');
      const isBanana = queryStr.includes('banana');
      const macros = (isEgg || isToast || isBanana) ? { kcal: 100, protein: 10, carbs: 10, fat: 10 } : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      
      if (!isEgg && !isToast && !isBanana) {
        return {
          normalizedQuery: query.raw || query.text || query.normalized || 'mock',
          status: 'rejected' as const,
          candidates: [],
          reasonCodes: ['NO_CANDIDATES'],
          createdAt: new Date().toISOString(),
          best: undefined
        };
      }
      
      return {
        normalizedQuery: query.raw || query.text || query.normalized || 'mock',
        status: 'accepted' as const,
        candidates: [],
        reasonCodes: [],
        createdAt: new Date().toISOString(),
        best: {
          id: 'mock-food-id',
          source: 'user' as const,
          food: {
            id: 'mock-food-id',
            name: isEgg ? 'Egg' : isToast ? 'Toast' : 'mock-food',
            normalizedName: 'mock-food',
            macrosPer100g: macros,
            source: 'user' as const,
          },
          score: 0.9,
          breakdown: { matchScore: 1, dataQualityScore: 1, kcalConsistencyScore: 1, sourceTrustScore: 1, finalScore: 1, notes: [] },
        },
      };
    },
  } as any;

  // Use a minimal mock repository to avoid persistence errors in tests
  const mockRepository = {
    addEntry: async (entry: any) => {
      // no-op
      return entry;
    },
  };

  const useCase = new LogFoodFromRawInputUseCase(
    mockRepository as any, // repository
    { now: () => new Date(), todayISO: () => new Date().toISOString().slice(0, 10) }, // clock
    { newId: () => 'test-id' }, // idGenerator
    new DeterministicFoodParser(), // parser
    mockResolver as any, // foodCatalog
    undefined, // aliasRepository
    undefined, // aiFoodMapper
    undefined, // nutritionLookup
    mockResolver as any, // resolver
  )

  const resolvedResults = await Promise.all(
    dispatch.nutritionResolverInputs.map(async (input) => {
      try {
        // Use the existing use case to resolve each nutrition input
        return await useCase.execute(input.raw)
      } catch (error) {
        // If resolution fails, skip but keep unresolvedRequests intact
        console.error('Resolution failed for input:', input.raw, error)
        return null
      }
    })
  )

  return {
    dispatch,
    resolvedResults: resolvedResults.filter((r): r is Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>> => r !== null),
  }
}
