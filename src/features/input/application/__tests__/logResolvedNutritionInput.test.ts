import { logResolvedNutritionInput } from '../logResolvedNutritionInput';

describe('logResolvedNutritionInput', () => {
  it('preserves explicit gram quantities through persistence', async () => {
    const result = await logResolvedNutritionInput('200g quark');

    expect(result.dispatch.readyRequests).toHaveLength(1);
    expect(result.dispatch.readyRequests[0]).toEqual(
      expect.objectContaining({
        rawName: 'quark',
        rawText: '200g quark',
        quantity: 200,
        unit: 'g',
      }),
    );
    expect(result.persistedEntries).toHaveLength(1);
    expect(result.persistedEntries[0].rawInput).toBe('200g quark');
    expect(result.persistedEntries[0].grams).toBe(200);
    expect(result.persistedEntries[0].calcBreakdown?.gramsUsed).toBe(200);
    expect(result.persistedEntries[0].calories).toBeGreaterThan(100);
  });

  it('keeps no-explicit-grams quark on the current fallback portion behavior', async () => {
    const result = await logResolvedNutritionInput('quark');

    expect(result.persistedEntries).toHaveLength(1);
    expect(result.persistedEntries[0].rawInput).toBe('quark');
    expect(result.persistedEntries[0].grams).toBe(100);
    expect(result.persistedEntries[0].calcBreakdown?.gramsUsed).toBe(100);
    expect(result.persistedEntries[0].calories).toBeGreaterThan(0);
  });

  it('preserves explicit grams for one connector item while keeping default behavior for another', async () => {
    const result = await logResolvedNutritionInput('200g quark und ei');

    expect(result.dispatch.readyRequests).toHaveLength(2);
    expect(result.dispatch.unresolvedRequests).toHaveLength(0);
    expect(result.persistedEntries).toHaveLength(2);

    const quarkEntry = result.persistedEntries.find((entry) => entry.parsedName === 'quark');
    const eggEntry = result.persistedEntries.find((entry) => entry.parsedName === 'ei');

    expect(quarkEntry).toBeDefined();
    expect(quarkEntry?.rawInput).toBe('200g quark');
    expect(quarkEntry?.grams).toBe(200);
    expect(quarkEntry?.calories).toBeGreaterThan(100);

    expect(eggEntry).toBeDefined();
    expect(eggEntry?.rawInput).toBe('ei');
    expect(eggEntry?.grams).toBeGreaterThan(0);
    expect(eggEntry?.grams).not.toBe(200);
  });

  it('satisfies P1-003 DoD: "ei und quark" produces two separate resolved entries', async () => {
    const result = await logResolvedNutritionInput('ei und quark');

    expect(result.dispatch.readyRequests).toHaveLength(2);
    expect(result.dispatch.unresolvedRequests).toHaveLength(0);
    expect(result.resolvedResults).toHaveLength(2);
    expect(result.persistedEntries).toHaveLength(2);
    expect(result.persistedEntries.map((entry) => entry.rawInput)).toEqual(['ei', 'quark']);
    expect(result.persistedEntries.every((entry) => entry.calories > 0)).toBe(true);
  });

  it('should log matched multi-item input', async () => {
    const input = '2 Eier und Toast';
    const result = await logResolvedNutritionInput(input);

    expect(result.dispatch.readyRequests.length).toBeGreaterThan(0);
    expect(result.resolvedResults.length).toBe(result.dispatch.readyRequests.length);
    expect(result.persistedEntries.length).toBe(result.dispatch.readyRequests.length);
    expect(result.blockedEntries).toBe(0);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('should log mixed known/unknown items', async () => {
    const input = 'Eier und mysteryfood';
    const result = await logResolvedNutritionInput(input);

    expect(result.dispatch.readyRequests.length).toBe(2);
    expect(result.resolvedResults.length).toBe(1);
    expect(result.persistedEntries.length).toBe(1);
    expect(result.blockedEntries).toBe(1);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('should route fully unknown input to resolver and block persistence if unresolved by nutrition sources', async () => {
    const input = 'mysteryfood';
    const result = await logResolvedNutritionInput(input);

    expect(result.dispatch.readyRequests.length).toBe(1);
    expect(result.resolvedResults.length).toBe(0);
    expect(result.persistedEntries.length).toBe(0);
    expect(result.blockedEntries).toBe(1);
    expect(result.dispatch.unresolvedRequests.length).toBe(0);
  });

  it('satisfies P1-003C DoD: composite-dish label is grouped, not resolved standalone', async () => {
    const result = await logResolvedNutritionInput('Auflauf mit Quark, Ei');

    // Only the two children are dispatched to the resolver - "Auflauf" itself never
    // becomes a resolver request or a standalone persisted entry.
    expect(result.dispatch.readyRequests).toHaveLength(2);
    expect(result.dispatch.readyRequests.every((req) => req.rawName !== 'auflauf')).toBe(true);
    expect(result.persistedEntries).toHaveLength(2);
    expect(result.persistedEntries.every((entry) => entry.rawInput !== 'Auflauf')).toBe(true);

    expect(result.persistedEntries.every((entry) => entry.groupId)).toBe(true);
    expect(result.persistedEntries.every((entry) => entry.groupLabel === 'Auflauf')).toBe(true);
    const groupIds = new Set(result.persistedEntries.map((entry) => entry.groupId));
    expect(groupIds.size).toBe(1);
  });

  it('exposes structured needs-edit items while preserving blockedEntries count', async () => {
    const result = await logResolvedNutritionInput('zwei scheiben schinken');

    expect(result.resolvedResults).toHaveLength(0);
    expect(result.persistedEntries).toHaveLength(0);
    expect(result.blockedEntries).toBe(1);
    expect(result.needsEditItems).toEqual([
      expect.objectContaining({
        type: 'portion_needs_edit',
        rawInput: 'zwei scheiben schinken',
        rawFoodName: 'schinken',
        foodIdentityKey: 'canonical:ham',
        unit: 'slice',
        quantity: 2,
      }),
    ]);
  });
});
