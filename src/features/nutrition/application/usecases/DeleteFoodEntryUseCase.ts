import { FoodEntryRepository } from '../ports/FoodEntryRepository';

/**
 * Use-Case: Delete Food Entry
 * 
 * Löscht einen FoodEntry anhand seiner ID.
 */
export class DeleteFoodEntryUseCase {
  constructor(private readonly repository: FoodEntryRepository) {}

  async execute(entryId: string): Promise<void> {
    await this.repository.deleteEntry(entryId);
  }
}
