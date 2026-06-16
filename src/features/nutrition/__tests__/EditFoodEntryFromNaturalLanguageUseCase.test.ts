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

  const quarkPer100g = {
    calories: 66,
    protein: 11.85,
    carbs: 3.68,
    fat: 0.18,
  };

  const createQuarkEntry = (overrides: Partial<FoodEntry> = {}): FoodEntry => ({
    id: 'quark-entry',
    rawInput: '200g quark',
    parsedName: 'quark',
    quantityGrams: 200,
    grams: 200,
    servingMultiplier: 1,
    calories: 132,
    protein: 23.7,
    carbs: 7.36,
    fat: 0.36,
    confidenceScore: 0.6,
    sourceType: 'generic',
    createdAt: new Date('2026-02-15T10:00:00Z'),
    calcBreakdown: {
      per100g: quarkPer100g,
      gramsUsed: 200,
      multiplier: 1,
    },
    ...overrides,
  });

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

  it('uses persisted calcBreakdown per100g when editing resolver-backed grams', async () => {
    await repository.addEntry(createQuarkEntry());

    const result = await useCase.execute('quark-entry', '300g');

    expect(result.editDecision.status).toBe('applied');
    expect(result.updatedEntry.grams).toBe(300);
    expect(result.updatedEntry.quantityGrams).toBe(300);
    expect(result.updatedEntry.rawInput).toBe('300g quark');
    expect(result.updatedEntry.servingMultiplier).toBe(1);
    expect(result.updatedEntry.calories).toBe(198);
    expect(result.updatedEntry.protein).toBe(35.55);
    expect(result.updatedEntry.carbs).toBe(11.04);
    expect(result.updatedEntry.fat).toBe(0.54);
    expect(result.updatedEntry.calcBreakdown).toEqual({
      per100g: quarkPer100g,
      gramsUsed: 300,
      multiplier: 1,
    });
  });

  it('converts doppelt edits to visible effective grams using persisted per100g', async () => {
    await repository.addEntry(createQuarkEntry());

    const result = await useCase.execute('quark-entry', 'doppelt');

    expect(result.editDecision.status).toBe('applied');
    expect(result.updatedEntry.grams).toBe(400);
    expect(result.updatedEntry.quantityGrams).toBe(400);
    expect(result.updatedEntry.rawInput).toBe('400g quark');
    expect(result.updatedEntry.servingMultiplier).toBe(1);
    expect(result.updatedEntry.calories).toBe(264);
    expect(result.updatedEntry.protein).toBe(47.4);
    expect(result.updatedEntry.carbs).toBe(14.72);
    expect(result.updatedEntry.fat).toBe(0.72);
    expect(result.updatedEntry.calcBreakdown?.gramsUsed).toBe(400);
  });

  it('converts halb edits to visible effective grams using persisted per100g', async () => {
    await repository.addEntry(createQuarkEntry());

    const result = await useCase.execute('quark-entry', 'halb');

    expect(result.editDecision.status).toBe('applied');
    expect(result.updatedEntry.grams).toBe(100);
    expect(result.updatedEntry.quantityGrams).toBe(100);
    expect(result.updatedEntry.rawInput).toBe('100g quark');
    expect(result.updatedEntry.servingMultiplier).toBe(1);
    expect(result.updatedEntry.calories).toBe(66);
    expect(result.updatedEntry.protein).toBe(11.85);
    expect(result.updatedEntry.carbs).toBe(3.68);
    expect(result.updatedEntry.fat).toBe(0.18);
    expect(result.updatedEntry.calcBreakdown?.gramsUsed).toBe(100);
  });

  it.each(['halb', 'halbe', 'hälfte'])(
    'converts %s edits to visible effective grams and truthful rawInput',
    async (editText) => {
      await repository.addEntry(createQuarkEntry());

      const result = await useCase.execute('quark-entry', editText);

      expect(result.editDecision.status).toBe('applied');
      expect(result.updatedEntry.grams).toBe(100);
      expect(result.updatedEntry.quantityGrams).toBe(100);
      expect(result.updatedEntry.rawInput).toBe('100g quark');
      expect(result.updatedEntry.servingMultiplier).toBe(1);
      expect(result.updatedEntry.calories).toBe(66);
    },
  );

  it('resets prior doppelt multiplier state on absolute gram edits without compounding', async () => {
    await repository.addEntry(
      createQuarkEntry({
        servingMultiplier: 2,
        calcBreakdown: {
          per100g: quarkPer100g,
          gramsUsed: 400,
          multiplier: 2,
        },
      }),
    );

    const result = await useCase.execute('quark-entry', '300g');

    expect(result.updatedEntry.grams).toBe(300);
    expect(result.updatedEntry.quantityGrams).toBe(300);
    expect(result.updatedEntry.servingMultiplier).toBe(1);
    expect(result.updatedEntry.calories).toBe(198);
    expect(result.updatedEntry.calcBreakdown?.gramsUsed).toBe(300);
    expect(result.updatedEntry.calcBreakdown?.multiplier).toBe(1);
  });

  it('resets prior halb multiplier state on absolute gram edits without compounding', async () => {
    await repository.addEntry(
      createQuarkEntry({
        servingMultiplier: 0.5,
        calcBreakdown: {
          per100g: quarkPer100g,
          gramsUsed: 100,
          multiplier: 0.5,
        },
      }),
    );

    const result = await useCase.execute('quark-entry', '300g');

    expect(result.updatedEntry.grams).toBe(300);
    expect(result.updatedEntry.quantityGrams).toBe(300);
    expect(result.updatedEntry.servingMultiplier).toBe(1);
    expect(result.updatedEntry.calories).toBe(198);
    expect(result.updatedEntry.calcBreakdown?.gramsUsed).toBe(300);
    expect(result.updatedEntry.calcBreakdown?.multiplier).toBe(1);
  });
});
