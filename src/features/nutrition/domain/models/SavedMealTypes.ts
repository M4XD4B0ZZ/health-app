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
}
