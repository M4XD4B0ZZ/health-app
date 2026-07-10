import { EvaluationProfile } from '../domain/models';
import { EvaluationProfileRegistry } from '../application/ports/EvaluationProfileRegistry';
import { KeyValueStore } from '../../nutrition/application/ports/KeyValueStore';

/**
 * GE-003: KeyValueStore-backed EvaluationProfileRegistry (mirrors SM-004's
 * PersistedSavedMealRepository pattern). `knownProfiles` is injected rather than
 * hardcoded, so GE-004's second Preset only needs a longer array at the composition root,
 * not a change to this class. Defaults to the first known profile (Evidence-based Standard,
 * per GE-002) whenever nothing is stored, or whenever a stored id no longer matches a known
 * profile (e.g. after a profile was retired) — never throws for "nothing set yet".
 */
export class PersistedActiveProfileRepository implements EvaluationProfileRegistry {
  private static readonly STORAGE_KEY = 'evaluation:activeProfileId';

  constructor(
    private readonly keyValueStore: KeyValueStore,
    private readonly knownProfiles: EvaluationProfile[],
  ) {
    if (knownProfiles.length === 0) {
      throw new Error('PersistedActiveProfileRepository requires at least one known profile');
    }
  }

  list(): EvaluationProfile[] {
    return [...this.knownProfiles];
  }

  async getActiveProfileId(): Promise<string> {
    const stored = await this.keyValueStore.get(PersistedActiveProfileRepository.STORAGE_KEY);
    if (stored && this.knownProfiles.some((profile) => profile.id === stored)) {
      return stored;
    }
    return this.knownProfiles[0].id;
  }

  async setActiveProfileId(id: string): Promise<void> {
    if (!this.knownProfiles.some((profile) => profile.id === id)) {
      throw new Error(`Unknown EvaluationProfile id: ${id}`);
    }
    await this.keyValueStore.set(PersistedActiveProfileRepository.STORAGE_KEY, id);
  }
}
