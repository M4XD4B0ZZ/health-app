import { DailySummary, buildDailySummary } from '../../domain/summary';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { GoalsRepository } from '../ports/GoalsRepository';

export class GetDailySummaryUseCase {
  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly goalsRepository: GoalsRepository,
  ) {}

  async execute(dateISO: string): Promise<DailySummary> {
    const entries = await this.repository.listEntriesForDate(dateISO);
    const goals = await this.goalsRepository.getGoals();
    return buildDailySummary(dateISO, entries, goals);
  }
}
