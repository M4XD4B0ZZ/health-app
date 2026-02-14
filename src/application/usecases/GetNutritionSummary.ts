import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { NutritionEntry, DailyNutritionSummary } from '../../domain/models/NutritionEntry';

/**
 * Ergebnis des Nutrition-Usecase
 */
export interface NutritionSummaryResult {
  // Tägliche Zusammenfassung
  dailySummary: DailyNutritionSummary;
  
  // Heutige Einträge
  todayEntries: NutritionEntry[];
  
  // Ziele und Fortschritt
  calorieGoal: number;
  calorieProgress: number; // Prozentsatz des Tagesziels
  
  // Makronährstoffziele und Fortschritt (optional)
  proteinGoal?: number;
  proteinProgress?: number;
  carbGoal?: number;
  carbProgress?: number;
  fatGoal?: number;
  fatProgress?: number;
  
  // Trends
  averageCaloriesLastWeek: number;
}

/**
 * Usecase zum Abrufen einer Ernährungszusammenfassung
 */
export class GetNutritionSummary {
  private nutritionRepository: NutritionRepository;
  
  // Standardziele
  private readonly DEFAULT_CALORIE_GOAL = 2000;
  private readonly DEFAULT_PROTEIN_GOAL = 100; // in Gramm
  private readonly DEFAULT_CARB_GOAL = 250; // in Gramm
  private readonly DEFAULT_FAT_GOAL = 65; // in Gramm
  
  constructor(nutritionRepository: NutritionRepository) {
    this.nutritionRepository = nutritionRepository;
  }
  
  /**
   * Führt den Usecase aus und gibt eine Ernährungszusammenfassung zurück
   * @param date Optional: Datum für die Zusammenfassung (Standard: heute)
   */
  execute(date: Date = new Date()): NutritionSummaryResult {
    // Tägliche Zusammenfassung abrufen
    const dailySummary = this.nutritionRepository.getDailyNutritionSummary(date);
    
    // Einträge für heute abrufen
    const todayEntries = this.nutritionRepository.getNutritionEntriesByDate(date);
    
    // Fortschritt berechnen
    const calorieProgress = Math.min(100, (dailySummary.totalCalories / this.DEFAULT_CALORIE_GOAL) * 100);
    
    // Makronährstoff-Fortschritt berechnen (falls verfügbar)
    let proteinProgress, carbProgress, fatProgress;
    
    if (dailySummary.totalProteins !== undefined) {
      proteinProgress = Math.min(100, (dailySummary.totalProteins / this.DEFAULT_PROTEIN_GOAL) * 100);
    }
    
    if (dailySummary.totalCarbs !== undefined) {
      carbProgress = Math.min(100, (dailySummary.totalCarbs / this.DEFAULT_CARB_GOAL) * 100);
    }
    
    if (dailySummary.totalFats !== undefined) {
      fatProgress = Math.min(100, (dailySummary.totalFats / this.DEFAULT_FAT_GOAL) * 100);
    }
    
    // Durchschnittliche Kalorien der letzten Woche
    const averageCaloriesLastWeek = this.nutritionRepository.getAverageCaloriesPerDay(7);
    
    return {
      dailySummary,
      todayEntries,
      
      calorieGoal: this.DEFAULT_CALORIE_GOAL,
      calorieProgress,
      
      proteinGoal: this.DEFAULT_PROTEIN_GOAL,
      proteinProgress,
      
      carbGoal: this.DEFAULT_CARB_GOAL,
      carbProgress,
      
      fatGoal: this.DEFAULT_FAT_GOAL,
      fatProgress,
      
      averageCaloriesLastWeek
    };
  }
}