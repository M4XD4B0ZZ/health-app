import { CalorieMacroCorridorRule } from '../application/rules/CalorieMacroCorridorRule';
import { EvidenceBasedStandardProfile } from '../application/profiles/EvidenceBasedStandardProfile';
import { EvaluationInput } from '../domain/models';
import { ComputeProgressForDateUseCase } from '../../journal/application/usecases/ComputeProgressForDateUseCase';
import { SetEffectiveGoalsUseCase } from '../../goals/application/usecases/SetEffectiveGoalsUseCase';
import { InMemoryEffectiveGoalsRepository } from '../../goals/infrastructure/InMemoryEffectiveGoalsRepository';
import { NutritionReadRepository } from '../../journal/application/ports/NutritionReadRepository';
import { FoodEntry } from '../../nutrition/domain/models/NutritionTypes';
import { DailyGoals } from '../../goals/domain/models/GoalsTypes';

class FixtureNutritionReadRepository implements NutritionReadRepository {
  constructor(private readonly entries: FoodEntry[]) {}

  async listFoodEntriesForDate(): Promise<
    { calories: number; protein: number; carbs: number; fat: number }[]
  > {
    return this.entries;
  }
}

/**
 * GE-002: proves EvidenceBasedStandardProfile's CalorieMacroCorridorRule produces the same
 * consumed/target/status numbers as the existing (pre-Evaluation-Engine)
 * ComputeProgressForDateUseCase, for identical fixture inputs — the adapter is behaviorally
 * equivalent, not just structurally plausible.
 */
describe('EvidenceBasedStandardProfile (GE-002)', () => {
  const goals: DailyGoals = { calories: 2200, protein: 140, carbs: 220, fat: 70 };

  const journalEntries: FoodEntry[] = [
    {
      id: 'e1',
      rawInput: '200g chicken',
      parsedName: 'chicken',
      quantityGrams: 200,
      calories: 1200,
      protein: 90,
      carbs: 100,
      fat: 40,
      confidenceScore: 0.9,
      sourceType: 'branded',
      createdAt: new Date('2026-04-01T08:00:00Z'),
    },
    {
      id: 'e2',
      rawInput: '150g rice',
      parsedName: 'rice',
      quantityGrams: 150,
      calories: 200,
      protein: 5,
      carbs: 45,
      fat: 1,
      confidenceScore: 0.6,
      sourceType: 'generic',
      createdAt: new Date('2026-04-01T12:00:00Z'),
    },
  ];

  it('profile references the rule', () => {
    expect(EvidenceBasedStandardProfile.ruleIds).toEqual([CalorieMacroCorridorRule.id]);
    expect(EvidenceBasedStandardProfile.origin).toBe('preset');
  });

  it('produces the same consumed/target/remaining numbers as ComputeProgressForDateUseCase', async () => {
    // Existing (pre-Evaluation-Engine) path.
    const effectiveGoalsRepository = new InMemoryEffectiveGoalsRepository();
    await new SetEffectiveGoalsUseCase(effectiveGoalsRepository).execute({
      mode: 'manual',
      goals,
    });
    const legacyUseCase = new ComputeProgressForDateUseCase(
      new FixtureNutritionReadRepository(journalEntries),
      effectiveGoalsRepository,
    );
    const legacySnapshot = await legacyUseCase.execute('2026-04-01');

    // New Evaluation Engine path, same fixture data.
    const input: EvaluationInput = {
      foodCatalogReads: [],
      journalReadsForPeriod: journalEntries,
      profileSettings: { goals },
    };
    const output = CalorieMacroCorridorRule.evaluate(input);

    const caloriesProgress = output.goalProgress.find((g) => g.label === 'calories')!;
    const proteinProgress = output.goalProgress.find((g) => g.label === 'protein')!;
    const carbsProgress = output.goalProgress.find((g) => g.label === 'carbs')!;
    const fatProgress = output.goalProgress.find((g) => g.label === 'fat')!;

    expect(caloriesProgress.consumed).toBe(legacySnapshot.consumed.calories);
    expect(caloriesProgress.target).toBe(legacySnapshot.goals.calories);
    expect(caloriesProgress.remaining).toBe(legacySnapshot.progress.remainingCalories);

    expect(proteinProgress.consumed).toBe(legacySnapshot.consumed.protein);
    expect(proteinProgress.remaining).toBe(legacySnapshot.progress.proteinRemaining);

    expect(carbsProgress.consumed).toBe(legacySnapshot.consumed.carbs);
    expect(carbsProgress.remaining).toBe(legacySnapshot.progress.carbsRemaining);

    expect(fatProgress.consumed).toBe(legacySnapshot.consumed.fat);
    expect(fatProgress.remaining).toBe(legacySnapshot.progress.fatRemaining);

    // 1400 consumed vs 2200 target calories -> under, no warnings.
    expect(output.assessment).toBe('on-track');
    expect(output.warnings).toEqual([]);
  });

  it('flags an over-calories day with a warning, matching isOverCalories semantics', () => {
    const overCalorieEntries: FoodEntry[] = [
      { ...journalEntries[0], calories: 2500 },
      journalEntries[1],
    ];

    const output = CalorieMacroCorridorRule.evaluate({
      foodCatalogReads: [],
      journalReadsForPeriod: overCalorieEntries,
      profileSettings: { goals },
    });

    expect(output.assessment).toBe('over');
    expect(output.warnings).toContain('Kalorienziel überschritten.');
  });
});
