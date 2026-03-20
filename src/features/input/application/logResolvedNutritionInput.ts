import { prepareNutritionResolverDispatch, PreparedNutritionResolverDispatch } from './prepareNutritionResolverDispatch'
import { resolvePreparedNutritionInputs } from './resolvePreparedNutritionInputs'
import { LogFoodFromRawInputUseCase } from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase'

export interface LogResolvedNutritionInputResult {
  dispatch: PreparedNutritionResolverDispatch
  resolvedResults: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[]
  persistedEntries: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[]
}

/**
 * Logs resolved nutrition inputs by persisting ready resolved results.
 *
 * Preserves unresolved requests in the dispatch.
 */
export async function logResolvedNutritionInput(
  rawInputOrDispatch: string | PreparedNutritionResolverDispatch
): Promise<LogResolvedNutritionInputResult> {
  // Resolve prepared inputs first
  const { dispatch, resolvedResults } =
    typeof rawInputOrDispatch === 'string'
      ? await resolvePreparedNutritionInputs(prepareNutritionResolverDispatch(rawInputOrDispatch))
      : await resolvePreparedNutritionInputs(rawInputOrDispatch)


   // Use resolved results directly as persisted entries to avoid duplicate execution
   // The resolvedResults already contain the executed and resolved nutrition data
   const persistedEntries: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[] = []
   
   for (const resolved of resolvedResults) {
     if (dispatch.readyRequests.some(r => r.rawName === resolved.rawInput)) {
       // Skip zero-macro entries to avoid error states, but don't re-execute
       if (resolved.calories && resolved.calories > 0) {
         persistedEntries.push(resolved)
       }
     }
   }

  return {
    dispatch,
    resolvedResults,
    persistedEntries,
  }
}
