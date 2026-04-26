/**
 * Tests for input-classification-based source routing.
 */

import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import {
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
} from '../domain/catalog/FoodCatalogSource';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';

const createMockBlsSource = (results: FoodCandidate[] = []): FoodCatalogSource => ({
  type: 'bls',
  search: jest.fn().mockResolvedValue(results),
});

const createMockOffSource = (): FoodCatalogSource => ({
  type: 'off',
  search: jest.fn().mockResolvedValue([]),
});

const createMockUsdaSource = (): FoodCatalogSource => ({
  type: 'usda',
  search: jest.fn().mockResolvedValue([]),
});

describe('Input Classification Routing', () => {
  let blsSource: FoodCatalogSource;
  let offSource: FoodCatalogSource;
  let usdaSource: FoodCatalogSource;
  let resolver: SequentialFoodCatalogResolver;
  let confidenceEngine: DefaultConfidenceEngine;

  beforeEach(() => {
    blsSource = createMockBlsSource();
    offSource = createMockOffSource();
    usdaSource = createMockUsdaSource();
    confidenceEngine = new DefaultConfidenceEngine();
    resolver = new SequentialFoodCatalogResolver(
      [offSource, blsSource, usdaSource],
      confidenceEngine,
      DEFAULT_CATALOG_CONFIG,
    );
  });

  it('uses DACH_GENERIC_FIRST routing for German generic inputs', async () => {
    const query: FoodSearchQuery = {
      raw: 'ei',
      normalized: 'ei',
      locale: 'de',
      inputType: 'generic',
    };

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await resolver.resolve(query);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('chosenPriority="DACH_GENERIC_FIRST"'),
    );

    consoleSpy.mockRestore();
  });

  it('prefers BLS before USDA for locale=de generic routing', async () => {
    const blsCandidate: FoodCandidate = {
      food: {
        id: 'bls-magerquark',
        name: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
        normalizedName: 'magerquark',
        macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
        source: 'bls',
        sourceId: 'M713100',
      },
      match: { exact: true, similarity: 1 },
      confidence: 0,
      reasons: [],
    };

    blsSource = createMockBlsSource([blsCandidate]);
    offSource = createMockOffSource();
    usdaSource = createMockUsdaSource();
    resolver = new SequentialFoodCatalogResolver(
      [offSource, blsSource, usdaSource],
      confidenceEngine,
      DEFAULT_CATALOG_CONFIG,
    );

    const result = await resolver.resolve({
      raw: 'magerquark',
      normalized: 'magerquark',
      locale: 'de',
      inputType: 'generic',
    });

    expect(blsSource.search).toHaveBeenCalled();
    expect(usdaSource.search).not.toHaveBeenCalled();
    expect(result.best?.source).toBe('BLS');
  });

  it('uses BRANDED_OFF_FIRST routing for branded inputs', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await resolver.resolve({
      raw: 'nutella',
      normalized: 'nutella',
      locale: 'de',
      inputType: 'branded',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('chosenPriority="BRANDED_OFF_FIRST"'),
    );

    consoleSpy.mockRestore();
  });

  it('uses STANDARD_SEQUENTIAL routing for ambiguous inputs', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await resolver.resolve({
      raw: 'unknown food',
      normalized: 'unknown food',
      locale: 'de',
      inputType: 'ambiguous',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('chosenPriority="STANDARD_SEQUENTIAL"'),
    );

    consoleSpy.mockRestore();
  });
});
