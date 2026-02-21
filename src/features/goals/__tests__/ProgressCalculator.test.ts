import { calculateDailyProgress } from '../application/calculators/ProgressCalculator';
import { DailyGoals } from '../domain/models/GoalsTypes';

describe('ProgressCalculator', () => {
  describe('calculateDailyProgress', () => {
    it('should calculate remaining when under goals', () => {
      const consumed: DailyGoals = {
        calories: 1500,
        protein: 100,
        carbs: 150,
        fat: 50,
      };

      const goals: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const progress = calculateDailyProgress(consumed, goals);

      expect(progress.consumedCalories).toBe(1500);
      expect(progress.remainingCalories).toBe(1000);
      expect(progress.proteinConsumed).toBe(100);
      expect(progress.proteinRemaining).toBe(50);
      expect(progress.carbsConsumed).toBe(150);
      expect(progress.carbsRemaining).toBe(100);
      expect(progress.fatConsumed).toBe(50);
      expect(progress.fatRemaining).toBe(30);

      expect(progress.isOverCalories).toBe(false);
      expect(progress.isOverProtein).toBe(false);
      expect(progress.isOverCarbs).toBe(false);
      expect(progress.isOverFat).toBe(false);
    });

    it('should set isOver flags when exceeding goals', () => {
      const consumed: DailyGoals = {
        calories: 2600,
        protein: 160,
        carbs: 260,
        fat: 85,
      };

      const goals: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const progress = calculateDailyProgress(consumed, goals);

      expect(progress.isOverCalories).toBe(true);
      expect(progress.isOverProtein).toBe(true);
      expect(progress.isOverCarbs).toBe(true);
      expect(progress.isOverFat).toBe(true);
    });

    it('should clamp remaining to 0 when over goals', () => {
      const consumed: DailyGoals = {
        calories: 2600,
        protein: 160,
        carbs: 260,
        fat: 85,
      };

      const goals: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const progress = calculateDailyProgress(consumed, goals);

      // Remaining should be clamped to 0
      expect(progress.remainingCalories).toBe(0);
      expect(progress.proteinRemaining).toBe(0);
      expect(progress.carbsRemaining).toBe(0);
      expect(progress.fatRemaining).toBe(0);

      // But isOver flags must be true
      expect(progress.isOverCalories).toBe(true);
      expect(progress.isOverProtein).toBe(true);
      expect(progress.isOverCarbs).toBe(true);
      expect(progress.isOverFat).toBe(true);
    });

    it('should handle mixed scenarios (some over, some under)', () => {
      const consumed: DailyGoals = {
        calories: 2600,
        protein: 140,
        carbs: 260,
        fat: 70,
      };

      const goals: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const progress = calculateDailyProgress(consumed, goals);

      expect(progress.isOverCalories).toBe(true);
      expect(progress.remainingCalories).toBe(0);

      expect(progress.isOverProtein).toBe(false);
      expect(progress.proteinRemaining).toBe(10);

      expect(progress.isOverCarbs).toBe(true);
      expect(progress.carbsRemaining).toBe(0);

      expect(progress.isOverFat).toBe(false);
      expect(progress.fatRemaining).toBe(10);
    });

    it('should handle exact match (consumed = goals)', () => {
      const consumed: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const goals: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const progress = calculateDailyProgress(consumed, goals);

      expect(progress.remainingCalories).toBe(0);
      expect(progress.proteinRemaining).toBe(0);
      expect(progress.carbsRemaining).toBe(0);
      expect(progress.fatRemaining).toBe(0);

      // Exact match is NOT over
      expect(progress.isOverCalories).toBe(false);
      expect(progress.isOverProtein).toBe(false);
      expect(progress.isOverCarbs).toBe(false);
      expect(progress.isOverFat).toBe(false);
    });

    it('should handle zero consumption', () => {
      const consumed: DailyGoals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };

      const goals: DailyGoals = {
        calories: 2500,
        protein: 150,
        carbs: 250,
        fat: 80,
      };

      const progress = calculateDailyProgress(consumed, goals);

      expect(progress.remainingCalories).toBe(2500);
      expect(progress.proteinRemaining).toBe(150);
      expect(progress.carbsRemaining).toBe(250);
      expect(progress.fatRemaining).toBe(80);

      expect(progress.isOverCalories).toBe(false);
      expect(progress.isOverProtein).toBe(false);
      expect(progress.isOverCarbs).toBe(false);
      expect(progress.isOverFat).toBe(false);
    });
  });
});
