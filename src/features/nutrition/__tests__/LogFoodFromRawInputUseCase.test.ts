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

class MutableTestClock implements Clock {
  constructor(private fixedDate: Date) {}

  now(): Date {
    return this.fixedDate;
  }

  todayISO(): string {
    return this.fixedDate.toISOString().slice(0, 10);
  }

  setNow(nextDate: Date): void {
    this.fixedDate = nextDate;
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

    it('sollte bei erfolgreicher Resolution genau einen Entry genau einmal persistieren', async () => {
      const successRepository = new InMemoryFoodEntryRepository();
      const addEntrySpy = jest.spyOn(successRepository, 'addEntry');
      const successUseCase = new LogFoodFromRawInputUseCase(
        successRepository,
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
        MockResolverBuilder.createHappyPathResolver(),
      );

      await expect(
        successUseCase.execute({ rawText: '120g skyr', rawInput: '120g skyr' }),
      ).resolves.toBeDefined();

      expect(addEntrySpy).toHaveBeenCalledTimes(1);

      const entries = await successRepository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
    });
  });

  describe('Recent default portion correction', () => {
    function createToastUseCase(testClock: Clock): LogFoodFromRawInputUseCase {
      const toastResolver = new MockResolverBuilder()
        .withAcceptedFood('toast', 'Toast', { kcal: 265, protein: 9, carbs: 49, fat: 3.2 })
        .withAcceptedFood('300g toast', 'Toast', { kcal: 265, protein: 9, carbs: 49, fat: 3.2 })
        .withAcceptedFood('100g toast', 'Toast', { kcal: 265, protein: 9, carbs: 49, fat: 3.2 })
        .withAcceptedFood('300g quark', 'Quark', { kcal: 67, protein: 12, carbs: 4, fat: 0.2 })
        .build();

      return new LogFoodFromRawInputUseCase(
        repository,
        testClock,
        idGenerator,
        parser,
        {
          getById: async () => null,
          searchByName: async () => null,
        } as any,
        undefined,
        undefined,
        undefined,
        toastResolver,
      );
    }

    it('updates a recent same-food default portion when explicit grams are logged', async () => {
      const mutableClock = new MutableTestClock(new Date('2026-02-15T12:00:00Z'));
      useCase = createToastUseCase(mutableClock);

      const defaultEntry = await useCase.execute({ rawText: 'toast', rawInput: 'toast' });
      mutableClock.setNow(new Date('2026-02-15T12:10:00Z'));
      const correctedEntry = await useCase.execute({ rawText: '300g toast', rawInput: '300g toast' });

      const entries = await repository.listEntriesForDate('2026-02-15');

      expect(entries).toHaveLength(1);
      expect(correctedEntry.id).toBe(defaultEntry.id);
      expect(entries[0].id).toBe(defaultEntry.id);
      expect(entries[0].createdAt).toEqual(defaultEntry.createdAt);
      expect(entries[0].lastModifiedAt).toEqual(new Date('2026-02-15T12:10:00Z'));
      expect(entries[0].rawInput).toBe('300g toast');
      expect(entries[0].parsedName).toBe('toast');
      expect(entries[0].quantityGrams).toBe(300);
      expect(entries[0].grams).toBe(300);
      expect(entries[0].calcBreakdown?.gramsUsed).toBe(300);
      expect(entries[0].calories).toBeCloseTo(795, 1);
    });

    it('appends when both same-food entries have explicit grams', async () => {
      const mutableClock = new MutableTestClock(new Date('2026-02-15T12:00:00Z'));
      useCase = createToastUseCase(mutableClock);

      await useCase.execute({ rawText: '100g toast', rawInput: '100g toast' });
      mutableClock.setNow(new Date('2026-02-15T12:10:00Z'));
      await useCase.execute({ rawText: '300g toast', rawInput: '300g toast' });

      const entries = await repository.listEntriesForDate('2026-02-15');

      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['100g toast', '300g toast']);
    });

    it('appends when the same food is logged outside the correction window', async () => {
      const mutableClock = new MutableTestClock(new Date('2026-02-15T12:00:00Z'));
      useCase = createToastUseCase(mutableClock);

      await useCase.execute({ rawText: 'toast', rawInput: 'toast' });
      mutableClock.setNow(new Date('2026-02-15T12:31:00Z'));
      await useCase.execute({ rawText: '300g toast', rawInput: '300g toast' });

      const entries = await repository.listEntriesForDate('2026-02-15');

      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['toast', '300g toast']);
    });

    it('appends different foods on the same day', async () => {
      const mutableClock = new MutableTestClock(new Date('2026-02-15T12:00:00Z'));
      useCase = createToastUseCase(mutableClock);

      await useCase.execute({ rawText: 'toast', rawInput: 'toast' });
      mutableClock.setNow(new Date('2026-02-15T12:10:00Z'));
      await useCase.execute({ rawText: '300g quark', rawInput: '300g quark' });

      const entries = await repository.listEntriesForDate('2026-02-15');

      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.rawInput)).toEqual(['toast', '300g quark']);
    });

    it('appends same-food entries into separate date buckets for different dates', async () => {
      const mutableClock = new MutableTestClock(new Date('2026-02-15T12:00:00Z'));
      useCase = createToastUseCase(mutableClock);

      await useCase.execute({ rawText: 'toast', rawInput: 'toast' });
      mutableClock.setNow(new Date('2026-02-16T12:10:00Z'));
      await useCase.execute({ rawText: '300g toast', rawInput: '300g toast' });

      const firstDayEntries = await repository.listEntriesForDate('2026-02-15');
      const secondDayEntries = await repository.listEntriesForDate('2026-02-16');

      expect(firstDayEntries).toHaveLength(1);
      expect(secondDayEntries).toHaveLength(1);
      expect(firstDayEntries[0].rawInput).toBe('toast');
      expect(secondDayEntries[0].rawInput).toBe('300g toast');
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

    it('sollte Resolver-Exception explizit werfen und Persistenz blockieren', async () => {
      const exceptionRepository = new InMemoryFoodEntryRepository();
      const addEntrySpy = jest.spyOn(exceptionRepository, 'addEntry');
      const resolverError = new Error('RESOLVER_EXCEPTION_TIMEOUT');
      const throwingResolver = {
        resolve: jest.fn().mockRejectedValue(resolverError),
      };

      const exceptionUseCase = new LogFoodFromRawInputUseCase(
        exceptionRepository,
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
        throwingResolver as any,
      );

      await expect(
        exceptionUseCase.execute({ rawText: '100g timeout food', rawInput: '100g timeout food' }),
      ).rejects.toThrow('RESOLVER_EXCEPTION_TIMEOUT');

      expect(addEntrySpy).not.toHaveBeenCalled();

      const entries = await exceptionRepository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(0);
    });
  });
});
