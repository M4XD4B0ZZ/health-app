import { PersistedEffectiveGoalsRepository } from '../infrastructure/PersistedEffectiveGoalsRepository';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';
import { EffectiveGoals } from '../domain/models/GoalsTypes';

describe('PersistedEffectiveGoalsRepository (DI-006)', () => {
  const fixtureManualGoals: EffectiveGoals = {
    mode: 'manual',
    goals: { calories: 2200, protein: 140, carbs: 220, fat: 70 },
  };

  const fixtureSuggestedGoals: EffectiveGoals = {
    mode: 'suggested',
    goals: { calories: 2400, protein: 150, carbs: 260, fat: 75 },
    suggestionSnapshot: {
      goals: { calories: 2400, protein: 150, carbs: 260, fat: 75 },
      rationale: 'Balanced macro distribution based on TDEE of 2400 kcal/day',
      macroStrategy: 'balanced',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  };

  it('returns null when nothing is stored', async () => {
    const repository = new PersistedEffectiveGoalsRepository(new FakeKeyValueStore());

    expect(await repository.get()).toBeNull();
  });

  it('persists and retrieves manual goals', async () => {
    const repository = new PersistedEffectiveGoalsRepository(new FakeKeyValueStore());

    await repository.upsert(fixtureManualGoals);

    expect(await repository.get()).toEqual(fixtureManualGoals);
  });

  it('persists and retrieves suggested goals, including the suggestion snapshot', async () => {
    const repository = new PersistedEffectiveGoalsRepository(new FakeKeyValueStore());

    await repository.upsert(fixtureSuggestedGoals);

    expect(await repository.get()).toEqual(fixtureSuggestedGoals);
  });

  it('survives a simulated app restart (durability)', async () => {
    const keyValueStore = new FakeKeyValueStore();
    const repository = new PersistedEffectiveGoalsRepository(keyValueStore);
    await repository.upsert(fixtureManualGoals);

    const reloaded = new PersistedEffectiveGoalsRepository(keyValueStore);

    expect(await reloaded.get()).toEqual(fixtureManualGoals);
  });

  it('returns null and logs, rather than throwing, on corrupt stored data', async () => {
    const keyValueStore = new FakeKeyValueStore();
    await keyValueStore.set('goals:effectiveGoals', 'not valid json{');
    const repository = new PersistedEffectiveGoalsRepository(keyValueStore);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(await repository.get()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
