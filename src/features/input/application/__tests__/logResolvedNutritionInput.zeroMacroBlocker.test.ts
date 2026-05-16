import { logResolvedNutritionInput } from '../logResolvedNutritionInput';
import { resolvePreparedNutritionInputs } from '../resolvePreparedNutritionInputs';

jest.mock('../resolvePreparedNutritionInputs', () => ({
  resolvePreparedNutritionInputs: jest.fn(),
}));

describe('logResolvedNutritionInput zero-macro blocker', () => {
  it('blocks persistence for resolved entries with kcal === 0', async () => {
    const mockedResolvePreparedNutritionInputs = resolvePreparedNutritionInputs as jest.Mock;

    mockedResolvePreparedNutritionInputs.mockResolvedValue({
      dispatch: {
        readyRequests: [{ rawName: 'zero-kcal-item' }],
      },
      resolvedResults: [
        {
          calories: 0,
        },
      ],
    } as any);

    const result = await logResolvedNutritionInput('zero-kcal-item');

    expect(result.persistedEntries).toHaveLength(0);
    expect(result.blockedEntries).toBe(1);
  });

  it('counts unresolved ready entries as blocked and does not mark them persisted', async () => {
    const mockedResolvePreparedNutritionInputs = resolvePreparedNutritionInputs as jest.Mock;

    mockedResolvePreparedNutritionInputs.mockResolvedValue({
      dispatch: {
        readyRequests: [{ rawName: 'water' }],
      },
      resolvedResults: [],
    } as any);

    const result = await logResolvedNutritionInput('water');

    expect(result.persistedEntries).toHaveLength(0);
    expect(result.blockedEntries).toBe(1);
  });
});
