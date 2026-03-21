import { LogMealFromRawInputUseCase } from '../application/usecases/LogMealFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { FakeAiMealParser } from '../infrastructure/ai/FakeAiMealParser';
import { Clock } from '../application/ports/Clock';
import { FoodEntry } from '../domain/models/NutritionTypes';
import { MockResolverBuilder } from './helpers/MockResolverBuilder';

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

    it('sollte "20er nuggets" über Single-Item Flow mit Makros behandeln', async () => {
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

      const entryIds = await useCase.execute('20er nuggets');

      expect(entryIds).toHaveLength(1);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('20er nuggets');
      expect(entries[0].rawInput).toBe('20er nuggets');
      expect(entries[0].calories).toBeGreaterThan(0); // Resolver liefert Makros
      expect(entries[0].sourceType).toBe('generic'); // Resolver-Hit
    });
  });

  describe('Multi-Item AI Parsing', () => {
    it('sollte "20er nuggets mit cola und pommes" in 3 Entries aufteilen', async () => {
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

      const entryIds = await useCase.execute('20er nuggets mit cola und pommes');

      expect(entryIds).toHaveLength(3);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(3);

      // Nuggets: 20 pieces - Resolver liefert Makros auch ohne Gramm
      const nuggets = entries.find((e: FoodEntry) => e.parsedName === 'nuggets');
      expect(nuggets).toBeDefined();
      expect(nuggets!.rawInput).toBe('20x nuggets');
      expect(nuggets!.calories).toBeGreaterThan(0); // Resolver liefert Makros
      expect(nuggets!.sourceType).toBe('generic'); // Resolver-Hit

      // Cola: 400ml
      const cola = entries.find((e: FoodEntry) => e.parsedName === 'cola');
      expect(cola).toBeDefined();
      expect(cola!.rawInput).toBe('400ml cola');
      expect(cola!.quantityGrams).toBe(400); // ml → grams approximation
      expect(cola!.calories).toBeGreaterThan(0); // Resolver liefert Makros

      // Pommes: 1 portion - Resolver liefert Makros auch ohne Gramm
      const pommes = entries.find((e: FoodEntry) => e.parsedName === 'pommes');
      expect(pommes).toBeDefined();
      expect(pommes!.rawInput).toBe('1 portion pommes');
      expect(pommes!.calories).toBeGreaterThan(0); // Resolver liefert Makros
      expect(pommes!.sourceType).toBe('generic'); // Resolver-Hit
    });

    it('sollte "burger mit cola" in 2 Entries aufteilen', async () => {
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

      const entryIds = await useCase.execute('burger mit cola');

      expect(entryIds).toHaveLength(2);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(2);

      const burger = entries.find((e: FoodEntry) => e.parsedName === 'burger');
      expect(burger).toBeDefined();

      const cola = entries.find((e: FoodEntry) => e.parsedName === 'cola');
      expect(cola).toBeDefined();
      expect(cola!.quantityGrams).toBe(400); // Default für Getränke
    });

    it('sollte AI explanation in Entries aufnehmen', async () => {
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

      await useCase.execute('20er nuggets mit cola');

      const entries = await repository.listEntriesForDate('2026-02-15');

      entries.forEach((entry: FoodEntry) => {
        expect(entry.explanation).toContain('AI strukturierte Multi-Item-Mahlzeit');
      });
    });

    it('sollte ohne AI-Parser auf Single-Item zurückfallen', async () => {
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

      const entryIds = await useCase.execute('burger mit cola');

      // Sollte als Single-Item behandelt werden
      expect(entryIds).toHaveLength(1);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].rawInput).toBe('burger mit cola');
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
    it('sollte sourceType "ai" für AI-geparste Items ohne Lookup setzen', async () => {
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
        // Ohne Lookup bleibt es "ai" (kein Gramm für Lookup außer Cola)
        // Cola hat 400g, aber ohne NutritionLookup bleibt sourceType "ai"
        expect(entry.sourceType).toBe('ai');
      });
    });
  });
});
