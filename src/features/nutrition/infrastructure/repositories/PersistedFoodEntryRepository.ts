import { FoodEntry, CorrectionLogEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../../application/ports/FoodEntryRepository';
import { KeyValueStore } from '../../application/ports/KeyValueStore';
import { AssumptionTag } from '../../domain/models/AssumptionTag';
import { DecisionMeta } from '../../domain/models/DecisionMeta';
import { ResolverDecisionSummary } from '../../domain/models/ResolverDecisionSummary';
import { getDateISOInTimezone } from '../../domain/common/DateTimezone';
import { FoodSourceType } from '../../domain/catalog/FoodCatalogSource';

/**
 * Serialisierbare Version von FoodEntry für JSON-Speicherung.
 * Date-Objekte werden als ISO-Strings gespeichert.
 */
interface SerializedFoodEntry {
  id: string;
  rawInput: string;
  parsedName: string;
  quantityGrams: number;
  grams?: number | null;
  servingMultiplier?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidenceScore: number;
  sourceType: string;
  createdAt: string; // ISO string
  explanation?: string;
  calcBreakdown?: {
    per100g: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    gramsUsed: number;
    multiplier: number;
  };
  editNote?: string;
  resolverDecisionSummary?: ResolverDecisionSummary;
  logDecision?: DecisionMeta;
  lastEditDecision?: DecisionMeta;
  assumptions?: AssumptionTag[];
  confidenceReason?: string;
  lastModifiedAt?: string; // ISO string
  groupId?: string;
  groupLabel?: string;
  nutritionSnapshot?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  foodCatalogRef?: {
    source: FoodSourceType;
    sourceId: string;
    displayName: string;
    confidence: number;
  };
  deletedAt?: string; // ISO string
}

/**
 * Serialisierbare Version von CorrectionLogEntry für JSON-Speicherung.
 */
interface SerializedCorrectionLogEntry {
  timestamp: string; // ISO string
  previousValues: SerializedFoodEntry;
  triggeredBy: 'user' | 'system';
}

/**
 * Persistierte Implementierung des FoodEntryRepository.
 * Speichert Einträge via KeyValueStore (AsyncStorage) und hält einen In-Memory-Cache.
 *
 * Storage-Strategie:
 * - Key: "nutrition:entries"
 * - Value: JSON-Array aller Einträge, gruppiert nach Datum
 * - Lazy-Loading beim ersten Zugriff
 * - Write-through: Jede Änderung wird sofort persistiert
 */
export class PersistedFoodEntryRepository implements FoodEntryRepository {
  private static readonly STORAGE_KEY = 'nutrition:entries';
  private static readonly CORRECTION_LOG_STORAGE_KEY = 'nutrition:correctionLog';

  private entries: Map<string, FoodEntry[]> = new Map();
  private correctionLog: Map<string, CorrectionLogEntry[]> = new Map();
  private isLoaded = false;

  constructor(private readonly keyValueStore: KeyValueStore) {}

  async addEntry(entry: FoodEntry): Promise<void> {
    await this.ensureLoaded();

    const dateISO = this.extractDateISO(entry.createdAt);
    const dateEntries = this.entries.get(dateISO) || [];
    dateEntries.push(entry);
    this.entries.set(dateISO, dateEntries);

    await this.persist();
  }

  async listEntriesForDate(dateISO: string): Promise<FoodEntry[]> {
    await this.ensureLoaded();

    const entries = this.entries.get(dateISO) || [];
    return entries.filter((entry) => !entry.deletedAt).map((entry) => ({ ...entry })); // Return copy to prevent external mutation
  }

  async listByDateRange(startDateISO: string, endDateISO: string): Promise<FoodEntry[]> {
    await this.ensureLoaded();

    const results: FoodEntry[] = [];
    for (const entries of this.entries.values()) {
      for (const entry of entries) {
        if (entry.deletedAt) {
          continue;
        }
        const dateISO = getDateISOInTimezone(entry.createdAt.toISOString(), 'Europe/Berlin');
        if (dateISO >= startDateISO && dateISO <= endDateISO) {
          results.push({ ...entry });
        }
      }
    }

    return results;
  }

  async updateEntry(dateISO: string, entry: FoodEntry): Promise<void> {
    await this.ensureLoaded();

    const dateEntries = this.entries.get(dateISO);
    if (!dateEntries) {
      throw new Error(`No entries found for date: ${dateISO}`);
    }

    const index = dateEntries.findIndex((e) => e.id === entry.id);
    if (index === -1) {
      throw new Error(`Entry with id ${entry.id} not found for date: ${dateISO}`);
    }

    dateEntries[index] = entry;

    await this.persist();
  }

  async getEntryById(id: string): Promise<FoodEntry | null> {
    await this.ensureLoaded();

    for (const entries of this.entries.values()) {
      const found = entries.find((entry) => entry.id === id && !entry.deletedAt);
      if (found) {
        return { ...found };
      }
    }

    return null;
  }

  async updateEntryById(entry: FoodEntry): Promise<void> {
    await this.ensureLoaded();

    for (const [dateISO, entries] of this.entries.entries()) {
      const index = entries.findIndex((existing) => existing.id === entry.id);
      if (index !== -1) {
        entries[index] = entry;
        this.entries.set(dateISO, entries);
        await this.persist();
        return;
      }
    }

    throw new Error(`Entry with id ${entry.id} not found`);
  }

  /** J-003: soft-delete — sets the tombstone (`deletedAt`) instead of removing the entry. */
  async deleteEntry(id: string, deletedAt: Date): Promise<void> {
    await this.ensureLoaded();

    for (const entries of this.entries.values()) {
      const index = entries.findIndex((e) => e.id === id && !e.deletedAt);
      if (index !== -1) {
        entries[index] = { ...entries[index], deletedAt };
        await this.persist();
        return;
      }
    }
  }

  async appendCorrectionLogEntry(entryId: string, logEntry: CorrectionLogEntry): Promise<void> {
    await this.ensureLoaded();

    const log = this.correctionLog.get(entryId) || [];
    log.push(logEntry);
    this.correctionLog.set(entryId, log);

    await this.persistCorrectionLog();
  }

  async getCorrectionLog(entryId: string): Promise<CorrectionLogEntry[]> {
    await this.ensureLoaded();

    return [...(this.correctionLog.get(entryId) || [])];
  }

  /**
   * Lädt Einträge und Correction Log aus dem Storage (lazy loading).
   */
  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    const storedData = await this.keyValueStore.get(PersistedFoodEntryRepository.STORAGE_KEY);

    if (storedData) {
      try {
        const serializedEntries: SerializedFoodEntry[] = JSON.parse(storedData);
        this.entries = this.deserializeEntries(serializedEntries);
      } catch (error) {
        // Falls Parsing fehlschlägt, starten wir mit leerer Map
        console.error('Failed to parse stored entries:', error);
        this.entries = new Map();
      }
    }

    const storedCorrectionLog = await this.keyValueStore.get(
      PersistedFoodEntryRepository.CORRECTION_LOG_STORAGE_KEY,
    );

    if (storedCorrectionLog) {
      try {
        const serializedLog: Record<string, SerializedCorrectionLogEntry[]> =
          JSON.parse(storedCorrectionLog);
        this.correctionLog = this.deserializeCorrectionLog(serializedLog);
      } catch (error) {
        console.error('Failed to parse stored correction log:', error);
        this.correctionLog = new Map();
      }
    }

    this.isLoaded = true;
  }

  /**
   * Persistiert alle Einträge in den Storage.
   */
  private async persist(): Promise<void> {
    const serializedEntries = this.serializeEntries();
    const json = JSON.stringify(serializedEntries);
    await this.keyValueStore.set(PersistedFoodEntryRepository.STORAGE_KEY, json);
  }

  /**
   * Persistiert den Correction Log in den Storage.
   */
  private async persistCorrectionLog(): Promise<void> {
    const serialized: Record<string, SerializedCorrectionLogEntry[]> = {};
    for (const [entryId, log] of this.correctionLog.entries()) {
      serialized[entryId] = log.map((logEntry) => ({
        timestamp: logEntry.timestamp.toISOString(),
        previousValues: this.serializeEntry(logEntry.previousValues),
        triggeredBy: logEntry.triggeredBy,
      }));
    }
    const json = JSON.stringify(serialized);
    await this.keyValueStore.set(PersistedFoodEntryRepository.CORRECTION_LOG_STORAGE_KEY, json);
  }

  /**
   * Deserialisiert den Correction Log.
   */
  private deserializeCorrectionLog(
    serialized: Record<string, SerializedCorrectionLogEntry[]>,
  ): Map<string, CorrectionLogEntry[]> {
    const log = new Map<string, CorrectionLogEntry[]>();
    for (const [entryId, serializedEntries] of Object.entries(serialized)) {
      log.set(
        entryId,
        serializedEntries.map((serializedEntry) => ({
          timestamp: new Date(serializedEntry.timestamp),
          previousValues: this.deserializeEntry(serializedEntry.previousValues),
          triggeredBy: serializedEntry.triggeredBy,
        })),
      );
    }
    return log;
  }

  /**
   * Serialisiert alle Einträge zu einem flachen Array.
   */
  private serializeEntries(): SerializedFoodEntry[] {
    const allEntries: SerializedFoodEntry[] = [];

    for (const dateEntries of this.entries.values()) {
      for (const entry of dateEntries) {
        allEntries.push(this.serializeEntry(entry));
      }
    }

    return allEntries;
  }

  /**
   * Serialisiert einen einzelnen FoodEntry.
   */
  private serializeEntry(entry: FoodEntry): SerializedFoodEntry {
    return {
      id: entry.id,
      rawInput: entry.rawInput,
      parsedName: entry.parsedName,
      quantityGrams: entry.quantityGrams,
      grams: entry.grams,
      servingMultiplier: entry.servingMultiplier,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      confidenceScore: entry.confidenceScore,
      sourceType: entry.sourceType,
      createdAt: entry.createdAt.toISOString(),
      explanation: entry.explanation,
      calcBreakdown: entry.calcBreakdown,
      editNote: entry.editNote,
      resolverDecisionSummary: entry.resolverDecisionSummary,
      logDecision: entry.logDecision,
      lastEditDecision: entry.lastEditDecision,
      assumptions: entry.assumptions,
      confidenceReason: entry.confidenceReason,
      lastModifiedAt: entry.lastModifiedAt?.toISOString(),
      groupId: entry.groupId,
      groupLabel: entry.groupLabel,
      nutritionSnapshot: entry.nutritionSnapshot,
      foodCatalogRef: entry.foodCatalogRef,
      deletedAt: entry.deletedAt?.toISOString(),
    };
  }

  /**
   * Deserialisiert Einträge und gruppiert sie nach Datum.
   */
  private deserializeEntries(serializedEntries: SerializedFoodEntry[]): Map<string, FoodEntry[]> {
    const entriesMap = new Map<string, FoodEntry[]>();

    for (const serialized of serializedEntries) {
      const entry = this.deserializeEntry(serialized);
      const dateISO = this.extractDateISO(entry.createdAt);

      const dateEntries = entriesMap.get(dateISO) || [];
      dateEntries.push(entry);
      entriesMap.set(dateISO, dateEntries);
    }

    return entriesMap;
  }

  /**
   * Deserialisiert einen einzelnen FoodEntry.
   */
  private deserializeEntry(serialized: SerializedFoodEntry): FoodEntry {
    const entry: FoodEntry = {
      id: serialized.id,
      rawInput: serialized.rawInput,
      parsedName: serialized.parsedName,
      quantityGrams: serialized.quantityGrams,
      calories: serialized.calories,
      protein: serialized.protein,
      carbs: serialized.carbs,
      fat: serialized.fat,
      confidenceScore: serialized.confidenceScore,
      sourceType: serialized.sourceType as any,
      createdAt: new Date(serialized.createdAt),
      explanation: serialized.explanation,
      confidenceReason: serialized.confidenceReason,
      lastModifiedAt: serialized.lastModifiedAt ? new Date(serialized.lastModifiedAt) : undefined,
    };

    if (serialized.grams !== undefined) {
      entry.grams = serialized.grams;
    }

    if (serialized.servingMultiplier !== undefined) {
      entry.servingMultiplier = serialized.servingMultiplier;
    }

    if (serialized.calcBreakdown !== undefined) {
      entry.calcBreakdown = serialized.calcBreakdown;
    }

    if (serialized.editNote !== undefined) {
      entry.editNote = serialized.editNote;
    }

    if (serialized.resolverDecisionSummary !== undefined) {
      entry.resolverDecisionSummary = serialized.resolverDecisionSummary;
    }

    if (serialized.logDecision !== undefined) {
      entry.logDecision = serialized.logDecision;
    }

    if (serialized.lastEditDecision !== undefined) {
      entry.lastEditDecision = serialized.lastEditDecision;
    }

    if (serialized.assumptions !== undefined) {
      entry.assumptions = serialized.assumptions;
    }

    if (serialized.groupId !== undefined) {
      entry.groupId = serialized.groupId;
    }

    if (serialized.groupLabel !== undefined) {
      entry.groupLabel = serialized.groupLabel;
    }

    if (serialized.nutritionSnapshot !== undefined) {
      entry.nutritionSnapshot = serialized.nutritionSnapshot;
    }

    if (serialized.foodCatalogRef !== undefined) {
      entry.foodCatalogRef = serialized.foodCatalogRef;
    }

    if (serialized.deletedAt !== undefined) {
      entry.deletedAt = new Date(serialized.deletedAt);
    }

    return entry;
  }

  /**
   * Extrahiert das ISO-Datum (YYYY-MM-DD) aus einem Date-Objekt.
   */
  private extractDateISO(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Test-Utility: Gibt alle Einträge zurück (nur für Tests).
   */
  getAllEntries(): Map<string, FoodEntry[]> {
    return new Map(this.entries);
  }

  /**
   * Test-Utility: Löscht alle Einträge (nur für Tests).
   */
  async clearAll(): Promise<void> {
    this.entries.clear();
    this.correctionLog.clear();
    this.isLoaded = true;
    await this.persist();
    await this.persistCorrectionLog();
  }
}
