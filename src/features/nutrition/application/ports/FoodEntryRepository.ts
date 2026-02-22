import { FoodEntry } from '../../domain/models/NutritionTypes';

export interface FoodEntryRepository {
  addEntry(entry: FoodEntry): Promise<void>;
  listEntriesForDate(dateISO: string): Promise<FoodEntry[]>;
  listByDateRange(startDateISO: string, endDateISO: string): Promise<FoodEntry[]>;
  updateEntry(dateISO: string, entry: FoodEntry): Promise<void>;
  getEntryById(id: string): Promise<FoodEntry | null>;
  updateEntryById(entry: FoodEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
}
