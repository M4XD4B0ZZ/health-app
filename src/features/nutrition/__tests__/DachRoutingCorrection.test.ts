import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { detectInputType } from '../application/utils/detectInputType';

describe('DACH Routing Correction', () => {
  describe('Input Type Detection', () => {
    test('ei should be classified as ambiguous', () => {
      const inputType = detectInputType('ei');
      expect(inputType).toBe('ambiguous');
    });

    test('quark should be classified as generic', () => {
      const inputType = detectInputType('quark');
      expect(inputType).toBe('generic');
    });

    test('nutella should be classified as branded', () => {
      const inputType = detectInputType('nutella');
      expect(inputType).toBe('branded');
    });
  });

  describe('BLS Source Direct Tests', () => {
    let blsSource: BlsStaticSource;

    beforeEach(() => {
      blsSource = new BlsStaticSource();
    });

    test('BLS should allow German generic inputs', async () => {
      const results = await blsSource.search({
        raw: 'quark',
        locale: 'de',
        inputType: 'generic',
        normalized: 'quark',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.name).toContain('Speisequark');
    });

    test('BLS should allow German ambiguous inputs (NEW)', async () => {
      const results = await blsSource.search({
        raw: 'ei',
        locale: 'de',
        inputType: 'ambiguous',
        normalized: 'ei',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.name).toContain('Huehnerei');
    });

    test('BLS should skip German branded inputs', async () => {
      const results = await blsSource.search({
        raw: 'nutella',
        locale: 'de',
        inputType: 'branded',
        normalized: 'nutella',
      });

      expect(results.length).toBe(0);
    });

    test('BLS should skip non-German inputs', async () => {
      const results = await blsSource.search({
        raw: 'egg',
        locale: 'en',
        inputType: 'generic',
        normalized: 'egg',
      });

      expect(results.length).toBe(0);
    });

    test('BLS should find neutral egg for ei input (CORRECTED)', async () => {
      const results = await blsSource.search({
        raw: 'ei',
        locale: 'de',
        inputType: 'ambiguous',
        normalized: 'ei',
        traceId: 'test-trace',
      });

      expect(results.length).toBeGreaterThan(0);
      const bestMatch = results[0];
      expect(bestMatch.food.name).toBe('Huehnerei ganz roh');
      expect(bestMatch.food.macrosPer100g.kcal).toBe(137);
      expect(bestMatch.food.macrosPer100g.protein).toBe(11.9);
    });

    test('BLS should find magerquark for quark input', async () => {
      const results = await blsSource.search({
        raw: 'quark',
        locale: 'de',
        inputType: 'generic',
        normalized: 'quark',
        traceId: 'test-trace',
      });

      expect(results.length).toBeGreaterThan(0);
      const bestMatch = results[0];
      expect(bestMatch.food.name).toContain('Magerquark');
      expect(bestMatch.food.macrosPer100g.kcal).toBe(66);
    });

    test('BLS should find toast for toast input', async () => {
      const results = await blsSource.search({
        raw: 'toast',
        locale: 'de',
        inputType: 'generic',
        normalized: 'toast',
        traceId: 'test-trace',
      });

      expect(results.length).toBeGreaterThan(0);
      const bestMatch = results[0];
      expect(bestMatch.food.name).toContain('toast');
    });

    test('BLS should find buttertoast shortcut', async () => {
      const results = await blsSource.search({
        raw: 'buttertoast',
        locale: 'de',
        inputType: 'generic',
        normalized: 'buttertoast',
        traceId: 'test-trace',
      });

      expect(results.length).toBeGreaterThan(0);
      const bestMatch = results[0];
      expect(bestMatch.food.name).toContain('Buttertoast');
      expect(bestMatch.food.sourceId).toBe('shortcut:buttertoast-default');
    });
  });

  describe('Core Functionality Tests', () => {
    test('German ambiguous inputs should be allowed in BLS', async () => {
      const blsSource = new BlsStaticSource();

      // Test various German ambiguous inputs
      const testCases = [
        { input: 'ei', expected: 'Huehnerei' }, // CORRECTED: now expects neutral egg
        { input: 'brot', expected: null }, // might not have direct match
      ];

      for (const testCase of testCases) {
        const results = await blsSource.search({
          raw: testCase.input,
          locale: 'de',
          inputType: 'ambiguous',
          normalized: testCase.input,
          traceId: `test-${testCase.input}`,
        });

        if (testCase.expected) {
          expect(results.length).toBeGreaterThan(0);
          expect(results[0].food.name).toContain(testCase.expected);
        }
        // Note: We don't test for empty results as that's valid for some inputs
      }
    });
  });
});
