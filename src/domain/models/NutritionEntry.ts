/**
 * Repräsentiert einen Nährwert-Eintrag (z.B. eine Mahlzeit)
 */
export interface NutritionEntry {
  id: string;
  name: string;
  timestamp: Date;
  calories: number;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

  // Makronährstoffe (optional)
  proteins?: number; // in Gramm
  carbs?: number; // in Gramm
  fats?: number; // in Gramm

  // Weitere optionale Nährwertinformationen
  sugar?: number; // in Gramm
  fiber?: number; // in Gramm
  sodium?: number; // in Milligramm
}

/**
 * Zusammenfassung der Ernährungsdaten für einen Tag
 */
export interface DailyNutritionSummary {
  date: Date;
  entries: NutritionEntry[];
  totalCalories: number;
  totalProteins?: number;
  totalCarbs?: number;
  totalFats?: number;

  // Aufschlüsselung nach Mahlzeiten (optional)
  mealBreakdown?: {
    breakfast: number; // Kalorien
    lunch: number; // Kalorien
    dinner: number; // Kalorien
    snacks: number; // Kalorien
    other: number; // Kalorien
  };
}
