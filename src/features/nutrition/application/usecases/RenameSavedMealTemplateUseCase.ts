import { SavedMealTemplate } from '../../domain/models/SavedMealTypes';
import { SavedMealRepository } from '../ports/SavedMealRepository';
import { Clock } from '../ports/Clock';

/**
 * Use-Case: Rename Saved Meal Template
 *
 * Benennt eine bestehende SavedMealTemplate um und aktualisiert `updatedAt`.
 * Wirft einen Fehler, falls die ID nicht existiert.
 */
export class RenameSavedMealTemplateUseCase {
  constructor(
    private readonly savedMealRepository: SavedMealRepository,
    private readonly clock: Clock,
  ) {}

  async execute(templateId: string, name: string): Promise<SavedMealTemplate> {
    const template = await this.savedMealRepository.getById(templateId);
    if (!template) {
      throw new Error(`SavedMealTemplate with id ${templateId} not found`);
    }

    const updated: SavedMealTemplate = {
      ...template,
      name,
      updatedAt: this.clock.now(),
    };

    await this.savedMealRepository.update(updated);

    return updated;
  }
}
