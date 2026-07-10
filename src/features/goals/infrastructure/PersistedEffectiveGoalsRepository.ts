import { EffectiveGoals } from '../domain/models/GoalsTypes';
import { EffectiveGoalsRepository } from '../application/ports';
import { KeyValueStore } from '../../nutrition/application/ports/KeyValueStore';

/**
 * DI-006: KeyValueStore-backed EffectiveGoalsRepository, mirroring
 * PersistedSavedMealRepository's/PersistedActiveProfileRepository's pattern.
 * `EffectiveGoals`'s fields are all plain JSON-serializable primitives (no `Date`
 * objects — `suggestionSnapshot.createdAt` is already an ISO string), so no serialize/
 * deserialize transformation is needed beyond `JSON.stringify`/`JSON.parse`.
 */
export class PersistedEffectiveGoalsRepository implements EffectiveGoalsRepository {
  private static readonly STORAGE_KEY = 'goals:effectiveGoals';

  constructor(private readonly keyValueStore: KeyValueStore) {}

  async get(): Promise<EffectiveGoals | null> {
    const stored = await this.keyValueStore.get(PersistedEffectiveGoalsRepository.STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as EffectiveGoals;
    } catch (error) {
      console.error('Failed to parse stored effective goals:', error);
      return null;
    }
  }

  async upsert(goals: EffectiveGoals): Promise<void> {
    await this.keyValueStore.set(
      PersistedEffectiveGoalsRepository.STORAGE_KEY,
      JSON.stringify(goals),
    );
  }
}
