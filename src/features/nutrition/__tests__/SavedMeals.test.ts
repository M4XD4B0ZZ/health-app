import { CreateSavedMealFromDateUseCase } from '../application/usecases/CreateSavedMealFromDateUseCase';
import { LogSavedMealToDateUseCase } from '../application/usecases/LogSavedMealToDateUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemorySavedMealRepository } from '../infrastructure/repositories/InMemorySavedMealRepository';
import { InMemoryNutritionLookup } from '../infrastructure/repositories/InMemoryNutritionLookup';
import { FoodEntry } from '../domain/models/NutritionTypes';

// Mock Clock and IdGenerator
class MockClock {
  private fixedTime = new Date('2024-01-15T10:00:00Z');

  now(): Date {
    return this.fixedTime;
  }

  todayISO(): string {
    return this.fixedTime.toISOString().slice(0, 10);
  }

  setTime(date: Date): void {
    this.fixedTime = date;
  }
}

class MockIdGenerator {
  private counter = 0;
  newId(): string {
    return `id-${++this.counter}`;
  }

  reset(): void {
    this.counter = 0;
  }
}

describe('Saved Meals System', () => {
  let foodEntryRepo: InMemoryFoodEntryRepository;
  let savedMealRepo: InMemorySavedMealRepository;
  let lookup: InMemoryNutritionLookup;
  let clock: MockClock;
  let idGen: MockIdGenerator;
  let createUseCase: CreateSavedMealFromDateUseCase;
  let logUseCase: LogSavedMealToDateUseCase;

  beforeEach(() => {
    foodEntryRepo = new InMemoryFoodEntryRepository();
    savedMealRepo = new InMemorySavedMealRepository();
    lookup = new InMemoryNutritionLookup();
    clock = new MockClock();
    idGen = new MockIdGenerator();

    createUseCase = new CreateSavedMealFromDateUseCase(foodEntryRepo, savedMealRepo, clock, idGen);

    logUseCase = new LogSavedMealToDateUseCase(savedMealRepo, foodEntryRepo, clock, idGen, lookup);
  });

  describe('CreateSavedMealFromDateUseCase', () => {
    it('should create a template from entries with grams', async () => {
      // Arrange: Add some food entries for a date
      const dateISO = '2024-01-15';
      const entries: FoodEntry[] = [
        {
          id: 'e1',
          rawInput: '200g chicken',
          parsedName: 'chicken',
          quantityGrams: 200,
          calories: 330,
          protein: 62,
          carbs: 0,
          fat: 7,
          confidenceScore: 0.6,
          sourceType: 'generic',
          createdAt: new Date(dateISO + 'T08:00:00Z'),
        },
        {
          id: 'e2',
          rawInput: '150g rice',
          parsedName: 'rice',
          quantityGrams: 150,
          calories: 195,
          protein: 4.2,
          carbs: 42,
          fat: 0.45,
          confidenceScore: 0.6,
          sourceType: 'generic',
          createdAt: new Date(dateISO + 'T08:00:00Z'),
        },
      ];

      for (const entry of entries) {
        await foodEntryRepo.addEntry(entry);
      }

      // Act: Create template
      const template = await createUseCase.execute(dateISO, 'My Lunch');

      // Assert
      expect(template.name).toBe('My Lunch');
      expect(template.items).toHaveLength(2);
      expect(template.items[0]).toEqual({
        parsedName: 'chicken',
        quantityGrams: 200,
      });
      expect(template.items[1]).toEqual({
        parsedName: 'rice',
        quantityGrams: 150,
      });
      expect(template.id).toBe('id-1');
      expect(template.createdAt).toEqual(clock.now());
      expect(template.updatedAt).toEqual(clock.now());
    });

    it('should skip entries without grams', async () => {
      // Arrange: Add entries with and without grams
      const dateISO = '2024-01-15';
      const entries: FoodEntry[] = [
        {
          id: 'e1',
          rawInput: '200g chicken',
          parsedName: 'chicken',
          quantityGrams: 200,
          calories: 330,
          protein: 62,
          carbs: 0,
          fat: 7,
          confidenceScore: 0.6,
          sourceType: 'generic',
          createdAt: new Date(dateISO + 'T08:00:00Z'),
        },
        {
          id: 'e2',
          rawInput: 'banana',
          parsedName: 'banana',
          quantityGrams: 0, // No grams!
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          confidenceScore: 0.3,
          sourceType: 'user',
          createdAt: new Date(dateISO + 'T08:00:00Z'),
        },
      ];

      for (const entry of entries) {
        await foodEntryRepo.addEntry(entry);
      }

      // Act: Create template
      const template = await createUseCase.execute(dateISO, 'My Meal');

      // Assert: Only chicken should be included
      expect(template.items).toHaveLength(1);
      expect(template.items[0].parsedName).toBe('chicken');
    });

    it('should persist template to repository', async () => {
      // Arrange
      const dateISO = '2024-01-15';
      const entry: FoodEntry = {
        id: 'e1',
        rawInput: '100g oats',
        parsedName: 'oats',
        quantityGrams: 100,
        calories: 389,
        protein: 16.9,
        carbs: 66,
        fat: 6.9,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date(dateISO + 'T08:00:00Z'),
      };
      await foodEntryRepo.addEntry(entry);

      // Act
      const template = await createUseCase.execute(dateISO, 'Breakfast');

      // Assert: Template is saved
      const savedTemplate = await savedMealRepo.getById(template.id);
      expect(savedTemplate).not.toBeNull();
      expect(savedTemplate?.name).toBe('Breakfast');
    });
  });

  describe('LogSavedMealToDateUseCase', () => {
    it('should log template items as new food entries', async () => {
      // Arrange: Create a template
      const template = {
        id: 'template-1',
        name: 'Protein Bowl',
        items: [
          { parsedName: 'chicken', quantityGrams: 200 },
          { parsedName: 'rice', quantityGrams: 150 },
        ],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      idGen.reset(); // Reset to predictable IDs

      // Act: Log template to a new date
      const entries = await logUseCase.execute('template-1', '2024-01-16');

      // Assert: Multiple entries created
      expect(entries).toHaveLength(2);
      expect(entries[0].parsedName).toBe('chicken');
      expect(entries[0].quantityGrams).toBe(200);
      expect(entries[0].rawInput).toBe('200g chicken');
      expect(entries[1].parsedName).toBe('rice');
      expect(entries[1].quantityGrams).toBe(150);
      expect(entries[1].rawInput).toBe('150g rice');
    });

    it('should enrich macros if lookup available', async () => {
      // Arrange: Create template
      const template = {
        id: 'template-1',
        name: 'Snack',
        items: [{ parsedName: 'banana', quantityGrams: 150 }],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act: Log template (banana is in lookup by default)
      const entries = await logUseCase.execute('template-1', '2024-01-16');

      // Assert: Macros enriched
      // banana per 100g: 89 cal, 1.1 protein, 22.8 carbs, 0.3 fat
      // 150g: 133.5 cal, 1.65 protein, 34.2 carbs, 0.45 fat
      expect(entries[0].calories).toBe(133.5);
      expect(entries[0].protein).toBe(1.65);
      expect(entries[0].carbs).toBe(34.2);
      expect(entries[0].fat).toBe(0.45);
      expect(entries[0].sourceType).toBe('generic');
      expect(entries[0].confidenceScore).toBe(0.6); // generic confidence
    });

    it('should populate explanation and confidenceReason', async () => {
      // Arrange: Create template
      const template = {
        id: 'template-1',
        name: 'Quick Meal',
        items: [{ parsedName: 'banana', quantityGrams: 100 }],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act
      const entries = await logUseCase.execute('template-1', '2024-01-16');

      // Assert: Metadata populated
      expect(entries[0].explanation).toBe('Template: Quick Meal');
      expect(entries[0].confidenceReason).toBe('Exact match found in generic database.');
    });

    it('should use user source type if lookup not found', async () => {
      // Arrange: Create template with unknown food
      const template = {
        id: 'template-1',
        name: 'Test Meal',
        items: [{ parsedName: 'unknown-food', quantityGrams: 100 }],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act
      const entries = await logUseCase.execute('template-1', '2024-01-16');

      // Assert: Not enriched, user source type
      expect(entries[0].calories).toBe(0);
      expect(entries[0].protein).toBe(0);
      expect(entries[0].sourceType).toBe('user');
      expect(entries[0].confidenceScore).toBe(0.3); // low confidence
      expect(entries[0].confidenceReason).toBe('Grams provided but nutrition unknown.');
    });

    it('should persist all entries to repository', async () => {
      // Arrange: Create template
      const template = {
        id: 'template-1',
        name: 'Full Meal',
        items: [
          { parsedName: 'chicken', quantityGrams: 200 },
          { parsedName: 'rice', quantityGrams: 150 },
          { parsedName: 'broccoli', quantityGrams: 100 },
        ],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act
      await logUseCase.execute('template-1', '2024-01-17');

      // Assert: All entries persisted
      const persistedEntries = await foodEntryRepo.listEntriesForDate('2024-01-17');
      expect(persistedEntries).toHaveLength(3);
      expect(persistedEntries[0].parsedName).toBe('chicken');
      expect(persistedEntries[1].parsedName).toBe('rice');
      expect(persistedEntries[2].parsedName).toBe('broccoli');
    });

    it('should throw error if template not found', async () => {
      // Act & Assert
      await expect(logUseCase.execute('non-existent-id', '2024-01-16')).rejects.toThrow(
        'SavedMealTemplate with id non-existent-id not found',
      );
    });
  });

  describe('Integration: Full workflow', () => {
    it('should create template from date and log it to another date', async () => {
      // Step 1: Add some entries to date 1
      const date1 = '2024-01-15';
      const entries: FoodEntry[] = [
        {
          id: 'e1',
          rawInput: '200g chicken',
          parsedName: 'chicken',
          quantityGrams: 200,
          calories: 330,
          protein: 62,
          carbs: 0,
          fat: 7,
          confidenceScore: 0.6,
          sourceType: 'generic',
          createdAt: new Date(date1 + 'T08:00:00Z'),
        },
        {
          id: 'e2',
          rawInput: '100g rice',
          parsedName: 'rice',
          quantityGrams: 100,
          calories: 130,
          protein: 2.8,
          carbs: 28,
          fat: 0.3,
          confidenceScore: 0.6,
          sourceType: 'generic',
          createdAt: new Date(date1 + 'T08:00:00Z'),
        },
      ];

      for (const entry of entries) {
        await foodEntryRepo.addEntry(entry);
      }

      // Step 2: Create template from date 1
      const template = await createUseCase.execute(date1, 'Standard Lunch');
      expect(template.items).toHaveLength(2);

      // Step 3: Log template to date 2
      const date2 = '2024-01-20';
      const newEntries = await logUseCase.execute(template.id, date2);

      // Step 4: Verify entries on date 2
      expect(newEntries).toHaveLength(2);
      const persistedOnDate2 = await foodEntryRepo.listEntriesForDate(date2);
      expect(persistedOnDate2).toHaveLength(2);
      expect(persistedOnDate2[0].parsedName).toBe('chicken');
      expect(persistedOnDate2[1].parsedName).toBe('rice');

      // Step 5: Original entries on date 1 should remain unchanged
      const entriesOnDate1 = await foodEntryRepo.listEntriesForDate(date1);
      expect(entriesOnDate1).toHaveLength(2);
    });

    // P0-004: Zero-Macro Blocker Test
    it('should block saving entries with zero macros', async () => {
      // Arrange: Add a food with zero macros to the lookup
      await lookup.upsertPer100gByName('zero-macro-food', {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });

      // Create template with item that has zero nutrition data
      const template = {
        id: 'template-zero-macro',
        name: 'Zero Macro Meal',
        items: [
          { parsedName: 'zero-macro-food', quantityGrams: 100 }, // This will be found but has 0 calories
        ],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act & Assert: Should throw error when trying to log
      await expect(logUseCase.execute('template-zero-macro', '2024-01-17')).rejects.toThrow(
        'ZERO_MACROS_BLOCKED for saved meal item: 100g zero-macro-food',
      );

      // Verify: No entries were persisted
      const persistedEntries = await foodEntryRepo.listEntriesForDate('2024-01-17');
      expect(persistedEntries).toHaveLength(0);
    });
  });
});
