import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';
import { NutritionLookup } from '../ports/NutritionLookup';
import { FoodCatalog } from '../ports/FoodCatalog';
import { FoodAliasRepository } from '../ports/FoodAliasRepository';
import { AiFoodMapper } from '../ports/AiFoodMapper';
import { AiMealParser } from '../ports/AiMealParser';
import { DeterministicFoodParser } from '../../infrastructure/parsers/DeterministicFoodParser';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';
import { isComplexMealInput } from '../utils/InputComplexity';
import { LogFoodFromRawInputUseCase } from './LogFoodFromRawInputUseCase';
import { normalizeText } from '../utils/normalizeText';

/**
 * Use-Case: Log Meal from Raw Input (Multi-Item)
 *
 * Sprint 5.3: Mit Canonical Food Catalog + Alias Learning
 *
 * Flow:
 * A) Falls Input komplex UND aiMealParser verfügbar:
 *    - AI parst Input in mehrere Items
 *    - Für jedes Item: Canonical Food Resolution
 *    - Deterministische Makro-Berechnung
 *    - Alle Entries werden persistiert
 *
 * B) Sonst:
 *    - Fallback zum Single-Item Flow (LogFoodFromRawInputUseCase)
 */
export class LogMealFromRawInputUseCase {
  private readonly engine: NutritionEngine;
  private readonly singleItemUseCase: LogFoodFromRawInputUseCase;

  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly parser: DeterministicFoodParser,
    private readonly foodCatalog?: FoodCatalog,
    private readonly aliasRepository?: FoodAliasRepository,
    private readonly aiFoodMapper?: AiFoodMapper,
    private readonly nutritionLookup?: NutritionLookup,
    private readonly aiMealParser?: AiMealParser,
  ) {
    this.engine = new NutritionEngine();
    this.singleItemUseCase = new LogFoodFromRawInputUseCase(
      repository,
      clock,
      idGenerator,
      parser,
      foodCatalog,
      aliasRepository,
      aiFoodMapper,
      nutritionLookup,
    );
  }

  /**
   * Führt das Logging aus.
   * @returns Array von erstellten FoodEntry-Objekten (Sprint 5.5)
   */
  async execute(rawInput: string, dateISO?: string): Promise<FoodEntry[]> {
    const createdEntries: FoodEntry[] = [];

    // Prüfen ob komplex und AI verfügbar
    if (isComplexMealInput(rawInput) && this.aiMealParser) {
      // Flow A: AI-basiertes Multi-Item-Parsing
      const aiResult = await this.aiMealParser.parseMeal(rawInput);
      const entryDate = dateISO ? this.parseDateISO(dateISO) : this.clock.now();

      for (const item of aiResult.items) {
        const entry = await this.createEntryFromAiItem(item, aiResult.explanation, entryDate);
        createdEntries.push(entry);
      }
    } else {
      // Flow B: Fallback zum Single-Item Flow
      const entry = await this.singleItemUseCase.execute(rawInput, dateISO);
      createdEntries.push(entry);
    }

    return createdEntries;
  }

  /**
   * Erstellt einen FoodEntry aus einem AI-parsed Item mit Canonical Food Resolution.
   */
  private async createEntryFromAiItem(
    item: { name: string; quantity?: number; unit?: string; sizeHint?: string },
    aiExplanation: string,
    entryDate: Date,
  ): Promise<FoodEntry> {
    // Bestimme quantityGrams basierend auf Unit
    let quantityGrams = 0;
    let confidenceScore = 0.35; // Default: low confidence
    let derivedRawInput = item.name;

    if (item.quantity !== undefined && item.unit) {
      switch (item.unit) {
        case 'g':
          quantityGrams = item.quantity;
          confidenceScore = 0.5; // Medium confidence
          derivedRawInput = `${item.quantity}g ${item.name}`;
          break;

        case 'ml':
          // Annahme: 1ml ≈ 1g (für Getränke meist ok)
          quantityGrams = item.quantity;
          confidenceScore = 0.45; // Medium-low confidence (Annahme)
          derivedRawInput = `${item.quantity}ml ${item.name}`;
          break;

        case 'piece':
          // Versuche Portion Defaults falls verfügbar (Sprint 5.1 Konzept)
          // Für jetzt: quantityGrams bleibt 0, Count wird im rawInput vermerkt
          quantityGrams = 0;
          confidenceScore = 0.35; // Low confidence
          derivedRawInput = `${item.quantity}x ${item.name}`;
          break;

        case 'portion':
          // Ähnlich wie piece
          quantityGrams = 0;
          confidenceScore = 0.35; // Low confidence
          derivedRawInput = `${item.quantity} portion ${item.name}`;
          break;

        default:
          derivedRawInput = item.name;
      }
    }

    // Versuche Lookup wenn Gramm > 0
    let entry: FoodEntry = {
      id: this.idGenerator.newId(),
      rawInput: derivedRawInput,
      parsedName: item.name.toLowerCase().trim(),
      quantityGrams,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      confidenceScore,
      sourceType: 'ai', // AI structured initially
      createdAt: entryDate,
      explanation: `AI strukturierte Multi-Item-Mahlzeit. ${aiExplanation}`,
    };

    // Sprint 5.3: Canonical Food Catalog Flow
    if (this.foodCatalog) {
      const result = await this.resolveCanonicalFood(item.name, derivedRawInput);

      if (result.canonicalFood && quantityGrams > 0) {
        // Calculate macros from canonical food
        const macros = this.engine.calculateFromPer100g(
          result.canonicalFood.per100g,
          quantityGrams,
        );

        // Update entry with enriched data
        entry = {
          ...entry,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          sourceType: result.sourceType,
          confidenceScore: Math.min(result.confidence, confidenceScore + 0.25),
          explanation: `AI strukturierte Multi-Item-Mahlzeit. ${result.explanation || aiExplanation}`,
        };
      }
    }
    // Fallback: Use old NutritionLookup if available
    else if (this.nutritionLookup && quantityGrams > 0) {
      const per100g = await this.nutritionLookup.getPer100gByName(entry.parsedName);

      if (per100g) {
        // Calculate macros
        const macros = this.engine.calculateFromPer100g(per100g, quantityGrams);

        // Upgrade to 'generic' source type (Lookup-Hit ist besser als AI)
        const sourceType = 'generic';

        // Upgrade confidence
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

    // P0-004: Strict Zero-Macro Blocker
    if (!entry.calories || entry.calories <= 0) {
      throw new Error(`RESOLVER_FAILED_OR_NO_MACROS for input: ${derivedRawInput}`);
    }

    // Persist
    await this.repository.addEntry(entry);

    return entry;
  }

  /**
   * Sprint 5.3: Canonical Food Resolution Flow
   * (Similar to LogFoodFromRawInputUseCase)
   */
  private async resolveCanonicalFood(
    parsedName: string,
    rawInput: string,
  ): Promise<{
    canonicalFood: {
      per100g: { calories: number; protein: number; carbs: number; fat: number };
    } | null;
    sourceType: 'cache' | 'generic' | 'ai' | 'user';
    confidence: number;
    explanation?: string;
  }> {
    if (!this.foodCatalog) {
      return { canonicalFood: null, sourceType: 'user', confidence: 0.35 };
    }

    // Step 1: Normalize
    const normalized = normalizeText(parsedName);

    // Step 2: Alias lookup
    if (this.aliasRepository) {
      const cachedCanonicalId = await this.aliasRepository.getCanonicalId(normalized);
      if (cachedCanonicalId) {
        const canonicalFood = await this.foodCatalog.getById(cachedCanonicalId);
        if (canonicalFood) {
          return {
            canonicalFood,
            sourceType: 'cache',
            confidence: 0.8,
            explanation: 'Cached alias mapping',
          };
        }
      }
    }

    // Step 3: Deterministic catalog search
    const searchResult = await this.foodCatalog.searchByName(normalized);
    if (searchResult && searchResult.confidence >= 0.7) {
      // Step 4: Save alias for future lookups
      if (this.aliasRepository) {
        await this.aliasRepository.saveAlias(normalized, searchResult.food.id);
      }

      return {
        canonicalFood: searchResult.food,
        sourceType: 'generic',
        confidence: searchResult.confidence,
        explanation: 'Deterministic catalog match',
      };
    }

    // Step 5: AI mapper fallback (if available)
    if (this.aiFoodMapper) {
      const aiResult = await this.aiFoodMapper.mapToCanonicalFood(rawInput);

      // Step 6: Save alias
      if (this.aliasRepository) {
        await this.aliasRepository.saveAlias(normalized, aiResult.canonicalId);
      }

      // Step 7: Load canonical food
      const canonicalFood = await this.foodCatalog.getById(aiResult.canonicalId);

      return {
        canonicalFood,
        sourceType: 'ai',
        confidence: aiResult.confidence,
        explanation: aiResult.explanation,
      };
    }

    // No match found
    return { canonicalFood: null, sourceType: 'user', confidence: 0.35 };
  }

  /**
   * Wandelt ISO-Datum-String (YYYY-MM-DD) in Date-Objekt um.
   */
  private parseDateISO(dateISO: string): Date {
    return new Date(dateISO + 'T00:00:00.000Z');
  }
}
