import { FoodEntry } from '../../domain/models/NutritionTypes';
import { detectCanonicalEntity } from '../../domain/detectCanonicalEntity';
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
import { ResolverDecision, ResolverDecisionSummary } from '../../domain/models';
import { PortionParser } from '../../domain/portion/PortionParser';
import { computeTotals, NutritionTotalsBreakdown } from '../../domain/portion/computeTotals';
import { buildLogDecisionMeta } from '../services/explainability/buildLogDecisionMeta';
import { summarizeResolverDecision } from '../services/explainability/summarizeResolverDecision';
import { AssumptionTag } from '../../domain/models/AssumptionTag';
import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';

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
  private readonly portionParser: PortionParser;

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
    if (!resolver) throw new Error('DI_MISSING_RESOLVER');
    this.engine = new NutritionEngine();
    this.portionParser = new PortionParser();
  }

  async execute(
    input: { rawText: string; rawInput: string },
    dateISO?: string
  ): Promise<FoodEntry> {
    const { rawText, rawInput } = input;
    const traceId = `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log(`[${traceId}] PROOF UseCase entered rawText="${rawText}" rawInput="${rawInput}"`);
    try {
      if (isDebugLoggingEnabled()) {
        console.log(`[${traceId}] START rawText="${rawText}" rawInput="${rawInput}"`);
      }
      const startTimeMs = Date.now();
      const originalRawInput = rawInput;

      // Parse den Input
      const parsed = this.parser.parse(rawText);

      // Integration: Canonical Entity Detection vor Resolver
      const canonicalEntity = detectCanonicalEntity(parsed.name);
      if (canonicalEntity) {
        // Ersetze parsed.name mit kanonischem Namen für Resolver
        parsed.name = canonicalEntity.id;
      }

      // Bestimme Datum
      const entryDate = dateISO ? this.parseDateISO(dateISO) : this.clock.now();

      // Bestimme quantityGrams basierend auf Parser-Resultat
      let quantityGrams = 0;
      let confidenceScore = 0.35; // Default: low confidence

      if (parsed.quantityGrams !== undefined) {
        // Gramm-Angabe vorhanden
        quantityGrams = parsed.quantityGrams;
        confidenceScore = 0.5; // Medium confidence (wir kennen die Menge, aber nicht die Nutrition)
      } else if (
        parsed.quantityCount !== undefined &&
        canonicalEntity?.defaultPortion?.unit === 'piece' &&
        canonicalEntity.defaultPortion.grams
      ) {
        quantityGrams = parsed.quantityCount * canonicalEntity.defaultPortion.grams;
        confidenceScore = 0.5;
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
      let resolverDecision: ResolverDecision | undefined;
      let resolverDecisionSummary: ResolverDecisionSummary | undefined;
      let calcBreakdown: NutritionTotalsBreakdown | undefined;
      const portionParseResult = this.portionParser.parse(rawText, {
        hasBaseGrams: quantityGrams > 0,
      });

      let entry: FoodEntry = {
        id: this.idGenerator.newId(),
        rawInput: rawInput, // preserve original per-item rawInput
        parsedName: parsed.name,
        quantityGrams,
        grams: quantityGrams > 0 ? quantityGrams : null,
        servingMultiplier: 1,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore,
        sourceType: 'user',
        createdAt: entryDate,
      };

      // Sprint 5.3: Canonical Food Catalog Flow
      if (this.resolver) {
        const result = await this.resolveCanonicalFood(parsed.name, originalRawInput, traceId);
        resolverDecision = result.resolverDecision;
        resolverDecisionSummary = result.resolverDecisionSummary;

        if (result.canonicalFood) {
          // Fallback to 100g if no explicit quantity was parsed
          const targetGrams = quantityGrams > 0 ? quantityGrams : 100;
          const computed = computeTotals(result.canonicalFood.per100g, targetGrams, 1);
          calcBreakdown = computed;

          // Update entry with enriched data
          entry = {
            ...entry,
            grams: parseInt(targetGrams.toFixed(0), 10),
            servingMultiplier: 1,
            calories: computed.totals.calories,
            protein: computed.totals.protein,
            carbs: computed.totals.carbs,
            fat: computed.totals.fat,
            sourceType: result.sourceType,
            confidenceScore: Math.min(result.confidence, confidenceScore + 0.25),
            explanation: result.explanation,
            resolverDecisionSummary,
            calcBreakdown: {
              per100g: computed.per100g,
              gramsUsed: computed.gramsUsed,
              multiplier: computed.multiplier,
            },
          };
        }
      } else {
        console.log(`[${traceId}] PROOF early_exit reason="RESOLVER_IS_UNDEFINED"`);
      }
      // Fallback: Use old NutritionLookup if available
      if (!this.resolver && this.nutritionLookup && quantityGrams > 0) {
        console.log(
          `[${traceId}] PROOF early_exit reason="RESOLVER_IS_UNDEFINED_FELL_BACK_TO_LOOKUP"`,
        );
        const per100g = await this.nutritionLookup.getPer100gByName(parsed.name);

        if (per100g) {
          const computed = computeTotals(per100g, quantityGrams, 1);
          calcBreakdown = computed;

          // Upgrade to 'generic' source type
          const sourceType = 'generic';

          // Upgrade confidence: cap by input certainty
          const baseConfidence = this.engine.confidenceForSource(sourceType);
          const cappedConfidence = Math.min(baseConfidence, confidenceScore + 0.15);

          // Update entry with enriched data
          entry = {
            ...entry,
            grams: quantityGrams,
            servingMultiplier: 1,
            calories: computed.totals.calories,
            protein: computed.totals.protein,
            carbs: computed.totals.carbs,
            fat: computed.totals.fat,
            sourceType,
            confidenceScore: cappedConfidence,
            calcBreakdown: {
              per100g: computed.per100g,
              gramsUsed: computed.gramsUsed,
              multiplier: computed.multiplier,
            },
          };
        }
      }

      entry.logDecision = buildLogDecisionMeta({
        resolverDecision,
        portionParseResult,
        calcBreakdown,
      });

      const assumptions: AssumptionTag[] = [];
      if (portionParseResult.grams !== undefined) {
        assumptions.push('GRAMS_ASSUMED');
      }
      if (portionParseResult.multiplier !== undefined) {
        assumptions.push('MULTIPLIER_APPLIED');
      }
      if (portionParseResult.notes.includes('ML_UNSUPPORTED')) {
        assumptions.push('ML_WITHOUT_DENSITY');
      }
      if (resolverDecisionSummary?.source === 'USDA') {
        assumptions.push('SOURCE_USDA');
      }
      if (resolverDecisionSummary?.source === 'OFF') {
        assumptions.push('SOURCE_OFF');
      }
      if (resolverDecisionSummary?.source.startsWith('MOCK_')) {
        assumptions.push('SOURCE_MOCK');
      }
      if (assumptions.length > 0) {
        entry.assumptions = assumptions;
      }

      if (resolverDecisionSummary) {
        entry.resolverDecisionSummary = resolverDecisionSummary;
      }

      // P0-004: Strict Zero-Macro Blocker
      if (!entry.calories || entry.calories <= 0) {
        console.log(`[${traceId}] PROOF early_exit reason="ZERO_MACROS_BLOCKED"`);
        if (isDebugLoggingEnabled()) {
          console.log(`[${traceId}] BLOCKED reason="NO_MATCH_OR_ZERO_MACROS"`);
        }
        throw new Error(`RESOLVER_FAILED_OR_NO_MACROS for input: ${rawInput}`);
      }

      // Persist
      await this.repository.addEntry(entry);

      if (isDebugLoggingEnabled()) {
        const durationMs = Date.now() - startTimeMs;
        console.log(`[${traceId}] PERSISTED entryId="${entry.id}" durationMs=${durationMs}`);
      }

      return entry;
    } catch (err: any) {
      console.log(`[${traceId}] PROOF EXCEPTION message="${err?.message}"`);
      console.log(
        `[${traceId}] PROOF EXCEPTION stack="${String(err?.stack).split('\\n').slice(0, 3).join(' | ')}"`,
      );
      throw err;
    }
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
    traceId?: string,
  ): Promise<{
    canonicalFood: {
      per100g: { calories: number; protein: number; carbs: number; fat: number };
    } | null;
    sourceType: 'cache' | 'generic' | 'ai' | 'user';
    confidence: number;
    explanation?: string;
    resolverDecision?: ResolverDecision;
    resolverDecisionSummary?: ResolverDecisionSummary;
  }> {
    if (!this.foodCatalog) {
      console.log(`[${traceId}] PROOF early_exit reason="FOOD_CATALOG_UNDEFINED"`);
      return { canonicalFood: null, sourceType: 'user', confidence: 0.35 };
    }

    // Step 1: Normalize
    const normalized = normalizeText(parsedName);
    console.log(`[${traceId}] PROOF normalized="${normalized}"`);

    if (isDebugLoggingEnabled() && traceId) {
      console.log(`[${traceId}] NORMALIZED input="${normalized}"`);
    }

    // Step 0: Try multi-source resolver first (if available)
    if (this.resolver) {
      console.log(`[${traceId}] PROOF ABOUT_TO_RESOLVE`);
      const decision = await this.resolver.resolve(
        {
          raw: rawInput,
          normalized,
          locale: 'de',
        },
        { traceId },
      );
      console.log(`[${traceId}] PROOF RESOLVE_RETURNED hasResult=${!!decision}`);
      const summary = summarizeResolverDecision(decision);
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
          resolverDecision: decision,
          resolverDecisionSummary: summary,
        };
      }

      return {
        canonicalFood: null,
        sourceType: 'user',
        confidence: 0.35,
        explanation: decision.reasonCodes.join(', '),
        resolverDecision: decision,
        resolverDecisionSummary: summary,
      };
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
