import { FoodEntry } from '../models/NutritionTypes';

export interface DailyTotals {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyRemaining {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ProgressMetric {
  consumed: number;
  target: number;
  remaining: number;
  ratio: number;
  status: 'under' | 'ontrack' | 'over';
}

export interface DailySummary {
  dateISO: string;
  // Backward-compatible legacy fields
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entries: FoodEntry[];
  totals: DailyTotals;
  remaining: DailyRemaining;
  progress: {
    calories: ProgressMetric;
    protein: ProgressMetric;
    carbs: ProgressMetric;
    fat: ProgressMetric;
  };
  notesDe?: string[];
}
