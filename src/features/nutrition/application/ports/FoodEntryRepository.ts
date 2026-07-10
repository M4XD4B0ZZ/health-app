import { FoodEntry, CorrectionLogEntry } from '../../domain/models/NutritionTypes';

export interface FoodEntryRepository {
  addEntry(entry: FoodEntry): Promise<void>;
  listEntriesForDate(dateISO: string): Promise<FoodEntry[]>;
  listByDateRange(startDateISO: string, endDateISO: string): Promise<FoodEntry[]>;
  updateEntry(dateISO: string, entry: FoodEntry): Promise<void>;
  getEntryById(id: string): Promise<FoodEntry | null>;
  updateEntryById(entry: FoodEntry): Promise<void>;
  /** J-003: soft-delete — sets the tombstone (`deletedAt`) instead of removing the entry. */
  deleteEntry(id: string, deletedAt: Date): Promise<void>;
  clearAll(): Promise<void>;
  /** J-003: append-only correction log, keyed by entry id. Internal audit/undo foundation. */
  appendCorrectionLogEntry(entryId: string, logEntry: CorrectionLogEntry): Promise<void>;
  getCorrectionLog(entryId: string): Promise<CorrectionLogEntry[]>;
}
