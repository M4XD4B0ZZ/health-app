import {
  prepareNutritionResolverDispatch,
  PreparedNutritionResolverDispatch,
} from './prepareNutritionResolverDispatch';
import { LogFoodFromRawInputUseCase } from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase';
import {
  PortionNeedsEditError,
  SpeckAmbiguityError,
} from '../../nutrition/application/usecases/LogFoodFromRawInputUseCase';
import { PortionNeedsEditItem } from '../../nutrition/domain/portion/PortionNeedsEdit';
import { SpeckClarificationItem } from '../../nutrition/domain/catalog/SpeckAmbiguity';
import container from '../../../infrastructure/di/container';

export interface ResolvePreparedNutritionInputsResult {
  dispatch: PreparedNutritionResolverDispatch;
  resolvedResults: Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>>[];
  needsEditItems: PortionNeedsEditItem[];
  /** RESOLVER-V2-010: bare, unqualified "Speck" items pending a user disambiguation choice. */
  speckClarificationItems: SpeckClarificationItem[];
}

const CONTROLLED_INPUT_FAILURE_MARKERS = [
  'PORTION_GRAMS_REQUIRED_FOR_UNIT_INPUT',
  'RESOLVER_FAILED_OR_NO_MACROS',
  'GENERIC_SPECK_NEEDS_CLARIFICATION',
];

export function isControlledInputResolutionFailure(error: unknown): boolean {
  if (error instanceof PortionNeedsEditError || error instanceof SpeckAmbiguityError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);

  return CONTROLLED_INPUT_FAILURE_MARKERS.some((marker) => message.includes(marker));
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
        return await useCase.execute({
          rawText: input.raw,
          rawInput: input.raw,
          groupId: input.groupId,
          groupLabel: input.groupLabel,
        });
      } catch (error) {
        if (error instanceof PortionNeedsEditError) {
          console.log('Controlled input resolution block:', input.raw);
          return { needsEdit: error.needsEdit };
        }

        if (error instanceof SpeckAmbiguityError) {
          console.log('Controlled input resolution block (Speck ambiguity):', input.raw);
          return { speckClarification: error.clarification };
        }

        if (isControlledInputResolutionFailure(error)) {
          console.log('Controlled input resolution block:', input.raw);
          return null;
        }

        // If resolution fails, skip but keep unresolvedRequests intact
        console.error('Resolution failed for input:', input.raw, error);
        return null;
      }
    }),
  );

  return {
    dispatch,
    resolvedResults: resolvedResults
      .filter((r): r is Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>> => r !== null)
      .filter(
        (r): r is Awaited<ReturnType<LogFoodFromRawInputUseCase['execute']>> =>
          !('needsEdit' in r) && !('speckClarification' in r),
      ),
    needsEditItems: resolvedResults
      .filter((r): r is { needsEdit: PortionNeedsEditItem } => r !== null && 'needsEdit' in r)
      .map((r) => r.needsEdit),
    speckClarificationItems: resolvedResults
      .filter(
        (r): r is { speckClarification: SpeckClarificationItem } =>
          r !== null && 'speckClarification' in r,
      )
      .map((r) => r.speckClarification),
  };
}
