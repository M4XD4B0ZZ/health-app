import { SavedMealTemplate, SavedMealItem } from '../../domain/models/SavedMealTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { SavedMealRepository } from '../ports/SavedMealRepository';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';

/**
 * Use-Case: Create Saved Meal Template from Date
 *
 * Nimmt alle FoodEntries von einem bestimmten Datum und erstellt
 * daraus eine SavedMealTemplate. Entries ohne Gramm-Angaben werden übersprungen.
 */
export class CreateSavedMealFromDateUseCase {
  constructor(
    private readonly foodEntryRepository: FoodEntryRepository,
    private readonly savedMealRepository: SavedMealRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(dateISO: string, name: string): Promise<SavedMealTemplate> {
    // Load all FoodEntries for the given date
    const entries = await this.foodEntryRepository.listEntriesForDate(dateISO);

    // Create template items, skipping entries without grams
    const items: SavedMealItem[] = entries
      .filter((entry) => entry.quantityGrams > 0)
      .map((entry) => ({
        parsedName: entry.parsedName,
        quantityGrams: entry.quantityGrams,
      }));

    // Generate new template
    const now = this.clock.now();
    const template: SavedMealTemplate = {
      id: this.idGenerator.newId(),
      name,
      items,
      createdAt: now,
      updatedAt: now,
    };

    // Persist template
    await this.savedMealRepository.create(template);

    return template;
  }
}
