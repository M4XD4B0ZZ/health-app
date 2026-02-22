import { GoalsRepository } from '../../application/ports/GoalsRepository';
import { KeyValueStore } from '../../application/ports/KeyValueStore';
import { UserGoals } from '../../domain/goals/UserGoals';

export class PersistedGoalsRepository implements GoalsRepository {
  private static readonly STORAGE_KEY = 'nutrition:goals';

  constructor(private readonly keyValueStore: KeyValueStore) {}

  async getGoals(): Promise<UserGoals | null> {
    const raw = await this.keyValueStore.get(PersistedGoalsRepository.STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UserGoals;
    } catch (error) {
      console.error('Failed to parse persisted goals:', error);
      return null;
    }
  }

  async setGoals(goals: UserGoals): Promise<void> {
    await this.keyValueStore.set(PersistedGoalsRepository.STORAGE_KEY, JSON.stringify(goals));
  }
}
