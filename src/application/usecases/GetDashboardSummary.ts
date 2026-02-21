import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { Sleep } from '../../domain/models/Sleep';
import { Steps } from '../../domain/models/Steps';
import { TimeRange } from '../../domain/models/TimeRange';

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

  constructor(recoveryRepository: RecoveryRepository, nutritionRepository: NutritionRepository) {
    this.recoveryRepository = recoveryRepository;
    this.nutritionRepository = nutritionRepository;
  }

  /**
   * Führt den Usecase aus und gibt eine Dashboard-Zusammenfassung zurück
   */
  execute(range: TimeRange): DashboardSummary {
    const targetDays = range === 'today' ? 1 : 7;

    // Ernährungsdaten abrufen
    const totalCalories = this.nutritionRepository.getTotalCalories(range);
    const calorieProgress = Math.min(
      100,
      (totalCalories / (this.DEFAULT_CALORIE_GOAL * targetDays)) * 100,
    );

    // Schlafdaten abrufen
    const sleeps = this.recoveryRepository.getSleep(range);
    const lastSleep = sleeps.length > 0 ? sleeps[0] : null;
    const sleepDurationMinutes = lastSleep ? lastSleep.durationMinutes : null;
    const sleepQuality = lastSleep ? lastSleep.quality || null : null;

    // Schrittdaten abrufen
    const steps = this.recoveryRepository.getSteps(range);
    const totalSteps = steps.reduce((sum, item) => sum + item.count, 0);
    const todaySteps =
      range === 'today'
        ? (steps[0] ?? null)
        : {
            id: 'steps-last7days',
            date: new Date(),
            count: totalSteps,
          };
    const stepProgress = Math.min(100, (totalSteps / (this.DEFAULT_STEP_GOAL * targetDays)) * 100);

    // Herzfrequenzdaten abrufen
    const restingHeartRate = this.recoveryRepository.getRestingHeartRate(range);

    return {
      todayCalories: totalCalories,
      calorieGoal: this.DEFAULT_CALORIE_GOAL,
      calorieProgress,

      lastSleep,
      sleepDurationMinutes,
      sleepQuality,

      todaySteps,
      stepGoal: this.DEFAULT_STEP_GOAL,
      stepProgress,

      restingHeartRate,
    };
  }
}
