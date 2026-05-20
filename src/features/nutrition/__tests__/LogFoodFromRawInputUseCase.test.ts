import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';
import { Clock } from '../application/ports/Clock';
import { MockResolverBuilder } from './helpers/MockResolverBuilder';

// Test-Implementierungen
class TestClock implements Clock {
  constructor(private fixedDate: Date) {}

  now(): Date {
    return this.fixedDate;
  }

  todayISO(): string {
    return this.fixedDate.toISOString().slice(0, 10);
  }
}

describe('LogFoodFromRawInputUseCase', () => {
  let useCase: LogFoodFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;
  let clock: Clock;
  let idGenerator: TestIdGenerator;
  let parser: DeterministicFoodParser;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    clock = new TestClock(new Date('2026-02-15T12:00:00Z'));
    idGenerator = new TestIdGenerator();
    parser = new DeterministicFoodParser();
    const mockResolver = MockResolverBuilder.createHappyPathResolver();

    // Create a minimal mock food catalog to enable resolver usage
    const mockFoodCatalog = {
      getById: async () => null,
      searchByName: async () => null,
    };

    useCase = new LogFoodFromRawInputUseCase(
      repository,
      clock,
      idGenerator,
      parser,
      mockFoodCatalog as any, // foodCatalog - needed to enable resolver
      undefined, // aliasRepository
      undefined, // aiFoodMapper
      undefined, // nutritionLookup
      mockResolver,
    );
  });

  describe('Basic Functionality', () => {
    it('sollte einen Food Entry erstellen', async () => {
      const entry = await useCase.execute({
        rawText: '250g chicken breast',
        rawInput: '250g chicken breast',
      });

      expect(entry.id).toBeDefined();
      expect(entry.rawInput).toBe('250g chicken breast');
      expect(entry.parsedName).toBe('chicken breast');
      expect(entry.quantityGrams).toBe(250);
      expect(entry.createdAt).toEqual(new Date('2026-02-15T12:00:00Z'));
    });

    it('sollte Entry im Repository speichern', async () => {
      await useCase.execute({ rawText: '200g skyr', rawInput: '200g skyr' });

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('skyr');
      expect(entries[0].quantityGrams).toBe(200);
    });

    it('sollte ohne Gramm-Angabe funktionieren', async () => {
      const entry = await useCase.execute({ rawText: '2 eggs', rawInput: '2 eggs' });

      expect(entry.parsedName).toBe('eggs');
      expect(entry.quantityGrams).toBe(120); // 2 eggs * 60g each
    });

    it('sollte nur Name ohne Menge parsen', async () => {
      const entry = await useCase.execute({ rawText: 'banana', rawInput: 'banana' });

      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(0);
    });
  });

  describe('Date Handling', () => {
    it('sollte custom dateISO verwenden', async () => {
      await useCase.execute({ rawText: '100g oats', rawInput: '100g oats' }, '2026-02-10');

      const entries = await repository.listEntriesForDate('2026-02-10');
      expect(entries).toHaveLength(1);
      // Entry should be stored under the custom date
    });

    it('sollte heutiges Datum als Default verwenden', async () => {
      await useCase.execute({ rawText: '100g oats', rawInput: '100g oats' });

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].createdAt).toEqual(new Date('2026-02-15T12:00:00Z'));
    });
  });

  describe('Multiple Entries', () => {
    it('sollte mehrere Entries verwalten', async () => {
      await useCase.execute({ rawText: '200g chicken', rawInput: '200g chicken' });
      await useCase.execute({ rawText: '150g rice', rawInput: '150g rice' });
      await useCase.execute({ rawText: 'banana', rawInput: 'banana' });

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(3);
      expect(entries[0].parsedName).toBe('chicken');
      expect(entries[1].parsedName).toBe('rice');
      expect(entries[2].parsedName).toBe('banana');
    });
  });

  describe('Zero-Macro Guard', () => {
    it('sollte Persistenz blockieren wenn Resolver keine validen Makros liefert', async () => {
      const failureRepository = new InMemoryFoodEntryRepository();
      const addEntrySpy = jest.spyOn(failureRepository, 'addEntry');
      const failureResolver = MockResolverBuilder.createFailurePathResolver();

      const failureUseCase = new LogFoodFromRawInputUseCase(
        failureRepository,
        clock,
        idGenerator,
        parser,
        {
          getById: async () => null,
          searchByName: async () => null,
        } as any,
        undefined,
        undefined,
        undefined,
        failureResolver,
      );

      await expect(
        failureUseCase.execute({ rawText: '100g unknown food', rawInput: '100g unknown food' }),
      ).rejects.toThrow(/RESOLVER_FAILED_OR_NO_MACROS/i);

      expect(addEntrySpy).not.toHaveBeenCalled();

      const entries = await failureRepository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(0);
    });
  });
});
