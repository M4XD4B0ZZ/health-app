import { detectCanonicalEntity, getSourceQuery } from '../domain/catalog/FoodAliasDictionary';

describe('Canonical Food Entity Detection + Source Query Adapter', () => {
  // -------------------------------------------------------------------------
  // detectCanonicalEntity
  // -------------------------------------------------------------------------

  describe('detectCanonicalEntity', () => {
    it('maps "ei" to canonicalId "egg"', () => {
      const result = detectCanonicalEntity('ei', 'de');
      expect(result.canonicalId).toBe('egg');
    });

    it('maps "eier" (plural) to canonicalId "egg"', () => {
      const result = detectCanonicalEntity('eier', 'de');
      expect(result.canonicalId).toBe('egg');
    });

    it('maps "egg" (EN) to canonicalId "egg"', () => {
      const result = detectCanonicalEntity('egg', 'en');
      expect(result.canonicalId).toBe('egg');
    });

    it('maps "eggs" (EN plural) to canonicalId "egg"', () => {
      const result = detectCanonicalEntity('eggs', 'en');
      expect(result.canonicalId).toBe('egg');
    });

    it('maps "apfel" to canonicalId "apple"', () => {
      const result = detectCanonicalEntity('apfel', 'de');
      expect(result.canonicalId).toBe('apple');
    });

    it('maps "haehnchen" (normalized umlaut) to canonicalId "chicken breast"', () => {
      const result = detectCanonicalEntity('haehnchen', 'de');
      expect(result.canonicalId).toBe('chicken breast');
    });

    it.each(['karotte', 'karotten', 'möhre', 'möhren', 'moehre', 'moehren'])(
      'maps German carrot alias "%s" to canonicalId "carrot"',
      (alias: string) => {
        const result = detectCanonicalEntity(alias, 'de');
        expect(result.canonicalId).toBe('carrot');
      },
    );

    it('returns null for unknown query', () => {
      const result = detectCanonicalEntity('hackbraten', 'de');
      expect(result.canonicalId).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getSourceQuery
  // -------------------------------------------------------------------------

  describe('getSourceQuery', () => {
    it('uses "egg" for USDA when canonicalId is known and locale is DE', () => {
      const result = getSourceQuery({
        sourceName: 'usda',
        locale: 'de',
        normalizedQuery: 'ei',
        canonicalId: 'egg',
      });
      expect(result).toBe('egg');
    });

    it('keeps original query for OFF even when canonicalId is known (DE locale)', () => {
      const result = getSourceQuery({
        sourceName: 'off',
        locale: 'de',
        normalizedQuery: 'ei',
        canonicalId: 'egg',
      });
      expect(result).toBe('ei');
    });

    it('returns normalizedQuery for USDA if no canonicalId exists', () => {
      const result = getSourceQuery({
        sourceName: 'usda',
        locale: 'de',
        normalizedQuery: 'hackbraten',
        canonicalId: null,
      });
      expect(result).toBe('hackbraten');
    });

    it('does NOT translate for USDA when locale is EN', () => {
      const result = getSourceQuery({
        sourceName: 'usda',
        locale: 'en',
        normalizedQuery: 'egg',
        canonicalId: 'egg',
      });
      expect(result).toBe('egg');
    });

    it('maps "apfel" to "apple" for USDA with DE locale', () => {
      const result = getSourceQuery({
        sourceName: 'usda',
        locale: 'de',
        normalizedQuery: 'apfel',
        canonicalId: 'apple',
      });
      expect(result).toBe('apple');
    });
  });
});
