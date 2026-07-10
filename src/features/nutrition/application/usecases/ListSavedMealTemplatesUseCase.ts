import { SavedMealTemplate } from '../../domain/models/SavedMealTypes';
import { SavedMealRepository } from '../ports/SavedMealRepository';

/**
 * Use-Case: List Saved Meal Templates
 *
 * Gibt alle gespeicherten Mahlzeit-Vorlagen zurück.
 */
export class ListSavedMealTemplatesUseCase {
  constructor(private readonly savedMealRepository: SavedMealRepository) {}

  async execute(): Promise<SavedMealTemplate[]> {
    return this.savedMealRepository.list();
  }
}
