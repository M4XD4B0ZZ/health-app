import { DailySummary, buildDailySummary } from '../../domain/summary';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { EffectiveGoalsRepository } from '../../../goals/application/ports';

/**
 * GE-006: reads goals from the real, screen-wired `EffectiveGoalsRepository`
 * (`src/features/goals`) — the single source of truth for goal targets, replacing the
 * previously-separate, unused-by-UI `GoalsRepository`/`UserGoals` system.
 */
export class GetDailySummaryUseCase {
  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly effectiveGoalsRepository: EffectiveGoalsRepository,
  ) {}

  async execute(dateISO: string): Promise<DailySummary> {
    const entries = await this.repository.listEntriesForDate(dateISO);
    const effectiveGoals = await this.effectiveGoalsRepository.get();
    return buildDailySummary(dateISO, entries, effectiveGoals?.goals ?? null);
  }
}
