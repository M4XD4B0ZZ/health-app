import { EffectiveGoals } from '../domain/models/GoalsTypes';
import { EffectiveGoalsRepository } from '../application/ports';

/**
 * In-memory implementation of EffectiveGoalsRepository
 * Stores a single set of effective goals
 */
export class InMemoryEffectiveGoalsRepository implements EffectiveGoalsRepository {
  private goals: EffectiveGoals | null = null;

  async get(): Promise<EffectiveGoals | null> {
    return this.goals;
  }

  async upsert(goals: EffectiveGoals): Promise<void> {
    this.goals = goals;
  }

  // Helper for testing
  clear(): void {
    this.goals = null;
  }
}
