import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { NutritionEntry, DailyNutritionSummary } from '../../domain/models/NutritionEntry';
import { TimeRange } from '../../domain/models/TimeRange';

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
  execute(range: TimeRange): NutritionSummaryResult {
    const targetDays = range === 'today' ? 1 : 7;

    const entries = this.nutritionRepository.getEntries(range);
    const totalCalories = this.nutritionRepository.getTotalCalories(range);

    const totalProteins = entries.every(e => e.proteins !== undefined)
      ? entries.reduce((sum, e) => sum + (e.proteins || 0), 0)
      : undefined;
    const totalCarbs = entries.every(e => e.carbs !== undefined)
      ? entries.reduce((sum, e) => sum + (e.carbs || 0), 0)
      : undefined;
    const totalFats = entries.every(e => e.fats !== undefined)
      ? entries.reduce((sum, e) => sum + (e.fats || 0), 0)
      : undefined;

    const mealBreakdown = {
      breakfast: entries.filter(e => e.mealType === 'breakfast').reduce((sum, e) => sum + e.calories, 0),
      lunch: entries.filter(e => e.mealType === 'lunch').reduce((sum, e) => sum + e.calories, 0),
      dinner: entries.filter(e => e.mealType === 'dinner').reduce((sum, e) => sum + e.calories, 0),
      snacks: entries.filter(e => e.mealType === 'snack').reduce((sum, e) => sum + e.calories, 0),
      other: entries
        .filter(e => e.mealType === 'other' || e.mealType === undefined)
        .reduce((sum, e) => sum + e.calories, 0),
    };

    const dailySummary: DailyNutritionSummary = {
      date: new Date(),
      entries,
      totalCalories,
      totalProteins,
      totalCarbs,
      totalFats,
      mealBreakdown,
    };

    const calorieProgress = Math.min(
      100,
      (totalCalories / (this.DEFAULT_CALORIE_GOAL * targetDays)) * 100
    );
    
    // Makronährstoff-Fortschritt berechnen (falls verfügbar)
    let proteinProgress, carbProgress, fatProgress;
    
    if (totalProteins !== undefined) {
      proteinProgress = Math.min(
        100,
        (totalProteins / (this.DEFAULT_PROTEIN_GOAL * targetDays)) * 100
      );
    }
    
    if (totalCarbs !== undefined) {
      carbProgress = Math.min(
        100,
        (totalCarbs / (this.DEFAULT_CARB_GOAL * targetDays)) * 100
      );
    }
    
    if (totalFats !== undefined) {
      fatProgress = Math.min(
        100,
        (totalFats / (this.DEFAULT_FAT_GOAL * targetDays)) * 100
      );
    }
    
    // Durchschnittliche Kalorien der letzten Woche
    const averageCaloriesLastWeek = this.nutritionRepository.getAverageCaloriesPerDay(7);
    
    return {
      dailySummary,
      todayEntries: entries,
      
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
