import {
  ProteinPreservingDeficitRule,
  WEIGHT_LOSS_DEFICIT_MULTIPLIER,
} from '../application/rules/ProteinPreservingDeficitRule';
import { suggestDailyGoals } from '../../goals/application/calculators/GoalsSuggestionCalculator';
import { EvaluationInput } from '../domain/models';
import { FoodEntry } from '../../nutrition/domain/models/NutritionTypes';

describe('ProteinPreservingDeficitRule (GE-004)', () => {
  const entry = (calories: number, protein: number, carbs: number, fat: number): FoodEntry => ({
    id: 'e1',
    rawInput: 'fixture',
    parsedName: 'fixture',
    quantityGrams: 100,
    calories,
    protein,
    carbs,
    fat,
    confidenceScore: 0.9,
    sourceType: 'generic',
    createdAt: new Date('2026-05-01T08:00:00Z'),
  });

  it('derives goals from a 20% TDEE deficit with a high-protein split, matching suggestDailyGoals directly', () => {
    const tdee = 2000;
    const expectedGoals = suggestDailyGoals(tdee * WEIGHT_LOSS_DEFICIT_MULTIPLIER, 'high_protein');

    const input: EvaluationInput = {
      foodCatalogReads: [],
      journalReadsForPeriod: [entry(1000, 60, 100, 30)],
      profileSettings: { tdee },
    };

    const output = ProteinPreservingDeficitRule.evaluate(input);

    expect(output.goalProgress.find((g) => g.label === 'calories')?.target).toBe(
      expectedGoals.calories,
    );
    expect(output.goalProgress.find((g) => g.label === 'protein')?.target).toBe(
      expectedGoals.protein,
    );
  });

  it('flags an over-deficit day with the deficit-specific warning', () => {
    const input: EvaluationInput = {
      foodCatalogReads: [],
      // Well above any reasonable deficit target for a 1800 kcal TDEE.
      journalReadsForPeriod: [entry(2500, 150, 200, 80)],
      profileSettings: { tdee: 1800 },
    };

    const output = ProteinPreservingDeficitRule.evaluate(input);

    expect(output.assessment).toBe('over');
    expect(output.warnings).toContain('Kaloriendefizit-Ziel überschritten.');
  });
});
