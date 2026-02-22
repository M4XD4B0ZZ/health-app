import { EditFoodEntryFromNaturalLanguageUseCase } from '../application/usecases/EditFoodEntryFromNaturalLanguageUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemoryNutritionLookup } from '../infrastructure/repositories/InMemoryNutritionLookup';
import { Clock } from '../application/ports/Clock';
import { FoodEntry } from '../domain/models/NutritionTypes';

class TestClock implements Clock {
  constructor(private readonly fixedDate: Date = new Date('2026-02-15T12:00:00Z')) {}

  now(): Date {
    return this.fixedDate;
  }

  todayISO(): string {
    return this.fixedDate.toISOString().slice(0, 10);
  }
}

describe('EditFoodEntryFromNaturalLanguageUseCase', () => {
  let repository: InMemoryFoodEntryRepository;
  let lookup: InMemoryNutritionLookup;
  let useCase: EditFoodEntryFromNaturalLanguageUseCase;
  let clock: TestClock;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    lookup = new InMemoryNutritionLookup();
    clock = new TestClock();
    useCase = new EditFoodEntryFromNaturalLanguageUseCase(repository, lookup, clock);
  });

  it('updates entry totals deterministically when grams are edited', async () => {
    const baseEntry: FoodEntry = {
      id: 'entry-1',
      rawInput: '100g banana',
      parsedName: 'banana',
      quantityGrams: 100,
      grams: 100,
      servingMultiplier: 1,
      calories: 89,
      protein: 1.1,
      carbs: 22.8,
      fat: 0.3,
      confidenceScore: 0.6,
      sourceType: 'generic',
      createdAt: new Date('2026-02-15T10:00:00Z'),
    };
    await repository.addEntry(baseEntry);

    const result = await useCase.execute('entry-1', '200g');

    expect(result.editDecision.status).toBe('applied');
    expect(result.editDecision.reasonCodes).toContain('GRAMS_SET');
    expect(result.updatedEntry.grams).toBe(200);
    expect(result.updatedEntry.quantityGrams).toBe(200);
    expect(result.updatedEntry.calories).toBe(178);
    expect(result.updatedEntry.protein).toBe(2.2);
    expect(result.updatedEntry.carbs).toBe(45.6);
    expect(result.updatedEntry.fat).toBe(0.6);
    expect(result.updatedEntry.lastModifiedAt).toEqual(clock.now());
    expect(result.updatedEntry.lastEditDecision).toBeDefined();
    expect(result.updatedEntry.lastEditDecision?.reasonCodes).toContain('GRAMS_SET');
  });

  it('returns ambiguous for ml without density', async () => {
    const baseEntry: FoodEntry = {
      id: 'entry-2',
      rawInput: '100g banana',
      parsedName: 'banana',
      quantityGrams: 100,
      grams: 100,
      servingMultiplier: 1,
      calories: 89,
      protein: 1.1,
      carbs: 22.8,
      fat: 0.3,
      confidenceScore: 0.6,
      sourceType: 'generic',
      createdAt: new Date('2026-02-15T10:00:00Z'),
    };
    await repository.addEntry(baseEntry);

    const result = await useCase.execute('entry-2', '250 ml');

    expect(result.editDecision.status).toBe('ambiguous');
    expect(result.editDecision.reasonCodes).toContain('ML_UNSUPPORTED');
  });

  it('marks ingredient exclusion as unsupported but stores edit note', async () => {
    const baseEntry: FoodEntry = {
      id: 'entry-3',
      rawInput: '100g banana',
      parsedName: 'banana',
      quantityGrams: 100,
      grams: 100,
      servingMultiplier: 1,
      calories: 89,
      protein: 1.1,
      carbs: 22.8,
      fat: 0.3,
      confidenceScore: 0.6,
      sourceType: 'generic',
      createdAt: new Date('2026-02-15T10:00:00Z'),
    };
    await repository.addEntry(baseEntry);

    const result = await useCase.execute('entry-3', 'ohne öl');

    expect(result.editDecision.status).toBe('ambiguous');
    expect(result.editDecision.reasonCodes).toContain('INGREDIENT_EDIT_UNSUPPORTED');
    expect(result.updatedEntry.editNote).toBe('exclude: oil');
    expect(result.updatedEntry.lastEditDecision?.reasonCodes).toContain(
      'INGREDIENT_EDIT_UNSUPPORTED',
    );
  });
});
