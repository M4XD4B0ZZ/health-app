import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { Clock } from '../ports/Clock';

/**
 * Use-Case: Delete Food Entry
 *
 * Löscht einen FoodEntry anhand seiner ID (soft delete — J-003).
 */
export class DeleteFoodEntryUseCase {
  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(entryId: string): Promise<void> {
    const entry = await this.repository.getEntryById(entryId);
    if (!entry) {
      return;
    }

    const deletedAt = this.clock.now();
    await this.repository.appendCorrectionLogEntry(entryId, {
      timestamp: deletedAt,
      previousValues: entry,
      triggeredBy: 'user',
    });
    await this.repository.deleteEntry(entryId, deletedAt);
  }
}
