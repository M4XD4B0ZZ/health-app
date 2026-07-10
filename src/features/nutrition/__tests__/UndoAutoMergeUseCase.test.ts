import { UndoAutoMergeUseCase } from '../application/usecases/UndoAutoMergeUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { FoodEntry } from '../domain/models/NutritionTypes';
import { Clock } from '../application/ports/Clock';

class TestClock implements Clock {
  constructor(private fixedDate: Date) {}

  now(): Date {
    return this.fixedDate;
  }

  todayISO(): string {
    return this.fixedDate.toISOString().slice(0, 10);
  }
}

describe('UndoAutoMergeUseCase (J-005)', () => {
  let repository: InMemoryFoodEntryRepository;
  let clock: TestClock;
  let useCase: UndoAutoMergeUseCase;

  const previousValues: FoodEntry = {
    id: 'entry-1',
    rawInput: 'toast',
    parsedName: 'toast',
    quantityGrams: 40,
    grams: 40,
    calories: 106,
    protein: 3.6,
    carbs: 19.6,
    fat: 1.28,
    confidenceScore: 0.35,
    sourceType: 'generic',
    createdAt: new Date('2026-02-15T12:00:00Z'),
  };

  const mergedValues: FoodEntry = {
    ...previousValues,
    rawInput: '300g toast',
    quantityGrams: 300,
    grams: 300,
    calories: 795,
    protein: 27,
    carbs: 147,
    fat: 9.6,
    confidenceScore: 0.6,
    lastModifiedAt: new Date('2026-02-15T12:01:30Z'),
  };

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    clock = new TestClock(new Date('2026-02-15T12:02:00Z'));
    useCase = new UndoAutoMergeUseCase(repository, clock);
  });

  it('restores the entry to its pre-merge values', async () => {
    await repository.addEntry(mergedValues);

    await useCase.execute('entry-1', previousValues);

    const restored = await repository.getEntryById('entry-1');
    expect(restored).toEqual(previousValues);
  });

  it('appends a user-triggered correction-log entry capturing the merged state', async () => {
    await repository.addEntry(mergedValues);

    await useCase.execute('entry-1', previousValues);

    const log = await repository.getCorrectionLog('entry-1');
    expect(log).toHaveLength(1);
    expect(log[0].triggeredBy).toBe('user');
    expect(log[0].timestamp).toEqual(clock.now());
    expect(log[0].previousValues).toEqual(mergedValues);
  });

  it('does nothing when the entry no longer exists', async () => {
    await useCase.execute('non-existent', previousValues);

    expect(await repository.getEntryById('non-existent')).toBeNull();
    expect(await repository.getCorrectionLog('non-existent')).toEqual([]);
  });
});
