import { NutritionPer100g } from '../../domain/models/NutritionTypes';

/**
 * Port für deterministic Nutrition Lookup.
 * Gibt Nährwerte pro 100g für normalisierte Lebensmittel zurück.
 */
export interface NutritionLookup {
  /**
   * Gibt Nutrition pro 100g für einen normalisierten Food-Namen zurück, falls bekannt.
   */
  getPer100gByName(normalizedName: string): Promise<NutritionPer100g | null>;

  /**
   * Fügt einen neuen Eintrag hinzu oder aktualisiert einen bestehenden.
   * Für zukünftige "Saved Meals" + Admin/Dev-Seeding.
   */
  upsertPer100gByName(normalizedName: string, per100g: NutritionPer100g): Promise<void>;
}
