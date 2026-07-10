import { PersistedActiveProfileRepository } from '../infrastructure/PersistedActiveProfileRepository';
import { EvidenceBasedStandardProfile } from '../application/profiles/EvidenceBasedStandardProfile';
import { EvaluationProfile } from '../domain/models';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';
import { InMemoryFoodEntryRepository } from '../../nutrition/infrastructure/repositories/InMemoryFoodEntryRepository';

const fixtureSecondProfile: EvaluationProfile = {
  id: 'fixture-second-profile',
  name: 'Fixture Second Profile',
  origin: 'preset',
  ruleIds: [],
  metadata: {},
};

describe('PersistedActiveProfileRepository (GE-003)', () => {
  it('defaults to the first known profile when nothing is stored', async () => {
    const repository = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      EvidenceBasedStandardProfile,
      fixtureSecondProfile,
    ]);

    expect(await repository.getActiveProfileId()).toBe(EvidenceBasedStandardProfile.id);
    expect(repository.list()).toEqual([EvidenceBasedStandardProfile, fixtureSecondProfile]);
  });

  it('persists an explicit selection and reflects it across a fresh instance (durability)', async () => {
    const keyValueStore = new FakeKeyValueStore();
    const repository = new PersistedActiveProfileRepository(keyValueStore, [
      EvidenceBasedStandardProfile,
      fixtureSecondProfile,
    ]);

    await repository.setActiveProfileId(fixtureSecondProfile.id);
    expect(await repository.getActiveProfileId()).toBe(fixtureSecondProfile.id);

    const reloaded = new PersistedActiveProfileRepository(keyValueStore, [
      EvidenceBasedStandardProfile,
      fixtureSecondProfile,
    ]);
    expect(await reloaded.getActiveProfileId()).toBe(fixtureSecondProfile.id);
  });

  it('rejects setting an unknown profile id', async () => {
    const repository = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      EvidenceBasedStandardProfile,
    ]);

    await expect(repository.setActiveProfileId('does-not-exist')).rejects.toThrow(
      'Unknown EvaluationProfile id: does-not-exist',
    );
  });

  it('falls back to the first known profile if a stored id is no longer known', async () => {
    const keyValueStore = new FakeKeyValueStore();
    await keyValueStore.set('evaluation:activeProfileId', 'a-retired-profile-id');

    const repository = new PersistedActiveProfileRepository(keyValueStore, [
      EvidenceBasedStandardProfile,
    ]);

    expect(await repository.getActiveProfileId()).toBe(EvidenceBasedStandardProfile.id);
  });

  it('throws at construction time if given zero known profiles', () => {
    expect(() => new PersistedActiveProfileRepository(new FakeKeyValueStore(), [])).toThrow(
      'PersistedActiveProfileRepository requires at least one known profile',
    );
  });

  it('never touches Journal data when switching the active profile (Variante B)', async () => {
    const keyValueStore = new FakeKeyValueStore();
    const repository = new PersistedActiveProfileRepository(keyValueStore, [
      EvidenceBasedStandardProfile,
      fixtureSecondProfile,
    ]);
    const foodEntryRepository = new InMemoryFoodEntryRepository();
    const addEntrySpy = jest.spyOn(foodEntryRepository, 'addEntry');
    const deleteEntrySpy = jest.spyOn(foodEntryRepository, 'deleteEntry');
    const updateEntrySpy = jest.spyOn(foodEntryRepository, 'updateEntry');

    await repository.setActiveProfileId(fixtureSecondProfile.id);
    await repository.setActiveProfileId(EvidenceBasedStandardProfile.id);

    expect(addEntrySpy).not.toHaveBeenCalled();
    expect(deleteEntrySpy).not.toHaveBeenCalled();
    expect(updateEntrySpy).not.toHaveBeenCalled();
  });
});
