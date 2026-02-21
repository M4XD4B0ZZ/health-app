import { aggregateConsumed } from '../application/calculators/ConsumedMacrosCalculator';

describe('ConsumedMacrosCalculator', () => {
  describe('aggregateConsumed', () => {
    it('should sum macros correctly from multiple entries', () => {
      const entries = [
        { calories: 100, protein: 10, carbs: 15, fat: 5 },
        { calories: 200, protein: 20, carbs: 25, fat: 10 },
        { calories: 150, protein: 15, carbs: 20, fat: 7 },
      ];

      const result = aggregateConsumed(entries);

      expect(result).toEqual({
        calories: 450,
        protein: 45,
        carbs: 60,
        fat: 22,
      });
    });

    it('should return zeros for empty array', () => {
      const result = aggregateConsumed([]);

      expect(result).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    });

    it('should round to whole numbers', () => {
      const entries = [
        { calories: 100.7, protein: 10.3, carbs: 15.8, fat: 5.2 },
        { calories: 200.2, protein: 20.6, carbs: 25.4, fat: 10.9 },
      ];

      const result = aggregateConsumed(entries);

      expect(result).toEqual({
        calories: 301, // 100.7 + 200.2 = 300.9 -> 301
        protein: 31, // 10.3 + 20.6 = 30.9 -> 31
        carbs: 41, // 15.8 + 25.4 = 41.2 -> 41
        fat: 16, // 5.2 + 10.9 = 16.1 -> 16
      });
    });

    it('should never return negative values', () => {
      const entries = [{ calories: -50, protein: -10, carbs: -5, fat: -2 }];

      const result = aggregateConsumed(entries);

      expect(result).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    });

    it('should handle single entry', () => {
      const entries = [{ calories: 250, protein: 25, carbs: 30, fat: 8 }];

      const result = aggregateConsumed(entries);

      expect(result).toEqual({
        calories: 250,
        protein: 25,
        carbs: 30,
        fat: 8,
      });
    });

    it('should clamp negative totals after summation', () => {
      const entries = [
        { calories: 100, protein: 50, carbs: 30, fat: 10 },
        { calories: -150, protein: -60, carbs: -40, fat: -15 },
      ];

      const result = aggregateConsumed(entries);

      expect(result).toEqual({
        calories: 0, // 100 - 150 = -50 -> 0
        protein: 0, // 50 - 60 = -10 -> 0
        carbs: 0, // 30 - 40 = -10 -> 0
        fat: 0, // 10 - 15 = -5 -> 0
      });
    });
  });
});
