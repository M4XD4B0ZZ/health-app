import { GetCalendarMonthSummaryUseCase } from '../application/usecases/GetCalendarMonthSummaryUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { EffectiveGoalsRepository } from '../../goals/application/ports';
import { EffectiveGoals } from '../../goals/domain/models/GoalsTypes';
import { FoodEntry } from '../domain/models/NutritionTypes';

class InMemoryGoalsRepository implements EffectiveGoalsRepository {
  async get(): Promise<EffectiveGoals | null> {
    return {
      mode: 'manual',
      goals: { calories: 2000, protein: 150, carbs: 250, fat: 70 },
    };
  }

  async upsert(): Promise<void> {}
}

function createEntry(input: {
  id: string;
  createdAt: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}): FoodEntry {
  return {
    id: input.id,
    rawInput: input.id,
    parsedName: input.id,
    quantityGrams: 100,
    calories: input.calories,
    protein: input.protein ?? 10,
    carbs: input.carbs ?? 10,
    fat: input.fat ?? 5,
    confidenceScore: 0.8,
    sourceType: 'generic',
    createdAt: new Date(input.createdAt),
  };
}

describe('GetCalendarMonthSummaryUseCase', () => {
  it('returns full month summary and filters entries by range boundaries', async () => {
    const entriesRepo = new InMemoryFoodEntryRepository();
    await entriesRepo.addEntry(
      createEntry({ id: 'start', createdAt: '2026-02-01T00:00:00.000Z', calories: 300 }),
    );
    await entriesRepo.addEntry(
      createEntry({ id: 'end', createdAt: '2026-02-28T22:59:00.000Z', calories: 400 }),
    );
    await entriesRepo.addEntry(
      createEntry({ id: 'outside', createdAt: '2026-03-01T00:10:00.000Z', calories: 999 }),
    );

    const useCase = new GetCalendarMonthSummaryUseCase(
      entriesRepo,
      new InMemoryGoalsRepository(),
      'Europe/Berlin',
    );
    const summary = await useCase.execute('2026-02');

    expect(summary.monthISO).toBe('2026-02');
    expect(summary.days).toHaveLength(28);
    expect(summary.days[0].hasEntries).toBe(true);
    expect(summary.days[27].hasEntries).toBe(true);
    expect(summary.days.some((day) => day.totalCaloriesKcal === 999)).toBe(false);
  });

  it('excludes soft-deleted (tombstoned) entries from day totals (J-003)', async () => {
    const entriesRepo = new InMemoryFoodEntryRepository();
    await entriesRepo.addEntry(
      createEntry({ id: 'kept', createdAt: '2026-02-10T10:00:00.000Z', calories: 300 }),
    );
    await entriesRepo.addEntry(
      createEntry({ id: 'deleted', createdAt: '2026-02-10T11:00:00.000Z', calories: 900 }),
    );
    await entriesRepo.deleteEntry('deleted', new Date('2026-02-10T12:00:00.000Z'));

    const useCase = new GetCalendarMonthSummaryUseCase(
      entriesRepo,
      new InMemoryGoalsRepository(),
      'Europe/Berlin',
    );
    const summary = await useCase.execute('2026-02');

    const day10 = summary.days.find((day) => day.dateISO === '2026-02-10');
    expect(day10?.totalCaloriesKcal).toBe(300);
  });
});
