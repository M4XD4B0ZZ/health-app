/**
 * Port: KeyValueStore
 * Simple key-value storage abstraction for persisting data.
 */
export interface KeyValueStore {
  /**
   * Retrieve a value by key
   * @returns The stored value, or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Store a value under the given key
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Remove a value by key
   */
  remove(key: string): Promise<void>;
}
