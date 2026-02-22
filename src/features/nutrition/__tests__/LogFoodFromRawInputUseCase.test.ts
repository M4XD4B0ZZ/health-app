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

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    clock = new TestClock(new Date('2026-02-15T12:00:00Z'));
    idGenerator = new TestIdGenerator();
    parser = new DeterministicFoodParser();
    useCase = new LogFoodFromRawInputUseCase(repository, clock, idGenerator, parser);
  });

  describe('Mit Gramm-Angabe', () => {
    it('sollte FoodEntry mit quantityGrams und confidence 0.5 erstellen', async () => {
      const entry = await useCase.execute('250g chicken breast');

      expect(entry.id).toBe('test-id-0');
      expect(entry.rawInput).toBe('250g chicken breast');
      expect(entry.parsedName).toBe('chicken breast');
      expect(entry.quantityGrams).toBe(250);
      expect(entry.confidenceScore).toBe(0.5);
      expect(entry.sourceType).toBe('user');
      expect(entry.calories).toBe(0);
      expect(entry.protein).toBe(0);
      expect(entry.carbs).toBe(0);
      expect(entry.fat).toBe(0);
      expect(entry.logDecision).toBeDefined();
      expect(entry.logDecision?.explanation.length).toBeGreaterThan(0);
    });

    it('sollte Entry im Repository speichern', async () => {
      await useCase.execute('200g skyr');

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('skyr');
    });
  });

  describe('Mit Count-Angabe (nur)', () => {
    it('sollte FoodEntry mit quantityGrams=0 und confidence 0.35 erstellen', async () => {
      const entry = await useCase.execute('2 eggs');

      expect(entry.parsedName).toBe('eggs');
      expect(entry.quantityGrams).toBe(0); // Kein Raten!
      expect(entry.confidenceScore).toBe(0.35);
      expect(entry.sourceType).toBe('user');
    });
  });

  describe('Ohne Mengenangabe', () => {
    it('sollte FoodEntry mit quantityGrams=0 und confidence 0.35 erstellen', async () => {
      const entry = await useCase.execute('banana');

      expect(entry.parsedName).toBe('banana');
      expect(entry.quantityGrams).toBe(0);
      expect(entry.confidenceScore).toBe(0.35);
      expect(entry.sourceType).toBe('user');
    });
  });

  describe('Mit optionalem Datum', () => {
    it('sollte dateISO für Speicherung verwenden', async () => {
      await useCase.execute('100g oats', '2026-02-10');

      const entries = await repository.listEntriesForDate('2026-02-10');
      expect(entries).toHaveLength(1);
      expect(entries[0].parsedName).toBe('oats');
    });

    it('sollte heutiges Datum verwenden wenn nicht angegeben', async () => {
      await useCase.execute('100g oats');

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(1);
    });
  });

  describe('Mehrere Einträge', () => {
    it('sollte mehrere Einträge für dasselbe Datum speichern', async () => {
      await useCase.execute('200g chicken');
      await useCase.execute('150g rice');
      await useCase.execute('banana');

      const entries = await repository.listEntriesForDate('2026-02-15');
      expect(entries).toHaveLength(3);
      expect(entries[0].parsedName).toBe('chicken');
      expect(entries[1].parsedName).toBe('rice');
      expect(entries[2].parsedName).toBe('banana');
    });
  });
});
