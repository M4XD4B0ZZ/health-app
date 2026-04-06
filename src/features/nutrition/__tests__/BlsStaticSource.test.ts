import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { FoodCatalogSource } from '../domain/catalog/FoodCatalogSource';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';

describe('BLS DACH Generic Source', () => {
  it('resolves a German generic whole-food lookup from BLS', async () => {
    const source = new BlsStaticSource();

    const candidates = await source.search({
      raw: 'magerquark',
      normalized: 'magerquark',
      locale: 'de',
      inputType: 'generic',
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].food.source).toBe('bls');
    expect(candidates[0].food.sourceId).toBe('M713100');
    expect(candidates[0].food.macrosPer100g.kcal).toBe(66);
  });

  it('uses the explicit buttertoast shortcut without splitting', async () => {
    const blsSource = new BlsStaticSource();
    const offSource: FoodCatalogSource = {
      type: 'off',
      search: jest.fn().mockResolvedValue([]),
    };
    const usdaSource: FoodCatalogSource = {
      type: 'usda',
      search: jest.fn().mockResolvedValue([]),
    };
    const resolver = new SequentialFoodCatalogResolver(
      [offSource, blsSource, usdaSource],
      new DefaultConfidenceEngine(),
      DEFAULT_CATALOG_CONFIG,
    );
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await resolver.resolve({
      raw: 'buttertoast',
      normalized: 'buttertoast',
      locale: 'de',
      inputType: 'generic',
    });

    expect(result.best?.source).toBe('BLS');
    expect(result.best?.food.sourceId).toBe('shortcut:buttertoast-default');
    expect(offSource.search).not.toHaveBeenCalled();
    expect(usdaSource.search).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('PROOF_CANONICAL_SHORTCUT_USED'),
    );

    consoleSpy.mockRestore();
  });

  it('does not introduce general compound splitting for unknown compounds', async () => {
    const source = new BlsStaticSource();

    const candidates = await source.search({
      raw: 'quarktoast',
      normalized: 'quarktoast',
      locale: 'de',
      inputType: 'generic',
    });

    expect(candidates).toEqual([]);
  });
});
