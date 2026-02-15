import { FoodEntry } from '../../domain/models/NutritionTypes';

/**
 * Port für FoodEntry-Persistierung.
 * Implementierungen können In-Memory, SQLite, oder Cloud sein.
 */
export interface FoodEntryRepository {
  /**
   * Fügt einen neuen FoodEntry hinzu.
   */
  addEntry(entry: FoodEntry): Promise<void>;

  /**
   * Lädt alle Einträge für ein bestimmtes Datum (ISO format: YYYY-MM-DD).
   */
  listEntriesForDate(dateISO: string): Promise<FoodEntry[]>;

  /**
   * Aktualisiert einen bestehenden Eintrag für ein bestimmtes Datum.
   * Sucht den Eintrag anhand der ID und ersetzt ihn.
   */
  updateEntry(dateISO: string, entry: FoodEntry): Promise<void>;

  /**
   * Löscht einen Eintrag anhand seiner ID.
   */
  deleteEntry(id: string): Promise<void>;
}
