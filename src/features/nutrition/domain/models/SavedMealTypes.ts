import { FoodSourceType } from '../catalog/FoodCatalogSource';

/**
 * SavedMealTemplate Domain Model
 * Repräsentiert eine gespeicherte Mahlzeit mit mehreren Food Items.
 */
export interface SavedMealTemplate {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Ein einzelnes Item innerhalb einer SavedMeal-Vorlage.
 */
export interface SavedMealItem {
  parsedName: string;
  quantityGrams: number;
  /**
   * SM-001: reference to the Food Catalog entry the source FoodEntry was matched to at
   * template-creation time (same shape as FoodEntry.foodCatalogRef), so logging this item
   * later can reuse the exact same identity instead of re-resolving by name. Absent when
   * the source entry had none (e.g. pure AI fallback or pre-J-004 entries).
   */
  foodCatalogRef?: {
    source: FoodSourceType;
    sourceId: string;
    displayName: string;
    confidence: number;
  };
}
