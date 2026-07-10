import { PersistedFoodEntryRepository } from '../infrastructure/repositories/PersistedFoodEntryRepository';
import { FakeKeyValueStore } from '../infrastructure/storage/FakeKeyValueStore';
import { FoodEntry } from '../domain/models/NutritionTypes';

describe('PersistedFoodEntryRepository', () => {
  let keyValueStore: FakeKeyValueStore;
  let repository: PersistedFoodEntryRepository;

  beforeEach(() => {
    keyValueStore = new FakeKeyValueStore();
    repository = new PersistedFoodEntryRepository(keyValueStore);
  });

  const createSampleEntry = (id: string, date: Date): FoodEntry => ({
    id,
    rawInput: '100g Chicken',
    parsedName: 'Chicken',
    quantityGrams: 100,
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    confidenceScore: 0.8,
    sourceType: 'cache',
    createdAt: date,
    explanation: 'From cache',
  });

  describe('addEntry', () => {
    it('should persist entry and allow retrieval', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      const entries = await repository.listEntriesForDate(dateISO);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(entry);
    });

    it('should persist entry to storage', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      // Verify storage was written
      const storedData = await keyValueStore.get('nutrition:entries');
      expect(storedData).toBeTruthy();

      const parsed = JSON.parse(storedData!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('entry-1');
    });

    it('should reload entries from storage in new instance', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      // Create new repository instance with same storage
      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate(dateISO);

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('entry-1');
      expect(entries[0].rawInput).toBe('100g Chicken');
      expect(entries[0].createdAt).toEqual(date);
    });

    it('should support multiple entries on same date', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry1 = createSampleEntry('entry-1', date);
      const entry2 = createSampleEntry('entry-2', date);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);

      const entries = await repository.listEntriesForDate(dateISO);
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe('entry-1');
      expect(entries[1].id).toBe('entry-2');
    });

    it('should support entries on different dates', async () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-16T10:00:00Z');
      const entry1 = createSampleEntry('entry-1', date1);
      const entry2 = createSampleEntry('entry-2', date2);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);

      const entries1 = await repository.listEntriesForDate('2024-01-15');
      const entries2 = await repository.listEntriesForDate('2024-01-16');

      expect(entries1).toHaveLength(1);
      expect(entries1[0].id).toBe('entry-1');
      expect(entries2).toHaveLength(1);
      expect(entries2[0].id).toBe('entry-2');
    });
  });

  describe('listEntriesForDate', () => {
    it('should return empty array for date with no entries', async () => {
      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toEqual([]);
    });

    it('should return only entries for specified date', async () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-16T10:00:00Z');
      const entry1 = createSampleEntry('entry-1', date1);
      const entry2 = createSampleEntry('entry-2', date2);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);

      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('entry-1');
    });

    it('should return copy to prevent external mutation', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      const entries1 = await repository.listEntriesForDate('2024-01-15');
      const entries2 = await repository.listEntriesForDate('2024-01-15');

      expect(entries1).not.toBe(entries2);
      expect(entries1).toEqual(entries2);
    });
  });

  describe('updateEntry', () => {
    it('should persist updates', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      const updatedEntry = { ...entry, calories: 200, protein: 35 };
      await repository.updateEntry(dateISO, updatedEntry);

      const entries = await repository.listEntriesForDate(dateISO);
      expect(entries[0].calories).toBe(200);
      expect(entries[0].protein).toBe(35);
    });

    it('should persist updates to storage', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      const updatedEntry = { ...entry, calories: 200 };
      await repository.updateEntry(dateISO, updatedEntry);

      // Create new instance and verify update was persisted
      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate(dateISO);

      expect(entries[0].calories).toBe(200);
    });

    it('should throw error if date has no entries', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await expect(repository.updateEntry('2024-01-15', entry)).rejects.toThrow(
        'No entries found for date: 2024-01-15',
      );
    });

    it('should throw error if entry id not found', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry1 = createSampleEntry('entry-1', date);
      const entry2 = createSampleEntry('entry-2', date);

      await repository.addEntry(entry1);

      await expect(repository.updateEntry('2024-01-15', entry2)).rejects.toThrow(
        'Entry with id entry-2 not found for date: 2024-01-15',
      );
    });
  });

  describe('deleteEntry', () => {
    it('should persist deletion', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);
      await repository.deleteEntry('entry-1', new Date('2024-01-15T11:00:00Z'));

      const entries = await repository.listEntriesForDate(dateISO);
      expect(entries).toHaveLength(0);
    });

    it('should persist deletion to storage', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateISO = '2024-01-15';
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);
      await repository.deleteEntry('entry-1', new Date('2024-01-15T11:00:00Z'));

      // Create new instance and verify deletion was persisted
      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate(dateISO);

      expect(entries).toHaveLength(0);
    });

    it('should soft-delete: set deletedAt tombstone instead of removing the row', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const deletedAt = new Date('2024-01-15T11:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);
      await repository.deleteEntry('entry-1', deletedAt);

      // Row still physically exists (test-utility read bypasses the tombstone filter)...
      const allEntries = repository.getAllEntries();
      const rawEntry = allEntries.get('2024-01-15')?.find((e) => e.id === 'entry-1');
      expect(rawEntry).toBeDefined();
      expect(rawEntry?.deletedAt).toEqual(deletedAt);

      // ...but is excluded from normal reads.
      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toHaveLength(0);
    });

    it('should exclude tombstoned entries from getEntryById and listByDateRange', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);
      await repository.deleteEntry('entry-1', new Date('2024-01-15T11:00:00Z'));

      expect(await repository.getEntryById('entry-1')).toBeNull();
      expect(await repository.listByDateRange('2024-01-01', '2024-01-31')).toHaveLength(0);
    });

    it('should only delete specified entry', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry1 = createSampleEntry('entry-1', date);
      const entry2 = createSampleEntry('entry-2', date);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);
      await repository.deleteEntry('entry-1', new Date('2024-01-15T11:00:00Z'));

      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('entry-2');
    });

    it('should handle deletion of non-existent entry gracefully', async () => {
      await expect(
        repository.deleteEntry('non-existent', new Date('2024-01-15T11:00:00Z')),
      ).resolves.not.toThrow();
    });
  });

  describe('correction log', () => {
    it('should append and retrieve correction log entries keyed by entry id', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);
      await repository.addEntry(entry);

      const timestamp = new Date('2024-01-15T10:05:00Z');
      await repository.appendCorrectionLogEntry('entry-1', {
        timestamp,
        previousValues: entry,
        triggeredBy: 'user',
      });

      const log = await repository.getCorrectionLog('entry-1');
      expect(log).toHaveLength(1);
      expect(log[0].timestamp).toEqual(timestamp);
      expect(log[0].triggeredBy).toBe('user');
      expect(log[0].previousValues).toEqual(entry);
    });

    it('should accumulate multiple entries in append order and survive reload', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);
      await repository.addEntry(entry);

      await repository.appendCorrectionLogEntry('entry-1', {
        timestamp: new Date('2024-01-15T10:05:00Z'),
        previousValues: entry,
        triggeredBy: 'user',
      });
      await repository.appendCorrectionLogEntry('entry-1', {
        timestamp: new Date('2024-01-15T10:10:00Z'),
        previousValues: { ...entry, calories: 200 },
        triggeredBy: 'system',
      });

      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const log = await newRepository.getCorrectionLog('entry-1');

      expect(log).toHaveLength(2);
      expect(log[0].triggeredBy).toBe('user');
      expect(log[1].triggeredBy).toBe('system');
      expect(log[1].previousValues.calories).toBe(200);
    });

    it('should return empty array for entry with no correction log', async () => {
      expect(await repository.getCorrectionLog('never-touched')).toEqual([]);
    });
  });

  describe('date grouping stability', () => {
    it('should group by date correctly across different times', async () => {
      const morning = new Date('2024-01-15T08:00:00Z');
      const afternoon = new Date('2024-01-15T14:00:00Z');
      const evening = new Date('2024-01-15T20:00:00Z');

      const entry1 = createSampleEntry('entry-1', morning);
      const entry2 = createSampleEntry('entry-2', afternoon);
      const entry3 = createSampleEntry('entry-3', evening);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);
      await repository.addEntry(entry3);

      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toHaveLength(3);
    });

    it('should handle date boundaries correctly', async () => {
      const endOfDay = new Date('2024-01-15T23:59:59Z');
      const startOfNextDay = new Date('2024-01-16T00:00:00Z');

      const entry1 = createSampleEntry('entry-1', endOfDay);
      const entry2 = createSampleEntry('entry-2', startOfNextDay);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);

      const entries15 = await repository.listEntriesForDate('2024-01-15');
      const entries16 = await repository.listEntriesForDate('2024-01-16');

      expect(entries15).toHaveLength(1);
      expect(entries16).toHaveLength(1);
    });
  });

  describe('serialization', () => {
    it('should preserve all entry fields', async () => {
      const date = new Date('2024-01-15T10:30:45Z');
      const entry: FoodEntry = {
        id: 'entry-1',
        rawInput: '200g Salmon',
        parsedName: 'Salmon',
        quantityGrams: 200,
        calories: 412,
        protein: 50,
        carbs: 0,
        fat: 24,
        confidenceScore: 0.95,
        sourceType: 'branded',
        createdAt: date,
        explanation: 'From branded database',
        confidenceReason: 'Exact match',
        lastModifiedAt: new Date('2024-01-15T11:00:00Z'),
      };

      await repository.addEntry(entry);

      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate('2024-01-15');

      expect(entries[0]).toEqual(entry);
    });

    it('should handle optional fields', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry: FoodEntry = {
        id: 'entry-1',
        rawInput: '100g Chicken',
        parsedName: 'Chicken',
        quantityGrams: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        confidenceScore: 0.8,
        sourceType: 'cache',
        createdAt: date,
        // no explanation, confidenceReason, lastModifiedAt
      };

      await repository.addEntry(entry);

      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate('2024-01-15');

      expect(entries[0].explanation).toBeUndefined();
      expect(entries[0].confidenceReason).toBeUndefined();
      expect(entries[0].lastModifiedAt).toBeUndefined();
    });

    it('should round-trip nutritionSnapshot and foodCatalogRef when present', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry: FoodEntry = {
        id: 'entry-1',
        rawInput: '100g Chicken',
        parsedName: 'Chicken',
        quantityGrams: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        confidenceScore: 0.8,
        sourceType: 'cache',
        createdAt: date,
        nutritionSnapshot: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
        foodCatalogRef: {
          source: 'usda',
          sourceId: 'usda-171077',
          displayName: 'Chicken breast',
          confidence: 0.92,
        },
      };

      await repository.addEntry(entry);

      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate('2024-01-15');

      expect(entries[0]).toEqual(entry);
    });

    it('should deserialize pre-J-002 entries without nutritionSnapshot/foodCatalogRef', async () => {
      // Simulates data persisted before this task: no nutritionSnapshot/foodCatalogRef keys at all.
      const legacySerialized = [
        {
          id: 'entry-1',
          rawInput: '100g Chicken',
          parsedName: 'Chicken',
          quantityGrams: 100,
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
          confidenceScore: 0.8,
          sourceType: 'cache',
          createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        },
      ];
      await keyValueStore.set('nutrition:entries', JSON.stringify(legacySerialized));

      const entries = await repository.listEntriesForDate('2024-01-15');

      expect(entries).toHaveLength(1);
      expect(entries[0].calories).toBe(165);
      expect(entries[0].nutritionSnapshot).toBeUndefined();
      expect(entries[0].foodCatalogRef).toBeUndefined();
    });

    it('should handle corrupted storage gracefully', async () => {
      await keyValueStore.set('nutrition:entries', 'invalid json{');

      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toEqual([]);
    });

    it('should recover from corrupted storage by overwriting', async () => {
      await keyValueStore.set('nutrition:entries', 'invalid json{');

      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      // Verify storage was overwritten with valid data
      const storedData = await keyValueStore.get('nutrition:entries');
      expect(() => JSON.parse(storedData!)).not.toThrow();
    });
  });

  describe('lazy loading', () => {
    it('should load from storage only once', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);

      // Spy on get method
      const getSpy = jest.spyOn(keyValueStore, 'get');

      // Multiple operations should only load once
      await repository.listEntriesForDate('2024-01-15');
      await repository.listEntriesForDate('2024-01-16');

      // Should not call get again after initial load
      expect(getSpy).not.toHaveBeenCalled();

      getSpy.mockRestore();
    });
  });

  describe('clear (test utility)', () => {
    it('should clear all entries', async () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-16T10:00:00Z');
      const entry1 = createSampleEntry('entry-1', date1);
      const entry2 = createSampleEntry('entry-2', date2);

      await repository.addEntry(entry1);
      await repository.addEntry(entry2);

      await repository.clearAll();
      expect(repository.getAllEntries().size).toBe(0);
      const entries1 = await repository.listEntriesForDate('2024-01-15');
      const entries2 = await repository.listEntriesForDate('2024-01-16');

      expect(entries1).toEqual([]);
      expect(entries2).toEqual([]);
    });

    it('should persist clear to storage', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const entry = createSampleEntry('entry-1', date);

      await repository.addEntry(entry);
      await repository.clearAll();

      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate('2024-01-15');

      expect(entries).toEqual([]);
    });
  });
});
