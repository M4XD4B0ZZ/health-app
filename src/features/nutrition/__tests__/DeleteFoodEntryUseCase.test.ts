import { DeleteFoodEntryUseCase } from '../application/usecases/DeleteFoodEntryUseCase';
import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { Clock } from '../application/ports/Clock';
import { IdGenerator } from '../application/ports/IdGenerator';
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

class TestIdGenerator implements IdGenerator {
  private counter = 0;

  newId(): string {
    return `test-id-${this.counter++}`;
  }
}

describe('DeleteFoodEntryUseCase', () => {
  let deleteUseCase: DeleteFoodEntryUseCase;
  let logFoodUseCase: LogFoodFromRawInputUseCase;
  let repository: InMemoryFoodEntryRepository;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    const clock = new TestClock(new Date('2026-02-15T12:00:00Z'));
    const idGenerator = new TestIdGenerator();
    const parser = new DeterministicFoodParser();
    const mockResolver = MockResolverBuilder.createHappyPathResolver();

    // Create a minimal mock food catalog to enable resolver usage
    const mockFoodCatalog = {
      getById: async () => null,
      searchByName: async () => null,
    };

    deleteUseCase = new DeleteFoodEntryUseCase(repository);
    logFoodUseCase = new LogFoodFromRawInputUseCase(
      repository,
      clock,
      idGenerator,
      parser,
      mockFoodCatalog as any, // foodCatalog - needed to enable resolver
      undefined, // aliasRepository
      undefined, // aiFoodMapper
      undefined, // nutritionLookup
      mockResolver
    );
  });

  it('sollte einen Eintrag löschen', async () => {
    const entry = await logFoodUseCase.execute({ rawText: '200g chicken', rawInput: '200g chicken' });

    await deleteUseCase.execute(entry.id);

    const entries = await repository.listEntriesForDate('2026-02-15');
    expect(entries).toHaveLength(0);
  });

  it('sollte nur den spezifischen Eintrag löschen', async () => {
    const entry1 = await logFoodUseCase.execute({ rawText: '200g chicken', rawInput: '200g chicken' });
    const entry2 = await logFoodUseCase.execute({ rawText: '150g rice', rawInput: '150g rice' });
    const entry3 = await logFoodUseCase.execute({ rawText: '100g oats', rawInput: '100g oats' });

    await deleteUseCase.execute(entry2.id);

    const entries = await repository.listEntriesForDate('2026-02-15');
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe(entry1.id);
    expect(entries[1].id).toBe(entry3.id);
  });

  it('sollte nichts tun wenn ID nicht existiert', async () => {
    await logFoodUseCase.execute({ rawText: '200g chicken', rawInput: '200g chicken' });

    await deleteUseCase.execute('non-existent-id');

    const entries = await repository.listEntriesForDate('2026-02-15');
    expect(entries).toHaveLength(1);
  });
});
