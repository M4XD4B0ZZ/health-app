import { isComplexMealInput } from '../application/utils/InputComplexity';

describe('InputComplexity', () => {
  describe('isComplexMealInput', () => {
    it('should return false for empty string', () => {
      expect(isComplexMealInput('')).toBe(false);
    });

    it('should return false for simple single items', () => {
      expect(isComplexMealInput('banana')).toBe(false);
      expect(isComplexMealInput('250g chicken')).toBe(false);
      expect(isComplexMealInput('2 eggs')).toBe(false);
    });

    it('should return false for "Xer" pattern (not complex, just quantity)', () => {
      expect(isComplexMealInput('20er nuggets')).toBe(false);
      expect(isComplexMealInput('6er nuggets')).toBe(false);
      expect(isComplexMealInput('10er chicken wings')).toBe(false);
    });

    it('should return true for "mit" connector', () => {
      expect(isComplexMealInput('burger mit pommes')).toBe(true);
      expect(isComplexMealInput('20er nuggets mit cola')).toBe(true);
    });

    it('should return true for "und" connector', () => {
      expect(isComplexMealInput('apfel und banane')).toBe(true);
      expect(isComplexMealInput('salat und brot')).toBe(true);
    });

    it('should return true for "+" connector', () => {
      expect(isComplexMealInput('chicken + rice')).toBe(true);
      expect(isComplexMealInput('apple + banana')).toBe(true);
    });

    it('should return true for "&" connector', () => {
      expect(isComplexMealInput('bread & butter')).toBe(true);
    });

    it('should return true for comma-separated items (>=2 parts)', () => {
      expect(isComplexMealInput('banana, apple')).toBe(true);
      expect(isComplexMealInput('chicken, rice, salad')).toBe(true);
    });

    it('should return false for single comma without proper splitting', () => {
      expect(isComplexMealInput('banana,')).toBe(false);
      expect(isComplexMealInput(',apple')).toBe(false);
    });

    it('should handle complex real-world examples', () => {
      expect(isComplexMealInput('20er nuggets mit cola und pommes')).toBe(true);
      expect(isComplexMealInput('burger mit cola')).toBe(true);
      expect(isComplexMealInput('salat, brot und käse')).toBe(true);
    });
  });
});
