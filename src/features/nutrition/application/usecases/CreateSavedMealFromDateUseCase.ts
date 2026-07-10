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
      .map((entry) => {
        // SM-002: derive a frozen per-100g snapshot so log-back can compute macros
        // deterministically without re-resolving the food by name or by catalog identity.
        const factor = 100 / entry.quantityGrams;
        const per100g =
          entry.calories > 0
            ? {
                calories: entry.calories * factor,
                protein: entry.protein * factor,
                carbs: entry.carbs * factor,
                fat: entry.fat * factor,
              }
            : undefined;

        return {
          parsedName: entry.parsedName,
          quantityGrams: entry.quantityGrams,
          // SM-001: preserve the source entry's Food Catalog identity, if any, so log-back
          // can display/trace it back — the actual determinism for macros comes from
          // per100g (SM-002) below.
          ...(entry.foodCatalogRef ? { foodCatalogRef: entry.foodCatalogRef } : {}),
          ...(per100g ? { per100g } : {}),
        };
      });

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
