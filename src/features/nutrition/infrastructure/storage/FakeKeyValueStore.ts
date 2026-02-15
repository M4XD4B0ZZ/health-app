import { KeyValueStore } from '../../application/ports/KeyValueStore';

/**
 * In-memory implementation of KeyValueStore for testing
 */
export class FakeKeyValueStore implements KeyValueStore {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Test utility: Clear all stored values
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Test utility: Get all stored keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}
