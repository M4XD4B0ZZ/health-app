import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';

describe('resolvePortionGrams', () => {
  describe('explicit grams (should not be overridden)', () => {
    it('should use explicit grams for "200g ei"', () => {
      const result = resolvePortionGrams('ei', 200, undefined);
      expect(result).toBe(200);
    });

    it('should use explicit grams even for canonical foods', () => {
      const result = resolvePortionGrams('egg', 150, 2);
      expect(result).toBe(150);
    });
  });

  describe('unit-based canonical foods', () => {
    it('should resolve "egg" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('egg', 0, undefined);
      expect(result).toBe(60);
    });

    it('should resolve "eier" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('eier', 0, undefined);
      expect(result).toBe(60);
    });

    it('should resolve "ei" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('ei', 0, undefined);
      expect(result).toBe(60);
    });

    it('should resolve "2 eggs" to 120g (2 pieces)', () => {
      const result = resolvePortionGrams('eggs', 0, 2);
      expect(result).toBe(120);
    });

    it('should resolve "3 eier" to 180g (3 pieces)', () => {
      const result = resolvePortionGrams('eier', 0, 3);
      expect(result).toBe(180);
    });
  });

  describe('other canonical foods', () => {
    it('should resolve "apple" to 150g (1 piece)', () => {
      const result = resolvePortionGrams('apple', 0, undefined);
      expect(result).toBe(150);
    });

    it('should resolve "2 bananas" to 240g (2 pieces)', () => {
      const result = resolvePortionGrams('bananas', 0, 2);
      expect(result).toBe(240);
    });

    it('should resolve "milk" to 244g (default portion)', () => {
      const result = resolvePortionGrams('milk', 0, undefined);
      expect(result).toBe(244);
    });
  });

  describe('non-canonical foods', () => {
    it('should fallback to 100g for unknown foods', () => {
      const result = resolvePortionGrams('unknownfood', 0, undefined);
      expect(result).toBe(100);
    });

    it('should fallback to 100g for "pizza"', () => {
      const result = resolvePortionGrams('pizza', 0, 2);
      expect(result).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle zero quantityGrams', () => {
      const result = resolvePortionGrams('egg', 0, 2);
      expect(result).toBe(120);
    });

    it('should handle undefined quantityCount as 1', () => {
      const result = resolvePortionGrams('egg', 0, undefined);
      expect(result).toBe(60);
    });

    it('should handle zero quantityCount as 0', () => {
      const result = resolvePortionGrams('egg', 0, 0);
      expect(result).toBe(0);
    });
  });
});