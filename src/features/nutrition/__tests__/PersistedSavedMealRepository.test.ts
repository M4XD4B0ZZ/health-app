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
      // ACC-003: a canonical UUIDv4 fixture id — this test is about reload-durability, not
      // the legacy-id migration (which has its own dedicated test file), so the id must not
      // itself trigger a rewrite on the new instance's load.
      const template = createSampleTemplate('11111111-1111-4111-8111-111111111111');
      await repository.create(template);

      const reloaded = new PersistedSavedMealRepository(keyValueStore);
      const found = await reloaded.getById('11111111-1111-4111-8111-111111111111');

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
      // ACC-003: a canonical UUIDv4 fixture id (see note in 'durability across instances'
      // above).
      const id = '22222222-2222-4222-8222-222222222222';
      await repository.create(createSampleTemplate(id));
      const deletedAt = new Date('2024-02-01T00:00:00Z');
      await repository.delete(id, deletedAt);

      const reloaded = new PersistedSavedMealRepository(keyValueStore);
      expect(await reloaded.getById(id)).toBeNull();
      expect((await reloaded.getByIdIncludingDeleted(id))?.deletedAt).toEqual(deletedAt);
    });
  });

  describe('migration / backward compatibility (ACC-002)', () => {
    it('defaults pre-existing records (no deletedAt field in storage) to active', async () => {
      // ACC-003: a canonical UUIDv4 fixture id — this test is specifically about ACC-002's
      // deletedAt-default behavior, not ACC-003's id migration (which has its own dedicated
      // test file), so the id must not itself trigger a rewrite on load.
      const id = '33333333-3333-4333-8333-333333333333';
      const legacySerialized = [
        {
          id,
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
      const found = await migrated.getById(id);
      expect(found).not.toBeNull();
      expect(found?.deletedAt).toBeUndefined();
      expect((await migrated.list()).map((t) => t.id)).toEqual([id]);
    });

    it('handles an empty/missing store without error (empty-database migration)', async () => {
      const migrated = new PersistedSavedMealRepository(keyValueStore);
      expect(await migrated.list()).toEqual([]);
      expect(await migrated.listIncludingDeleted()).toEqual([]);
    });
  });

  describe('ACC-003: legacy id migration', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('migrates a legacy SavedMealTemplate id to UUIDv4 on load', async () => {
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: 'legacy-template-1',
            name: 'Protein Bowl',
            items: [{ parsedName: 'chicken', quantityGrams: 200 }],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedSavedMealRepository(keyValueStore);
      const [template] = await migrated.list();

      expect(template.id).not.toBe('legacy-template-1');
      expect(template.id).toMatch(UUID_REGEX);
      expect(template.name).toBe('Protein Bowl');
      // SavedMealItem relationships remain intact (still embedded, unchanged).
      expect(template.items).toEqual([{ parsedName: 'chicken', quantityGrams: 200 }]);
    });

    it('leaves an already-valid UUIDv4 template id unchanged', async () => {
      const validId = '11111111-1111-4111-8111-111111111111';
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: validId,
            name: 'Protein Bowl',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedSavedMealRepository(keyValueStore);
      const [template] = await migrated.list();
      expect(template.id).toBe(validId);
    });

    it('migrates an ACC-002 tombstoned (soft-deleted) template without resurrecting it', async () => {
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: 'legacy-deleted-template',
            name: 'Old Bowl',
            items: [{ parsedName: 'rice', quantityGrams: 150 }],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
            deletedAt: '2024-01-15T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedSavedMealRepository(keyValueStore);

      // Still excluded from the active list (not resurrected).
      expect(await migrated.list()).toEqual([]);

      const [tombstoned] = await migrated.listIncludingDeleted();
      expect(tombstoned.id).not.toBe('legacy-deleted-template');
      expect(tombstoned.id).toMatch(UUID_REGEX);
      expect(tombstoned.deletedAt).toBeInstanceOf(Date);
      expect(tombstoned.items).toEqual([{ parsedName: 'rice', quantityGrams: 150 }]);
    });

    it('migrates a mix of legacy and already-migrated templates, touching only the legacy one', async () => {
      const alreadyValid = '22222222-2222-4222-8222-222222222222';
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: 'legacy-a',
            name: 'A',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
          {
            id: alreadyValid,
            name: 'B',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedSavedMealRepository(keyValueStore);
      const templates = await migrated.list();

      const migratedA = templates.find((t) => t.name === 'A')!;
      const untouchedB = templates.find((t) => t.name === 'B')!;
      expect(migratedA.id).toMatch(UUID_REGEX);
      expect(migratedA.id).not.toBe('legacy-a');
      expect(untouchedB.id).toBe(alreadyValid);
    });

    it('is idempotent: re-running migration (a second fresh instance) changes nothing further', async () => {
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: 'legacy-template-1',
            name: 'Protein Bowl',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        ]),
      );

      const first = new PersistedSavedMealRepository(keyValueStore);
      const [firstTemplate] = await first.list();
      const migratedId = firstTemplate.id;

      const second = new PersistedSavedMealRepository(keyValueStore);
      const [secondTemplate] = await second.list();

      expect(secondTemplate.id).toBe(migratedId); // same id, not re-rolled
    });

    it('preserves the migrated id across a simulated app restart', async () => {
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: 'legacy-template-1',
            name: 'Protein Bowl',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        ]),
      );

      const before = new PersistedSavedMealRepository(keyValueStore);
      const [templateBefore] = await before.list();

      const afterRestart = new PersistedSavedMealRepository(keyValueStore);
      const [templateAfter] = await afterRestart.list();

      expect(templateAfter.id).toBe(templateBefore.id);
    });

    it('never crashes on duplicate legacy template ids, and whichever record survives the (pre-existing, id-format-independent) load still gets a valid new UUIDv4', async () => {
      // Note: `PersistedSavedMealRepository` has always deserialized into a `Map<id, template>`
      // (SM-004, predating both ACC-002 and ACC-003) — two stored records sharing the same
      // legacy id already collapse onto one Map entry at *load* time, before migration ever
      // runs. This is a pre-existing characteristic of keying the in-memory store by id, not
      // something ACC-003 introduces or could fix by changing id *format* alone. What ACC-003
      // does guarantee: no crash, and the record that does survive the load still gets a
      // proper, valid UUIDv4 — verified here.
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: 'dup-legacy-id',
            name: 'First',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
          {
            id: 'dup-legacy-id',
            name: 'Second',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        ]),
      );

      const migrated = new PersistedSavedMealRepository(keyValueStore);
      const templates = await migrated.list();

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toMatch(UUID_REGEX);
      expect(templates[0].id).not.toBe('dup-legacy-id');
    });
  });

  describe('ACC-004: local sync-readiness fields', () => {
    it('round-trips revision/userId/syncStatus across a reload when set', async () => {
      const template = {
        ...createSampleTemplate('77777777-7777-4777-8777-777777777777'),
        revision: 4,
        userId: 'user-123',
        syncStatus: 'synced' as const,
      };

      await repository.create(template);

      const reloaded = new PersistedSavedMealRepository(keyValueStore);
      const found = await reloaded.getById('77777777-7777-4777-8777-777777777777');

      expect(found?.revision).toBe(4);
      expect(found?.userId).toBe('user-123');
      expect(found?.syncStatus).toBe('synced');
    });

    it('leaves them undefined for a pre-ACC-004 record with no such fields at all', async () => {
      await keyValueStore.set(
        'nutrition:savedMeals',
        JSON.stringify([
          {
            id: '88888888-8888-4888-8888-888888888888',
            name: 'Protein Bowl',
            items: [],
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
            // no revision/userId/syncStatus/deletedAt key at all — exactly what every
            // record persisted before ACC-002/ACC-004 looks like in storage.
          },
        ]),
      );

      const migrated = new PersistedSavedMealRepository(keyValueStore);
      const [template] = await migrated.list();

      expect(template.revision).toBeUndefined();
      expect(template.userId).toBeUndefined();
      expect(template.syncStatus).toBeUndefined();
    });
  });
});
