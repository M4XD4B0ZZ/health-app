import { GetDailySummaryUseCase } from '../application/usecases/GetDailySummaryUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { FoodEntry } from '../domain/models/NutritionTypes';
import { GoalsRepository } from '../application/ports/GoalsRepository';
import { UserGoals } from '../domain/goals/UserGoals';

class InMemoryGoalsRepository implements GoalsRepository {
  private goals: UserGoals | null = null;

  async getGoals(): Promise<UserGoals | null> {
    return this.goals;
  }

  async setGoals(goals: UserGoals): Promise<void> {
    this.goals = goals;
  }
}

describe('GetDailySummaryUseCase', () => {
  let repository: InMemoryFoodEntryRepository;
  let goalsRepository: InMemoryGoalsRepository;
  let useCase: GetDailySummaryUseCase;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    goalsRepository = new InMemoryGoalsRepository();
    useCase = new GetDailySummaryUseCase(repository, goalsRepository);
  });

  it('returns summary with notes when no goals are set', async () => {
    const summary = await useCase.execute('2026-02-15');

    expect(summary.dateISO).toBe('2026-02-15');
    expect(summary.totals.caloriesKcal).toBe(0);
    expect(summary.notesDe).toEqual(['Kein Ziel gesetzt.']);
    expect(summary.progress.calories.target).toBe(0);
  });

  it('returns summary with goals and progress metrics', async () => {
    await goalsRepository.setGoals({
      caloriesTargetKcal: 2500,
      proteinTargetG: 150,
      carbsTargetG: 250,
      fatTargetG: 80,
      activityLevel: 'moderate',
      source: 'manual',
      updatedAt: new Date('2026-02-22T10:00:00Z').toISOString(),
    });

    const entries: FoodEntry[] = [
      {
        id: 'e1',
        rawInput: 'meal1',
        parsedName: 'meal1',
        quantityGrams: 100,
        calories: 500,
        protein: 40,
        carbs: 30,
        fat: 20,
        confidenceScore: 0.8,
        sourceType: 'generic',
        createdAt: new Date('2026-02-15T10:00:00Z'),
      },
      {
        id: 'e2',
        rawInput: 'meal2',
        parsedName: 'meal2',
        quantityGrams: 200,
        calories: 700,
        protein: 35,
        carbs: 90,
        fat: 25,
        confidenceScore: 0.8,
        sourceType: 'generic',
        createdAt: new Date('2026-02-15T12:00:00Z'),
      },
    ];
    await repository.addEntry(entries[0]);
    await repository.addEntry(entries[1]);

    const summary = await useCase.execute('2026-02-15');
    expect(summary.totals.caloriesKcal).toBe(1200);
    expect(summary.totals.proteinG).toBe(75);
    expect(summary.remaining.caloriesKcal).toBe(1300);
    expect(summary.progress.calories.status).toBe('under');
  });

  it('uses ISO date extraction correctly at day boundaries', async () => {
    const endOfDay: FoodEntry = {
      id: 'end',
      rawInput: 'late',
      parsedName: 'late',
      quantityGrams: 100,
      calories: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
      confidenceScore: 0.8,
      sourceType: 'generic',
      createdAt: new Date('2026-02-15T23:59:59.000Z'),
    };
    const startNextDay: FoodEntry = {
      id: 'start',
      rawInput: 'early',
      parsedName: 'early',
      quantityGrams: 100,
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 2,
      confidenceScore: 0.8,
      sourceType: 'generic',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
    };

    await repository.addEntry(endOfDay);
    await repository.addEntry(startNextDay);

    const summary15 = await useCase.execute('2026-02-15');
    const summary16 = await useCase.execute('2026-02-16');

    expect(summary15.totals.caloriesKcal).toBe(200);
    expect(summary16.totals.caloriesKcal).toBe(100);
  });

  it('excludes soft-deleted (tombstoned) entries from totals (J-003)', async () => {
    const kept: FoodEntry = {
      id: 'kept',
      rawInput: 'kept meal',
      parsedName: 'kept',
      quantityGrams: 100,
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
      confidenceScore: 0.8,
      sourceType: 'generic',
      createdAt: new Date('2026-02-15T10:00:00Z'),
    };
    const deleted: FoodEntry = {
      id: 'deleted',
      rawInput: 'deleted meal',
      parsedName: 'deleted',
      quantityGrams: 100,
      calories: 900,
      protein: 60,
      carbs: 90,
      fat: 30,
      confidenceScore: 0.8,
      sourceType: 'generic',
      createdAt: new Date('2026-02-15T11:00:00Z'),
    };
    await repository.addEntry(kept);
    await repository.addEntry(deleted);
    await repository.deleteEntry('deleted', new Date('2026-02-15T12:00:00Z'));

    const summary = await useCase.execute('2026-02-15');

    expect(summary.totals.caloriesKcal).toBe(300);
  });
});
