import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { Clock } from '../application/ports/Clock';
import { IdGenerator } from '../application/ports/IdGenerator';

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

class TestIdGenerator implements IdGenerator {
  private counter = 0;

  newId(): string {
    return `test-id-${this.counter++}`;
  }
}

describe('LogFoodFromRawInputUseCase', () => {
  let useCase: LogFoodFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;
  let clock: TestClock;
  let idGenerator: TestIdGenerator;
  let parser: DeterministicFoodParser;

  import { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import { FoodSearchQuery } from '../../domain/catalog/FoodCatalogSource';
import { ResolverDecision } from '../../domain/models/ResolverDecision';

  class MockFoodCatalogResolver implements FoodCatalogResolver {
    async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
      // Return enriched food data for known queries
      if (query.text.toLowerCase().includes('chicken breast')) {
        return Promise.resolve({
          decision: 'accept',
          reason: 'mock enriched',
          food: {
            id: 'chicken breast',
            per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
          },
        });
      }
      if (query.text.toLowerCase().includes('banana')) {
        return Promise.resolve({
          decision: 'accept',
          reason: 'mock enriched',
          food: {
            id: 'banana',
            per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
          },
        });
      }
      return Promise.resolve({ decision: 'none', reason: 'mock' });
    }
  }

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    clock = new TestClock(new Date('2026-02-15T12:00:00Z'));
    idGenerator = new TestIdGenerator();
    parser = new DeterministicFoodParser();
    const mockResolver = new MockFoodCatalogResolver();
    // Provide all required dependencies
    useCase = new LogFoodFromRawInputUseCase(
      repository,
      clock,
      idGenerator,
      parser,
      undefined, // FoodCatalog not needed here
      undefined, // AliasRepository not needed here
      undefined, // AiFoodMapper not needed here
      undefined, // Some other dependency
      mockResolver
    );
  });

  describe('Mit Gramm-Angabe', () => {
    it('sollte FoodEntry mit quantityGrams und confidence 0.5 erstellen', async () => {
      const entry = await useCase.execute({ rawText: '250g chicken breast', rawInput: '250g chicken breast' });

      expect(entry.id).toBe('test-id-0');
      expect(entry.rawInput).toBe('250g chicken breast');
      expect(entry.parsedName).toBe('chicken breast');
      expect(entry.quantityGrams).toBe(250);
      expect(entry.confidenceScore).toBe(0.5);
      expect(entry.sourceType).toBe('user');
      // Adjusted to enriched macros
      expect(entry.calories).toBeCloseTo(412.5, 1); // 250 * 165/100
      expect(entry.protein).toBeCloseTo(77.5, 1); // 250 * 31/100
      expect(entry.carbs).toBe(0);
      expect(entry.fat).toBeCloseTo(9, 1); // 250 * 3.6/100
      expect(entry.logDecision).toBeDefined();
      expect(entry.logDecision?.explanation.length).toBeGreaterThan(0);
    });

    it('sollte Entry im Repository speichern', async () => {
      await useCase.execute({ rawText: '200g skyr', rawInput: '200g skyr' });

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('skyr');
    });
  });

  describe('Mit Count-Angabe (nur)', () => {
    it('sollte Count-basierte Default-Portionen in Gramm auflÃ¶sen', async () => {
      const entry = await useCase.execute({ rawText: '2 eggs', rawInput: '2 eggs' });

      expect(entry.parsedName).toBe('egg');
      expect(entry.rawInput).toBe('2 eggs');
      expect(entry.quantityGrams).toBe(120);
      expect(entry.grams).toBe(120);
      expect(entry.confidenceScore).toBe(0.5);
      expect(entry.sourceType).toBe('user');
    });
  });

  describe('Ohne Mengenangabe', () => {
    it('sollte FoodEntry mit quantityGrams=0 und confidence 0.35 erstellen', async () => {
      const entry = await useCase.execute({ rawText: 'banana', rawInput: 'banana' });

      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(0);
      expect(entry.confidenceScore).toBe(0.35);
      expect(entry.sourceType).toBe('user');
    });
  });

  describe('Mit optionalem Datum', () => {
    it('sollte dateISO für Speicherung verwenden', async () => {
      await useCase.execute({ rawText: '100g oats', rawInput: '100g oats' }, '2026-02-10');

      const entries = await repository.listEntriesForDate('2026-02-10');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('oats');
    });

    it('sollte heutiges Datum verwenden wenn nicht angegeben', async () => {
      await useCase.execute({ rawText: '100g oats', rawInput: '100g oats' });

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
    });
  });

  describe('Mehrere Einträge', () => {
    it('sollte mehrere Einträge für dasselbe Datum speichern', async () => {
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
});
