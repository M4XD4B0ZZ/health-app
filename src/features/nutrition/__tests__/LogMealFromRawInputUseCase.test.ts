import { LogMealFromRawInputUseCase } from '../application/usecases/LogMealFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { FakeAiMealParser } from '../infrastructure/ai/FakeAiMealParser';
import { Clock } from '../application/ports/Clock';
import { FoodEntry } from '../domain/models/NutritionTypes';

describe('LogMealFromRawInputUseCase', () => {
  let useCase: LogMealFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;
  let clock: Clock;
  let idGenerator: TestIdGenerator;
  let parser: DeterministicFoodParser;
  let aiParser: FakeAiMealParser;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    clock = {
      now: () => new Date('2026-02-15T12:00:00Z'),
      todayISO: () => '2026-02-15'
    };
    idGenerator = new TestIdGenerator();
    parser = new DeterministicFoodParser();
    aiParser = new FakeAiMealParser();
  });

  describe('Single-Item Fallback', () => {
    it('sollte einfachen Input über Single-Item Flow behandeln', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
      );

      const entryIds = await useCase.execute('250g chicken');

      expect(entryIds).toHaveLength(1);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('chicken');
      expect(entries[0].quantityGrams).toBe(250);
    });

    it('sollte "20er nuggets" allein über Single-Item Flow behandeln (nicht komplex)', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
      );

      const entryIds = await useCase.execute('20er nuggets');

      expect(entryIds).toHaveLength(1);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('nuggets');
      expect(entries[0].rawInput).toBe('20er nuggets');
      expect(entries[0].quantityGrams).toBe(0); // Kein Lookup, daher 0g
      expect(entries[0].confidenceScore).toBe(0.35); // Low confidence ohne Gramm
    });
  });

  describe('Multi-Item AI Parsing', () => {
    it('sollte "20er nuggets mit cola und pommes" in 3 Entries aufteilen', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
      );

      const entryIds = await useCase.execute('20er nuggets mit cola und pommes');

      expect(entryIds).toHaveLength(3);

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(3);

      // Nuggets: 20 pieces
      const nuggets = entries.find((e: FoodEntry) => e.parsedName === 'nuggets');
      expect(nuggets).toBeDefined();
      expect(nuggets!.rawInput).toBe('20x nuggets');
      expect(nuggets!.quantityGrams).toBe(0); // pieces → 0g (keine portion defaults)

      // Cola: 400ml
      const cola = entries.find((e: FoodEntry) => e.parsedName === 'cola');
      expect(cola).toBeDefined();
      expect(cola!.rawInput).toBe('400ml cola');
      expect(cola!.quantityGrams).toBe(400); // ml → grams approximation

      // Pommes: 1 portion
      const pommes = entries.find((e: FoodEntry) => e.parsedName === 'pommes');
      expect(pommes).toBeDefined();
      expect(pommes!.rawInput).toBe('1 portion pommes');
      expect(pommes!.quantityGrams).toBe(0); // portion → 0g (keine portion defaults)
    });

    it('sollte "burger mit cola" in 2 Entries aufteilen', async () => {
      useCase = new LogMealFromRawInputUseCase(
        repository,
        clock,
        idGenerator,
        parser,
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
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
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
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
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        undefined  // Kein AI Parser
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
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
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
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // nutritionLookup
        aiParser   // aiMealParser
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
