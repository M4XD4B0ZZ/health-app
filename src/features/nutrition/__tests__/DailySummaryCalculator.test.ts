import {
  buildDailySummary,
  computeProgress,
  sumEntriesToDailyTotals,
} from '../domain/summary/DailySummaryCalculator';
import { FoodEntry } from '../domain/models/NutritionTypes';

function entry(input: Partial<FoodEntry> & { id: string; createdAt: Date }): FoodEntry {
  return {
    id: input.id,
    rawInput: input.rawInput ?? 'x',
    parsedName: input.parsedName ?? 'x',
    quantityGrams: input.quantityGrams ?? 100,
    calories: input.calories ?? 0,
    protein: input.protein ?? 0,
    carbs: input.carbs ?? 0,
    fat: input.fat ?? 0,
    confidenceScore: input.confidenceScore ?? 0.5,
    sourceType: input.sourceType ?? 'generic',
    createdAt: input.createdAt,
    grams: input.grams,
    servingMultiplier: input.servingMultiplier,
    explanation: input.explanation,
    confidenceReason: input.confidenceReason,
    lastModifiedAt: input.lastModifiedAt,
  };
}

describe('DailySummaryCalculator', () => {
  it('sums totals deterministically', () => {
    const totals = sumEntriesToDailyTotals([
      entry({
        id: 'a',
        createdAt: new Date(),
        calories: 100.2,
        protein: 10.04,
        carbs: 20.02,
        fat: 5.07,
      }),
      entry({
        id: 'b',
        createdAt: new Date(),
        calories: 200.2,
        protein: 5.06,
        carbs: 10.09,
        fat: 1.03,
      }),
    ]);

    expect(totals.caloriesKcal).toBe(300);
    expect(totals.proteinG).toBe(15.1);
    expect(totals.carbsG).toBe(30.1);
    expect(totals.fatG).toBe(6.1);
  });

  it('applies progress thresholds under/ontrack/over', () => {
    expect(computeProgress(90, 100).status).toBe('under');
    expect(computeProgress(95, 100).status).toBe('ontrack');
    expect(computeProgress(105, 100).status).toBe('ontrack');
    expect(computeProgress(106, 100).status).toBe('over');
  });

  it('builds summary with no goals and note', () => {
    const summary = buildDailySummary('2026-02-15', [], null);
    expect(summary.notesDe).toEqual(['Kein Ziel gesetzt.']);
    expect(summary.progress.calories.target).toBe(0);
  });
});
