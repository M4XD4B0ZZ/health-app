import { suggestDailyGoals } from '../application/calculators/GoalsSuggestionCalculator';

describe('GoalsSuggestionCalculator', () => {
  describe('suggestDailyGoals - balanced strategy', () => {
    it('should calculate goals with balanced macro distribution (25/45/30)', () => {
      const tdee = 2500;
      const goals = suggestDailyGoals(tdee, 'balanced');

      expect(goals.calories).toBe(2500);

      // Protein: 25% of 2500 = 625 kcal / 4 = 156.25 => 156g
      expect(goals.protein).toBe(156);

      // Carbs: 45% of 2500 = 1125 kcal / 4 = 281.25 => 281g
      expect(goals.carbs).toBe(281);

      // Fat: 30% of 2500 = 750 kcal / 9 = 83.33 => 83g
      expect(goals.fat).toBe(83);
    });

    it('should round grams to whole numbers', () => {
      const tdee = 2759;
      const goals = suggestDailyGoals(tdee, 'balanced');

      expect(Number.isInteger(goals.protein)).toBe(true);
      expect(Number.isInteger(goals.carbs)).toBe(true);
      expect(Number.isInteger(goals.fat)).toBe(true);
    });
  });

  describe('suggestDailyGoals - high_protein strategy', () => {
    it('should calculate goals with high protein distribution (30/40/30)', () => {
      const tdee = 2500;
      const goals = suggestDailyGoals(tdee, 'high_protein');

      expect(goals.calories).toBe(2500);

      // Protein: 30% of 2500 = 750 kcal / 4 = 187.5 => 188g
      expect(goals.protein).toBe(188);

      // Carbs: 40% of 2500 = 1000 kcal / 4 = 250g
      expect(goals.carbs).toBe(250);

      // Fat: 30% of 2500 = 750 kcal / 9 = 83.33 => 83g
      expect(goals.fat).toBe(83);
    });

    it('should have higher protein than balanced strategy', () => {
      const tdee = 2500;
      const balanced = suggestDailyGoals(tdee, 'balanced');
      const highProtein = suggestDailyGoals(tdee, 'high_protein');

      expect(highProtein.protein).toBeGreaterThan(balanced.protein);
      expect(highProtein.carbs).toBeLessThan(balanced.carbs);
    });
  });

  describe('conversion factors', () => {
    it('should use 4 kcal/g for protein and carbs, 9 kcal/g for fat', () => {
      const tdee = 1800;
      const goals = suggestDailyGoals(tdee, 'balanced');

      // Verify conversion: protein 25% = 450 kcal / 4 = 112.5 => 113g
      expect(goals.protein).toBe(113);

      // Carbs: 45% = 810 kcal / 4 = 202.5 => 203g
      expect(goals.carbs).toBe(203);

      // Fat: 30% = 540 kcal / 9 = 60g
      expect(goals.fat).toBe(60);
    });
  });
});
