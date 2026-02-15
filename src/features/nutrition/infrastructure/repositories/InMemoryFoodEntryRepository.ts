import { FoodEntry } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../../application/ports/FoodEntryRepository';

/**
 * In-Memory Implementierung des FoodEntryRepository.
 * Speichert Einträge in einer Map, gruppiert nach Datum (ISO format).
 */
export class InMemoryFoodEntryRepository implements FoodEntryRepository {
  private entries: Map<string, FoodEntry[]> = new Map();

  async addEntry(entry: FoodEntry): Promise<void> {
    const dateISO = this.extractDateISO(entry.createdAt);
    const dateEntries = this.entries.get(dateISO) || [];
    dateEntries.push(entry);
    this.entries.set(dateISO, dateEntries);
  }

  async listEntriesForDate(dateISO: string): Promise<FoodEntry[]> {
    const entries = this.entries.get(dateISO) || [];
    return [...entries]; // Return copy to prevent external mutation
  }

  async updateEntry(dateISO: string, entry: FoodEntry): Promise<void> {
    const dateEntries = this.entries.get(dateISO);
    if (!dateEntries) {
      throw new Error(`No entries found for date: ${dateISO}`);
    }

    const index = dateEntries.findIndex((e) => e.id === entry.id);
    if (index === -1) {
      throw new Error(`Entry with id ${entry.id} not found for date: ${dateISO}`);
    }

    dateEntries[index] = entry;
  }

  async deleteEntry(id: string): Promise<void> {
    for (const [dateISO, entries] of this.entries.entries()) {
      const index = entries.findIndex((e) => e.id === id);
      if (index !== -1) {
        entries.splice(index, 1);
        if (entries.length === 0) {
          this.entries.delete(dateISO);
        }
        return;
      }
    }
  }

  /**
   * Utility: Extrahiert das ISO-Datum (YYYY-MM-DD) aus einem Date-Objekt.
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
  clear(): void {
    this.entries.clear();
  }
}
