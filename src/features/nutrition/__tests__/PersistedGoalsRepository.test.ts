import { PersistedGoalsRepository } from '../infrastructure/repositories/PersistedGoalsRepository';
import { FakeKeyValueStore } from '../infrastructure/storage/FakeKeyValueStore';

describe('PersistedGoalsRepository', () => {
  it('persists and loads goals', async () => {
    const store = new FakeKeyValueStore();
    const repository = new PersistedGoalsRepository(store);

    await repository.setGoals({
      caloriesTargetKcal: 2500,
      proteinTargetG: 170,
      carbsTargetG: 280,
      fatTargetG: 70,
      activityLevel: 'moderate',
      source: 'manual',
      updatedAt: new Date('2026-02-22T10:00:00Z').toISOString(),
    });

    const loaded = await repository.getGoals();
    expect(loaded).not.toBeNull();
    expect(loaded?.caloriesTargetKcal).toBe(2500);
    expect(loaded?.activityLevel).toBe('moderate');
  });
});
