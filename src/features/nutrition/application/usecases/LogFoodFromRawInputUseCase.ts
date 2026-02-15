import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';
import { NutritionLookup } from '../ports/NutritionLookup';
import { DeterministicFoodParser } from '../../infrastructure/parsers/DeterministicFoodParser';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';

/**
 * Use-Case: Log Food Entry from Raw Input
 *
 * Nimmt rohen User-Input, parsed ihn deterministisch und speichert einen FoodEntry.
 * Optional: Falls NutritionLookup verfügbar und Gramm vorhanden, werden Macros sofort angereichert.
 */
export class LogFoodFromRawInputUseCase {
  private readonly engine: NutritionEngine;

  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly parser: DeterministicFoodParser,
    private readonly nutritionLookup?: NutritionLookup
  ) {
    this.engine = new NutritionEngine();
  }

  async execute(rawInput: string, dateISO?: string): Promise<FoodEntry> {
    // Parse den Input
    const parsed = this.parser.parse(rawInput);

    // Bestimme Datum
    const entryDate = dateISO ? this.parseDateISO(dateISO) : this.clock.now();

    // Bestimme quantityGrams basierend auf Parser-Resultat
    let quantityGrams = 0;
    let confidenceScore = 0.35; // Default: low confidence

    if (parsed.quantityGrams !== undefined) {
      // Gramm-Angabe vorhanden
      quantityGrams = parsed.quantityGrams;
      confidenceScore = 0.5; // Medium confidence (wir kennen die Menge, aber nicht die Nutrition)
    } else if (parsed.quantityCount !== undefined) {
      // Nur Count, keine Gramm-Angabe
      // Wir raten NICHT die Gramm-Anzahl, lassen es bei 0
      quantityGrams = 0;
      confidenceScore = 0.35; // Low confidence
    } else {
      // Weder Gramm noch Count
      quantityGrams = 0;
      confidenceScore = 0.35; // Low confidence
    }

    // Build base FoodEntry
    let entry: FoodEntry = {
      id: this.idGenerator.newId(),
      rawInput,
      parsedName: parsed.name,
      quantityGrams,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      confidenceScore,
      sourceType: 'user',
      createdAt: entryDate,
    };

    // Optional: Try immediate macro enrichment if grams present and lookup available
    if (this.nutritionLookup && quantityGrams > 0) {
      const per100g = await this.nutritionLookup.getPer100gByName(parsed.name);
      
      if (per100g) {
        // Calculate macros
        const macros = this.engine.calculateFromPer100g(per100g, quantityGrams);
        
        // Upgrade to 'generic' source type
        const sourceType = 'generic';
        
        // Upgrade confidence: cap by input certainty
        const baseConfidence = this.engine.confidenceForSource(sourceType);
        const cappedConfidence = Math.min(baseConfidence, confidenceScore + 0.15);
        
        // Update entry with enriched data
        entry = {
          ...entry,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          sourceType,
          confidenceScore: cappedConfidence,
        };
      }
    }

    // Persist
    await this.repository.addEntry(entry);

    return entry;
  }

  /**
   * Wandelt ISO-Datum-String (YYYY-MM-DD) in Date-Objekt um.
   */
  private parseDateISO(dateISO: string): Date {
    return new Date(dateISO + 'T00:00:00.000Z');
  }
}
