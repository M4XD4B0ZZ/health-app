import { DailyGoals } from '../../domain/models/GoalsTypes';
import { DailyProgress } from '../../domain/models/ProgressTypes';

/**
 * Calculate daily progress by comparing consumed vs goals
 *
 * Rules:
 * - remaining = goals - consumed (clamped to 0 minimum)
 * - isOverX = consumedX > goalsX
 */
export function calculateDailyProgress(consumed: DailyGoals, goals: DailyGoals): DailyProgress {
  // Calculate remaining (clamped to 0)
  const remainingCalories = Math.max(0, goals.calories - consumed.calories);
  const proteinRemaining = Math.max(0, goals.protein - consumed.protein);
  const carbsRemaining = Math.max(0, goals.carbs - consumed.carbs);
  const fatRemaining = Math.max(0, goals.fat - consumed.fat);

  // Calculate isOver flags
  const isOverCalories = consumed.calories > goals.calories;
  const isOverProtein = consumed.protein > goals.protein;
  const isOverCarbs = consumed.carbs > goals.carbs;
  const isOverFat = consumed.fat > goals.fat;

  return {
    consumedCalories: consumed.calories,
    remainingCalories,
    proteinConsumed: consumed.protein,
    proteinRemaining,
    carbsConsumed: consumed.carbs,
    carbsRemaining,
    fatConsumed: consumed.fat,
    fatRemaining,
    isOverCalories,
    isOverProtein,
    isOverCarbs,
    isOverFat,
  };
}
