import { logResolvedNutritionInput } from '../logResolvedNutritionInput';
import { resolvePreparedNutritionInputs } from '../resolvePreparedNutritionInputs';

jest.mock('../resolvePreparedNutritionInputs', () => ({
  resolvePreparedNutritionInputs: jest.fn(),
}));

describe('logResolvedNutritionInput zero-macro blocker', () => {
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
