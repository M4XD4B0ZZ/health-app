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
      // ACC-003: a canonical UUIDv4 fixture id — this test is about reload-durability, not
      // the legacy-id migration (which has its own dedicated test file), so the id must not
      // itself trigger a rewrite on the new instance's load.
      const entry = createSampleEntry('11111111-1111-4111-8111-111111111111', date);

      await repository.addEntry(entry);

      // Create new repository instance with same storage
      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await newRepository.listEntriesForDate(dateISO);

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('11111111-1111-4111-8111-111111111111');
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
      // ACC-003: a canonical UUIDv4 fixture id (see note in 'addEntry' above).
      const entryId = '22222222-2222-4222-8222-222222222222';
      const entry = createSampleEntry(entryId, date);
      await repository.addEntry(entry);

      await repository.appendCorrectionLogEntry(entryId, {
        timestamp: new Date('2024-01-15T10:05:00Z'),
        previousValues: entry,
        triggeredBy: 'user',
      });
      await repository.appendCorrectionLogEntry(entryId, {
        timestamp: new Date('2024-01-15T10:10:00Z'),
        previousValues: { ...entry, calories: 200 },
        triggeredBy: 'system',
      });

      const newRepository = new PersistedFoodEntryRepository(keyValueStore);
      const log = await newRepository.getCorrectionLog(entryId);

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
        // ACC-003: a canonical UUIDv4 fixture id (see note in 'addEntry' above).
        id: '33333333-3333-4333-8333-333333333333',
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
        // ACC-003: a canonical UUIDv4 fixture id (see note in 'addEntry' above).
        id: '44444444-4444-4444-8444-444444444444',
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

  describe('ACC-003: legacy id migration', () => {
    const ACC003_MIGRATION_STATE_KEY = 'nutrition:acc003IdMigrationState';
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('migrates legacy Journal record ids to UUIDv4 on load', async () => {
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-entry-1',
            rawInput: '100g Chicken',
            parsedName: 'Chicken',
            quantityGrams: 100,
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            confidenceScore: 0.8,
            sourceType: 'cache',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const [entry] = await migrated.listEntriesForDate('2024-01-15');

      expect(entry.id).not.toBe('legacy-entry-1');
      expect(entry.id).toMatch(UUID_REGEX);
      // Non-id fields are untouched.
      expect(entry.rawInput).toBe('100g Chicken');
      expect(entry.calories).toBe(165);
    });

    it('leaves an already-valid UUIDv4 record id unchanged', async () => {
      const validId = '11111111-1111-4111-8111-111111111111';
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: validId,
            rawInput: '100g Chicken',
            parsedName: 'Chicken',
            quantityGrams: 100,
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            confidenceScore: 0.8,
            sourceType: 'cache',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const [entry] = await migrated.listEntriesForDate('2024-01-15');

      expect(entry.id).toBe(validId);
    });

    it('rewrites Correction Log references (entryId key + embedded previousValues.id) to the migrated id', async () => {
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-entry-1',
            rawInput: '150g Toast',
            parsedName: 'Toast',
            quantityGrams: 150,
            calories: 400,
            protein: 10,
            carbs: 70,
            fat: 5,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );
      await keyValueStore.set(
        'nutrition:correctionLog',
        JSON.stringify({
          'legacy-entry-1': [
            {
              timestamp: '2024-01-15T11:00:00.000Z',
              previousValues: {
                id: 'legacy-entry-1',
                rawInput: '150g Toast',
                parsedName: 'Toast',
                quantityGrams: 150,
                calories: 400,
                protein: 10,
                carbs: 70,
                fat: 5,
                confidenceScore: 0.6,
                sourceType: 'generic',
                createdAt: '2024-01-15T10:00:00.000Z',
              },
              triggeredBy: 'user',
            },
          ],
        }),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const [entry] = await migrated.listEntriesForDate('2024-01-15');
      const log = await migrated.getCorrectionLog(entry.id);

      expect(log).toHaveLength(1);
      expect(log[0].previousValues.id).toBe(entry.id);
      // The old key is gone — the log is only reachable via the migrated id.
      expect(await migrated.getCorrectionLog('legacy-entry-1')).toEqual([]);
    });

    it('migrates soft-deleted (tombstoned) Journal entries without resurrecting them', async () => {
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-deleted-entry',
            rawInput: '1 Ei',
            parsedName: 'Ei',
            quantityGrams: 60,
            calories: 82,
            protein: 7,
            carbs: 1,
            fat: 5,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
            deletedAt: '2024-01-15T12:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);

      // Still excluded from active reads (not resurrected).
      expect(await migrated.listEntriesForDate('2024-01-15')).toEqual([]);
      expect(await migrated.getEntryById('legacy-deleted-entry')).toBeNull();

      // But durably present, with a migrated id and its tombstone intact.
      const raw = [...migrated.getAllEntries().values()].flat();
      expect(raw).toHaveLength(1);
      expect(raw[0].id).not.toBe('legacy-deleted-entry');
      expect(raw[0].id).toMatch(UUID_REGEX);
      expect(raw[0].deletedAt).toBeInstanceOf(Date);
    });

    it('succeeds as a no-op on an empty store', async () => {
      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      expect(await migrated.listEntriesForDate('2024-01-15')).toEqual([]);
      expect(await keyValueStore.get(ACC003_MIGRATION_STATE_KEY)).toBeNull();
    });

    it('succeeds when the Correction Log store key is entirely missing', async () => {
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-entry-only',
            rawInput: '100g Chicken',
            parsedName: 'Chicken',
            quantityGrams: 100,
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            confidenceScore: 0.8,
            sourceType: 'cache',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );
      // No 'nutrition:correctionLog' key set at all.

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const [entry] = await migrated.listEntriesForDate('2024-01-15');
      expect(entry.id).toMatch(UUID_REGEX);
      expect(await migrated.getCorrectionLog(entry.id)).toEqual([]);
    });

    it('migrates a mix of legacy and already-migrated ids correctly, touching only the legacy ones', async () => {
      const alreadyValid = '22222222-2222-4222-8222-222222222222';
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-a',
            rawInput: '1',
            parsedName: 'a',
            quantityGrams: 100,
            calories: 100,
            protein: 1,
            carbs: 1,
            fat: 1,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
          {
            id: alreadyValid,
            rawInput: '2',
            parsedName: 'b',
            quantityGrams: 100,
            calories: 200,
            protein: 2,
            carbs: 2,
            fat: 2,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await migrated.listEntriesForDate('2024-01-15');

      const migratedA = entries.find((e) => e.parsedName === 'a')!;
      const untouchedB = entries.find((e) => e.parsedName === 'b')!;
      expect(migratedA.id).toMatch(UUID_REGEX);
      expect(migratedA.id).not.toBe('legacy-a');
      expect(untouchedB.id).toBe(alreadyValid);
    });

    it('is idempotent: re-running migration (a second fresh instance) changes nothing further', async () => {
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-entry-1',
            rawInput: '100g Chicken',
            parsedName: 'Chicken',
            quantityGrams: 100,
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            confidenceScore: 0.8,
            sourceType: 'cache',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );

      const first = new PersistedFoodEntryRepository(keyValueStore);
      const [firstEntry] = await first.listEntriesForDate('2024-01-15');
      const migratedId = firstEntry.id;

      const second = new PersistedFoodEntryRepository(keyValueStore);
      const [secondEntry] = await second.listEntriesForDate('2024-01-15');

      expect(secondEntry.id).toBe(migratedId); // same id, not re-rolled
      expect(await keyValueStore.get(ACC003_MIGRATION_STATE_KEY)).toBeNull();
    });

    it('preserves the migrated id across a simulated app restart', async () => {
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'legacy-entry-1',
            rawInput: '100g Chicken',
            parsedName: 'Chicken',
            quantityGrams: 100,
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            confidenceScore: 0.8,
            sourceType: 'cache',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );

      const before = new PersistedFoodEntryRepository(keyValueStore);
      const [entryBefore] = await before.listEntriesForDate('2024-01-15');

      const afterRestart = new PersistedFoodEntryRepository(keyValueStore);
      const [entryAfter] = await afterRestart.listEntriesForDate('2024-01-15');

      expect(entryAfter.id).toBe(entryBefore.id);
    });

    it('resumes an interrupted migration using the exact persisted mapping, without regenerating ids', async () => {
      const migratedId = '33333333-3333-4333-8333-333333333333';

      // Simulates the state right after a crash between the two writes: `nutrition:entries`
      // already reflects the migrated id (that write completed), but
      // `nutrition:correctionLog` was never rewritten, and the durable migration-state key
      // still says so.
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: migratedId,
            rawInput: '150g Toast',
            parsedName: 'Toast',
            quantityGrams: 150,
            calories: 400,
            protein: 10,
            carbs: 70,
            fat: 5,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );
      await keyValueStore.set(
        'nutrition:correctionLog',
        JSON.stringify({
          'legacy-entry-1': [
            {
              timestamp: '2024-01-15T11:00:00.000Z',
              previousValues: {
                id: 'legacy-entry-1',
                rawInput: '150g Toast',
                parsedName: 'Toast',
                quantityGrams: 150,
                calories: 400,
                protein: 10,
                carbs: 70,
                fat: 5,
                confidenceScore: 0.6,
                sourceType: 'generic',
                createdAt: '2024-01-15T10:00:00.000Z',
              },
              triggeredBy: 'user',
            },
          ],
        }),
      );
      await keyValueStore.set(
        ACC003_MIGRATION_STATE_KEY,
        JSON.stringify({
          version: 1,
          idMap: { 'legacy-entry-1': migratedId },
          duplicateLegacyIds: [],
          migratedEntryIds: [migratedId],
          entriesMigrated: true,
          correctionLogMigrated: false,
        }),
      );

      const resumed = new PersistedFoodEntryRepository(keyValueStore);
      const [entry] = await resumed.listEntriesForDate('2024-01-15');

      // Resumption reused the persisted mapping — the id was not re-rolled.
      expect(entry.id).toBe(migratedId);
      const log = await resumed.getCorrectionLog(migratedId);
      expect(log).toHaveLength(1);
      expect(log[0].previousValues.id).toBe(migratedId);
      // Cleanup finished — no leftover migration state.
      expect(await keyValueStore.get(ACC003_MIGRATION_STATE_KEY)).toBeNull();
    });

    it('cleans up a leftover migration-state key from a run that completed both writes but was interrupted before cleanup', async () => {
      const migratedId = '44444444-4444-4444-8444-444444444444';
      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: migratedId,
            rawInput: '100g Chicken',
            parsedName: 'Chicken',
            quantityGrams: 100,
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            confidenceScore: 0.8,
            sourceType: 'cache',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );
      await keyValueStore.set(
        ACC003_MIGRATION_STATE_KEY,
        JSON.stringify({
          version: 1,
          idMap: { 'legacy-entry-1': migratedId },
          entriesMigrated: true,
          correctionLogMigrated: true,
        }),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const [entry] = await migrated.listEntriesForDate('2024-01-15');

      expect(entry.id).toBe(migratedId); // untouched — already fully migrated
      expect(await keyValueStore.get(ACC003_MIGRATION_STATE_KEY)).toBeNull();
    });

    it('handles duplicate legacy ids safely: each occurrence gets its own new id, and the ambiguous Correction Log reference is left unrewritten rather than guessed at', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await keyValueStore.set(
        'nutrition:entries',
        JSON.stringify([
          {
            id: 'dup-legacy-id',
            rawInput: '1',
            parsedName: 'first',
            quantityGrams: 100,
            calories: 100,
            protein: 1,
            carbs: 1,
            fat: 1,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
          {
            id: 'dup-legacy-id',
            rawInput: '2',
            parsedName: 'second',
            quantityGrams: 100,
            calories: 200,
            protein: 2,
            carbs: 2,
            fat: 2,
            confidenceScore: 0.6,
            sourceType: 'generic',
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );
      await keyValueStore.set(
        'nutrition:correctionLog',
        JSON.stringify({
          'dup-legacy-id': [
            {
              timestamp: '2024-01-15T11:00:00.000Z',
              previousValues: {
                id: 'dup-legacy-id',
                rawInput: '1',
                parsedName: 'first',
                quantityGrams: 100,
                calories: 100,
                protein: 1,
                carbs: 1,
                fat: 1,
                confidenceScore: 0.6,
                sourceType: 'generic',
                createdAt: '2024-01-15T10:00:00.000Z',
              },
              triggeredBy: 'user',
            },
          ],
        }),
      );

      const migrated = new PersistedFoodEntryRepository(keyValueStore);
      const entries = await migrated.listEntriesForDate('2024-01-15');

      // Both occurrences survived, each with its own distinct new id — never collapsed or
      // silently dropped.
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toMatch(UUID_REGEX);
      expect(entries[1].id).toMatch(UUID_REGEX);
      expect(entries[0].id).not.toBe(entries[1].id);

      // The ambiguous Correction Log entry (which of the two duplicates does it belong to?)
      // is left under its original, now-dangling key rather than guessed at — fails closed,
      // preserves the data, and is reported via a diagnostic.
      expect(consoleWarnSpy).toHaveBeenCalled();
      const rawCorrectionLogJson = await keyValueStore.get('nutrition:correctionLog');
      const rawCorrectionLog = JSON.parse(rawCorrectionLogJson!);
      expect(rawCorrectionLog['dup-legacy-id']).toHaveLength(1);

      consoleWarnSpy.mockRestore();
    });
  });
});
