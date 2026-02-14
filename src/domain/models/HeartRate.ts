/**
 * Repräsentiert einen Herzfrequenzmesswert zu einem bestimmten Zeitpunkt
 */
export interface HeartRatePoint {
  id: string;
  timestamp: Date;
  beatsPerMinute: number;
  measurementType: 'resting' | 'active' | 'sleep' | 'other';
}

/**
 * Repräsentiert eine Sammlung von Herzfrequenzmessungen für einen Zeitraum
 */
export interface HeartRateSeries {
  date: Date;
  points: HeartRatePoint[];
  averageBpm: number;
  minBpm: number;
  maxBpm: number;
  restingBpm?: number; // Ruhepuls (falls verfügbar)
}

/**
 * Zusammenfassung der Herzfrequenzdaten
 */
export interface HeartRateSummary {
  today: HeartRateSeries | null;
  restingHeartRate: number | null; // Aktueller Ruhepuls
  weeklyAverageResting: number | null;
  weeklyTrend: 'increasing' | 'decreasing' | 'stable' | null;
}