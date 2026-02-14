/**
 * Repräsentiert einen Schlafdatensatz
 */
export interface Sleep {
  id: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  quality?: number; // Optional: Schlafqualität in Prozent (0-100)
  deepSleepMinutes?: number; // Optional: Zeit im Tiefschlaf
  remSleepMinutes?: number; // Optional: Zeit im REM-Schlaf
  lightSleepMinutes?: number; // Optional: Zeit im Leichtschlaf
}

/**
 * Zusammenfassung der Schlafdaten
 */
export interface SleepSummary {
  lastSleep: Sleep | null;
  averageDurationLastWeek: number;
  averageQualityLastWeek?: number;
}