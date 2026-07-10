import { SavedMealRepository } from '../ports/SavedMealRepository';

/**
 * Use-Case: Delete Saved Meal Template
 *
 * Löscht eine SavedMealTemplate anhand ihrer ID. No-op, falls die ID nicht existiert.
 */
export class DeleteSavedMealTemplateUseCase {
  constructor(private readonly savedMealRepository: SavedMealRepository) {}

  async execute(templateId: string): Promise<void> {
    await this.savedMealRepository.delete(templateId);
  }
}
