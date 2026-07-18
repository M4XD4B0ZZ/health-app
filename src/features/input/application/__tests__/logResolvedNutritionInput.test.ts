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

  // RESOLVER-V2-010: architecture-level behavior (detection, item shape, multi-food
  // coexistence, partial success) using this file's existing mocked-container harness
  // (test-setup.ts's MockResolverBuilder happy path — it has no real BLS "Speck" data, so it
  // cannot prove specific preview kcal values or that qualified terms resolve deterministically;
  // those are proven end-to-end against the real BLS artifact in
  // ResolverV2010SpeckClarification.test.ts instead). What *is* provable here — and is exactly
  // what this file's existing container wiring is for — is that the detection/throw/collect
  // architecture behaves correctly regardless of which resolver backs it.
  describe('RESOLVER-V2-010: generic "Speck" clarification (architecture)', () => {
    it('scenario A: "100 g Speck" does not silently persist — clarification item is produced instead', async () => {
      const result = await logResolvedNutritionInput('100 g Speck');

      expect(result.persistedEntries).toHaveLength(0);
      expect(result.blockedEntries).toBe(1);
      expect(result.speckClarificationItems).toHaveLength(1);

      const item = result.speckClarificationItems[0];
      expect(item.rawInput).toBe('100 g Speck');
      expect(item.hasExplicitQuantity).toBe(true);
      expect(item.quantityGrams).toBe(100);
      expect(item.heading).toBe('Welche Art von Speck meinst du?');
      expect(item.choices.map((c) => c.id)).toEqual([
        'bacon_bauchspeck',
        'fettspeck_rueckenspeck',
        'schinkenspeck',
      ]);
    });

    it('scenario B: bare "Speck" (no quantity) produces a clarification item with no fabricated portion', async () => {
      const result = await logResolvedNutritionInput('Speck');

      expect(result.persistedEntries).toHaveLength(0);
      expect(result.speckClarificationItems).toHaveLength(1);
      const item = result.speckClarificationItems[0];
      expect(item.hasExplicitQuantity).toBe(false);
      expect(item.quantityGrams).toBe(0);
    });

    it('scenario G: "2 Eier und 100 g Speck" — eggs persist once, only Speck needs clarification', async () => {
      const result = await logResolvedNutritionInput('2 Eier und 100 g Speck');

      expect(result.persistedEntries).toHaveLength(1);
      expect(result.persistedEntries[0].parsedName).toBe('eier');
      expect(result.speckClarificationItems).toHaveLength(1);
      expect(result.speckClarificationItems[0].rawInput).toBe('100 g Speck');
    });

    it('scenario H: "1 Banane und Speck" — banana persists, Speck needs clarification', async () => {
      const result = await logResolvedNutritionInput('1 Banane und Speck');

      expect(result.persistedEntries).toHaveLength(1);
      expect(result.persistedEntries[0].parsedName).toBe('banane');
      expect(result.speckClarificationItems).toHaveLength(1);
    });
  });
});
