import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';

describe('resolvePortionGrams', () => {
  describe('explicit grams (should not be overridden)', () => {
    it('should use explicit grams for "200g ei"', () => {
      const result = resolvePortionGrams('ei', 200, undefined);
      expect(result).toEqual({ status: 'resolved', grams: 200, reasonCode: 'EXPLICIT_GRAMS' });
    });

    it('should use explicit grams even for canonical foods', () => {
      const result = resolvePortionGrams('egg', 150, 2);
      expect(result).toEqual({ status: 'resolved', grams: 150, reasonCode: 'EXPLICIT_GRAMS' });
    });
  });

  describe('unit-based canonical foods', () => {
    it('should resolve "egg" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('egg', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "eier" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('eier', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "ei" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('ei', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "2 eggs" to 120g (2 pieces)', () => {
      const result = resolvePortionGrams('eggs', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 120,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "3 eier" to 180g (3 pieces)', () => {
      const result = resolvePortionGrams('eier', 0, 3);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 180,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "toast" to 35g (1 slice/piece)', () => {
      const result = resolvePortionGrams('toast', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 35,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 35,
      });
    });

    it('should resolve "2 scheiben toast" to 70g using toast default portion', () => {
      const result = resolvePortionGrams('toast', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 70,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 35,
      });
    });
  });

  describe('other canonical foods', () => {
    it('should resolve "apple" to 150g (1 piece)', () => {
      const result = resolvePortionGrams('apple', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 150,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 150,
      });
    });

    it('should resolve "2 bananas" to 240g (2 pieces)', () => {
      const result = resolvePortionGrams('bananas', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 240,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 120,
      });
    });

    it('should resolve "milk" to 244g (default portion)', () => {
      const result = resolvePortionGrams('milk', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 244,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 244,
      });
    });
  });

  describe('non-canonical foods', () => {
    it('should preserve legacy 100g fallback only when no explicit count is provided', () => {
      const result = resolvePortionGrams('unknownfood', 0, undefined);
      expect(result).toEqual({
        status: 'resolved',
        grams: 100,
        reasonCode: 'NO_QUANTITY_LEGACY_100G_FALLBACK',
      });
    });

    it('should require edit instead of silently using 100g for explicit unknown count foods', () => {
      const result = resolvePortionGrams('pizza', 0, 2);
      expect(result).toEqual({ status: 'needs_edit', reasonCode: 'COUNT_WITHOUT_PORTION_HINT' });
    });
  });

  describe('edge cases', () => {
    it('should handle zero quantityGrams', () => {
      const result = resolvePortionGrams('egg', 0, 2);
      expect(result).toMatchObject({ status: 'resolved', grams: 120 });
    });

    it('should handle undefined quantityCount as 1', () => {
      const result = resolvePortionGrams('egg', 0, undefined);
      expect(result).toMatchObject({ status: 'resolved', grams: 60 });
    });

    it('should handle zero quantityCount as 0', () => {
      const result = resolvePortionGrams('egg', 0, 0);
      expect(result).toMatchObject({ status: 'resolved', grams: 0 });
    });
  });
});
