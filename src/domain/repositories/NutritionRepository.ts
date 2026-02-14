import { NutritionEntry, DailyNutritionSummary } from '../models/NutritionEntry';
import { TimeRange } from '../models/TimeRange';

/**
 * Repository-Interface für Ernährungsdaten
 */
export interface NutritionRepository {
  // Bereichsbasierte Abfragen
  getEntries(range: TimeRange): NutritionEntry[];
  getTotalCalories(range: TimeRange): number;

  // Einzelne Einträge
  getNutritionEntryById(id: string): NutritionEntry | null;
  getNutritionEntriesByDate(date: Date): NutritionEntry[];
  getNutritionEntriesByDateRange(startDate: Date, endDate: Date): NutritionEntry[];
  
  // Tägliche Zusammenfassungen
  getDailyNutritionSummary(date: Date): DailyNutritionSummary;
  getDailyNutritionSummaries(startDate: Date, endDate: Date): DailyNutritionSummary[];
  
  // Statistiken
  getAverageCaloriesPerDay(days: number): number; // Durchschnitt der letzten X Tage
  getAverageMacronutrients(days: number): {
    proteins: number | null;
    carbs: number | null;
    fats: number | null;
  };
}
