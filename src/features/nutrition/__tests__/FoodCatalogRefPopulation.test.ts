import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { LogMealFromRawInputUseCase } from '../application/usecases/LogMealFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemoryFoodCatalog } from '../infrastructure/catalog/InMemoryFoodCatalog';
import { InMemoryFoodAliasRepository } from '../infrastructure/catalog/InMemoryFoodAliasRepository';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';
import { FakeAiMealParser } from '../infrastructure/ai/FakeAiMealParser';
import { Clock } from '../application/ports/Clock';
import { MockResolverBuilder } from './helpers/MockResolverBuilder';

/**
 * J-004: Food Catalog Reference Population.
 * foodCatalogRef must be populated whenever the resolver actually produced a catalog
 * match, and must stay unset when the log succeeded through a non-catalog data source.
 * Macro values (calories/protein/carbs/fat) must be byte-identical to pre-J-004 behavior.
 */
describe('Food Catalog Reference Population (J-004)', () => {
  const clock: Clock = {
    now: () => new Date('2026-02-15T12:00:00Z'),
    todayISO: () => '2026-02-15',
  };

  describe('LogFoodFromRawInputUseCase', () => {
    it('populates foodCatalogRef from a resolver match without changing macros', async () => {
      const repository = new InMemoryFoodEntryRepository();
      const mockFoodCatalog = { getById: async () => null, searchByName: async () => null };
      const mockResolver = MockResolverBuilder.createHappyPathResolver();

      const useCase = new LogFoodFromRawInputUseCase(
        repository,
        clock,
        new TestIdGenerator(),
        new DeterministicFoodParser(),
        mockFoodCatalog as any,
        undefined,
        undefined,
        undefined,
        mockResolver,
      );

      const entry = await useCase.execute({
        rawText: '200g chicken',
        rawInput: '200g chicken',
      });

      // Macros unchanged from pre-J-004 behavior (165 kcal/100g * 200g).
      expect(entry.calories).toBe(330);
      expect(entry.protein).toBe(62);

      expect(entry.foodCatalogRef).toBeDefined();
      expect(entry.foodCatalogRef?.source).toBe('usda');
      expect(entry.foodCatalogRef?.sourceId).toBe('mock-chicken breast');
      expect(entry.foodCatalogRef?.displayName).toBe('Chicken Breast');
      expect(entry.foodCatalogRef?.confidence).toBe(0.85);
    });

    it('populates foodCatalogRef with confidence 0.8 on a cache-hit (alias) match', async () => {
      const repository = new InMemoryFoodEntryRepository();
      const foodCatalog = new InMemoryFoodCatalog();
      const aliasRepository = new InMemoryFoodAliasRepository();
      await aliasRepository.saveAlias('banana', 'banana');
      const mockResolver = MockResolverBuilder.createFailurePathResolver();

      const useCase = new LogFoodFromRawInputUseCase(
        repository,
        clock,
        new TestIdGenerator(),
        new DeterministicFoodParser(),
        foodCatalog,
        aliasRepository,
        undefined,
        undefined,
        mockResolver,
      );

      const entry = await useCase.execute({
        rawText: '100g banana',
        rawInput: '100g banana',
      });

      expect(entry.calories).toBe(89);
      expect(entry.sourceType).toBe('cache');
      expect(entry.foodCatalogRef).toEqual({
        source: 'user',
        sourceId: 'banana',
        displayName: 'Banana',
        confidence: 0.8,
      });
    });

    it('does not persist an entry when no catalog match is found (Zero-Macro Blocker)', async () => {
      const repository = new InMemoryFoodEntryRepository();
      const mockFoodCatalog = { getById: async () => null, searchByName: async () => null };
      const mockResolver = MockResolverBuilder.createFailurePathResolver();

      const useCase = new LogFoodFromRawInputUseCase(
        repository,
        clock,
        new TestIdGenerator(),
        new DeterministicFoodParser(),
        mockFoodCatalog as any,
        undefined,
        undefined,
        undefined,
        mockResolver,
      );

      await expect(
        useCase.execute({ rawText: 'unknown food', rawInput: 'unknown food' }),
      ).rejects.toThrow('RESOLVER_FAILED_OR_NO_MACROS');

      expect(await repository.listEntriesForDate('2026-02-15')).toHaveLength(0);
    });
  });

  describe('LogMealFromRawInputUseCase', () => {
    it('populates foodCatalogRef from a resolver match without changing macros', async () => {
      const repository = new InMemoryFoodEntryRepository();
      const mockFoodCatalog = { getById: async () => null, searchByName: async () => null };

      const useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        new TestIdGenerator(),
        new DeterministicFoodParser(),
        mockFoodCatalog as any,
        undefined,
        undefined,
        undefined,
        new FakeAiMealParser(),
        MockResolverBuilder.createHappyPathResolver(),
      );

      await useCase.execute('250g chicken');

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].calories).toBeCloseTo(412.5, 1);
      expect(entries[0].foodCatalogRef).toBeDefined();
      expect(entries[0].foodCatalogRef?.source).toBe('usda');
      expect(entries[0].foodCatalogRef?.displayName).toBe('Chicken Breast');
    });

    // Note: LogMealFromRawInputUseCase's own NutritionLookup fallback (item processed via
    // its private per-item method, not delegated to LogFoodFromRawInputUseCase) is gated on
    // `!this.foodCatalog`, but every multi-item input reaching that method first goes through
    // deterministic splitMultiItemInput(), which delegates each split item to
    // LogFoodFromRawInputUseCase — and that use case requires a resolver, whose own
    // foodCatalog-undefined path always zero-macro-blocks (see the LogFoodFromRawInputUseCase
    // "does not persist" test above). container.ts also always wires a real foodCatalog. So
    // this fallback is unreachable via the public API in the current architecture; the
    // Zero-Macro-Blocker test above is the concrete proof that "no catalog match" can never
    // silently produce a persisted entry with macros but no foodCatalogRef.
  });
});
