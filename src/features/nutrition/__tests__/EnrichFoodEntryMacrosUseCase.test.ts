import { EnrichFoodEntryMacrosUseCase } from '../application/usecases/EnrichFoodEntryMacrosUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemoryNutritionLookup } from '../infrastructure/repositories/InMemoryNutritionLookup';
import { FoodEntry, NutritionPer100g } from '../domain/models/NutritionTypes';

describe('EnrichFoodEntryMacrosUseCase', () => {
  let useCase: EnrichFoodEntryMacrosUseCase;
  let repository: InMemoryFoodEntryRepository;
  let lookup: InMemoryNutritionLookup;

  beforeEach(() => {
    repository = new InMemoryFoodEntryRepository();
    lookup = new InMemoryNutritionLookup();
    useCase = new EnrichFoodEntryMacrosUseCase(repository, lookup);
  });

  describe('enriches existing entry with known food', () => {
    it('should enrich entry with macros for known food', async () => {
      // Setup: Add entry with no macros
      const baseEntry: FoodEntry = {
        id: 'entry-1',
        rawInput: '150g banana',
        parsedName: 'banana',
        quantityGrams: 150,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore: 0.5,
        sourceType: 'user',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      // Execute
      const enriched = await useCase.execute('2024-01-15', 'entry-1');

      // Verify: Macros calculated for 150g banana (per 100g: 89 cal, 1.1 protein, 22.8 carbs, 0.3 fat)
      expect(enriched.calories).toBe(133.5); // 89 * 1.5
      expect(enriched.protein).toBe(1.65); // 1.1 * 1.5
      expect(enriched.carbs).toBe(34.2); // 22.8 * 1.5
      expect(enriched.fat).toBe(0.45); // 0.3 * 1.5
      expect(enriched.sourceType).toBe('generic');
      expect(enriched.confidenceScore).toBeGreaterThan(0.5); // upgraded
      expect(enriched.confidenceScore).toBeLessThanOrEqual(0.65); // capped at original + 0.15
    });

    it('should update repository with enriched entry', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-2',
        rawInput: '100g chicken breast',
        parsedName: 'chicken breast',
        quantityGrams: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore: 0.5,
        sourceType: 'user',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      await useCase.execute('2024-01-15', 'entry-2');

      // Verify repository was updated
      const entries = await repository.listEntriesForDate('2024-01-15');
      expect(entries[0].calories).toBe(165); // per 100g
      expect(entries[0].protein).toBe(31);
      expect(entries[0].sourceType).toBe('generic');
    });
  });

  describe('handles unknown food', () => {
    it('should keep macros at 0 for unknown food', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-3',
        rawInput: '100g unknown food',
        parsedName: 'unknown food',
        quantityGrams: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore: 0.5,
        sourceType: 'user',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      const result = await useCase.execute('2024-01-15', 'entry-3');

      // Verify: Macros remain 0, confidence lowered
      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
      expect(result.sourceType).toBe('user');
      expect(result.confidenceScore).toBe(0.3); // low confidence
    });
  });

  describe('handles entries without quantity', () => {
    it('should mark as low confidence when quantityGrams <= 0', async () => {
      const baseEntry: FoodEntry = {
        id: 'entry-4',
        rawInput: 'banana',
        parsedName: 'banana',
        quantityGrams: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidenceScore: 0.35,
        sourceType: 'user',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      await repository.addEntry(baseEntry);

      const result = await useCase.execute('2024-01-15', 'entry-4');

      // Verify: No enrichment, confidence remains low
      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.confidenceScore).toBe(0.3);
      expect(result.sourceType).toBe('user');
    });
  });

  describe('error handling', () => {
    it('should throw error if entry not found', async () => {
      await expect(useCase.execute('2024-01-15', 'non-existent-id')).rejects.toThrow(
        'Entry with id non-existent-id not found',
      );
    });
  });
});
