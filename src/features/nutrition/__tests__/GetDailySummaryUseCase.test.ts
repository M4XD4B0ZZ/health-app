import { GetDailySummaryUseCase } from '../application/usecases/GetDailySummaryUseCase';
import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { NutritionEngine } from '../domain/engine/NutritionEngine';
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

describe('GetDailySummaryUseCase', () => {
  let getSummaryUseCase: GetDailySummaryUseCase;
  let logFoodUseCase: LogFoodFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;
  let engine: NutritionEngine;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    engine = new NutritionEngine();
    const clock = new TestClock(new Date('2026-02-15T12:00:00Z'));
    const idGenerator = new TestIdGenerator();
    const parser = new DeterministicFoodParser();

    getSummaryUseCase = new GetDailySummaryUseCase(repository, engine);
    logFoodUseCase = new LogFoodFromRawInputUseCase(repository, clock, idGenerator, parser);
  });

  describe('Ohne Einträge', () => {
    it('sollte leere Summary mit korrektem Datum zurückgeben', async () => {
      const summary = await getSummaryUseCase.execute('2026-02-15');

      expect(summary.date).toBe('2026-02-15');
      expect(summary.totalCalories).toBe(0);
      expect(summary.totalProtein).toBe(0);
      expect(summary.totalCarbs).toBe(0);
      expect(summary.totalFat).toBe(0);
      expect(summary.entries).toHaveLength(0);
    });
  });

  describe('Mit Einträgen (Macros=0)', () => {
    it('sollte alle Einträge aggregieren', async () => {
      await logFoodUseCase.execute('200g chicken');
      await logFoodUseCase.execute('150g rice');
      await logFoodUseCase.execute('banana');

      const summary = await getSummaryUseCase.execute('2026-02-15');

      expect(summary.date).toBe('2026-02-15');
      expect(summary.entries).toHaveLength(3);
      expect(summary.totalCalories).toBe(0); // Noch keine Nutrition-Daten
      expect(summary.totalProtein).toBe(0);
      expect(summary.totalCarbs).toBe(0);
      expect(summary.totalFat).toBe(0);
    });

    it('sollte nur Einträge für das angegebene Datum laden', async () => {
      await logFoodUseCase.execute('200g chicken', '2026-02-15');
      await logFoodUseCase.execute('150g rice', '2026-02-16');

      const summary15 = await getSummaryUseCase.execute('2026-02-15');
      const summary16 = await getSummaryUseCase.execute('2026-02-16');

      expect(summary15.entries).toHaveLength(1);
      expect(summary15.entries[0].parsedName).toBe('chicken');

      expect(summary16.entries).toHaveLength(1);
      expect(summary16.entries[0].parsedName).toBe('rice');
    });
  });

  describe('Aggregation', () => {
    it('sollte NutritionEngine korrekt verwenden', async () => {
      // Füge Einträge mit manuellen Macros hinzu
      const entry1 = await logFoodUseCase.execute('200g chicken');
      const entry2 = await logFoodUseCase.execute('150g rice');

      // Manuell Macros setzen für den Test
      entry1.calories = 330;
      entry1.protein = 62;
      entry1.carbs = 0;
      entry1.fat = 7;

      entry2.calories = 195;
      entry2.protein = 4;
      entry2.carbs = 43;
      entry2.fat = 0.5;

      // Repository aktualisieren
      await repository.deleteEntry(entry1.id);
      await repository.deleteEntry(entry2.id);
      await repository.addEntry(entry1);
      await repository.addEntry(entry2);

      const summary = await getSummaryUseCase.execute('2026-02-15');

      expect(summary.totalCalories).toBe(525);
      expect(summary.totalProtein).toBe(66);
      expect(summary.totalCarbs).toBe(43);
      expect(summary.totalFat).toBe(7.5);
    });
  });
});
