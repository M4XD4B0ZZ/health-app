import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyValueStore } from '../../application/ports/KeyValueStore';

/**
 * AsyncStorage-based implementation of KeyValueStore
 * Prefixes all keys with "nutrition:" to avoid collisions
 */
export class AsyncStorageKeyValueStore implements KeyValueStore {
  private readonly prefix = 'nutrition:';

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.prefixKey(key));
    } catch (error) {
      console.error(`AsyncStorageKeyValueStore: Failed to get key "${key}"`, error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.prefixKey(key), value);
    } catch (error) {
      console.error(`AsyncStorageKeyValueStore: Failed to set key "${key}"`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.prefixKey(key));
    } catch (error) {
      console.error(`AsyncStorageKeyValueStore: Failed to remove key "${key}"`, error);
      throw error;
    }
  }
}
