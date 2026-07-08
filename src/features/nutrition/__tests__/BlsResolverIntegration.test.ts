import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { FoodSearchQuery, FoodCatalogSource } from '../domain/catalog/FoodCatalogSource';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';

describe('BLS Resolver Integration', () => {
  let resolver: SequentialFoodCatalogResolver;
  let blsSource: BlsStaticSource;
  let mockOffSource: FoodCatalogSource;
  let mockUsdaSource: FoodCatalogSource;

  beforeEach(() => {
    blsSource = new BlsStaticSource();

    // Mock OFF source that returns empty results
    mockOffSource = {
      type: 'off',
      search: jest.fn().mockResolvedValue([]),
    };

    // Mock USDA source that returns empty results
    mockUsdaSource = {
      type: 'usda',
      search: jest.fn().mockResolvedValue([]),
    };

    resolver = new SequentialFoodCatalogResolver(
      [mockOffSource, blsSource, mockUsdaSource],
      new DefaultConfidenceEngine(),
      DEFAULT_CATALOG_CONFIG,
    );
  });

  describe('DACH Generic Source Priority', () => {
    it('should prioritize BLS for German generic inputs', async () => {
      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-integration-magerquark',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('BLS');
      expect(result.best?.food.name).toContain('Speisequark');
      expect(result.best?.food.sourceId).toBe('M713100');

      // Verify BLS was called
      expect(blsSource.search).toBeDefined();
    });

    it('should use BLS early return for high confidence matches', async () => {
      const query: FoodSearchQuery = {
        raw: 'rührei',
        normalized: 'rührei',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-integration-ruehrei',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('BLS');
      expect(result.best?.food.name).toContain('Rührei');
      expect(result.reasonCodes).toContain('ACCEPTED_STRONG_MATCH');

      // USDA should not be called due to BLS early return
      expect(mockUsdaSource.search).not.toHaveBeenCalled();
    });

    it('should handle BLS shortcuts correctly', async () => {
      const query: FoodSearchQuery = {
        raw: 'buttertoast',
        normalized: 'buttertoast',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-integration-buttertoast',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('BLS');
      expect(result.best?.food.name).toContain('Buttertoast');
      expect(result.best?.food.sourceId).toBe('shortcut:buttertoast-default');
      expect(result.reasonCodes).toContain('ACCEPTED_STRONG_MATCH');
    });
  });

  describe('Source Routing Strategy', () => {
    it('should use DACH_GENERIC_FIRST strategy for German generic inputs', async () => {
      const query: FoodSearchQuery = {
        raw: 'quark',
        normalized: 'quark',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-routing-strategy',
      };

      const result = await resolver.resolve(query);

      // Should find BLS match
      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('BLS');
    });

    it('should skip BLS for non-German locale', async () => {
      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'en',
        inputType: 'generic',
        traceId: 'test-non-german',
      };

      const result = await resolver.resolve(query);

      // Should not find BLS match (BLS skips non-German)
      expect(result.status).toBe('rejected');
      expect(result.reasonCodes).toContain('NO_CANDIDATES');
    });

    it('should skip BLS for branded inputs', async () => {
      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'de',
        inputType: 'branded',
        traceId: 'test-branded',
      };

      const result = await resolver.resolve(query);

      // Should not find BLS match (BLS skips branded)
      expect(result.status).toBe('rejected');
      expect(result.reasonCodes).toContain('NO_CANDIDATES');
    });
  });

  describe('Logging and Tracing', () => {
    it('should log PROOF_BLS_MATCH when BLS finds candidates', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const query: FoodSearchQuery = {
        raw: 'magerquark',
        normalized: 'magerquark',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-logging',
      };

      await resolver.resolve(query);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROOF_BLS_MATCH input="magerquark"'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'best_match="Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr."',
        ),
      );

      consoleSpy.mockRestore();
    });

    it('should log PROOF_BLS_SOURCE_USED when BLS wins', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const query: FoodSearchQuery = {
        raw: 'rührei',
        normalized: 'rührei',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-source-used',
      };

      await resolver.resolve(query);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROOF_BLS_SOURCE_USED candidate="Rührei gebraten"'),
      );

      consoleSpy.mockRestore();
    });

    it('should log PROOF_CANONICAL_SHORTCUT_USED for shortcuts', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const query: FoodSearchQuery = {
        raw: 'buttertoast',
        normalized: 'buttertoast',
        locale: 'de',
        inputType: 'generic',
        traceId: 'test-shortcut-logging',
      };

      await resolver.resolve(query);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROOF_CANONICAL_SHORTCUT_USED shortcut="buttertoast"'),
      );

      consoleSpy.mockRestore();
    });
  });
});
