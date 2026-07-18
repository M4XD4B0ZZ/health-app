import { PersistedMetabolismProfileRepository } from '../infrastructure/PersistedMetabolismProfileRepository';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';
import { MetabolismProfile } from '../domain/models/MetabolismTypes';

describe('PersistedMetabolismProfileRepository (DI-006)', () => {
  // ACC-003: a canonical UUIDv4 fixture id — this file is about serialization/durability, not
  // the legacy-id migration (which has its own dedicated test file), so the id must not
  // itself trigger a rewrite on `get()`.
  const fixtureProfile: MetabolismProfile = {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    weightKg: 80,
    heightCm: 180,
    ageYears: 30,
    sex: 'male',
    activityLevel: 'moderate',
  };

  it('returns null when nothing is stored', async () => {
    const repository = new PersistedMetabolismProfileRepository(new FakeKeyValueStore());

    expect(await repository.get()).toBeNull();
  });

  it('persists and retrieves a profile', async () => {
    const repository = new PersistedMetabolismProfileRepository(new FakeKeyValueStore());

    await repository.upsert(fixtureProfile);

    expect(await repository.get()).toEqual(fixtureProfile);
  });

  it('survives a simulated app restart (durability)', async () => {
    const keyValueStore = new FakeKeyValueStore();
    const repository = new PersistedMetabolismProfileRepository(keyValueStore);
    await repository.upsert(fixtureProfile);

    const reloaded = new PersistedMetabolismProfileRepository(keyValueStore);

    expect(await reloaded.get()).toEqual(fixtureProfile);
  });

  it('returns null and logs, rather than throwing, on corrupt stored data', async () => {
    const keyValueStore = new FakeKeyValueStore();
    await keyValueStore.set('goals:metabolismProfile', 'not valid json{');
    const repository = new PersistedMetabolismProfileRepository(keyValueStore);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(await repository.get()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  describe('ACC-003: legacy id migration', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('migrates a legacy MetabolismProfile id to UUIDv4 on get()', async () => {
      const keyValueStore = new FakeKeyValueStore();
      await keyValueStore.set(
        'goals:metabolismProfile',
        JSON.stringify({ ...fixtureProfile, id: 'legacy-profile-1' }),
      );

      const repository = new PersistedMetabolismProfileRepository(keyValueStore);
      const profile = await repository.get();

      expect(profile?.id).not.toBe('legacy-profile-1');
      expect(profile?.id).toMatch(UUID_REGEX);
      // Non-id fields are preserved unchanged.
      expect(profile?.weightKg).toBe(80);
      expect(profile?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('leaves an already-valid UUIDv4 profile id unchanged', async () => {
      const repository = new PersistedMetabolismProfileRepository(new FakeKeyValueStore());
      await repository.upsert(fixtureProfile);

      const profile = await repository.get();
      expect(profile?.id).toBe(fixtureProfile.id);
    });

    it('is idempotent: calling get() twice on the same legacy-seeded store changes nothing further after the first migration', async () => {
      const keyValueStore = new FakeKeyValueStore();
      await keyValueStore.set(
        'goals:metabolismProfile',
        JSON.stringify({ ...fixtureProfile, id: 'legacy-profile-1' }),
      );

      const repository = new PersistedMetabolismProfileRepository(keyValueStore);
      const first = await repository.get();
      const second = await repository.get();

      expect(second?.id).toBe(first?.id); // same id, not re-rolled
    });

    it('preserves the migrated id across a simulated app restart', async () => {
      const keyValueStore = new FakeKeyValueStore();
      await keyValueStore.set(
        'goals:metabolismProfile',
        JSON.stringify({ ...fixtureProfile, id: 'legacy-profile-1' }),
      );

      const before = new PersistedMetabolismProfileRepository(keyValueStore);
      const profileBefore = await before.get();

      const afterRestart = new PersistedMetabolismProfileRepository(keyValueStore);
      const profileAfter = await afterRestart.get();

      expect(profileAfter?.id).toBe(profileBefore?.id);
    });
  });

  describe('ACC-004: local sync-readiness fields', () => {
    it('round-trips revision/userId/syncStatus when set', async () => {
      const profileWithSyncFields: MetabolismProfile = {
        ...fixtureProfile,
        revision: 1,
        userId: 'user-123',
        syncStatus: 'synced',
      };
      const repository = new PersistedMetabolismProfileRepository(new FakeKeyValueStore());

      await repository.upsert(profileWithSyncFields);

      expect(await repository.get()).toEqual(profileWithSyncFields);
    });

    it('leaves them undefined for a pre-ACC-004 record with no such fields at all', async () => {
      const repository = new PersistedMetabolismProfileRepository(new FakeKeyValueStore());
      await repository.upsert(fixtureProfile);

      const loaded = await repository.get();
      expect(loaded?.revision).toBeUndefined();
      expect(loaded?.userId).toBeUndefined();
      expect(loaded?.syncStatus).toBeUndefined();
    });
  });
});
