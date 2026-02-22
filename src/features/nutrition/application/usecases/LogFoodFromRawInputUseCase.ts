import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';
import { NutritionLookup } from '../ports/NutritionLookup';
import { FoodCatalog } from '../ports/FoodCatalog';
import { FoodAliasRepository } from '../ports/FoodAliasRepository';
import { AiFoodMapper } from '../ports/AiFoodMapper';
import { DeterministicFoodParser } from '../../infrastructure/parsers/DeterministicFoodParser';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';
import { normalizeText } from '../utils/normalizeText';
import { FoodCatalogResolver } from '../services/FoodCatalogResolver';

/**
 * Use-Case: Log Food Entry from Raw Input
 *
 * Sprint 5.3: Mit Canonical Food Catalog + Alias Learning
 *
 * Flow:
 * 1. Parse den Input (Gramm, Name)
 * 2. Normalize den Namen
 * 3. Alias-Lookup (Cache-Hit?)
 * 4. Falls nicht: Deterministische Catalog-Suche
 * 5. Falls confidence >= 0.7: Alias speichern
 * 6. Falls nicht: AI Mapper verwenden (falls verfügbar)
 * 7. Alias speichern nach AI-Mapping
 * 8. CanonicalFood via getById laden
 * 9. Macros deterministisch berechnen
 */
export class LogFoodFromRawInputUseCase {
  private readonly engine: NutritionEngine;

  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly parser: DeterministicFoodParser,
    private readonly foodCatalog?: FoodCatalog,
    private readonly aliasRepository?: FoodAliasRepository,
    private readonly aiFoodMapper?: AiFoodMapper,
    private readonly nutritionLookup?: NutritionLookup, // Fallback für Kompatibilität
    private readonly resolver?: FoodCatalogResolver,
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

    // Sprint 5.3: Canonical Food Catalog Flow
    if (this.foodCatalog) {
      const result = await this.resolveCanonicalFood(parsed.name, rawInput);

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
          explanation: result.explanation,
        };
      }
    }
    // Fallback: Use old NutritionLookup if available
    else if (this.nutritionLookup && quantityGrams > 0) {
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
   * Sprint 5.3: Canonical Food Resolution Flow
   * Step 0: Multi-source resolver (if available)
   * Step 1: Normalize text
   * Step 2: Alias lookup (cache hit?)
   * Step 3: Deterministic catalog search
   * Step 4: If confidence >= 0.7, save alias
   * Step 5: If not found, use AI mapper (if available)
   * Step 6: Save alias after AI mapping
   * Step 7: Load CanonicalFood by ID
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

    // Step 0: Try multi-source resolver first (if available)
    if (this.resolver) {
      const decision = await this.resolver.resolve({
        raw: rawInput,
        normalized,
        locale: 'de',
      });
      const resolved = decision.best;

      if (resolved && resolved.score >= 0.7) {
        // Transform CanonicalFood from resolver to expected format
        const canonicalFood = {
          id: resolved.food.id,
          name: resolved.food.name,
          per100g: {
            calories: resolved.food.macrosPer100g.kcal,
            protein: resolved.food.macrosPer100g.protein,
            carbs: resolved.food.macrosPer100g.carbs,
            fat: resolved.food.macrosPer100g.fat,
          },
        };

        // Save alias for future lookups (same as deterministic catalog match)
        if (this.aliasRepository) {
          await this.aliasRepository.saveAlias(normalized, resolved.food.id);
        }

        return {
          canonicalFood,
          sourceType: 'generic',
          confidence: resolved.score,
          explanation: [...decision.reasonCodes, ...resolved.breakdown.notes].join(', '),
        };
      }
    }

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
