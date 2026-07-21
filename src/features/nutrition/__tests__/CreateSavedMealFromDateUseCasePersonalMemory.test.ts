import { CreateSavedMealFromDateUseCase } from '../application/usecases/CreateSavedMealFromDateUseCase';
import { RecordPersonalResolutionMemoryUseCase } from '../application/usecases/RecordPersonalResolutionMemoryUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemorySavedMealRepository } from '../infrastructure/repositories/InMemorySavedMealRepository';
import { FoodEntry } from '../domain/models/NutritionTypes';
import type {
  PersonalResolutionMemory,
  PersonalResolutionMemoryEvidence,
} from '../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryRecordOutcome,
  PersonalResolutionMemoryRepository,
} from '../application/ports/PersonalResolutionMemoryRepository';
import type { ResolverObservationOwnerProvider } from '../application/ports/ResolverObservationOwnerProvider';

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
    return `template-${++this.counter}`;
  }
}
class RecordingRepo implements PersonalResolutionMemoryRepository {
  memories: PersonalResolutionMemory[] = [];
  evidence: PersonalResolutionMemoryEvidence[] = [];
  async record(
    _ownerId: string,
    memory: PersonalResolutionMemory,
    evidence: PersonalResolutionMemoryEvidence,
  ): Promise<PersonalResolutionMemoryRecordOutcome> {
    this.memories.push(memory);
    this.evidence.push(evidence);
    return 'written';
  }
}
class FixedOwnerProvider implements ResolverObservationOwnerProvider {
  constructor(private readonly ownerId: string | null) {}
  async getOwnerId(): Promise<string | null> {
    return this.ownerId;
  }
}

const entryWithRef = (id: string): FoodEntry => ({
  id,
  rawInput: '100g Ei',
  parsedName: 'Ei',
  quantityGrams: 100,
  grams: 100,
  calories: 155,
  protein: 13,
  carbs: 1.1,
  fat: 11,
  confidenceScore: 0.9,
  sourceType: 'branded',
  createdAt: new Date('2024-01-15T08:00:00Z'),
  foodCatalogRef: { source: 'bls', sourceId: 'egg-raw', displayName: 'Ei', confidence: 0.9 },
});

describe('RESOLVER-V3-026 CreateSavedMealFromDateUseCase personal-memory recording', () => {
  it('records deliberately_saved_personal_meal (P2) for each source-grounded item when saving a named template', async () => {
    const foodEntryRepo = new InMemoryFoodEntryRepository();
    await foodEntryRepo.addEntry(entryWithRef('e1'));
    const savedMealRepo = new InMemorySavedMealRepository();
    const repo = new RecordingRepo();
    const useCase = new CreateSavedMealFromDateUseCase(
      foodEntryRepo,
      savedMealRepo,
      new MockClock(),
      new MockIdGenerator(),
      new RecordPersonalResolutionMemoryUseCase(repo),
      new FixedOwnerProvider('owner-a'),
    );

    await useCase.execute('2024-01-15', 'Mein Frühstück');
    await new Promise((resolve) => setImmediate(resolve));

    expect(repo.memories).toHaveLength(1);
    expect(repo.memories[0]).toMatchObject({
      level: 'P2_confirmed',
      scopeKey: 'bls:egg-raw',
      target: { sourceType: 'bls', sourceId: 'egg-raw', kind: 'source_grounded' },
    });
    expect(repo.evidence[0].type).toBe('deliberately_saved_personal_meal');
  });

  it('never records anything without an authenticated owner', async () => {
    const foodEntryRepo = new InMemoryFoodEntryRepository();
    await foodEntryRepo.addEntry(entryWithRef('e1'));
    const savedMealRepo = new InMemorySavedMealRepository();
    const repo = new RecordingRepo();
    const useCase = new CreateSavedMealFromDateUseCase(
      foodEntryRepo,
      savedMealRepo,
      new MockClock(),
      new MockIdGenerator(),
      new RecordPersonalResolutionMemoryUseCase(repo),
      new FixedOwnerProvider(null),
    );

    await useCase.execute('2024-01-15', 'Mein Frühstück');
    await new Promise((resolve) => setImmediate(resolve));

    expect(repo.memories).toHaveLength(0);
  });

  it('template creation still succeeds when personal-memory recording is not wired at all', async () => {
    const foodEntryRepo = new InMemoryFoodEntryRepository();
    await foodEntryRepo.addEntry(entryWithRef('e1'));
    const savedMealRepo = new InMemorySavedMealRepository();
    const useCase = new CreateSavedMealFromDateUseCase(
      foodEntryRepo,
      savedMealRepo,
      new MockClock(),
      new MockIdGenerator(),
    );

    const template = await useCase.execute('2024-01-15', 'Mein Frühstück');

    expect(template.items).toHaveLength(1);
  });

  it('template creation still succeeds even if personal-memory recording throws', async () => {
    const foodEntryRepo = new InMemoryFoodEntryRepository();
    await foodEntryRepo.addEntry(entryWithRef('e1'));
    const savedMealRepo = new InMemorySavedMealRepository();
    const throwingRepo: PersonalResolutionMemoryRepository = {
      record: async () => {
        throw new Error('boom');
      },
    };
    const useCase = new CreateSavedMealFromDateUseCase(
      foodEntryRepo,
      savedMealRepo,
      new MockClock(),
      new MockIdGenerator(),
      new RecordPersonalResolutionMemoryUseCase(throwingRepo),
      new FixedOwnerProvider('owner-a'),
    );

    const template = await useCase.execute('2024-01-15', 'Mein Frühstück');
    await new Promise((resolve) => setImmediate(resolve));

    expect(template.items).toHaveLength(1);
  });

  it('does not record an item that has no foodCatalogRef (no target to build)', async () => {
    const foodEntryRepo = new InMemoryFoodEntryRepository();
    await foodEntryRepo.addEntry({ ...entryWithRef('e1'), foodCatalogRef: undefined });
    const savedMealRepo = new InMemorySavedMealRepository();
    const repo = new RecordingRepo();
    const useCase = new CreateSavedMealFromDateUseCase(
      foodEntryRepo,
      savedMealRepo,
      new MockClock(),
      new MockIdGenerator(),
      new RecordPersonalResolutionMemoryUseCase(repo),
      new FixedOwnerProvider('owner-a'),
    );

    await useCase.execute('2024-01-15', 'Mein Frühstück');
    await new Promise((resolve) => setImmediate(resolve));

    expect(repo.memories).toHaveLength(0);
  });
});
