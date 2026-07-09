import { LogMealFromRawInputUseCase } from '../application/usecases/LogMealFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { FakeAiMealParser } from '../infrastructure/ai/FakeAiMealParser';
import { Clock } from '../application/ports/Clock';
import { FoodEntry } from '../domain/models/NutritionTypes';
import { MockResolverBuilder } from './helpers/MockResolverBuilder';
import { MultiItemSplitFailureResult } from '../application/usecases/LogMealFromRawInputUseCase';

describe('LogMealFromRawInputUseCase', () => {
  let useCase: LogMealFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;
  let clock: Clock;
  let idGenerator: TestIdGenerator;
  let parser: DeterministicFoodParser;
  let aiParser: FakeAiMealParser;
  let mockResolver: ReturnType<typeof MockResolverBuilder.createHappyPathResolver>;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    clock = {
      now: () => new Date('2026-02-15T12:00:00Z'),
      todayISO: () => '2026-02-15',
    };
    idGenerator = new TestIdGenerator();
    parser = new DeterministicFoodParser();
    aiParser = new FakeAiMealParser();
    mockResolver = MockResolverBuilder.createHappyPathResolver();
  });

  // Create a minimal mock food catalog to enable resolver usage
  const mockFoodCatalog = {
    getById: async () => null,
    searchByName: async () => null,
  };

  describe('Single-Item Fallback', () => {
    it('sollte einfachen Input über Single-Item Flow behandeln', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        MockResolverBuilder.createHappyPathResolver(), // resolver mit realistischen Makros
      );

      const entryIds = await useCase.execute('250g chicken');

      expect(entryIds).toHaveLength(1);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('chicken');
      expect(entries[0].quantityGrams).toBe(250);
    });

    it('sollte "20er nuggets" ohne Portion-Hint deterministisch blockieren', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        mockResolver, // resolver
      );

      await expect(useCase.execute('20er nuggets')).rejects.toThrow(
        'PORTION_GRAMS_REQUIRED_FOR_UNIT_INPUT reason=COUNT_WITHOUT_PORTION_HINT',
      );

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(0);
    });
  });

  describe('Deterministic Multi-Item Split', () => {
    it('sollte "2 Eier und 200g Quark" deterministisch in 2 Entries aufteilen', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        MockResolverBuilder.createHappyPathResolver(), // resolver mit realistischen Makros
      );

      const result = await useCase.execute('2 Eier und 200g Quark');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(2);

      expect(entries.map((entry) => entry.rawInput)).toEqual(['2 Eier', '200g Quark']);
      expect(entries.map((entry) => entry.parsedName)).toEqual(['eier', 'quark']);
      entries.forEach((entry: FoodEntry) => {
        expect(entry.calories).toBeGreaterThan(0);
        expect(entry.sourceType).toBe('generic');
      });
    });

    it('sollte "2 eggs and 200g quark" deterministisch in 2 Entries aufteilen', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        mockResolver, // resolver
      );

      const result = await useCase.execute('2 eggs and 200g quark');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['2 eggs', '200g quark']);
      expect(entries.map((entry) => entry.parsedName)).toEqual(['eggs', 'quark']);
    });

    it('sollte "apple, banana, skyr" deterministisch in 3 Entries aufteilen', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        mockResolver, // resolver
      );

      const result = await useCase.execute('apple, banana, skyr');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(3);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['apple', 'banana', 'skyr']);
      expect(entries.map((entry) => entry.parsedName)).toEqual(['apple', 'banana', 'skyr']);
    });

    it('sollte "apple, banana and skyr" deterministisch in 3 Entries aufteilen', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        mockResolver, // resolver
      );

      const result = await useCase.execute('apple, banana and skyr');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(3);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['apple', 'banana', 'skyr']);
    });

    it('sollte bei Teilfehlern nichts persistieren und erkannte sowie fehlgeschlagene Items zurückgeben', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        mockResolver, // resolver
      );

      const result = (await useCase.execute(
        '2 eggs and 200g quark and mysteryfood',
      )) as MultiItemSplitFailureResult;

      expect(Array.isArray(result)).toBe(false);
      expect(result.status).toBe('blocked_partial_failure');
      expect(result.recognizedItems.map((item) => item.rawText)).toEqual(['2 eggs', '200g quark']);
      expect(result.failedItems.map((item) => item.rawText)).toEqual(['mysteryfood']);
      expect(result.explanation).toContain('Nothing was saved automatically');

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(0);
    });

    it('sollte ohne AI-Parser deterministisch splitten', async () => {
      // Kein aiParser übergeben
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        undefined, // Kein AI Parser
        mockResolver, // resolver
      );

      const result = await useCase.execute('burger mit cola');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['burger', 'cola']);
    });
  });

  describe('Composite-Dish Label Handling (P1-003B)', () => {
    it('sollte bei "Obstsalat mit Apple, Banana" nur die Kinder resolven, nicht das Label', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        undefined, // kein AI-Parser nötig
        mockResolver, // resolver
      );

      const result = await useCase.execute('Obstsalat mit Apple, Banana');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['Apple', 'Banana']);
      expect(entries.some((entry) => entry.rawInput.toLowerCase() === 'obstsalat')).toBe(false);
    });

    it('sollte bei einem einzelnen "mit"-Objekt ohne Kommaliste weiterhin flach splitten', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        undefined, // kein AI-Parser nötig
        mockResolver, // resolver
      );

      const result = await useCase.execute('burger mit cola');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries.map((entry) => entry.rawInput)).toEqual(['burger', 'cola']);
    });
  });

  describe('Date Handling', () => {
    it('sollte custom dateISO korrekt verarbeiten', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        MockResolverBuilder.createHappyPathResolver(), // resolver mit realistischen Makros
      );

      await useCase.execute('burger mit cola', '2026-02-14');

      const entries = await repository.listEntriesForDate('2026-02-14');
      expect(entries).toHaveLength(2);

      const noEntriesToday = await repository.listEntriesForDate('2026-02-15');
      expect(noEntriesToday).toHaveLength(0);
    });
  });

  describe('sourceType', () => {
    it('sollte sourceType "generic" setzen wenn Resolver erfolgreich ist', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        mockFoodCatalog as any, // foodCatalog - needed to enable resolver
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser, // aiMealParser
        MockResolverBuilder.createHappyPathResolver(), // resolver mit realistischen Makros
      );

      await useCase.execute('burger mit cola');

      const entries = await repository.listEntriesForDate('2026-02-15');

      entries.forEach((entry: FoodEntry) => {
        expect(entry.sourceType).toBe('generic');
      });
    });
  });
});
