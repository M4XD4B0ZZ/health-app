import {
  ComputeProgressForDateUseCase,
  GoalsNotFoundError,
} from '../application/usecases/ComputeProgressForDateUseCase';
import { NutritionReadRepository } from '../application/ports/NutritionReadRepository';
import { EffectiveGoalsRepository } from '../../goals/application/ports';
import { EffectiveGoals } from '../../goals/domain/models/GoalsTypes';

// Mock implementation of NutritionReadRepository
class MockNutritionReadRepository implements NutritionReadRepository {
  private entries: Map<
    string,
    {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[]
  > = new Map();

  setEntriesForDate(
    dateISO: string,
    entries: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[],
  ) {
    this.entries.set(dateISO, entries);
  }

  async listFoodEntriesForDate(dateISO: string): Promise<
    {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[]
  > {
    return this.entries.get(dateISO) || [];
  }
}

// Mock implementation of EffectiveGoalsRepository
class MockEffectiveGoalsRepository implements EffectiveGoalsRepository {
  private goals: EffectiveGoals | null = null;

  setGoals(goals: EffectiveGoals | null) {
    this.goals = goals;
  }

  async get(): Promise<EffectiveGoals | null> {
    return this.goals;
  }

  async upsert(goals: EffectiveGoals): Promise<void> {
    this.goals = goals;
  }
}

describe('ComputeProgressForDateUseCase', () => {
  let nutritionRepo: MockNutritionReadRepository;
  let goalsRepo: MockEffectiveGoalsRepository;
  let useCase: ComputeProgressForDateUseCase;

  beforeEach(() => {
    nutritionRepo = new MockNutritionReadRepository();
    goalsRepo = new MockEffectiveGoalsRepository();
    useCase = new ComputeProgressForDateUseCase(nutritionRepo, goalsRepo);
  });

  it('should compute progress with consumed entries and goals', async () => {
    // Setup nutrition entries
    nutritionRepo.setEntriesForDate('2026-02-15', [
      { calories: 500, protein: 30, carbs: 50, fat: 20 },
      { calories: 300, protein: 20, carbs: 30, fat: 10 },
    ]);

    // Setup goals
    goalsRepo.setGoals({
      mode: 'manual',
      goals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70,
      },
    });

    const result = await useCase.execute('2026-02-15');

    expect(result.dateISO).toBe('2026-02-15');
    expect(result.consumed).toEqual({
      calories: 800, // 500 + 300
      protein: 50, // 30 + 20
      carbs: 80, // 50 + 30
      fat: 30, // 20 + 10
    });
    expect(result.goals).toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 70,
    });
    expect(result.progress).toEqual({
      consumedCalories: 800,
      remainingCalories: 1200, // 2000 - 800
      proteinConsumed: 50,
      proteinRemaining: 100, // 150 - 50
      carbsConsumed: 80,
      carbsRemaining: 120, // 200 - 80
      fatConsumed: 30,
      fatRemaining: 40, // 70 - 30
      isOverCalories: false,
      isOverProtein: false,
      isOverCarbs: false,
      isOverFat: false,
    });
  });

  it('should handle empty day with no entries', async () => {
    // No entries for the date
    nutritionRepo.setEntriesForDate('2026-02-15', []);

    goalsRepo.setGoals({
      mode: 'manual',
      goals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70,
      },
    });

    const result = await useCase.execute('2026-02-15');

    expect(result.consumed).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(result.progress).toEqual({
      consumedCalories: 0,
      remainingCalories: 2000, // Full goals remaining
      proteinConsumed: 0,
      proteinRemaining: 150,
      carbsConsumed: 0,
      carbsRemaining: 200,
      fatConsumed: 0,
      fatRemaining: 70,
      isOverCalories: false,
      isOverProtein: false,
      isOverCarbs: false,
      isOverFat: false,
    });
  });

  it('should detect when consumed exceeds goals', async () => {
    nutritionRepo.setEntriesForDate('2026-02-15', [
      { calories: 2500, protein: 200, carbs: 250, fat: 100 },
    ]);

    goalsRepo.setGoals({
      mode: 'manual',
      goals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70,
      },
    });

    const result = await useCase.execute('2026-02-15');

    expect(result.progress).toEqual({
      consumedCalories: 2500,
      remainingCalories: 0, // Clamped to 0
      proteinConsumed: 200,
      proteinRemaining: 0, // Clamped to 0
      carbsConsumed: 250,
      carbsRemaining: 0, // Clamped to 0
      fatConsumed: 100,
      fatRemaining: 0, // Clamped to 0
      isOverCalories: true,
      isOverProtein: true,
      isOverCarbs: true,
      isOverFat: true,
    });
  });

  it('should throw GoalsNotFoundError when no goals are set', async () => {
    nutritionRepo.setEntriesForDate('2026-02-15', [
      { calories: 500, protein: 30, carbs: 50, fat: 20 },
    ]);

    // No goals set
    goalsRepo.setGoals(null);

    await expect(useCase.execute('2026-02-15')).rejects.toThrow(GoalsNotFoundError);
    await expect(useCase.execute('2026-02-15')).rejects.toThrow(
      'No effective goals found. Please set goals first.',
    );
  });

  it('should work with suggested goals mode', async () => {
    nutritionRepo.setEntriesForDate('2026-02-15', [
      { calories: 1000, protein: 80, carbs: 100, fat: 40 },
    ]);

    goalsRepo.setGoals({
      mode: 'suggested',
      goals: {
        calories: 2500,
        protein: 180,
        carbs: 250,
        fat: 80,
      },
      suggestionSnapshot: {
        goals: {
          calories: 2500,
          protein: 180,
          carbs: 250,
          fat: 80,
        },
        rationale: 'Based on metabolism',
        macroStrategy: 'Balanced',
        createdAt: '2026-02-15T10:00:00.000Z',
      },
    });

    const result = await useCase.execute('2026-02-15');

    expect(result.goals).toEqual({
      calories: 2500,
      protein: 180,
      carbs: 250,
      fat: 80,
    });
    expect(result.progress.remainingCalories).toBe(1500); // 2500 - 1000
  });

  it('should handle partial over limits', async () => {
    nutritionRepo.setEntriesForDate('2026-02-15', [
      { calories: 2100, protein: 140, carbs: 220, fat: 60 },
    ]);

    goalsRepo.setGoals({
      mode: 'manual',
      goals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70,
      },
    });

    const result = await useCase.execute('2026-02-15');

    expect(result.progress).toEqual({
      consumedCalories: 2100,
      remainingCalories: 0, // Over
      proteinConsumed: 140,
      proteinRemaining: 10, // Under
      carbsConsumed: 220,
      carbsRemaining: 0, // Over
      fatConsumed: 60,
      fatRemaining: 10, // Under
      isOverCalories: true,
      isOverProtein: false,
      isOverCarbs: true,
      isOverFat: false,
    });
  });
});
