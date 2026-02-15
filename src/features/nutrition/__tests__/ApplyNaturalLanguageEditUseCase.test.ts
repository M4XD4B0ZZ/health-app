import { ApplyNaturalLanguageEditUseCase } from '../application/usecases/ApplyNaturalLanguageEditUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemoryNutritionLookup } from '../infrastructure/repositories/InMemoryNutritionLookup';
import { FoodEntry } from '../domain/models/NutritionTypes';
import { Clock } from '../application/ports/Clock';

/**
 * Test-Clock für deterministische Tests.
 */
class TestClock implements Clock {
  constructor(private fixedDate: Date = new Date('2024-01-15T12:00:00Z')) {}

  now(): Date {
    return this.fixedDate;
  }

  todayISO(): string {
    return this.fixedDate.toISOString().slice(0, 10);
  }
}

describe('ApplyNaturalLanguageEditUseCase', () => {
  let useCase: ApplyNaturalLanguageEditUseCase;
  let repository: InMemoryFoodEntryRepository;
  let lookup: InMemoryNutritionLookup;
  let clock: TestClock;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    lookup = new InMemoryNutritionLookup();
    clock = new TestClock();
    useCase = new ApplyNaturalLanguageEditUseCase(repository, lookup, clock);
  });

  describe('grams change', () => {
    it('should update quantity for "200g" instruction', async () => {
      // Setup: Add entry with known food (banana)
      const baseEntry: FoodEntry = {
        id: 'entry-1',
        rawInput: '150g banana',
        parsedName: 'banana',
        quantityGrams: 150,
        calories: 133.5,
        protein: 1.65,
        carbs: 34.2,
        fat: 0.45,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute: Change to 200g
      const result = await useCase.execute('2024-01-15', 'entry-1', '200g');

      // Verify: Quantity changed, macros recalculated
      expect(result.quantityGrams).toBe(200);
      expect(result.calories).toBe(178); // 89 * 2
      expect(result.protein).toBe(2.2); // 1.1 * 2
      expect(result.carbs).toBe(45.6); // 22.8 * 2
      expect(result.fat).toBe(0.6); // 0.3 * 2
      expect(result.lastModifiedAt).toEqual(clock.now());
      expect(result.explanation).toBe('Macros calculated from 100g reference.');
      expect(result.confidenceReason).toBe('Exact match found in generic database.');
    });

    it('should update quantity for "300 g" instruction (with space)', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-2',
        rawInput: '100g chicken breast',
        parsedName: 'chicken breast',
        quantityGrams: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute: Change to 300g
      const result = await useCase.execute('2024-01-15', 'entry-2', '300 g');

      // Verify
      expect(result.quantityGrams).toBe(300);
      expect(result.calories).toBe(495); // 165 * 3
      expect(result.protein).toBe(93); // 31 * 3
      expect(result.lastModifiedAt).toEqual(clock.now());
    });
  });

  describe('double portion logic', () => {
    it('should double quantity and recalculate macros', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-3',
        rawInput: '150g banana',
        parsedName: 'banana',
        quantityGrams: 150,
        calories: 133.5,
        protein: 1.65,
        carbs: 34.2,
        fat: 0.45,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute
      const result = await useCase.execute('2024-01-15', 'entry-3', 'double portion');

      // Verify
      expect(result.quantityGrams).toBe(300);
      expect(result.calories).toBe(267); // 89 * 3
      expect(result.protein).toBe(3.3); // 1.1 * 3
      expect(result.carbs).toBe(68.4); // 22.8 * 3
      expect(result.fat).toBe(0.9); // 0.3 * 3
      expect(result.lastModifiedAt).toEqual(clock.now());
      expect(result.explanation).toBe('Macros calculated from 100g reference.');
    });
  });

  describe('half portion logic', () => {
    it('should halve quantity and recalculate macros', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-4',
        rawInput: '200g banana',
        parsedName: 'banana',
        quantityGrams: 200,
        calories: 178,
        protein: 2.2,
        carbs: 45.6,
        fat: 0.6,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute
      const result = await useCase.execute('2024-01-15', 'entry-4', 'half portion');

      // Verify
      expect(result.quantityGrams).toBe(100);
      expect(result.calories).toBe(89); // 89 * 1
      expect(result.protein).toBe(1.1); // 1.1 * 1
      expect(result.carbs).toBe(22.8); // 22.8 * 1
      expect(result.fat).toBe(0.3); // 0.3 * 1
      expect(result.lastModifiedAt).toEqual(clock.now());
    });
  });

  describe('confidence reason updated', () => {
    it('should update confidenceReason after edit', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-5',
        rawInput: '100g banana',
        parsedName: 'banana',
        quantityGrams: 100,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute
      const result = await useCase.execute('2024-01-15', 'entry-5', '150g');

      // Verify: Confidence metadata updated
      expect(result.confidenceScore).toBe(0.6); // from generic source
      expect(result.confidenceReason).toBe('Exact match found in generic database.');
      expect(result.explanation).toBe('Macros calculated from 100g reference.');
    });
  });

  describe('handles unknown food', () => {
    it('should update quantity but keep macros at 0 for unknown food', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-6',
        rawInput: '100g unknown food',
        parsedName: 'unknown food',
        quantityGrams: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore: 0.3,
        sourceType: 'user',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute
      const result = await useCase.execute('2024-01-15', 'entry-6', '200g');

      // Verify: Quantity updated, but macros stay 0
      expect(result.quantityGrams).toBe(200);
      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
      expect(result.explanation).toBe('Grams provided but nutrition unknown.');
      expect(result.confidenceReason).toBe('Grams provided but nutrition unknown.');
    });
  });

  describe('unrecognized instruction', () => {
    it('should return unchanged entry for unrecognized instruction', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-7',
        rawInput: '100g banana',
        parsedName: 'banana',
        quantityGrams: 100,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute with unrecognized instruction
      const result = await useCase.execute('2024-01-15', 'entry-7', 'make it bigger');

      // Verify: No changes
      expect(result.quantityGrams).toBe(100);
      expect(result.calories).toBe(89);
      expect(result.lastModifiedAt).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw error if entry not found', async () => {
      await expect(
        useCase.execute('2024-01-15', 'non-existent-id', '200g')
      ).rejects.toThrow('Entry with id non-existent-id not found');
    });
  });
});
