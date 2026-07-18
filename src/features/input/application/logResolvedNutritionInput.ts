import {
  prepareNutritionResolverDispatch,
  PreparedNutritionResolverDispatch,
} from './prepareNutritionResolverDispatch';
import { resolvePreparedNutritionInputs } from './resolvePreparedNutritionInputs';
import { LogFoodFromRawInputUseCase } from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase';
import { PortionNeedsEditItem } from '../../nutrition/domain/portion/PortionNeedsEdit';
import { SpeckClarificationItem } from '../../nutrition/domain/catalog/SpeckAmbiguity';

export interface LogResolvedNutritionInputResult {
  dispatch: PreparedNutritionResolverDispatch;
  resolvedResults: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[];
  persistedEntries: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[];
  blockedEntries: number;
  needsEditItems: PortionNeedsEditItem[];
  /** RESOLVER-V2-010: bare, unqualified "Speck" items pending a user disambiguation choice. */
  speckClarificationItems: SpeckClarificationItem[];
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
  const { dispatch, resolvedResults, needsEditItems, speckClarificationItems } =
    typeof rawInputOrDispatch === 'string'
      ? await resolvePreparedNutritionInputs(prepareNutritionResolverDispatch(rawInputOrDispatch))
      : await resolvePreparedNutritionInputs(rawInputOrDispatch);

  const persistedEntries = resolvedResults.filter((resolved) => resolved.calories > 0);
  const blockedEntries = Math.max(0, dispatch.readyRequests.length - persistedEntries.length);

  return {
    dispatch,
    resolvedResults,
    persistedEntries,
    blockedEntries,
    needsEditItems,
    speckClarificationItems,
  };
}
