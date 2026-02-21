/**
 * Repräsentiert einen Schrittdatensatz für einen bestimmten Tag
 */
export interface Steps {
  id: string;
  date: Date;
  count: number;
  distanceMeters?: number; // Optional: Zurückgelegte Distanz in Metern
  caloriesBurned?: number; // Optional: Verbrannte Kalorien durch Schritte
}

/**
 * Zusammenfassung der Schrittdaten
 */
export interface StepsSummary {
  today: Steps | null;
  weeklyAverage: number;
  weeklyTotal: number;
  monthlyAverage: number;
}
