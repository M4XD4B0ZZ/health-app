import { CreateSavedMealFromDateUseCase } from '../application/usecases/CreateSavedMealFromDateUseCase';
import { LogSavedMealToDateUseCase } from '../application/usecases/LogSavedMealToDateUseCase';
import { ListSavedMealTemplatesUseCase } from '../application/usecases/ListSavedMealTemplatesUseCase';
import { DeleteSavedMealTemplateUseCase } from '../application/usecases/DeleteSavedMealTemplateUseCase';
import { RenameSavedMealTemplateUseCase } from '../application/usecases/RenameSavedMealTemplateUseCase';
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

  beforeEach(async () => {
    foodEntryRepo = new InMemoryFoodEntryRepository();
    savedMealRepo = new InMemorySavedMealRepository();
    lookup = new InMemoryNutritionLookup();
    clock = new MockClock();
    idGen = new MockIdGenerator();

    createUseCase = new CreateSavedMealFromDateUseCase(foodEntryRepo, savedMealRepo, clock, idGen);

    logUseCase = new LogSavedMealToDateUseCase(savedMealRepo, foodEntryRepo, clock, idGen, lookup);

    await lookup.upsertPer100gByName('chicken', {
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
    });
    await lookup.upsertPer100gByName('rice', {
      calories: 130,
      protein: 2.8,
      carbs: 28,
      fat: 0.3,
    });
    await lookup.upsertPer100gByName('broccoli', {
      calories: 34,
      protein: 2.8,
      carbs: 6.6,
      fat: 0.4,
    });
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
        per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.5 },
      });
      expect(template.items[1]).toEqual({
        parsedName: 'rice',
        quantityGrams: 150,
        per100g: { calories: 130, protein: 2.8, carbs: 28, fat: 0.3 },
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

    it('should include piece/unit-based entries via entry.grams, not just quantityGrams (SM-007)', async () => {
      // Arrange: a count-based entry ("2 Eier") — quantityGrams stays 0 (no explicit gram
      // input), but the resolved portion weight lives in `grams`, exactly like
      // LogFoodFromRawInputUseCase leaves it for unit-based foods.
      const dateISO = '2024-01-15';
      const entry: FoodEntry = {
        id: 'e1',
        rawInput: '2 Eier',
        parsedName: 'Eier',
        quantityGrams: 0,
        grams: 120,
        calories: 164.4,
        protein: 14,
        carbs: 1,
        fat: 11,
        confidenceScore: 0.6,
        sourceType: 'generic',
        createdAt: new Date(dateISO + 'T08:00:00Z'),
      };
      await foodEntryRepo.addEntry(entry);

      // Act
      const template = await createUseCase.execute(dateISO, 'Frühstück');

      // Assert: entry is included, using entry.grams as the template's quantityGrams
      expect(template.items).toHaveLength(1);
      expect(template.items[0].parsedName).toBe('Eier');
      expect(template.items[0].quantityGrams).toBe(120);
      const per100g = template.items[0].per100g;
      expect(per100g?.calories).toBeCloseTo(137, 10);
      expect(per100g?.protein).toBeCloseTo(11.666666666666666, 10);
      expect(per100g?.carbs).toBeCloseTo(0.8333333333333334, 10);
      expect(per100g?.fat).toBeCloseTo(9.166666666666666, 10);
    });

    it('should copy foodCatalogRef from source entries that have one (SM-001)', async () => {
      // Arrange: one entry with a foodCatalogRef, one without
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
          confidenceScore: 0.9,
          sourceType: 'branded',
          createdAt: new Date(dateISO + 'T08:00:00Z'),
          foodCatalogRef: {
            source: 'off',
            sourceId: 'off-123',
            displayName: 'Chicken Breast',
            confidence: 0.9,
          },
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
          // no foodCatalogRef
        },
      ];

      for (const entry of entries) {
        await foodEntryRepo.addEntry(entry);
      }

      // Act
      const template = await createUseCase.execute(dateISO, 'My Lunch');

      // Assert
      expect(template.items[0].foodCatalogRef).toEqual({
        source: 'off',
        sourceId: 'off-123',
        displayName: 'Chicken Breast',
        confidence: 0.9,
      });
      expect(template.items[1].foodCatalogRef).toBeUndefined();
    });

    it('should derive a frozen per100g snapshot from source entry macros (SM-002)', async () => {
      // Arrange: 200g chicken at 330 kcal/62 protein/0 carbs/7 fat -> per100g halves
      const dateISO = '2024-01-15';
      const entry: FoodEntry = {
        id: 'e1',
        rawInput: '200g chicken',
        parsedName: 'chicken',
        quantityGrams: 200,
        calories: 330,
        protein: 62,
        carbs: 0,
        fat: 7,
        confidenceScore: 0.9,
        sourceType: 'branded',
        createdAt: new Date(dateISO + 'T08:00:00Z'),
      };
      await foodEntryRepo.addEntry(entry);

      // Act
      const template = await createUseCase.execute(dateISO, 'My Lunch');

      // Assert
      expect(template.items[0].per100g).toEqual({
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.5,
      });
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

    it('should block save if lookup not found', async () => {
      // Arrange: Create template with unknown food
      const template = {
        id: 'template-1',
        name: 'Test Meal',
        items: [{ parsedName: 'unknown-food', quantityGrams: 100 }],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      await expect(logUseCase.execute('template-1', '2024-01-16')).rejects.toThrow(
        'ZERO_MACROS_BLOCKED for saved meal item: 100g unknown-food',
      );

      const persistedEntries = await foodEntryRepo.listEntriesForDate('2024-01-16');
      expect(persistedEntries).toHaveLength(0);
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

    it('should use the frozen per100g snapshot deterministically, without NutritionLookup (SM-002)', async () => {
      // Arrange: template item carries a per100g snapshot + foodCatalogRef, and its name is
      // deliberately NOT registered in `lookup`, so any fallback to NutritionLookup would
      // throw ZERO_MACROS_BLOCKED instead of succeeding.
      const template = {
        id: 'template-1',
        name: 'Snapshot Meal',
        items: [
          {
            parsedName: 'unregistered-branded-food',
            quantityGrams: 200,
            per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
            foodCatalogRef: {
              source: 'off' as const,
              sourceId: 'off-999',
              displayName: 'Branded Chicken',
              confidence: 0.95,
            },
          },
        ],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act
      const entries = await logUseCase.execute('template-1', '2024-01-16');

      // Assert: macros computed from the frozen snapshot (165 * 2 = 330 kcal, etc.)
      expect(entries[0].calories).toBe(330);
      expect(entries[0].protein).toBe(62);
      expect(entries[0].carbs).toBe(0);
      expect(entries[0].fat).toBe(7.2);
      expect(entries[0].sourceType).toBe('cache');
      expect(entries[0].confidenceScore).toBe(0.8); // cache confidence
      expect(entries[0].foodCatalogRef).toEqual(template.items[0].foodCatalogRef);
      expect(entries[0].nutritionSnapshot).toEqual({
        kcal: 330,
        protein: 62,
        carbs: 0,
        fat: 7.2,
      });
    });

    it('should always set nutritionSnapshot, including on the by-name fallback path', async () => {
      // Arrange: legacy template item without per100g (pre-SM-002)
      const template = {
        id: 'template-1',
        name: 'Legacy Meal',
        items: [{ parsedName: 'banana', quantityGrams: 100 }],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act
      const entries = await logUseCase.execute('template-1', '2024-01-16');

      // Assert
      expect(entries[0].nutritionSnapshot).toEqual({
        kcal: entries[0].calories,
        protein: entries[0].protein,
        carbs: entries[0].carbs,
        fat: entries[0].fat,
      });
      expect(entries[0].foodCatalogRef).toBeUndefined();
    });

    it('should still block zero-macro entries when a per100g snapshot itself is zero', async () => {
      // Arrange
      const template = {
        id: 'template-zero-per100g',
        name: 'Zero Snapshot Meal',
        items: [
          {
            parsedName: 'zero-snapshot-food',
            quantityGrams: 100,
            per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          },
        ],
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
      };
      await savedMealRepo.create(template);

      // Act & Assert
      await expect(logUseCase.execute('template-zero-per100g', '2024-01-17')).rejects.toThrow(
        'ZERO_MACROS_BLOCKED for saved meal item: 100g zero-snapshot-food',
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

  describe('Template Management Use Cases (SM-003)', () => {
    let listUseCase: ListSavedMealTemplatesUseCase;
    let deleteUseCase: DeleteSavedMealTemplateUseCase;
    let renameUseCase: RenameSavedMealTemplateUseCase;

    beforeEach(() => {
      listUseCase = new ListSavedMealTemplatesUseCase(savedMealRepo);
      deleteUseCase = new DeleteSavedMealTemplateUseCase(savedMealRepo, clock);
      renameUseCase = new RenameSavedMealTemplateUseCase(savedMealRepo, clock);
    });

    it('ListSavedMealTemplatesUseCase returns all templates', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await savedMealRepo.create({
        id: 't2',
        name: 'Dinner',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      const templates = await listUseCase.execute();

      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.name).sort()).toEqual(['Dinner', 'Lunch']);
    });

    it('ListSavedMealTemplatesUseCase returns an empty array when none exist', async () => {
      expect(await listUseCase.execute()).toEqual([]);
    });

    it('DeleteSavedMealTemplateUseCase removes a template by id', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      await deleteUseCase.execute('t1');

      expect(await savedMealRepo.getById('t1')).toBeNull();
    });

    it('DeleteSavedMealTemplateUseCase is a no-op for an unknown id', async () => {
      await expect(deleteUseCase.execute('does-not-exist')).resolves.toBeUndefined();
    });

    it('RenameSavedMealTemplateUseCase updates name and updatedAt', async () => {
      const createdAt = new Date('2024-01-10T10:00:00Z');
      await savedMealRepo.create({
        id: 't1',
        name: 'Old Name',
        items: [{ parsedName: 'chicken', quantityGrams: 200 }],
        createdAt,
        updatedAt: createdAt,
      });

      clock.setTime(new Date('2024-01-20T12:00:00Z'));
      const updated = await renameUseCase.execute('t1', 'New Name');

      expect(updated.name).toBe('New Name');
      expect(updated.updatedAt).toEqual(new Date('2024-01-20T12:00:00Z'));
      expect(updated.createdAt).toEqual(createdAt);
      expect(updated.items).toEqual([{ parsedName: 'chicken', quantityGrams: 200 }]);

      const persisted = await savedMealRepo.getById('t1');
      expect(persisted?.name).toBe('New Name');
    });

    it('RenameSavedMealTemplateUseCase rejects an unknown id', async () => {
      await expect(renameUseCase.execute('does-not-exist', 'New Name')).rejects.toThrow(
        'SavedMealTemplate with id does-not-exist not found',
      );
    });
  });

  describe('ACC-002: Saved Meal soft-delete', () => {
    let listUseCase: ListSavedMealTemplatesUseCase;
    let deleteUseCase: DeleteSavedMealTemplateUseCase;
    let renameUseCase: RenameSavedMealTemplateUseCase;

    beforeEach(() => {
      listUseCase = new ListSavedMealTemplatesUseCase(savedMealRepo);
      deleteUseCase = new DeleteSavedMealTemplateUseCase(savedMealRepo, clock);
      renameUseCase = new RenameSavedMealTemplateUseCase(savedMealRepo, clock);
    });

    it('sets the deletedAt tombstone rather than removing the record', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [{ parsedName: 'chicken', quantityGrams: 200 }],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      await deleteUseCase.execute('t1');

      const tombstoned = await savedMealRepo.getByIdIncludingDeleted('t1');
      expect(tombstoned).not.toBeNull();
      expect(tombstoned?.deletedAt).toEqual(clock.now());
      // SavedMealItem records remain associated with the tombstoned parent.
      expect(tombstoned?.items).toEqual([{ parsedName: 'chicken', quantityGrams: 200 }]);
    });

    it('excludes soft-deleted templates from list()', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await savedMealRepo.create({
        id: 't2',
        name: 'Dinner',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      await deleteUseCase.execute('t1');

      expect((await listUseCase.execute()).map((t) => t.name)).toEqual(['Dinner']);
      expect((await savedMealRepo.listIncludingDeleted()).map((t) => t.id).sort()).toEqual([
        't1',
        't2',
      ]);
    });

    it('rejects logging a deleted template without creating any Journal entry', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [{ parsedName: 'chicken', quantityGrams: 200 }],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await deleteUseCase.execute('t1');

      await expect(logUseCase.execute('t1', '2024-01-16')).rejects.toThrow(
        'SavedMealTemplate with id t1 not found',
      );
      expect(await foodEntryRepo.listEntriesForDate('2024-01-16')).toHaveLength(0);
    });

    it('rejects renaming a deleted template (cannot be opened as an active template)', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await deleteUseCase.execute('t1');

      await expect(renameUseCase.execute('t1', 'New Name')).rejects.toThrow(
        'SavedMealTemplate with id t1 not found',
      );
    });

    it('is idempotent: repeated delete calls do not throw and do not move the tombstone timestamp', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      await deleteUseCase.execute('t1');
      const firstDeletedAt = (await savedMealRepo.getByIdIncludingDeleted('t1'))?.deletedAt;

      clock.setTime(new Date('2024-02-01T00:00:00Z'));
      await expect(deleteUseCase.execute('t1')).resolves.toBeUndefined();

      const afterSecondDelete = await savedMealRepo.getByIdIncludingDeleted('t1');
      expect(afterSecondDelete?.deletedAt).toEqual(firstDeletedAt);
    });

    it('does not resurrect a deleted template when a new template uses the same display name', async () => {
      await savedMealRepo.create({
        id: 't1',
        name: 'Lunch',
        items: [{ parsedName: 'chicken', quantityGrams: 200 }],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await deleteUseCase.execute('t1');

      await savedMealRepo.create({
        id: 't2',
        name: 'Lunch',
        items: [{ parsedName: 'rice', quantityGrams: 150 }],
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });

      const active = await listUseCase.execute();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('t2');
      expect(active[0].items).toEqual([{ parsedName: 'rice', quantityGrams: 150 }]);
      // The old tombstoned record under 't1' is untouched, not merged into 't2'.
      expect((await savedMealRepo.getByIdIncludingDeleted('t1'))?.items).toEqual([
        { parsedName: 'chicken', quantityGrams: 200 },
      ]);
    });
  });
});
