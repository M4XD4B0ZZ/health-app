import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';
import { computeTotals } from '../domain/portion/computeTotals';

function resolvedGrams(result: Awaited<ReturnType<typeof resolvePortionGrams>>): number {
  expect(result.status).toBe('resolved');
  if (result.status !== 'resolved') {
    throw new Error(`Expected resolved portion, got ${result.reasonCode}`);
  }
  return result.grams;
}

describe('Unit Portion Fix - Integration Test', () => {
  const eggMacrosPer100g = { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 };

  it('applies configured unit portions proportionally', async () => {
    const singleEggGrams = resolvedGrams(await resolvePortionGrams('egg', 0, 1));
    const doubleEggGrams = resolvedGrams(await resolvePortionGrams('eier', 0, 2));
    const tripleEggGrams = resolvedGrams(await resolvePortionGrams('eggs', 0, 3));

    expect(singleEggGrams).toBe(60);
    expect(doubleEggGrams).toBe(120);
    expect(tripleEggGrams).toBe(180);

    const singleEggResult = computeTotals(eggMacrosPer100g, singleEggGrams, 1);
    const doubleEggResult = computeTotals(eggMacrosPer100g, doubleEggGrams, 1);

    expect(singleEggResult.totals.calories).toBeCloseTo(85.8, 1);
    expect(doubleEggResult.totals.calories).toBeCloseTo(singleEggResult.totals.calories * 2, 1);
    expect(doubleEggResult.totals.protein).toBeCloseTo(singleEggResult.totals.protein * 2, 1);
    expect(doubleEggResult.totals.carbs).toBeCloseTo(singleEggResult.totals.carbs * 2, 1);
    expect(doubleEggResult.totals.fat).toBeCloseTo(singleEggResult.totals.fat * 2, 1);
  });

  it('does not override explicit grams with unit defaults', async () => {
    const explicitEiGrams = resolvedGrams(await resolvePortionGrams('ei', 200, undefined));
    const explicitEggGrams = resolvedGrams(await resolvePortionGrams('egg', 150, 1));

    expect(explicitEiGrams).toBe(200);
    expect(explicitEggGrams).toBe(150);
    expect(computeTotals(eggMacrosPer100g, explicitEiGrams, 1).totals.calories).toBeCloseTo(
      286,
      1,
    );
  });

  it('uses seed hints for other canonical foods and blocks unknown counts', async () => {
    expect(resolvedGrams(await resolvePortionGrams('apple', 0, undefined))).toBe(180);
    expect(resolvedGrams(await resolvePortionGrams('bananas', 0, 2))).toBe(240);

    await expect(resolvePortionGrams('pizza', 0, 2)).resolves.toMatchObject({
      status: 'needs_edit',
      reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
      needsEdit: { type: 'portion_needs_edit', rawFoodName: 'pizza', quantity: 2 },
    });
  });
});