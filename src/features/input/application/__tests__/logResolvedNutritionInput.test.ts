import { logResolvedNutritionInput } from '../logResolvedNutritionInput';

describe('logResolvedNutritionInput', () => {
  it('should log matched multi-item input', async () => {
    const input = '2 Eier und Toast';
    const result = await logResolvedNutritionInput(input);

    expect(result.dispatch.readyRequests.length).toBeGreaterThan(0);
    expect(result.resolvedResults.length).toBe(result.dispatch.readyRequests.length);
    expect(result.persistedEntries.length).toBe(result.dispatch.readyRequests.length);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('should log mixed known/unknown items', async () => {
    const input = 'Eier und mysteryfood';
    const result = await logResolvedNutritionInput(input);

    expect(result.dispatch.readyRequests.length).toBe(1);
    expect(result.resolvedResults.length).toBe(1);
    expect(result.persistedEntries.length).toBe(1);
    expect(result.dispatch.unresolvedRequests.length).toBe(1);
  });

  it('should handle fully unresolved input', async () => {
    const input = 'mysteryfood';
    const result = await logResolvedNutritionInput(input);

    expect(result.dispatch.readyRequests.length).toBe(0);
    expect(result.resolvedResults.length).toBe(0);
    expect(result.persistedEntries.length).toBe(0);
    expect(result.dispatch.unresolvedRequests.length).toBe(1);
  });
});
