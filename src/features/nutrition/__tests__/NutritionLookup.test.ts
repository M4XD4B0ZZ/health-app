import { InMemoryNutritionLookup } from '../infrastructure/repositories/InMemoryNutritionLookup';
import { NutritionPer100g } from '../domain/models/NutritionTypes';

describe('InMemoryNutritionLookup', () => {
  let lookup: InMemoryNutritionLookup;

  beforeEach(() => {
    lookup = new InMemoryNutritionLookup();
  });

  describe('getPer100gByName', () => {
    it('should return nutrition data for seeded items', async () => {
      const banana = await lookup.getPer100gByName('banana');

      expect(banana).not.toBeNull();
      expect(banana?.calories).toBe(89);
      expect(banana?.protein).toBe(1.1);
      expect(banana?.carbs).toBe(22.8);
      expect(banana?.fat).toBe(0.3);
    });

    it('should return nutrition data for chicken breast', async () => {
      const chicken = await lookup.getPer100gByName('chicken breast');

      expect(chicken).not.toBeNull();
      expect(chicken?.calories).toBe(165);
      expect(chicken?.protein).toBe(31);
    });

    it('should return null for unknown food', async () => {
      const unknown = await lookup.getPer100gByName('unknown food item');

      expect(unknown).toBeNull();
    });

    it('should normalize keys (case-insensitive, trimmed)', async () => {
      const banana1 = await lookup.getPer100gByName('BANANA');
      const banana2 = await lookup.getPer100gByName('  banana  ');
      const banana3 = await lookup.getPer100gByName('Banana');

      expect(banana1).not.toBeNull();
      expect(banana2).not.toBeNull();
      expect(banana3).not.toBeNull();
      expect(banana1?.calories).toBe(89);
      expect(banana2?.calories).toBe(89);
      expect(banana3?.calories).toBe(89);
    });
  });

  describe('upsertPer100gByName', () => {
    it('should add new nutrition data', async () => {
      const newFood: NutritionPer100g = {
        calories: 200,
        protein: 15,
        carbs: 10,
        fat: 5,
      };

      await lookup.upsertPer100gByName('test food', newFood);

      const result = await lookup.getPer100gByName('test food');
      expect(result).toEqual(newFood);
    });

    it('should update existing nutrition data', async () => {
      const updatedBanana: NutritionPer100g = {
        calories: 100,
        protein: 2,
        carbs: 25,
        fat: 0.5,
      };

      await lookup.upsertPer100gByName('banana', updatedBanana);

      const result = await lookup.getPer100gByName('banana');
      expect(result).toEqual(updatedBanana);
    });
  });
});
