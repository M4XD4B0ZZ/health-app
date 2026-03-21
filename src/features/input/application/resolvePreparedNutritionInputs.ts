import {
  prepareNutritionResolverDispatch,
  PreparedNutritionResolverDispatch,
} from './prepareNutritionResolverDispatch';
import { LogFoodFromRawInputUseCase } from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase';
import container from '../../../infrastructure/di/container';

export interface ResolvePreparedNutritionInputsResult {
  dispatch: PreparedNutritionResolverDispatch;
  resolvedResults: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[];
}

/**
 * Connects the input pipeline's prepared nutrition resolver inputs to the existing nutrition resolver execution path.
 * Accepts raw input string or a prepared dispatch object.
 *
 * Preserves unresolved requests in the result.
 */
export async function resolvePreparedNutritionInputs(
  rawInputOrDispatch: string | PreparedNutritionResolverDispatch,
): Promise<ResolvePreparedNutritionInputsResult> {
  let dispatch: PreparedNutritionResolverDispatch;

  if (typeof rawInputOrDispatch === 'string') {
    dispatch = prepareNutritionResolverDispatch(rawInputOrDispatch);
  } else {
    dispatch = rawInputOrDispatch;
  }

  // Use the real LogFoodFromRawInputUseCase from the DI container
  const useCase = container.logFoodFromRawInputUseCase;

  const resolvedResults = await Promise.all(
    dispatch.nutritionResolverInputs.map(async (input) => {
      try {
        // Use the existing use case to resolve each nutrition input
        // Pass rawText explicitly to preserve truthfulness
        return await useCase.execute({ rawText: input.raw, rawInput: input.raw });
      } catch (error) {
        // If resolution fails, skip but keep unresolvedRequests intact
        console.error('Resolution failed for input:', input.raw, error);
        return null;
      }
    }),
  );

  return {
    dispatch,
    resolvedResults: resolvedResults.filter(
      (r): r is Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>> => r !== null,
    ),
  };
}
