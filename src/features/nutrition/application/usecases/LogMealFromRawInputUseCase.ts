import { FoodEntry, CorrectionLogEntry } from '../../domain/models/NutritionTypes';
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
import { FoodCatalogResolver } from '../services/FoodCatalogResolver';
import { PortionKnowledgeService } from '../../domain/portion/PortionKnowledgeService';
import { normalizeText } from '../utils/normalizeText';
import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';
import { splitMultiItemInput, buildGroupInfoByItemIndex } from '../utils/splitMultiItemInput';
import { CanonicalFood } from '../../domain/catalog/FoodCatalogSource';

function toLegacyPer100g(food: CanonicalFood): {
  per100g: { calories: number; protein: number; carbs: number; fat: number };
} {
  return {
    per100g: {
      calories: food.macrosPer100g.kcal,
      protein: food.macrosPer100g.protein,
      carbs: food.macrosPer100g.carbs,
      fat: food.macrosPer100g.fat,
    },
  };
}

export interface MultiItemSplitFailureItem {
  rawText: string;
  index: number;
  reason: string;
}

export interface MultiItemSplitRecognizedItem {
  rawText: string;
  parsedName: string;
  calories: number;
}

export interface MultiItemSplitFailureResult {
  status: 'blocked_partial_failure';
  recognizedItems: MultiItemSplitRecognizedItem[];
  failedItems: MultiItemSplitFailureItem[];
  explanation: string;
}

export type LogMealFromRawInputResult = FoodEntry[] | MultiItemSplitFailureResult;

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
    private readonly resolver?: FoodCatalogResolver,
    private readonly portionKnowledgeService?: PortionKnowledgeService,
  ) {
    this.engine = new NutritionEngine();
    this.singleItemUseCase = this.createSingleItemUseCase(repository, this.aliasRepository);
  }

  private createSingleItemUseCase(
    repository: FoodEntryRepository,
    aliasRepository: FoodAliasRepository | undefined,
  ): LogFoodFromRawInputUseCase {
    return new LogFoodFromRawInputUseCase(
      repository,
      this.clock,
      this.idGenerator,
      this.parser,
      this.foodCatalog,
      aliasRepository,
      this.aiFoodMapper,
      this.nutritionLookup,
      this.resolver,
      this.portionKnowledgeService,
    );
  }

  /**
   * Führt das Logging aus.
   * @returns Array von erstellten FoodEntry-Objekten oder strukturierte Partial-Failure-Info
   */
  async execute(rawInput: string, dateISO?: string): Promise<LogMealFromRawInputResult> {
    const createdEntries: FoodEntry[] = [];

    const splitResult = splitMultiItemInput(rawInput);

    if (splitResult.wasSplit) {
      const failedItems: MultiItemSplitFailureItem[] = [];
      const stagedRepository = new StagedFoodEntryRepository();
      const stagedSingleItemUseCase = this.createSingleItemUseCase(stagedRepository, undefined);

      const groupInfoByItemIndex = buildGroupInfoByItemIndex(splitResult);

      for (const item of splitResult.items) {
        try {
          const groupInfo = groupInfoByItemIndex.get(item.index);
          const entry = await stagedSingleItemUseCase.execute(
            {
              rawText: item.rawText,
              rawInput: item.rawText,
              groupId: groupInfo?.groupId,
              groupLabel: groupInfo?.groupLabel,
            },
            dateISO,
          );
          createdEntries.push(entry);
        } catch (error) {
          failedItems.push({
            rawText: item.rawText,
            index: item.index,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (failedItems.length > 0) {
        return {
          status: 'blocked_partial_failure',
          recognizedItems: createdEntries.map((entry) => ({
            rawText: entry.rawInput,
            parsedName: entry.parsedName,
            calories: entry.calories,
          })),
          failedItems,
          explanation:
            'Multi-item save was blocked because one or more items could not be resolved. Nothing was saved automatically.',
        };
      }

      for (const entry of createdEntries) {
        await this.repository.addEntry(entry);
      }

      return createdEntries;
    }

    // Prüfen ob komplex und AI verfügbar
    if (isComplexMealInput(rawInput) && this.aiMealParser) {
      const traceId = `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      if (isDebugLoggingEnabled()) {
        console.log(`[${traceId}] START rawInput="${rawInput}" (complex meal)`);
      }
      const startTimeMs = Date.now();

      // Flow A: AI-basiertes Multi-Item-Parsing
      const aiResult = await this.aiMealParser.parseMeal(rawInput);
      const entryDate = dateISO ? this.parseDateISO(dateISO) : this.clock.now();

      for (const item of aiResult.items) {
        const entry = await this.createEntryFromAiItem(
          item,
          aiResult.explanation,
          entryDate,
          traceId,
          startTimeMs,
        );
        createdEntries.push(entry);
      }
    } else {
      // Flow B: Fallback zum Single-Item Flow
      const entry = await this.singleItemUseCase.execute({ rawText: rawInput, rawInput }, dateISO);
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
    traceId?: string,
    startTimeMs?: number,
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
      const result = await this.resolveCanonicalFood(item.name, derivedRawInput, traceId);

      if (result.canonicalFood) {
        // Calculate macros from canonical food (even if quantityGrams = 0 for pieces/portions)
        const macros = this.engine.calculateFromPer100g(
          result.canonicalFood.per100g,
          quantityGrams > 0 ? quantityGrams : 100, // Use 100g as default for pieces/portions
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
      if (isDebugLoggingEnabled() && traceId) {
        console.log(
          `[${traceId}] BLOCKED reason="NO_MATCH_OR_ZERO_MACROS" item="${derivedRawInput}"`,
        );
      }
      throw new Error(`RESOLVER_FAILED_OR_NO_MACROS for input: ${derivedRawInput}`);
    }

    // Persist
    await this.repository.addEntry(entry);

    if (isDebugLoggingEnabled() && traceId && startTimeMs) {
      const durationMs = Date.now() - startTimeMs;
      console.log(`[${traceId}] PERSISTED entryId="${entry.id}" durationMs=${durationMs}`);
    }

    return entry;
  }

  /**
   * Sprint 5.3: Canonical Food Resolution Flow
   * (Similar to LogFoodFromRawInputUseCase)
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
  }> {
    if (!this.foodCatalog) {
      return { canonicalFood: null, sourceType: 'user', confidence: 0.35 };
    }

    // Step 1: Normalize
    const normalized = normalizeText(parsedName);

    if (isDebugLoggingEnabled() && traceId) {
      console.log(`[${traceId}] NORMALIZED input="${normalized}"`);
    }

    // Step 2: Alias lookup
    if (this.aliasRepository) {
      const cachedCanonicalId = await this.aliasRepository.getCanonicalId(normalized);
      if (cachedCanonicalId) {
        const canonicalFood = await this.foodCatalog.getById(cachedCanonicalId);
        if (canonicalFood) {
          return {
            canonicalFood: toLegacyPer100g(canonicalFood),
            sourceType: 'cache',
            confidence: 0.8,
            explanation: 'Cached alias mapping',
          };
        }
      }
    }

    // Step 3: Use Resolver if available (Sprint 5.3)
    if (this.resolver) {
      const resolverResult = await this.resolver.resolve({
        raw: rawInput,
        normalized,
        locale: 'de',
      });

      if (resolverResult.status === 'accepted' && resolverResult.best) {
        // Step 4: Save alias for future lookups
        if (this.aliasRepository) {
          await this.aliasRepository.saveAlias(normalized, resolverResult.best.food.id);
        }

        return {
          canonicalFood: toLegacyPer100g(resolverResult.best.food),
          sourceType: 'generic',
          confidence: resolverResult.best.score,
          explanation: `Resolver match: ${resolverResult.best.food.name}`,
        };
      }
    }

    // Step 3b: Fallback to deterministic catalog search
    const searchResult = await this.foodCatalog.searchByName(normalized);
    if (searchResult && searchResult.confidence >= 0.7) {
      // Step 4: Save alias for future lookups
      if (this.aliasRepository) {
        await this.aliasRepository.saveAlias(normalized, searchResult.food.id);
      }

      return {
        canonicalFood: toLegacyPer100g(searchResult.food),
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
        canonicalFood: canonicalFood ? toLegacyPer100g(canonicalFood) : null,
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

class StagedFoodEntryRepository implements FoodEntryRepository {
  private readonly entries: FoodEntry[] = [];
  private readonly correctionLog: Map<string, CorrectionLogEntry[]> = new Map();

  async addEntry(entry: FoodEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listEntriesForDate(): Promise<FoodEntry[]> {
    return this.entries.filter((entry) => !entry.deletedAt);
  }

  async listByDateRange(): Promise<FoodEntry[]> {
    return this.entries.filter((entry) => !entry.deletedAt);
  }

  async updateEntry(_dateISO: string, entry: FoodEntry): Promise<void> {
    await this.updateEntryById(entry);
  }

  async getEntryById(id: string): Promise<FoodEntry | null> {
    return this.entries.find((entry) => entry.id === id && !entry.deletedAt) ?? null;
  }

  async updateEntryById(entry: FoodEntry): Promise<void> {
    const index = this.entries.findIndex((existing) => existing.id === entry.id);
    if (index === -1) {
      throw new Error(`Entry with id ${entry.id} not found`);
    }
    this.entries[index] = entry;
  }

  async deleteEntry(id: string, deletedAt: Date): Promise<void> {
    const index = this.entries.findIndex((entry) => entry.id === id && !entry.deletedAt);
    if (index !== -1) {
      this.entries[index] = { ...this.entries[index], deletedAt };
    }
  }

  async appendCorrectionLogEntry(entryId: string, logEntry: CorrectionLogEntry): Promise<void> {
    const log = this.correctionLog.get(entryId) || [];
    log.push(logEntry);
    this.correctionLog.set(entryId, log);
  }

  async getCorrectionLog(entryId: string): Promise<CorrectionLogEntry[]> {
    return [...(this.correctionLog.get(entryId) || [])];
  }

  async clearAll(): Promise<void> {
    this.entries.length = 0;
    this.correctionLog.clear();
  }
}
