import { PersistedReminderSettingsRepository } from '../infrastructure/repositories/PersistedReminderSettingsRepository';
import { FakeKeyValueStore } from '../infrastructure/storage/FakeKeyValueStore';
import { SetReminderSettingsUseCase } from '../application/usecases/SetReminderSettingsUseCase';
import { GetReminderSettingsUseCase } from '../application/usecases/GetReminderSettingsUseCase';
import { GetReminderDecisionUseCase } from '../application/usecases/GetReminderDecisionUseCase';
import { GetDailySummaryUseCase } from '../application/usecases/GetDailySummaryUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { EffectiveGoalsRepository } from '../../goals/application/ports';
import { EffectiveGoals } from '../../goals/domain/models/GoalsTypes';
import { FoodEntry } from '../domain/models/NutritionTypes';
import { getDateISOInTimezone } from '../domain/reminders/ReminderDecisionEngine';

class InMemoryGoalsRepository implements EffectiveGoalsRepository {
  async get(): Promise<EffectiveGoals | null> {
    return null;
  }

  async upsert(): Promise<void> {}
}

describe('Reminder system v1', () => {
  it('returns default settings when nothing stored', async () => {
    const repository = new PersistedReminderSettingsRepository(new FakeKeyValueStore());
    const settings = await repository.getSettings();

    expect(settings.isEnabled).toBe(false);
    expect(settings.timeLocal).toBe('20:00');
  });

  it('rejects invalid time strings', async () => {
    const repository = new PersistedReminderSettingsRepository(new FakeKeyValueStore());
    const useCase = new SetReminderSettingsUseCase(repository);
    await expect(useCase.execute({ isEnabled: true, timeLocal: '25:00' })).rejects.toThrow(
      'Invalid time format. Expected HH:mm.',
    );
  });

  it('disabled => no notify', async () => {
    const store = new FakeKeyValueStore();
    const settingsRepo = new PersistedReminderSettingsRepository(store);
    await new SetReminderSettingsUseCase(settingsRepo).execute({
      isEnabled: false,
      timeLocal: '20:00',
    });

    const summaryUseCase = new GetDailySummaryUseCase(
      new InMemoryFoodEntryRepository(),
      new InMemoryGoalsRepository(),
    );
    const decisionUseCase = new GetReminderDecisionUseCase(
      summaryUseCase,
      settingsRepo,
      'Europe/Berlin',
      () => '2026-02-22T20:30:00.000Z',
    );
    const decision = await decisionUseCase.execute('2026-02-22');
    expect(decision.shouldNotify).toBe(false);
    expect(decision.reasonCodes).toContain('DISABLED');
  });

  it('enabled + no entries + after time => notify', async () => {
    const store = new FakeKeyValueStore();
    const settingsRepo = new PersistedReminderSettingsRepository(store);
    await new SetReminderSettingsUseCase(settingsRepo).execute({
      isEnabled: true,
      timeLocal: '20:00',
    });

    const summaryUseCase = new GetDailySummaryUseCase(
      new InMemoryFoodEntryRepository(),
      new InMemoryGoalsRepository(),
    );
    const decisionUseCase = new GetReminderDecisionUseCase(
      summaryUseCase,
      settingsRepo,
      'Europe/Berlin',
      () => '2026-02-22T21:30:00.000Z',
    );
    const decision = await decisionUseCase.execute('2026-02-22');
    expect(decision.shouldNotify).toBe(true);
    expect(decision.reasonCodes).toContain('NO_LOGS_TODAY');
  });

  it('enabled + no entries + before time => no notify with plannedAtISO', async () => {
    const store = new FakeKeyValueStore();
    const settingsRepo = new PersistedReminderSettingsRepository(store);
    await new SetReminderSettingsUseCase(settingsRepo).execute({
      isEnabled: true,
      timeLocal: '20:00',
    });

    const summaryUseCase = new GetDailySummaryUseCase(
      new InMemoryFoodEntryRepository(),
      new InMemoryGoalsRepository(),
    );
    const decisionUseCase = new GetReminderDecisionUseCase(
      summaryUseCase,
      settingsRepo,
      'Europe/Berlin',
      () => '2026-02-22T17:00:00.000Z',
    );
    const decision = await decisionUseCase.execute('2026-02-22');
    expect(decision.shouldNotify).toBe(false);
    expect(decision.reasonCodes).toContain('TOO_EARLY');
    expect(decision.plannedAtISO).toBeDefined();
  });

  it('enabled + entries exist => no notify', async () => {
    const store = new FakeKeyValueStore();
    const settingsRepo = new PersistedReminderSettingsRepository(store);
    await new SetReminderSettingsUseCase(settingsRepo).execute({
      isEnabled: true,
      timeLocal: '20:00',
    });

    const entriesRepo = new InMemoryFoodEntryRepository();
    const entry: FoodEntry = {
      id: 'e1',
      rawInput: 'meal',
      parsedName: 'meal',
      quantityGrams: 100,
      calories: 300,
      protein: 20,
      carbs: 25,
      fat: 10,
      confidenceScore: 0.8,
      sourceType: 'generic',
      createdAt: new Date('2026-02-22T12:00:00.000Z'),
    };
    await entriesRepo.addEntry(entry);

    const summaryUseCase = new GetDailySummaryUseCase(entriesRepo, new InMemoryGoalsRepository());
    const decisionUseCase = new GetReminderDecisionUseCase(
      summaryUseCase,
      settingsRepo,
      'Europe/Berlin',
      () => '2026-02-22T21:30:00.000Z',
    );
    const decision = await decisionUseCase.execute('2026-02-22');
    expect(decision.shouldNotify).toBe(false);
    expect(decision.reasonCodes).toContain('ALREADY_LOGGED');
  });

  it('timezone handling is correct around Berlin day boundary', async () => {
    const late = getDateISOInTimezone('2026-02-22T22:30:00.000Z', 'Europe/Berlin');
    const afterMidnight = getDateISOInTimezone('2026-02-22T23:10:00.000Z', 'Europe/Berlin');

    expect(late).toBe('2026-02-22');
    expect(afterMidnight).toBe('2026-02-23');
  });

  it('GetReminderSettingsUseCase returns persisted settings', async () => {
    const repository = new PersistedReminderSettingsRepository(new FakeKeyValueStore());
    await repository.setSettings({
      isEnabled: true,
      timeLocal: '19:30',
      updatedAt: new Date('2026-02-22T10:00:00.000Z').toISOString(),
    });
    const useCase = new GetReminderSettingsUseCase(repository);
    const settings = await useCase.execute();
    expect(settings.timeLocal).toBe('19:30');
    expect(settings.isEnabled).toBe(true);
  });
});
