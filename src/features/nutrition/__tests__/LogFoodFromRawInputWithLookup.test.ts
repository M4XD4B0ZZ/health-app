import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemoryNutritionLookup } from '../infrastructure/repositories/InMemoryNutritionLookup';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { MockResolverBuilder } from './helpers/MockResolverBuilder';

// Mock Clock and IdGenerator
class MockClock {
  now(): Date {
    return new Date('2024-01-15T10:00:00Z');
  }

  todayISO(): string {
    return '2024-01-15';
  }
}

class MockIdGenerator {
  private counter = 0;
  newId(): string {
    return `id-${++this.counter}`;
  }
}

describe('LogFoodFromRawInputUseCase with NutritionLookup', () => {
  let useCase: LogFoodFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;
  let lookup: InMemoryNutritionLookup;
  let clock: MockClock;
  let idGen: MockIdGenerator;
  let parser: DeterministicFoodParser;
  let mockResolver: ReturnType<typeof MockResolverBuilder.createHappyPathResolver>;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    lookup = new InMemoryNutritionLookup();
    clock = new MockClock();
    idGen = new MockIdGenerator();
    parser = new DeterministicFoodParser();
    mockResolver = MockResolverBuilder.createHappyPathResolver();
  });

  describe('with NutritionLookup provided', () => {
    beforeEach(() => {
      useCase = new LogFoodFromRawInputUseCase(
        repository,
        clock,
        idGen,
        parser,
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        lookup, // NutritionLookup provided
        mockResolver, // resolver
      );
    });

    it('should enrich macros immediately for known food with grams', async () => {
      const entry = await useCase.execute({ rawText: '150g banana', rawInput: '150g banana' });

      // Verify: Macros calculated (150g banana: per 100g = 89 cal, 1.1 protein, 22.8 carbs, 0.3 fat)
      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(150);
      expect(entry.calories).toBe(133.5); // 89 * 1.5
      expect(entry.protein).toBe(1.65); // 1.1 * 1.5
      expect(entry.carbs).toBe(34.2); // 22.8 * 1.5
      expect(entry.fat).toBe(0.45); // 0.3 * 1.5
      expect(entry.sourceType).toBe('generic');
      expect(entry.confidenceScore).toBeGreaterThan(0.5); // upgraded from 0.5

      // Verify: Macros calculated (150g banana: per 100g = 89 cal, 1.1 protein, 22.8 carbs, 0.3 fat)
      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(150);
      expect(entry.calories).toBe(133.5); // 89 * 1.5
      expect(entry.protein).toBe(1.65); // 1.1 * 1.5
      expect(entry.carbs).toBe(34.2); // 22.8 * 1.5
      expect(entry.fat).toBe(0.45); // 0.3 * 1.5
      expect(entry.sourceType).toBe('generic');
      expect(entry.confidenceScore).toBeGreaterThan(0.5); // upgraded from 0.5
    });

    it('should not enrich if food is unknown', async () => {
      const entry = await useCase.execute({ rawText: '100g unknown food', rawInput: '100g unknown food' });

      // Verify: No enrichment
      expect(entry.parsedName).toBe('unknown food');
      expect(entry.quantityGrams).toBe(100);
      expect(entry.calories).toBe(0);
      expect(entry.protein).toBe(0);
      expect(entry.carbs).toBe(0);
      expect(entry.fat).toBe(0);
      expect(entry.sourceType).toBe('user');
      expect(entry.confidenceScore).toBe(0.5); // medium confidence (has grams)
    });

    it('should not enrich if no grams specified', async () => {
      const entry = await useCase.execute({ rawText: 'banana', rawInput: 'banana' });

      // Verify: No enrichment (no grams)
      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(0);
      expect(entry.calories).toBe(0);
      expect(entry.protein).toBe(0);
      expect(entry.sourceType).toBe('user');
      expect(entry.confidenceScore).toBe(0.35); // low confidence
    });

    it('should persist enriched entry to repository', async () => {
      await useCase.execute({ rawText: '200g skyr', rawInput: '200g skyr' }, '2024-01-15');

      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('skyr');
      expect(entries[0].calories).toBe(114); // 57 * 2
      expect(entries[0].protein).toBe(22); // 11 * 2
      expect(entries[0].sourceType).toBe('generic');
    });
  });

  describe('without NutritionLookup (Sprint 1 behavior)', () => {
    beforeEach(() => {
      useCase = new LogFoodFromRawInputUseCase(
        repository,
        clock,
        idGen,
        parser,
        undefined, // foodCatalog
        undefined, // aliasRepository
        undefined, // aiFoodMapper
        undefined, // NO NutritionLookup provided
        mockResolver, // resolver
      );
    });

    it('should not enrich macros even for known food', async () => {
      const entry = await useCase.execute({ rawText: '150g banana', rawInput: '150g banana' });

      // Verify: No enrichment (Sprint 1 behavior)
      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(150);
      expect(entry.calories).toBe(0);
      expect(entry.protein).toBe(0);
      expect(entry.carbs).toBe(0);
      expect(entry.fat).toBe(0);
      expect(entry.sourceType).toBe('user');
      expect(entry.confidenceScore).toBe(0.5); // medium confidence
    });
  });
});
