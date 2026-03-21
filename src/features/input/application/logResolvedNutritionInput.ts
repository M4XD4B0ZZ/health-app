import {
  prepareNutritionResolverDispatch,
  PreparedNutritionResolverDispatch,
} from './prepareNutritionResolverDispatch';
import { resolvePreparedNutritionInputs } from './resolvePreparedNutritionInputs';
import { LogFoodFromRawInputUseCase } from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase';

export interface LogResolvedNutritionInputResult {
  dispatch: PreparedNutritionResolverDispatch;
  resolvedResults: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[];
  persistedEntries: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[];
}

/**
 * Logs resolved nutrition inputs by persisting ready resolved results.
 *
 * Preserves unresolved requests in the dispatch.
 */
export async function logResolvedNutritionInput(
  rawInputOrDispatch: string | PreparedNutritionResolverDispatch,
): Promise<LogResolvedNutritionInputResult> {
  // Resolve prepared inputs first
  const { dispatch, resolvedResults } =
    typeof rawInputOrDispatch === 'string'
      ? await resolvePreparedNutritionInputs(prepareNutritionResolverDispatch(rawInputOrDispatch))
      : await resolvePreparedNutritionInputs(rawInputOrDispatch);

  const persistedEntries = resolvedResults.filter((resolved) => resolved.calories > 0);

  return {
    dispatch,
    resolvedResults,
    persistedEntries,
  };
}
