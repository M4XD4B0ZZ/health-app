import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { FoodSearchQuery } from '../domain/catalog/FoodCatalogSource';

describe('Ei Variants Guard Tests', () => {
  let blsSource: BlsStaticSource;

  beforeEach(() => {
    blsSource = new BlsStaticSource();
  });

  describe('DACH Guard: Prevent overly broad matches', () => {
    it('should match "ei" to neutral egg, not prepared variants', async () => {
      const query: FoodSearchQuery = {
        raw: 'ei',
        normalized: 'ei',
        locale: 'de',
        inputType: 'ambiguous',
        traceId: 'test-ei-guard',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.name).toBe('Huehnerei ganz roh');
      expect(results[0].food.sourceId).toBe('Y720100');
      expect(results[0].match.exact).toBe(true);
      expect(results[0].match.similarity).toBe(1);
    });

    it('should match "eier" to neutral egg via alias', async () => {
      const query: FoodSearchQuery = {
        raw: 'eier',
        normalized: 'eier',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-eier',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.name).toBe('Huehnerei ganz roh');
      expect(results[0].food.sourceId).toBe('Y720100');
      expect(results[0].match.exact).toBe(true);
    });

    it('should match "rührei" directly to prepared variant', async () => {
      const query: FoodSearchQuery = {
        raw: 'rührei',
        normalized: 'rührei',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-ruehrei',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.name).toBe('Rührei gebraten');
      expect(results[0].food.sourceId).toBe('Y720143');
      expect(results[0].match.exact).toBe(true);
    });

    it('should match "ruehrei" directly to prepared variant', async () => {
      const query: FoodSearchQuery = {
        raw: 'ruehrei',
        normalized: 'ruehrei',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-ruehrei-alt',
      };

      const results = await blsSource.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].food.name).toBe('Rührei gebraten');
      expect(results[0].food.sourceId).toBe('Y720143');
      expect(results[0].match.exact).toBe(true);
    });
  });

  describe('Guard behavior verification', () => {
    it('should not return prepared variants for broad single-token inputs', async () => {
      const broadInputs = ['ei', 'o']; // Very short, broad inputs

      for (const input of broadInputs) {
        const query: FoodSearchQuery = {
          raw: input,
          normalized: input,
          locale: 'de',
          inputType: 'ambiguous',
          traceId: `test-guard-${input}`,
        };

        const results = await blsSource.search(query);

        // If results exist, they should not be prepared variants with high confidence
        if (results.length > 0) {
          const topResult = results[0];
          const isPreparedFood =
            topResult.food.name.toLowerCase().includes('gebraten') ||
            topResult.food.name.toLowerCase().includes('gekocht') ||
            topResult.food.name.toLowerCase().includes('zubereitung');

          if (isPreparedFood) {
            // Guard should have reduced confidence
            expect(topResult.match.similarity).toBeLessThan(0.9);
          }
        }
      }
    });
  });
});
