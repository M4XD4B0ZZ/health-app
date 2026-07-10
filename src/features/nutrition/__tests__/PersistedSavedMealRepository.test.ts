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
      await repository.delete('t1');

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

  describe('delete', () => {
    it('removes a template by id', async () => {
      await repository.create(createSampleTemplate('t1'));
      await repository.delete('t1');

      expect(await repository.getById('t1')).toBeNull();
    });

    it('is a no-op for an unknown id', async () => {
      await expect(repository.delete('does-not-exist')).resolves.toBeUndefined();
    });
  });
});
