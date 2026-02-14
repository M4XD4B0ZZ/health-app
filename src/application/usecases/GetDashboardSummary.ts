import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { Sleep } from '../../domain/models/Sleep';
import { Steps } from '../../domain/models/Steps';

/**
 * Ergebnis des Dashboard-Usecase
 */
export interface DashboardSummary {
  // Ernährung
  todayCalories: number;
  calorieGoal: number;
  calorieProgress: number; // Prozentsatz des Tagesziels
  
  // Schlaf
  lastSleep: Sleep | null;
  sleepDurationMinutes: number | null;
  sleepQuality: number | null;
  
  // Schritte
  todaySteps: Steps | null;
  stepGoal: number;
  stepProgress: number; // Prozentsatz des Tagesziels
  
  // Herzfrequenz
  restingHeartRate: number | null;
}

/**
 * Usecase zum Abrufen einer Zusammenfassung für das Dashboard
 */
export class GetDashboardSummary {
  private recoveryRepository: RecoveryRepository;
  private nutritionRepository: NutritionRepository;
  
  // Standardziele
  private readonly DEFAULT_CALORIE_GOAL = 2000;
  private readonly DEFAULT_STEP_GOAL = 10000;
  
  constructor(
    recoveryRepository: RecoveryRepository,
    nutritionRepository: NutritionRepository
  ) {
    this.recoveryRepository = recoveryRepository;
    this.nutritionRepository = nutritionRepository;
  }
  
  /**
   * Führt den Usecase aus und gibt eine Dashboard-Zusammenfassung zurück
   */
  execute(): DashboardSummary {
    // Ernährungsdaten abrufen
    const today = new Date();
    const nutritionSummary = this.nutritionRepository.getDailyNutritionSummary(today);
    const todayCalories = nutritionSummary.totalCalories;
    const calorieProgress = Math.min(100, (todayCalories / this.DEFAULT_CALORIE_GOAL) * 100);
    
    // Schlafdaten abrufen
    const lastSleep = this.recoveryRepository.getLastSleep();
    const sleepDurationMinutes = lastSleep ? lastSleep.durationMinutes : null;
    const sleepQuality = lastSleep ? lastSleep.quality || null : null;
    
    // Schrittdaten abrufen
    const todaySteps = this.recoveryRepository.getStepsByDate(today);
    const stepProgress = todaySteps 
      ? Math.min(100, (todaySteps.count / this.DEFAULT_STEP_GOAL) * 100)
      : 0;
    
    // Herzfrequenzdaten abrufen
    const restingHeartRate = this.recoveryRepository.getRestingHeartRate();
    
    return {
      todayCalories,
      calorieGoal: this.DEFAULT_CALORIE_GOAL,
      calorieProgress,
      
      lastSleep,
      sleepDurationMinutes,
      sleepQuality,
      
      todaySteps,
      stepGoal: this.DEFAULT_STEP_GOAL,
      stepProgress,
      
      restingHeartRate
    };
  }
}