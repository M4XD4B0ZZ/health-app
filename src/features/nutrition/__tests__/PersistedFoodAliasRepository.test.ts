import { PersistedFoodAliasRepository } from '../infrastructure/catalog/PersistedFoodAliasRepository';
import { FakeKeyValueStore } from '../infrastructure';

describe('PersistedFoodAliasRepository', () => {
  let store: FakeKeyValueStore;
  let repository: PersistedFoodAliasRepository;

  beforeEach(() => {
    store = new FakeKeyValueStore();
    repository = new PersistedFoodAliasRepository(store);
  });

  it('should return null for unknown alias', async () => {
    const result = await repository.getCanonicalId('unknown');
    expect(result).toBeNull();
  });

  it('should save and retrieve alias', async () => {
    await repository.saveAlias('apfel', 'apple');
    const result = await repository.getCanonicalId('apfel');
    expect(result).toBe('apple');
  });

  it('should persist alias to storage', async () => {
    await repository.saveAlias('banane', 'banana');
    
    // Verify it's in storage with correct key
    const storageKey = 'alias:banane';
    const storedValue = await store.get(storageKey);
    expect(storedValue).toBe('banana');
  });

  it('should use cache for repeated reads', async () => {
    await repository.saveAlias('orange', 'orange-fruit');
    
    // First read - should fetch from storage
    const result1 = await repository.getCanonicalId('orange');
    expect(result1).toBe('orange-fruit');
    
    // Clear the storage to verify cache is used
    await store.remove('alias:orange');
    
    // Second read - should return from cache
    const result2 = await repository.getCanonicalId('orange');
    expect(result2).toBe('orange-fruit');
  });

  it('should handle multiple aliases', async () => {
    await repository.saveAlias('apfel', 'apple');
    await repository.saveAlias('birne', 'pear');
    await repository.saveAlias('kirsche', 'cherry');

    expect(await repository.getCanonicalId('apfel')).toBe('apple');
    expect(await repository.getCanonicalId('birne')).toBe('pear');
    expect(await repository.getCanonicalId('kirsche')).toBe('cherry');
  });

  it('should update existing alias', async () => {
    await repository.saveAlias('test', 'value1');
    expect(await repository.getCanonicalId('test')).toBe('value1');

    await repository.saveAlias('test', 'value2');
    expect(await repository.getCanonicalId('test')).toBe('value2');
  });

  it('should persist across repository instances', async () => {
    // First instance saves alias
    const repo1 = new PersistedFoodAliasRepository(store);
    await repo1.saveAlias('kiwi', 'kiwi-fruit');

    // Second instance should read it from storage
    const repo2 = new PersistedFoodAliasRepository(store);
    const result = await repo2.getCanonicalId('kiwi');
    expect(result).toBe('kiwi-fruit');
  });
});
