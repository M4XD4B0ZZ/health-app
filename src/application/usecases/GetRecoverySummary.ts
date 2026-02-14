import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { Sleep, SleepSummary } from '../../domain/models/Sleep';
import { Steps, StepsSummary } from '../../domain/models/Steps';
import { HeartRateSummary } from '../../domain/models/HeartRate';

/**
 * Ergebnis des Recovery-Usecase
 */
export interface RecoverySummaryResult {
  // Schlaf
  sleepSummary: SleepSummary;
  lastSleep: Sleep | null;
  
  // Schritte
  stepsSummary: StepsSummary;
  todaySteps: Steps | null;
  stepGoal: number;
  stepProgress: number; // Prozentsatz des Tagesziels
  
  // Herzfrequenz
  heartRateSummary: HeartRateSummary;
  restingHeartRate: number | null;
  
  // Gesamterholung
  recoveryScore: number; // 0-100 Erholungswert basierend auf Schlaf, Aktivität und Herzfrequenz
  recoveryStatus: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Usecase zum Abrufen einer Erholungszusammenfassung
 */
export class GetRecoverySummary {
  private recoveryRepository: RecoveryRepository;
  
  // Standardziele
  private readonly DEFAULT_STEP_GOAL = 10000;
  
  constructor(recoveryRepository: RecoveryRepository) {
    this.recoveryRepository = recoveryRepository;
  }
  
  /**
   * Führt den Usecase aus und gibt eine Erholungszusammenfassung zurück
   */
  execute(): RecoverySummaryResult {
    // Schlafzusammenfassung abrufen
    const sleepSummary = this.recoveryRepository.getSleepSummary();
    const lastSleep = this.recoveryRepository.getLastSleep();
    
    // Schrittzusammenfassung abrufen
    const stepsSummary = this.recoveryRepository.getStepsSummary();
    const todaySteps = this.recoveryRepository.getStepsByDate(new Date());
    const stepProgress = todaySteps 
      ? Math.min(100, (todaySteps.count / this.DEFAULT_STEP_GOAL) * 100)
      : 0;
    
    // Herzfrequenzzusammenfassung abrufen
    const heartRateSummary = this.recoveryRepository.getHeartRateSummary();
    const restingHeartRate = this.recoveryRepository.getRestingHeartRate();
    
    // Erholungswert berechnen (vereinfachte Berechnung für Mock-Daten)
    let recoveryScore = 70; // Standardwert
    
    // Schlafqualität einbeziehen (falls vorhanden)
    if (lastSleep && lastSleep.quality) {
      recoveryScore += (lastSleep.quality - 75) / 5; // Anpassung basierend auf Schlafqualität
    }
    
    // Schlafdauer einbeziehen
    if (lastSleep) {
      const optimalSleepMinutes = 480; // 8 Stunden
      const sleepDiff = lastSleep.durationMinutes - optimalSleepMinutes;
      
      if (sleepDiff < -120) { // Mehr als 2 Stunden weniger als optimal
        recoveryScore -= 15;
      } else if (sleepDiff < -60) { // 1-2 Stunden weniger
        recoveryScore -= 10;
      } else if (sleepDiff < 0) { // Bis zu 1 Stunde weniger
        recoveryScore -= 5;
      } else if (sleepDiff > 120) { // Mehr als 2 Stunden mehr
        recoveryScore += 5;
      } else if (sleepDiff > 0) { // Bis zu 2 Stunden mehr
        recoveryScore += 10;
      }
    }
    
    // Ruhepuls einbeziehen (falls vorhanden)
    if (restingHeartRate) {
      if (restingHeartRate < 50) {
        recoveryScore += 10; // Sehr gut
      } else if (restingHeartRate < 60) {
        recoveryScore += 5; // Gut
      } else if (restingHeartRate > 80) {
        recoveryScore -= 10; // Schlecht
      } else if (restingHeartRate > 70) {
        recoveryScore -= 5; // Nicht optimal
      }
    }
    
    // Erholungswert begrenzen
    recoveryScore = Math.max(0, Math.min(100, recoveryScore));
    
    // Erholungsstatus bestimmen
    let recoveryStatus: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (recoveryScore >= 85) {
      recoveryStatus = 'excellent';
    } else if (recoveryScore >= 70) {
      recoveryStatus = 'good';
    } else if (recoveryScore >= 50) {
      recoveryStatus = 'fair';
    } else {
      recoveryStatus = 'poor';
    }
    
    return {
      sleepSummary,
      lastSleep,
      
      stepsSummary,
      todaySteps,
      stepGoal: this.DEFAULT_STEP_GOAL,
      stepProgress,
      
      heartRateSummary,
      restingHeartRate,
      
      recoveryScore,
      recoveryStatus
    };
  }
}