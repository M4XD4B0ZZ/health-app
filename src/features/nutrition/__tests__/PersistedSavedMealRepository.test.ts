import { PersistedSavedMealRepository } from '../infrastructure/repositories/PersistedSavedMealRepository';
import { FakeKeyValueStore } from '../infrastructure/storage/FakeKeyValueStore';
import { SavedMealTemplate } from '../domain/models/SavedMealTypes';

describe('PersistedSavedMealRepository (SM-004)', () => {
  let keyValueStore: FakeKeyValueStore;
  let repository: PersistedSavedMealRepository;

  beforeEach(() => {
    keyValueStore = new FakeKeyValueStore();
    repository = new PersistedSavedMealRepository(keyValueStore);
  });

  const createSampleTemplate = (id: string): SavedMealTemplate => ({
    id,
    name: 'Protein Bowl',
    items: [
      {
        parsedName: 'chicken',
        quantityGrams: 200,
        foodCatalogRef: {
          source: 'off',
          sourceId: 'off-123',
          displayName: 'Chicken Breast',
          confidence: 0.9,
        },
        per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      },
      { parsedName: 'rice', quantityGrams: 150 },
    ],
    createdAt: new Date('2024-01-10T10:00:00Z'),
    updatedAt: new Date('2024-01-10T10:00:00Z'),
  });

  describe('create/list/getById', () => {
    it('persists a template and allows retrieval by id', async () => {
      const template = createSampleTemplate('t1');

      await repository.create(template);

      const found = await repository.getById('t1');
      expect(found).toEqual(template);
    });

    it('lists all persisted templates', async () => {
      await repository.create(createSampleTemplate('t1'));
      await repository.create({ ...createSampleTemplate('t2'), name: 'Snack' });

      const all = await repository.list();
      expect(all).toHaveLength(2);
      expect(all.map((t) => t.name).sort()).toEqual(['Protein Bowl', 'Snack']);
    });

    it('returns null for an unknown id', async () => {
      expect(await repository.getById('does-not-exist')).toBeNull();
    });

    it('writes to the underlying KeyValueStore', async () => {
      await repository.create(createSampleTemplate('t1'));

      const stored = await keyValueStore.get('nutrition:savedMeals');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('t1');
    });
  });

  describe('durability across instances', () => {
    it('reloads templates (incl. foodCatalogRef/per100g on items) from storage in a new instance', async () => {
      const template = createSampleTemplate('t1');
      await repository.create(template);

      const reloaded = new PersistedSavedMealRepository(keyValueStore);
      const found = await reloaded.getById('t1');

      expect(found).toEqual(template);
      expect(found?.items[0].foodCatalogRef).toEqual(template.items[0].foodCatalogRef);
      expect(found?.items[0].per100g).toEqual(template.items[0].per100g);
      expect(found?.items[1].foodCatalogRef).toBeUndefined();
      expect(found?.items[1].per100g).toBeUndefined();
    });

    it('reflects deletes across instances', async () => {
      await repository.create(createSampleTemplate('t1'));
      await repository.delete('t1', new Date('2024-02-01T00:00:00Z'));

      const reloaded = new PersistedSavedMealRepository(keyValueStore);
      expect(await reloaded.getById('t1')).toBeNull();
    });
  });

  describe('update', () => {
    it('overwrites an existing template', async () => {
      await repository.create(createSampleTemplate('t1'));

      const updated = { ...createSampleTemplate('t1'), name: 'Renamed' };
      await repository.update(updated);

      expect(await repository.getById('t1')).toEqual(updated);
    });

    it('throws for an unknown id', async () => {
      await expect(repository.update(createSampleTemplate('unknown'))).rejects.toThrow(
        'SavedMealTemplate with id unknown not found',
      );
    });
  });

  describe('delete (ACC-002: soft-delete)', () => {
    it('excludes the template from getById after delete', async () => {
      await repository.create(createSampleTemplate('t1'));
      await repository.delete('t1', new Date('2024-02-01T00:00:00Z'));

      expect(await repository.getById('t1')).toBeNull();
    });

    it('is a no-op for an unknown id', async () => {
      await expect(
        repository.delete('does-not-exist', new Date('2024-02-01T00:00:00Z')),
      ).resolves.toBeUndefined();
    });

    it('sets the deletedAt tombstone instead of physically removing the record', async () => {
      await repository.create(createSampleTemplate('t1'));
      const deletedAt = new Date('2024-02-01T00:00:00Z');
      await repository.delete('t1', deletedAt);

      const tombstoned = await repository.getByIdIncludingDeleted('t1');
      expect(tombstoned).not.toBeNull();
      expect(tombstoned?.deletedAt).toEqual(deletedAt);
      // SavedMealItem records stay associated with the tombstoned parent, not destroyed.
      expect(tombstoned?.items).toEqual(createSampleTemplate('t1').items);
    });

    it('excludes soft-deleted templates from list() while listIncludingDeleted() still returns them', async () => {
      await repository.create(createSampleTemplate('t1'));
      await repository.create({ ...createSampleTemplate('t2'), name: 'Snack' });
      await repository.delete('t1', new Date('2024-02-01T00:00:00Z'));

      expect((await repository.list()).map((t) => t.id)).toEqual(['t2']);
      expect((await repository.listIncludingDeleted()).map((t) => t.id).sort()).toEqual([
        't1',
        't2',
      ]);
    });

    it('is idempotent: a repeated delete does not overwrite the original tombstone timestamp', async () => {
      await repository.create(createSampleTemplate('t1'));
      const firstDeletedAt = new Date('2024-02-01T00:00:00Z');
      await repository.delete('t1', firstDeletedAt);

      const secondDeletedAt = new Date('2024-03-01T00:00:00Z');
      await repository.delete('t1', secondDeletedAt);

      const tombstoned = await repository.getByIdIncludingDeleted('t1');
      expect(tombstoned?.deletedAt).toEqual(firstDeletedAt);
    });

    it('persists the tombstone durably across repository instances', async () => {
      await repository.create(createSampleTemplate('t1'));
      const deletedAt = new Date('2024-02-01T00:00:00Z');
      await repository.delete('t1', deletedAt);

      const reloaded = new PersistedSavedMealRepository(keyValueStore);
      expect(await reloaded.getById('t1')).toBeNull();
      expect((await reloaded.getByIdIncludingDeleted('t1'))?.deletedAt).toEqual(deletedAt);
    });
  });

  describe('migration / backward compatibility (ACC-002)', () => {
    it('defaults pre-existing records (no deletedAt field in storage) to active', async () => {
      const legacySerialized = [
        {
          id: 't1',
          name: 'Legacy Template',
          items: [{ parsedName: 'rice', quantityGrams: 150 }],
          createdAt: '2024-01-10T10:00:00.000Z',
          updatedAt: '2024-01-10T10:00:00.000Z',
          // no `deletedAt` key at all — this is exactly what every record written before
          // ACC-002 looks like in storage.
        },
      ];
      await keyValueStore.set('nutrition:savedMeals', JSON.stringify(legacySerialized));

      const migrated = new PersistedSavedMealRepository(keyValueStore);
      const found = await migrated.getById('t1');
      expect(found).not.toBeNull();
      expect(found?.deletedAt).toBeUndefined();
      expect((await migrated.list()).map((t) => t.id)).toEqual(['t1']);
    });

    it('handles an empty/missing store without error (empty-database migration)', async () => {
      const migrated = new PersistedSavedMealRepository(keyValueStore);
      expect(await migrated.list()).toEqual([]);
      expect(await migrated.listIncludingDeleted()).toEqual([]);
    });
  });
});
