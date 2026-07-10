import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { Clock } from '../ports/Clock';

/**
 * Use-Case: Undo Auto-Merge
 *
 * J-005 / Journal Decision Record 1 Entscheidung 2: reverts an entry to the values it had
 * before LogFoodFromRawInputUseCase silently merged a new log into it (the values surfaced
 * via that use case's `autoMergeInfo` return field). The undo itself is logged as a
 * user-triggered correction, so the correction log accurately reflects both events in order.
 */
export class UndoAutoMergeUseCase {
  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(entryId: string, previousValues: FoodEntry): Promise<void> {
    const current = await this.repository.getEntryById(entryId);
    if (!current) {
      return;
    }

    await this.repository.appendCorrectionLogEntry(entryId, {
      timestamp: this.clock.now(),
      previousValues: current,
      triggeredBy: 'user',
    });
    await this.repository.updateEntryById(previousValues);
  }
}
