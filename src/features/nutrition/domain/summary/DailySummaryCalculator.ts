import { FoodEntry } from '../models/NutritionTypes';
import { DailyGoals } from '../../../goals/domain/models/GoalsTypes';
import { DailySummary, DailyTotals, ProgressMetric } from './DailySummaryTypes';

function roundKcal(value: number): number {
  return Math.round(value);
}

function roundGram(value: number): number {
  return Math.round(value * 10) / 10;
}

export function sumEntriesToDailyTotals(entries: FoodEntry[]): DailyTotals {
  return entries.reduce(
    (acc, entry) => ({
      caloriesKcal: roundKcal(acc.caloriesKcal + entry.calories),
      proteinG: roundGram(acc.proteinG + entry.protein),
      carbsG: roundGram(acc.carbsG + entry.carbs),
      fatG: roundGram(acc.fatG + entry.fat),
    }),
    {
      caloriesKcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    } satisfies DailyTotals,
  );
}

export function computeProgress(consumed: number, target: number): ProgressMetric {
  if (target <= 0) {
    return {
      consumed,
      target,
      remaining: 0,
      ratio: 0,
      status: 'under',
    };
  }

  const ratio = Math.max(0, consumed / target);
  const remaining = target - consumed;

  let status: ProgressMetric['status'] = 'under';
  if (consumed > target * 1.05) {
    status = 'over';
  } else if (consumed >= target * 0.95) {
    status = 'ontrack';
  }

  return {
    consumed,
    target,
    remaining,
    ratio,
    status,
  };
}

export function buildDailySummary(
  dateISO: string,
  entries: FoodEntry[],
  goals: DailyGoals | null,
): DailySummary {
  const totals = sumEntriesToDailyTotals(entries);

  if (!goals) {
    return {
      dateISO,
      date: dateISO,
      totalCalories: totals.caloriesKcal,
      totalProtein: totals.proteinG,
      totalCarbs: totals.carbsG,
      totalFat: totals.fatG,
      entries: [...entries],
      totals,
      remaining: {
        caloriesKcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      progress: {
        calories: computeProgress(totals.caloriesKcal, 0),
        protein: computeProgress(totals.proteinG, 0),
        carbs: computeProgress(totals.carbsG, 0),
        fat: computeProgress(totals.fatG, 0),
      },
      notesDe: ['Kein Ziel gesetzt.'],
    };
  }

  const caloriesProgress = computeProgress(totals.caloriesKcal, goals.calories);
  const proteinProgress = computeProgress(totals.proteinG, goals.protein);
  const carbsProgress = computeProgress(totals.carbsG, goals.carbs);
  const fatProgress = computeProgress(totals.fatG, goals.fat);

  return {
    dateISO,
    date: dateISO,
    totalCalories: totals.caloriesKcal,
    totalProtein: totals.proteinG,
    totalCarbs: totals.carbsG,
    totalFat: totals.fatG,
    entries: [...entries],
    totals,
    remaining: {
      caloriesKcal: roundKcal(caloriesProgress.remaining),
      proteinG: roundGram(proteinProgress.remaining),
      carbsG: roundGram(carbsProgress.remaining),
      fatG: roundGram(fatProgress.remaining),
    },
    progress: {
      calories: caloriesProgress,
      protein: proteinProgress,
      carbs: carbsProgress,
      fat: fatProgress,
    },
  };
}
