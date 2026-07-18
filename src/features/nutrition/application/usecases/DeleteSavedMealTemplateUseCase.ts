import { SavedMealRepository } from '../ports/SavedMealRepository';
import { Clock } from '../ports/Clock';

/**
 * Use-Case: Delete Saved Meal Template
 *
 * ACC-002: soft-deletes a SavedMealTemplate anhand ihrer ID (sets the `deletedAt`
 * tombstone instead of removing it — mirrors DeleteFoodEntryUseCase/J-003). No-op, falls
 * die ID nicht existiert oder das Template bereits gelöscht ist.
 */
export class DeleteSavedMealTemplateUseCase {
  constructor(
    private readonly savedMealRepository: SavedMealRepository,
    private readonly clock: Clock,
  ) {}

  async execute(templateId: string): Promise<void> {
    await this.savedMealRepository.delete(templateId, this.clock.now());
  }
}
