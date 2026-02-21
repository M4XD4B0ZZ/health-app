import { DailyGoals } from '../../../goals/domain/models/GoalsTypes';
import { DailyProgress } from '../../../goals/domain/models/ProgressTypes';
import { calculateDailyProgress } from '../../../goals/application/calculators/ProgressCalculator';
import { EffectiveGoalsRepository } from '../../../goals/application/ports';
import { NutritionReadRepository } from '../ports/NutritionReadRepository';
import { aggregateConsumed, ConsumedMacros } from '../calculators/ConsumedMacrosCalculator';

/**
 * Error thrown when no effective goals are found.
 */
export class GoalsNotFoundError extends Error {
  constructor() {
    super('No effective goals found. Please set goals first.');
    this.name = 'GoalsNotFoundError';
  }
}

/**
 * Snapshot of daily progress including consumed, goals, and progress data.
 */
export interface DailyProgressSnapshot {
  dateISO: string;
  consumed: ConsumedMacros;
  goals: DailyGoals;
  progress: DailyProgress;
}

/**
 * Use case to compute daily progress for a specific date.
 *
 * Integrates nutrition (consumed) with goals (targets) to calculate progress.
 *
 * Flow:
 * 1. Load nutrition entries for the date
 * 2. Aggregate consumed macros
 * 3. Load effective goals
 * 4. Calculate daily progress
 * 5. Return complete snapshot
 */
export class ComputeProgressForDateUseCase {
  constructor(
    private nutritionReadRepo: NutritionReadRepository,
    private effectiveGoalsRepo: EffectiveGoalsRepository,
  ) {}

  async execute(dateISO: string): Promise<DailyProgressSnapshot> {
    // 1. Load and aggregate consumed macros
    const entries = await this.nutritionReadRepo.listFoodEntriesForDate(dateISO);
    const consumed = aggregateConsumed(entries);

    // 2. Load effective goals
    const effectiveGoals = await this.effectiveGoalsRepo.get();
    if (!effectiveGoals) {
      throw new GoalsNotFoundError();
    }

    const goals = effectiveGoals.goals;

    // 3. Calculate progress
    const progress = calculateDailyProgress(consumed, goals);

    // 4. Return snapshot
    return {
      dateISO,
      consumed,
      goals,
      progress,
    };
  }
}
