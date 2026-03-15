/**
 * Read-only port for accessing nutrition data.
 * Exposes only the minimal interface needed for journal/progress features.
 * Keeps goals feature independent by not importing from nutrition.
 */
export interface NutritionReadRepository {
  /**
   * List food entries for a specific date, returning only macro fields.
   * @param dateISO - Date in ISO format (YYYY-MM-DD)
   * @returns Array of macro objects (calories, protein, carbs, fat)
   */
  listFoodEntriesForDate(dateISO: string): Promise<
    {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[]
  >;
}
