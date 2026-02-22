import { computeTotals } from '../domain/portion/computeTotals';

describe('computeTotals', () => {
  it('computes totals deterministically from per100g, grams and multiplier', () => {
    const result = computeTotals({ calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 }, 200, 1.5);

    expect(result.gramsUsed).toBe(300);
    expect(result.totals.calories).toBe(267);
    expect(result.totals.protein).toBe(3.3);
    expect(result.totals.carbs).toBe(68.4);
    expect(result.totals.fat).toBe(0.9);
  });
});
