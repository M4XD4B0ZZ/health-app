import { Sleep, SleepSummary } from '../models/Sleep';
import { Steps, StepsSummary } from '../models/Steps';
import { HeartRatePoint, HeartRateSeries, HeartRateSummary } from '../models/HeartRate';
import { TimeRange } from '../models/TimeRange';

/**
 * Repository-Interface für alle Erholungs- und Aktivitätsdaten
 * (Schlaf, Schritte, Herzfrequenz)
 */
export interface RecoveryRepository {
  // Bereichsbasierte Abfragen
  getSleep(range: TimeRange): Sleep[];
  getSteps(range: TimeRange): Steps[];
  getRestingHeartRate(range: TimeRange): number | null;

  // Schlaf-Methoden
  getSleepById(id: string): Sleep | null;
  getLastSleep(): Sleep | null;
  getSleepsByDateRange(startDate: Date, endDate: Date): Sleep[];
  getSleepSummary(): SleepSummary;
  
  // Schritt-Methoden
  getStepsById(id: string): Steps | null;
  getStepsByDate(date: Date): Steps | null;
  getStepsByDateRange(startDate: Date, endDate: Date): Steps[];
  getStepsSummary(): StepsSummary;
  
  // Herzfrequenz-Methoden
  getHeartRatePointById(id: string): HeartRatePoint | null;
  getHeartRateSeriesByDate(date: Date): HeartRateSeries | null;
  getHeartRateSeriesByDateRange(startDate: Date, endDate: Date): HeartRateSeries[];
  getLatestHeartRate(): HeartRatePoint | null;
  getHeartRateSummary(): HeartRateSummary;
}
