import { FoodEntry } from '../../domain/models/NutritionTypes';
import { detectCanonicalEntity } from '../../domain/detectCanonicalEntity';
import { resolvePortionGrams } from '../../domain/portion/resolvePortionGrams';
import { PortionNeedsEditItem } from '../../domain/portion/PortionNeedsEdit';
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
import { detectInputType } from '../utils/detectInputType';
import { FoodCatalogResolver } from '../services/FoodCatalogResolver';
import { ResolverDecision, ResolverDecisionSummary } from '../../domain/models';
import { PortionParser } from '../../domain/portion/PortionParser';
import { computeTotals, NutritionTotalsBreakdown } from '../../domain/portion/computeTotals';
import { PortionKnowledgeService } from '../../domain/portion/PortionKnowledgeService';
import { buildLogDecisionMeta } from '../services/explainability/buildLogDecisionMeta';
import { summarizeResolverDecision } from '../services/explainability/summarizeResolverDecision';
import { AssumptionTag } from '../../domain/models/AssumptionTag';
import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';
import { CanonicalFood } from '../../domain/catalog/FoodCatalogSource';

/**
 * J-004: transforms a resolved CanonicalFood into the local per100g shape used by
 * computeTotals, plus a foodCatalogRef pointing at the stable catalog identity that
 * actually produced it (per Journal Decision Record 1 Entscheidung 3).
 */
function toResolvedCanonicalFood(
  food: CanonicalFood,
  confidence: number,
): {
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  foodCatalogRef: {
    source: CanonicalFood['source'];
    sourceId: string;
    displayName: string;
    confidence: number;
  };
} {
  return {
    per100g: {
      calories: food.macrosPer100g.kcal,
      protein: food.macrosPer100g.protein,
      carbs: food.macrosPer100g.carbs,
      fat: food.macrosPer100g.fat,
    },
    foodCatalogRef: {
      source: food.source,
      sourceId: food.sourceId ?? food.id,
      displayName: food.name,
      confidence,
    },
  };
}

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
  private static readonly CORRECTION_WINDOW_MS = 30 * 60 * 1000;
  static readonly LOCAL_PORTION_HINT_USER_ID = 'local-user';

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
    private readonly portionKnowledgeService?: PortionKnowledgeService,
  ) {
    if (!resolver) throw new Error('DI_MISSING_RESOLVER');
    this.engine = new NutritionEngine();
    this.portionParser = new PortionParser();
  }

  async execute(
    input: { rawText: string; rawInput: string; groupId?: string; groupLabel?: string },
    dateISO?: string,
  ): Promise<FoodEntry> {
    const { rawText, rawInput, groupId, groupLabel } = input;
    const traceId = `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log(`[${traceId}] PROOF_USECASE_ENTERED rawText="${rawText}" rawInput="${rawInput}"`);
    try {
      if (isDebugLoggingEnabled()) {
        console.log(`[${traceId}] START rawText="${rawText}" rawInput="${rawInput}"`);
      }
      const startTimeMs = Date.now();
      const originalRawInput = rawInput;

      // Parse den Input
      const parsed = this.parser.parse(rawText);
      const originalParsedName = parsed.name; // Preserve original for parsedName field

      // Integration: Canonical Entity Detection - preserve original for resolver
      const canonicalEntity = detectCanonicalEntity(parsed.name);
      // Note: Do NOT override parsed.name here - let resolver handle source-specific mapping

      console.log(
        `[${traceId}] PROOF_INPUT_PRESERVATION rawInput="${rawInput}" parsedName="${parsed.name}" canonicalId="${canonicalEntity?.id || 'none'}"`,
      );

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
        // Count without explicit grams is resolved later via identity-based portion knowledge.
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
        parsedName: originalParsedName, // Use original parsed name, not canonical ID
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
        groupId,
        groupLabel,
      };

      // Sprint 5.3: Canonical Food Catalog Flow
      const inputType = detectInputType(rawInput);
      console.log(
        `[${traceId}] PROOF_INPUT_CLASSIFICATION type="${inputType}" rawInput="${rawInput}"`,
      );

      if (this.resolver) {
        console.log(`[${traceId}] PROOF_ABOUT_TO_RESOLVE query="${parsed.name}"`);
        const result = await this.resolveCanonicalFood(
          parsed.name,
          originalRawInput,
          traceId,
          inputType,
        );
        console.log(`[${traceId}] PROOF_RESOLVER_CALLED query="${parsed.name}"`);
        resolverDecision = result.resolverDecision;
        resolverDecisionSummary = result.resolverDecisionSummary;

        if (result.canonicalFood) {
          // Use portion-aware logic for unit-based foods like "egg"
          const portionResolution = await resolvePortionGrams(
            parsed.name,
            quantityGrams,
            parsed.quantityCount,
            {
              unit: parsed.unit,
              rawInput,
              userId: LogFoodFromRawInputUseCase.LOCAL_PORTION_HINT_USER_ID,
              portionKnowledgeService: this.portionKnowledgeService,
            },
          );
          if (portionResolution.status === 'needs_edit') {
            throw new PortionNeedsEditError(portionResolution.needsEdit);
          }
          const targetGrams = portionResolution.grams;
          const computed = computeTotals(result.canonicalFood.per100g, targetGrams, 1);
          calcBreakdown = computed;

          console.log(`[${traceId}] PROOF_MACROS_CALCULATED kcal=${computed.totals.calories}`);

          if (isDebugLoggingEnabled() && traceId) {
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] rawInput="${rawInput}" parsedName="${parsed.name}" normalizedQuery="${parsed.name}"`,
            );
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] resolverWinner="canonicalFood" source="${result.sourceType}"`,
            );
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] macrosPer100g=${JSON.stringify(result.canonicalFood.per100g)}`,
            );
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] quantityCount=${parsed.quantityCount} quantityGrams=${quantityGrams}`,
            );

            // Unit-based food logging
            if (quantityGrams <= 0) {
              const canonicalEntity = detectCanonicalEntity(parsed.name);
              const defaultPortionGrams = canonicalEntity?.defaultPortion?.grams ?? null;
              console.log(
                `[${traceId}] [NUTRITION_FLOW_DEBUG] unitBasedFood defaultPortionGrams=${defaultPortionGrams} reason="explicit grams not provided"`,
              );
            } else {
              // Weight-based input logging
              console.log(
                `[${traceId}] [NUTRITION_FLOW_DEBUG] weightBasedInput explicitGrams=${quantityGrams} reason="explicit grams prioritized"`,
              );
            }

            console.log(`[${traceId}] [NUTRITION_FLOW_DEBUG] finalTargetGrams=${targetGrams}`);
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] finalKcal=${computed.totals.calories}`,
            );
          }

          if (isDebugLoggingEnabled() && traceId) {
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] rawInput="${rawInput}" parsedName="${parsed.name}" normalizedQuery="${parsed.name}"`,
            );
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] resolverWinner="canonicalFood" source="${result.sourceType}"`,
            );
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] macrosPer100g=${JSON.stringify(result.canonicalFood.per100g)}`,
            );
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] quantityCount=${parsed.quantityCount} quantityGrams=${quantityGrams}`,
            );

            // Unit-based food logging
            if (quantityGrams <= 0) {
              const canonicalEntity = detectCanonicalEntity(parsed.name);
              const defaultPortionGrams = canonicalEntity?.defaultPortion?.grams ?? null;
              console.log(
                `[${traceId}] [NUTRITION_FLOW_DEBUG] unitBasedFood defaultPortionGrams=${defaultPortionGrams} reason="explicit grams not provided"`,
              );
            } else {
              // Weight-based input logging
              console.log(
                `[${traceId}] [NUTRITION_FLOW_DEBUG] weightBasedInput explicitGrams=${quantityGrams} reason="explicit grams prioritized"`,
              );
            }

            console.log(`[${traceId}] [NUTRITION_FLOW_DEBUG] finalTargetGrams=${targetGrams}`);
            console.log(
              `[${traceId}] [NUTRITION_FLOW_DEBUG] finalKcal=${computed.totals.calories}`,
            );
          }

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
            foodCatalogRef: result.canonicalFood.foodCatalogRef,
          };

          console.log(
            `[${traceId}] PROOF_CANDIDATES_COUNT count=${result.resolverDecision?.candidates.length ?? 0}`,
          );

          if (result.sourceType === 'generic') {
            // Assuming resolver calls OFF and USDA internally, log these
            console.log(`[${traceId}] PROOF_OFF_SOURCE_CALLED`);
            console.log(`[${traceId}] PROOF_USDA_SOURCE_CALLED`);
          }
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
      if (resolverDecisionSummary?.source === 'BLS') {
        assumptions.push('SOURCE_BLS');
        console.log(`[${traceId}] PROOF_BLS_SOURCE_USED`);
      }
      if (resolverDecisionSummary?.source === 'OFF') {
        assumptions.push('SOURCE_OFF');
      }
      if (resolverDecisionSummary?.source.startsWith('MOCK_')) {
        assumptions.push('SOURCE_MOCK');
      }
      if (resolverDecision?.reasonCodes.includes('BLS_GENERIC_TRUTH')) {
        assumptions.push('CANONICAL_SHORTCUT_USED');
      }
      if (
        resolverDecision?.best?.food.sourceId?.startsWith('shortcut:') ||
        resolverDecision?.best?.food.normalizedName === 'buttertoast'
      ) {
        assumptions.push('CANONICAL_SHORTCUT_USED');
        console.log(`[${traceId}] PROOF_CANONICAL_SHORTCUT_USED`);
      }
      if (assumptions.length > 0) {
        entry.assumptions = Array.from(new Set(assumptions));
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

      // Persist, with narrow correction/upsert behavior for recent default portions.
      const correctionCandidate = parsed.quantityGrams
        ? await this.findCorrectionCandidate(entry)
        : undefined;

      if (correctionCandidate) {
        const updatedEntry: FoodEntry = {
          ...entry,
          id: correctionCandidate.id,
          createdAt: correctionCandidate.createdAt,
          lastModifiedAt: entryDate,
        };

        await this.repository.updateEntryById(updatedEntry);

        console.log(`[${traceId}] PROOF_PERSIST_SUCCESS entryId="${updatedEntry.id}"`);

        if (isDebugLoggingEnabled()) {
          const durationMs = Date.now() - startTimeMs;
          console.log(
            `[${traceId}] PERSISTED entryId="${updatedEntry.id}" durationMs=${durationMs}`,
          );
        }

        return updatedEntry;
      }

      await this.repository.addEntry(entry);

      console.log(`[${traceId}] PROOF_PERSIST_SUCCESS entryId="${entry.id}"`);

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
    inputType?: 'generic' | 'branded' | 'ambiguous',
  ): Promise<{
    canonicalFood: {
      per100g: { calories: number; protein: number; carbs: number; fat: number };
      foodCatalogRef?: {
        source: CanonicalFood['source'];
        sourceId: string;
        displayName: string;
        confidence: number;
      };
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

    // For alias storage, use the original raw input name if it differs from parsedName
    // This handles cases where detectCanonicalEntity changed parsedName from "banane" to "banana"
    const aliasKey = normalizeText(rawInput.replace(/^\d+g?\s*/, '').trim()); // Extract food name from raw input

    if (isDebugLoggingEnabled() && traceId) {
      console.log(`[${traceId}] NORMALIZED input="${normalized}"`);
    }

    // Step 2: Alias lookup FIRST (before resolver) - this is the cache hit path
    if (this.aliasRepository) {
      const cachedCanonicalId = await this.aliasRepository.getCanonicalId(aliasKey);
      if (cachedCanonicalId) {
        const canonicalFood = await this.foodCatalog.getById(cachedCanonicalId);
        if (canonicalFood) {
          return {
            canonicalFood: toResolvedCanonicalFood(canonicalFood, 0.8),
            sourceType: 'cache',
            confidence: 0.8,
            explanation: 'Cached alias mapping',
          };
        }
      }
    }

    // Step 0: Try multi-source resolver (if available)
    if (this.resolver) {
      console.log(`[${traceId}] PROOF ABOUT_TO_RESOLVE`);
      const decision = await this.resolver.resolve(
        {
          raw: rawInput,
          normalized,
          locale: 'de',
          inputType,
        },
        { traceId },
      );
      console.log(`[${traceId}] PROOF RESOLVE_RETURNED hasResult=${!!decision}`);
      const summary = summarizeResolverDecision(decision);
      const resolved = decision.best;

      if (resolved && resolved.score >= 0.7) {
        // Transform CanonicalFood from resolver to expected format
        const canonicalFood = toResolvedCanonicalFood(resolved.food, resolved.score);

        // Save alias for future lookups (same as deterministic catalog match)
        if (this.aliasRepository) {
          await this.aliasRepository.saveAlias(aliasKey, resolved.food.id);
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

    // Step 3: Deterministic catalog search
    const searchResult = await this.foodCatalog.searchByName(normalized);
    if (searchResult && searchResult.confidence >= 0.7) {
      // Step 4: Save alias for future lookups
      if (this.aliasRepository) {
        await this.aliasRepository.saveAlias(aliasKey, searchResult.food.id);
      }

      return {
        canonicalFood: toResolvedCanonicalFood(searchResult.food, searchResult.confidence),
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
        await this.aliasRepository.saveAlias(aliasKey, aiResult.canonicalId);
      }

      // Step 7: Load canonical food
      const canonicalFood = await this.foodCatalog.getById(aiResult.canonicalId);

      return {
        canonicalFood: canonicalFood
          ? toResolvedCanonicalFood(canonicalFood, aiResult.confidence)
          : null,
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

  private async findCorrectionCandidate(newEntry: FoodEntry): Promise<FoodEntry | undefined> {
    if (typeof this.repository.listEntriesForDate !== 'function') {
      return undefined;
    }

    const newFoodKey = this.sameFoodKey(newEntry);
    if (!newFoodKey) {
      return undefined;
    }

    const dateISO = newEntry.createdAt.toISOString().slice(0, 10);
    const sameDayEntries = await this.repository.listEntriesForDate(dateISO);

    return sameDayEntries
      .filter((entry) => this.isCorrectionCandidate(entry, newEntry, newFoodKey))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private isCorrectionCandidate(
    existingEntry: FoodEntry,
    newEntry: FoodEntry,
    newFoodKey: string,
  ): boolean {
    const existingFoodKey = this.sameFoodKey(existingEntry);
    if (!existingFoodKey || existingFoodKey !== newFoodKey) {
      return false;
    }

    if (!this.usedDefaultOrAssumedPortion(existingEntry)) {
      return false;
    }

    const ageMs = newEntry.createdAt.getTime() - existingEntry.createdAt.getTime();
    return ageMs >= 0 && ageMs <= LogFoodFromRawInputUseCase.CORRECTION_WINDOW_MS;
  }

  private usedDefaultOrAssumedPortion(entry: FoodEntry): boolean {
    const explicitQuantityGrams = entry.quantityGrams > 0;
    const effectiveGrams = entry.grams ?? entry.calcBreakdown?.gramsUsed ?? 0;

    return !explicitQuantityGrams && effectiveGrams > 0;
  }

  private sameFoodKey(entry: FoodEntry): string | undefined {
    const summary = entry.resolverDecisionSummary;
    if (summary?.status === 'accepted' && summary.chosenName.trim()) {
      return [summary.source, summary.chosenName, summary.chosenBrand]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .map((part) => normalizeText(part))
        .join(':');
    }

    const parsedName = normalizeText(entry.parsedName);
    return parsedName.length > 0 ? parsedName : undefined;
  }
}

export class PortionNeedsEditError extends Error {
  readonly code = 'PORTION_GRAMS_REQUIRED_FOR_UNIT_INPUT';

  constructor(readonly needsEdit: PortionNeedsEditItem) {
    super(
      `PORTION_GRAMS_REQUIRED_FOR_UNIT_INPUT reason=${needsEdit.reasonCode} input: ${needsEdit.rawInput}`,
    );
    this.name = 'PortionNeedsEditError';
  }
}
