import { MetabolismProfile } from '../domain/models/MetabolismTypes';
import { MetabolismProfileRepository } from '../application/ports';
import { KeyValueStore } from '../../nutrition/application/ports/KeyValueStore';
import { isUuidV4 } from '../../../infrastructure/ids/isUuidV4';
import { generateRecordId } from '../../../infrastructure/ids/generateRecordId';

/**
 * DI-006: KeyValueStore-backed MetabolismProfileRepository, mirroring
 * PersistedSavedMealRepository's/PersistedActiveProfileRepository's pattern.
 * `MetabolismProfile`'s fields are all plain JSON-serializable primitives (no `Date`
 * objects — `createdAt`/`updatedAt` are already ISO strings), so no serialize/deserialize
 * transformation is needed beyond `JSON.stringify`/`JSON.parse`. ACC-004's optional
 * `revision`/`userId`/`syncStatus` fields round-trip through this same plain pass-through
 * automatically — no code change needed here beyond the domain model itself.
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
      const profile = JSON.parse(stored) as MetabolismProfile;
      return await this.migrateLegacyIdIfNeeded(profile);
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

  /**
   * ACC-003: one-time migration of a legacy (pre-UUIDv4) `MetabolismProfile.id` to a stable
   * UUIDv4. There is exactly one profile per install (singleton, one storage key) and nothing
   * else in local storage references it by id, so this is a single-key, single-write
   * migration — no durable temporary migration state is needed (same reasoning as
   * `PersistedSavedMealRepository`).
   */
  private async migrateLegacyIdIfNeeded(profile: MetabolismProfile): Promise<MetabolismProfile> {
    if (isUuidV4(profile.id)) {
      return profile;
    }

    const migrated: MetabolismProfile = { ...profile, id: generateRecordId() };
    await this.upsert(migrated);
    return migrated;
  }
}
