import { FoodAliasRepository } from '../../application/ports/FoodAliasRepository';
import { KeyValueStore } from '../../application/ports/KeyValueStore';

/**
 * Persistent implementation of FoodAliasRepository using KeyValueStore
 * Includes an in-memory cache to reduce storage reads
 */
export class PersistedFoodAliasRepository implements FoodAliasRepository {
  private cache: Map<string, string> = new Map();
  private readonly keyPrefix = 'alias:';

  constructor(private readonly store: KeyValueStore) {}

  private getStorageKey(normalized: string): string {
    return `${this.keyPrefix}${normalized}`;
  }

  async getCanonicalId(normalized: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    // Read from storage
    const storageKey = this.getStorageKey(normalized);
    const canonicalId = await this.store.get(storageKey);

    // Update cache
    if (canonicalId !== null) {
      this.cache.set(normalized, canonicalId);
    }

    return canonicalId;
  }

  async saveAlias(normalized: string, canonicalId: string): Promise<void> {
    // Update cache
    this.cache.set(normalized, canonicalId);

    // Persist to storage
    const storageKey = this.getStorageKey(normalized);
    await this.store.set(storageKey, canonicalId);
  }
}
