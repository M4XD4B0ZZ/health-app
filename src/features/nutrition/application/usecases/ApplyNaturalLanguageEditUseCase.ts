import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { NutritionLookup } from '../ports/NutritionLookup';
import { Clock } from '../ports/Clock';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';

/**
 * Use-Case: Apply Natural Language Edit
 *
 * Parst eine natürlichsprachliche Editier-Anweisung und aktualisiert den FoodEntry.
 * Unterstützt deterministische Edits ohne AI:
 * - "200g" oder "300 g"
 * - "double portion", "double"
 * - "half portion", "half"
 * - Deutsche Varianten: "doppelt", "doppelte portion", "halb", "halbe portion"
 */
export class ApplyNaturalLanguageEditUseCase {
  private readonly engine: NutritionEngine;

  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly nutritionLookup: NutritionLookup,
    private readonly clock: Clock,
  ) {
    this.engine = new NutritionEngine();
  }

  async execute(dateISO: string, entryId: string, editInstruction: string): Promise<FoodEntry> {
    // 1. Load entry
    const entries = await this.repository.listEntriesForDate(dateISO);
    const entry = entries.find((e) => e.id === entryId);

    if (!entry) {
      throw new Error(`Entry with id ${entryId} not found for date ${dateISO}`);
    }

    // 2. Parse instruction and calculate new quantityGrams
    const newQuantityGrams = this.parseEditInstruction(editInstruction, entry.quantityGrams);

    if (newQuantityGrams === entry.quantityGrams) {
      // No change detected
      return entry;
    }

    // 3. Try to get per100g data
    const per100g = await this.nutritionLookup.getPer100gByName(entry.parsedName);

    // 4. Calculate new macros if per100g data available
    let updatedEntry: FoodEntry;

    if (per100g) {
      const macros = this.engine.calculateFromPer100g(per100g, newQuantityGrams);
      updatedEntry = {
        ...entry,
        quantityGrams: newQuantityGrams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        lastModifiedAt: this.clock.now(),
        explanation: 'Macros calculated from 100g reference.',
      };
    } else {
      // No per100g data: just update quantity, keep macros at 0 or current
      updatedEntry = {
        ...entry,
        quantityGrams: newQuantityGrams,
        lastModifiedAt: this.clock.now(),
        explanation: 'Grams provided but nutrition unknown.',
      };
    }

    // 5. Generate confidence metadata
    const confidenceMetadata = this.engine.generateConfidenceMetadata(updatedEntry);
    updatedEntry.confidenceScore = confidenceMetadata.score;
    updatedEntry.confidenceReason = confidenceMetadata.reason;

    // 6. Persist update
    await this.repository.updateEntry(dateISO, updatedEntry);

    return updatedEntry;
  }

  private parseEditInstruction(instruction: string, currentGrams: number): number {
    const normalized = instruction.trim().toLowerCase();

    // Match "200g" or "300 g"
    const gramsMatch = normalized.match(/^(\d+)\s*g$/);
    if (gramsMatch) {
      return Number.parseFloat(gramsMatch[1]);
    }

    // Match "double" variants (English)
    if (normalized === 'double portion' || normalized === 'double') {
      return currentGrams * 2;
    }

    // Match "half" variants (English)
    if (normalized === 'half portion' || normalized === 'half') {
      return currentGrams / 2;
    }

    // Match "double" variants (German)
    if (normalized === 'doppelt' || normalized === 'doppelte portion') {
      return currentGrams * 2;
    }

    // Match "half" variants (German)
    if (normalized === 'halb' || normalized === 'halbe portion') {
      return currentGrams / 2;
    }

    // No recognized instruction: return unchanged
    return currentGrams;
  }
}
