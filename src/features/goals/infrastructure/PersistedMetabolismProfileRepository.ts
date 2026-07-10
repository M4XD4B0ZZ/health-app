import { MetabolismProfile } from '../domain/models/MetabolismTypes';
import { MetabolismProfileRepository } from '../application/ports';
import { KeyValueStore } from '../../nutrition/application/ports/KeyValueStore';

/**
 * DI-006: KeyValueStore-backed MetabolismProfileRepository, mirroring
 * PersistedSavedMealRepository's/PersistedActiveProfileRepository's pattern.
 * `MetabolismProfile`'s fields are all plain JSON-serializable primitives (no `Date`
 * objects — `createdAt`/`updatedAt` are already ISO strings), so no serialize/deserialize
 * transformation is needed beyond `JSON.stringify`/`JSON.parse`.
 */
export class PersistedMetabolismProfileRepository implements MetabolismProfileRepository {
  private static readonly STORAGE_KEY = 'goals:metabolismProfile';

  constructor(private readonly keyValueStore: KeyValueStore) {}

  async get(): Promise<MetabolismProfile | null> {
    const stored = await this.keyValueStore.get(PersistedMetabolismProfileRepository.STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as MetabolismProfile;
    } catch (error) {
      console.error('Failed to parse stored metabolism profile:', error);
      return null;
    }
  }

  async upsert(profile: MetabolismProfile): Promise<void> {
    await this.keyValueStore.set(
      PersistedMetabolismProfileRepository.STORAGE_KEY,
      JSON.stringify(profile),
    );
  }
}
