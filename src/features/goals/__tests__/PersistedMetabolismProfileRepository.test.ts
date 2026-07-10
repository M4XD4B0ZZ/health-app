import { PersistedMetabolismProfileRepository } from '../infrastructure/PersistedMetabolismProfileRepository';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';
import { MetabolismProfile } from '../domain/models/MetabolismTypes';

describe('PersistedMetabolismProfileRepository (DI-006)', () => {
  const fixtureProfile: MetabolismProfile = {
    id: 'profile-1',
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
});
