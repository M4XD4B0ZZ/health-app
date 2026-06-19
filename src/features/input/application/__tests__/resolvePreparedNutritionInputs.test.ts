import {
  isControlledInputResolutionFailure,
  resolvePreparedNutritionInputs,
} from '../resolvePreparedNutritionInputs';
import { prepareNutritionResolverDispatch } from '../prepareNutritionResolverDispatch';

describe('resolvePreparedNutritionInputs', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('classifies expected user-input resolution failures as controlled blocks', () => {
    expect(
      isControlledInputResolutionFailure(
        new Error('PORTION_GRAMS_REQUIRED_FOR_UNIT_INPUT reason=COUNT_WITHOUT_PORTION_HINT'),
      ),
    ).toBe(true);
    expect(isControlledInputResolutionFailure(new Error('RESOLVER_FAILED_OR_NO_MACROS'))).toBe(
      true,
    );
    expect(isControlledInputResolutionFailure(new Error('NETWORK_TIMEOUT'))).toBe(false);
  });

  it('should dispatch and resolve matched multi-item input', async () => {
    const input = '2 Eier und Toast';
    const dispatch = prepareNutritionResolverDispatch(input, 'de');
    const result = await resolvePreparedNutritionInputs(dispatch);

    expect(result.dispatch.readyRequests.length).toBeGreaterThan(0);
    expect(result.resolvedResults.length).toBe(result.dispatch.readyRequests.length);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('should dispatch and resolve mixed known/unknown items', async () => {
    const input = 'Eier und mysteryfood';
    const dispatch = prepareNutritionResolverDispatch(input, 'de');
    const result = await resolvePreparedNutritionInputs(dispatch);

    expect(result.dispatch.readyRequests.length).toBe(2);
    expect(result.resolvedResults.length).toBe(1);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('should handle fully unresolved input', async () => {
    const input = 'mysteryfood';
    const dispatch = prepareNutritionResolverDispatch(input, 'de');
    const result = await resolvePreparedNutritionInputs(dispatch);

    expect(result.dispatch.readyRequests.length).toBe(1);
    expect(result.resolvedResults.length).toBe(0);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('does not use console.error for expected missing portion input blocks', async () => {
    const input = '8 karotten';
    const dispatch = prepareNutritionResolverDispatch(input, 'de');
    const result = await resolvePreparedNutritionInputs(dispatch);

    expect(result.dispatch.readyRequests).toHaveLength(1);
    expect(result.resolvedResults).toHaveLength(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Controlled input resolution block:', '8 karotten');
  });
});
