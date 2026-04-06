import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { FoodSearchQuery } from '../domain/catalog/FoodCatalogSource';

describe('BLS Token-based Matching', () => {
  let blsSource: BlsStaticSource;

  beforeEach(() => {
    blsSource = new BlsStaticSource();
  });

  describe('Target inputs from requirements', () => {
    it('should find BLS match for "magerquark"', async () => {
      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-magerquark',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.source).toBe('bls');
      expect(results[0].food.name).toContain('Speisequark');
      expect(results[0].food.sourceId).toBe('M713100');
      expect(results[0].match.similarity).toBeGreaterThan(0.8);
    });

    it('should find BLS match for "rührei"', async () => {
      const query: FoodSearchQuery = {
        raw: 'rührei',
        normalized: 'rührei',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-ruehrei',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.source).toBe('bls');
      expect(results[0].food.name).toContain('Ruehrei');
      expect(results[0].food.sourceId).toBe('Y720143');
      expect(results[0].match.similarity).toBeGreaterThan(0.8);
    });

    it('should find BLS shortcut for "buttertoast"', async () => {
      const query: FoodSearchQuery = {
        raw: 'buttertoast',
        normalized: 'buttertoast',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-buttertoast',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.source).toBe('bls');
      expect(results[0].food.name).toContain('Buttertoast');
      expect(results[0].food.sourceId).toBe('shortcut:buttertoast-default');
      expect(results[0].match.exact).toBe(true);
      expect(results[0].match.usedHeuristic).toBe('alias');
    });
  });

  describe('Token-based matching behavior', () => {
    it('should match "quark" to magerquark via token matching', async () => {
      const query: FoodSearchQuery = {
        raw: 'quark',
        normalized: 'quark',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-quark',
      };

      const results = await blsSource.search(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.name).toContain('Speisequark');
    });

    it('should match "toast" to toast via token matching', async () => {
      const query: FoodSearchQuery = {
        raw: 'toast',
        normalized: 'toast',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-toast',
      };

      const results = await blsSource.search(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.name).toContain('toast');
    });

    it('should handle umlauts in token matching', async () => {
      const query: FoodSearchQuery = {
        raw: 'käse',
        normalized: 'käse',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-kaese',
      };

      const results = await blsSource.search(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.name).toContain('kaese');
    });
  });

  describe('Locale and input type filtering', () => {
    it('should return empty for non-German locale', async () => {
      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'en',
        inputType: 'generic',
        traceId: 'test-en',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(0);
    });

    it('should return empty for non-generic input type', async () => {
      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'de',
        inputType: 'branded',
        traceId: 'test-branded',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(0);
    });
  });

  describe('Scoring and ranking', () => {
    it('should return results sorted by score', async () => {
      const query: FoodSearchQuery = {
        raw: 'ei',
        normalized: 'ei',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-ei',
      };

      const results = await blsSource.search(query);

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].match.similarity).toBeGreaterThanOrEqual(results[i + 1].match.similarity);
        }
      }
    });

    it('should limit results to top 3 candidates', async () => {
      const query: FoodSearchQuery = {
        raw: 'brot',
        normalized: 'brot',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-brot',
      };

      const results = await blsSource.search(query);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});