import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { SavedMealRepository } from '../ports/SavedMealRepository';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';
import { NutritionLookup } from '../ports/NutritionLookup';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';

/**
 * Use-Case: Log Saved Meal to Date
 *
 * Lädt eine SavedMealTemplate und erstellt für jedes Item einen neuen FoodEntry
 * am angegebenen Datum. Macros werden deterministisch angereichert, falls
 * NutritionLookup verfügbar ist.
 */
export class LogSavedMealToDateUseCase {
  private readonly engine: NutritionEngine;

  constructor(
    private readonly savedMealRepository: SavedMealRepository,
    private readonly foodEntryRepository: FoodEntryRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly nutritionLookup?: NutritionLookup,
  ) {
    this.engine = new NutritionEngine();
  }

  async execute(templateId: string, dateISO: string): Promise<FoodEntry[]> {
    // Load template
    const template = await this.savedMealRepository.getById(templateId);
    if (!template) {
      throw new Error(`SavedMealTemplate with id ${templateId} not found`);
    }

    // Parse date
    const entryDate = this.parseDateISO(dateISO);

    // Create FoodEntries for each item
    const entries: FoodEntry[] = [];

    for (const item of template.items) {
      // Create rawInput like "200g chicken"
      const rawInput = `${item.quantityGrams}g ${item.parsedName}`;

      // Build base entry
      let entry: FoodEntry = {
        id: this.idGenerator.newId(),
        rawInput,
        parsedName: item.parsedName,
        quantityGrams: item.quantityGrams,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore: 0.3, // Default: user/low confidence
        sourceType: 'user',
        createdAt: entryDate,
      };

      // Try to enrich macros deterministically
      if (this.nutritionLookup && item.quantityGrams > 0) {
        const per100g = await this.nutritionLookup.getPer100gByName(item.parsedName);

        if (per100g) {
          // Calculate macros
          const macros = this.engine.calculateFromPer100g(per100g, item.quantityGrams);

          // Upgrade to 'generic' source type
          entry.sourceType = 'generic';

          // Update macros
          entry.calories = macros.calories;
          entry.protein = macros.protein;
          entry.carbs = macros.carbs;
          entry.fat = macros.fat;

          // Update confidence
          entry.confidenceScore = this.engine.confidenceForSource('generic');
        }
      }

      // Generate confidence metadata
      const metadata = this.engine.generateConfidenceMetadata(entry);
      entry.explanation = `Template: ${template.name}`;
      entry.confidenceReason = metadata.reason;

      // Persist entry
      await this.foodEntryRepository.addEntry(entry);
      entries.push(entry);
    }

    return entries;
  }

  /**
   * Wandelt ISO-Datum-String (YYYY-MM-DD) in Date-Objekt um.
   */
  private parseDateISO(dateISO: string): Date {
    return new Date(dateISO + 'T00:00:00.000Z');
  }
}
