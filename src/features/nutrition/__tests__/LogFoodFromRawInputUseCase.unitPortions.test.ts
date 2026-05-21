import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';
import { computeTotals } from '../domain/portion/computeTotals';

describe('Unit Portion Fix - Integration Test', () => {
  describe('resolvePortionGrams + computeTotals integration', () => {
    const eggMacrosPer100g = { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 };

    it('should calculate "egg" as 60g → ~85 kcal', () => {
      const targetGrams = resolvePortionGrams('egg', 0, undefined);
      const result = computeTotals(eggMacrosPer100g, targetGrams, 1);

      expect(targetGrams).toBe(60); // 1 egg = 60g
      expect(result.totals.calories).toBeCloseTo(85.8, 1); // 143 * 0.6 = 85.8
      expect(result.totals.protein).toBeCloseTo(7.56, 1); // 12.6 * 0.6
      expect(result.totals.carbs).toBeCloseTo(0.42, 1); // 0.7 * 0.6
      expect(result.totals.fat).toBeCloseTo(5.7, 1); // 9.5 * 0.6
    });

    it('should calculate "2 eier" as 120g → ~171 kcal', () => {
      const targetGrams = resolvePortionGrams('eier', 0, 2);
      const result = computeTotals(eggMacrosPer100g, targetGrams, 1);

      expect(targetGrams).toBe(120); // 2 eggs = 120g
      expect(result.totals.calories).toBeCloseTo(171.6, 1); // 143 * 1.2 = 171.6
      expect(result.totals.protein).toBeCloseTo(15.12, 1); // 12.6 * 1.2
      expect(result.totals.carbs).toBeCloseTo(0.84, 1); // 0.7 * 1.2
      expect(result.totals.fat).toBeCloseTo(11.4, 1); // 9.5 * 1.2
    });

    it('should calculate "3 eggs" as 180g → ~257 kcal', () => {
      const targetGrams = resolvePortionGrams('eggs', 0, 3);
      const result = computeTotals(eggMacrosPer100g, targetGrams, 1);

      expect(targetGrams).toBe(180); // 3 eggs = 180g
      expect(result.totals.calories).toBeCloseTo(257.4, 1); // 143 * 1.8 = 257.4
      expect(result.totals.protein).toBeCloseTo(22.68, 1); // 12.6 * 1.8
      expect(result.totals.carbs).toBeCloseTo(1.26, 1); // 0.7 * 1.8
      expect(result.totals.fat).toBeCloseTo(17.1, 1); // 9.5 * 1.8
    });

    it('should NOT override explicit grams: "200g ei" → 200g', () => {
      const targetGrams = resolvePortionGrams('ei', 200, undefined);
      const result = computeTotals(eggMacrosPer100g, targetGrams, 1);

      expect(targetGrams).toBe(200); // explicit grams preserved
      expect(result.totals.calories).toBeCloseTo(286, 1); // 143 * 2.0 = 286
    });

    it('should prioritize explicit grams over unit default for eggs: "150g egg" → 150g totals', () => {
      const targetGrams = resolvePortionGrams('egg', 150, 1);
      const result = computeTotals(eggMacrosPer100g, targetGrams, 1);

      expect(targetGrams).toBe(150); // explicit grams must override 60g canonical egg portion
      expect(result.totals.calories).toBeCloseTo(214.5, 1); // 143 * 1.5
      expect(result.totals.protein).toBeCloseTo(18.9, 1); // 12.6 * 1.5
      expect(result.totals.carbs).toBeCloseTo(1.05, 1); // 0.7 * 1.5
      expect(result.totals.fat).toBeCloseTo(14.25, 1); // 9.5 * 1.5
    });

    it('should handle "ei" (singular) as 60g → ~85 kcal', () => {
      const targetGrams = resolvePortionGrams('ei', 0, undefined);
      const result = computeTotals(eggMacrosPer100g, targetGrams, 1);

      expect(targetGrams).toBe(60); // 1 egg = 60g
      expect(result.totals.calories).toBeCloseTo(85.8, 1); // 143 * 0.6 = 85.8
    });
  });

  describe('comparison: before vs after fix', () => {
    const eggMacrosPer100g = { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 };

    it('demonstrates the fix: "egg" now gives 85 kcal instead of 143 kcal', () => {
      // New logic with resolvePortionGrams
      const newTargetGrams = resolvePortionGrams('egg', 0, undefined);
      const newResult = computeTotals(eggMacrosPer100g, newTargetGrams, 1);

      // Old logic (100g fallback)
      const oldTargetGrams = 100;
      const oldResult = computeTotals(eggMacrosPer100g, oldTargetGrams, 1);

      expect(newResult.totals.calories).toBeCloseTo(85.8, 1); // New: 60g portion
      expect(oldResult.totals.calories).toBeCloseTo(143, 1); // Old: 100g fallback
      expect(newResult.totals.calories).not.toBeCloseTo(oldResult.totals.calories, 1);
    });

    it('demonstrates proportional scaling: "2 eier" gives 2x the calories', () => {
      const singleEggGrams = resolvePortionGrams('egg', 0, undefined);
      const singleEggResult = computeTotals(eggMacrosPer100g, singleEggGrams, 1);

      const doubleEggGrams = resolvePortionGrams('eier', 0, 2);
      const doubleEggResult = computeTotals(eggMacrosPer100g, doubleEggGrams, 1);

      expect(doubleEggResult.totals.calories).toBeCloseTo(singleEggResult.totals.calories * 2, 1);
      expect(doubleEggResult.totals.protein).toBeCloseTo(singleEggResult.totals.protein * 2, 1);
      expect(doubleEggResult.totals.carbs).toBeCloseTo(singleEggResult.totals.carbs * 2, 1);
      expect(doubleEggResult.totals.fat).toBeCloseTo(singleEggResult.totals.fat * 2, 1);
    });
  });

  describe('other canonical foods', () => {
    it('should work for apple (150g default)', () => {
      const targetGrams = resolvePortionGrams('apple', 0, undefined);
      expect(targetGrams).toBe(150);
    });

    it('should work for "2 bananas" (240g total)', () => {
      const targetGrams = resolvePortionGrams('bananas', 0, 2);
      expect(targetGrams).toBe(240); // 2 * 120g
    });

    it('should fallback to 100g for unknown foods', () => {
      const targetGrams = resolvePortionGrams('pizza', 0, 2);
      expect(targetGrams).toBe(100); // fallback
    });
  });
});
