import { FoodEntryRepository } from '../../nutrition/application/ports/FoodEntryRepository';
import { NutritionReadRepository } from '../application/ports/NutritionReadRepository';

/**
 * Adapter implementation that wraps FoodEntryRepository
 * and exposes only the read model needed for journal features.
 *
 * This keeps the journal feature independent of nutrition implementation details.
 */
export class NutritionReadRepositoryFromFoodEntryRepository implements NutritionReadRepository {
  constructor(private foodEntryRepo: FoodEntryRepository) {}

  async listFoodEntriesForDate(dateISO: string): Promise<
    {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[]
  > {
    const entries = await this.foodEntryRepo.listEntriesForDate(dateISO);

    // Map to read model with only macro fields
    return entries.map((entry) => ({
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    }));
  }
}
