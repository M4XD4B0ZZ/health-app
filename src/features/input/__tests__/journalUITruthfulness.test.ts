import { logResolvedNutritionInput } from '../application/logResolvedNutritionInput';
import { prepareNutritionResolverDispatch } from '../application/prepareNutritionResolverDispatch';
import { aggregateCanonicalItems } from '../application/aggregateCanonicalItems';

describe('Journal UI Truthfulness', () => {
  it('keeps a truthful one-item mapping for "Ei"', async () => {
    const result = await logResolvedNutritionInput('Ei');

    expect(result.dispatch.readyRequests).toHaveLength(1);
    expect(result.persistedEntries).toHaveLength(1);
    expect(result.dispatch.readyRequests[0].rawName).toBe('ei');
    expect(result.persistedEntries[0].rawInput).toBe('ei');
    expect(result.persistedEntries[0].calories).toBeGreaterThan(0);
  });

  it('applies quantity scaling on the per-item egg flow', async () => {
    const singleEgg = await logResolvedNutritionInput('Ei');
    const twoEggs = await logResolvedNutritionInput('zwei eier');

    expect(twoEggs.dispatch.readyRequests).toHaveLength(1);
    expect(twoEggs.persistedEntries).toHaveLength(1);
    expect(twoEggs.persistedEntries[0].rawInput).toBe('eier');
    expect(twoEggs.persistedEntries[0].grams).toBeGreaterThanOrEqual(
      singleEgg.persistedEntries[0].grams ?? 0,
    );
    expect(twoEggs.persistedEntries[0].calories).toBeGreaterThanOrEqual(
      singleEgg.persistedEntries[0].calories,
    );
  });

  it('keeps recognized and unresolved items aligned without aggregation break', async () => {
    const result = await logResolvedNutritionInput('Eier und mysteryfood');

    expect(result.dispatch.readyRequests).toHaveLength(1);
    expect(result.dispatch.unresolvedRequests).toHaveLength(1);
    expect(result.persistedEntries).toHaveLength(1);
    expect(result.dispatch.readyRequests[0].rawName).toBe('eier');
    expect(result.persistedEntries[0].rawInput).toBe('eier');
    expect(result.persistedEntries[0].calories).toBeGreaterThan(0);
    expect(result.dispatch.unresolvedRequests[0].rawName).toBe('mysteryfood');
  });

  it('does not aggregate the runtime persistence path when 1:1 mapping is required', async () => {
    const dispatch = prepareNutritionResolverDispatch('2 Eier und Egg');
    const aggregated = aggregateCanonicalItems(dispatch.readyRequests);
    const result = await logResolvedNutritionInput(dispatch);

    expect(dispatch.readyRequests).toHaveLength(2);
    expect(aggregated).toHaveLength(1);
    expect(result.persistedEntries).toHaveLength(dispatch.readyRequests.length);
    expect(result.persistedEntries.map((entry) => entry.rawInput)).toEqual(['eier', 'egg']);
  });
});
