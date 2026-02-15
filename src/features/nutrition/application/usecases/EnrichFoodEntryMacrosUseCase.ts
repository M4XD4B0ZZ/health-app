import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { NutritionLookup } from '../ports/NutritionLookup';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';

/**
 * Use-Case: Enrich Food Entry Macros
 * 
 * Lädt einen bestehenden FoodEntry und reichert ihn mit Makro-Daten an,
 * basierend auf NutritionLookup (deterministische Datenbank).
 */
export class EnrichFoodEntryMacrosUseCase {
  private readonly engine: NutritionEngine;

  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly nutritionLookup: NutritionLookup
  ) {
    this.engine = new NutritionEngine();
  }

  async execute(dateISO: string, entryId: string): Promise<FoodEntry> {
    // a) Load entries for date from FoodEntryRepository
    const entries = await this.repository.listEntriesForDate(dateISO);

    // b) Find the entry by id
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) {
      throw new Error(`Entry with id ${entryId} not found for date ${dateISO}`);
    }

    // c) If entry.quantityGrams <= 0: return unchanged but mark as low confidence
    if (entry.quantityGrams <= 0) {
      const updatedEntry: FoodEntry = {
        ...entry,
        confidenceScore: 0.3, // low confidence
      };
      await this.repository.updateEntry(dateISO, updatedEntry);
      return updatedEntry;
    }

    // d) Query NutritionLookup.getPer100gByName(entry.parsedName)
    const per100g = await this.nutritionLookup.getPer100gByName(entry.parsedName);

    // e) If not found: keep macros at 0, sourceType remains "user", confidence slightly down
    if (!per100g) {
      const updatedEntry: FoodEntry = {
        ...entry,
        confidenceScore: 0.3, // slightly down
      };
      await this.repository.updateEntry(dateISO, updatedEntry);
      return updatedEntry;
    }

    // f) If found: calculate macros and update entry
    const macros = this.engine.calculateFromPer100g(per100g, entry.quantityGrams);
    
    // Update entry.sourceType to "generic"
    const sourceType = 'generic';
    
    // Set entry.confidenceScore using NutritionEngine.confidenceForSource
    // BUT cap by input certainty: min(confidenceForSource(sourceType), entry.confidenceScore + 0.15)
    const baseConfidence = this.engine.confidenceForSource(sourceType);
    const cappedConfidence = Math.min(baseConfidence, entry.confidenceScore + 0.15);

    const enrichedEntry: FoodEntry = {
      ...entry,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      sourceType,
      confidenceScore: cappedConfidence,
    };

    // Persist update
    await this.repository.updateEntry(dateISO, enrichedEntry);

    return enrichedEntry;
  }
}
