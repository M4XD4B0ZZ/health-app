import { FusionCandidateResolver } from '../application/services/FusionCandidateResolver';
import {
  FoodCatalogSource,
  FoodCandidate,
  FoodSearchQuery,
} from '../domain/catalog/FoodCatalogSource';

describe('FusionCandidateResolver Integration', () => {
  let resolver: FusionCandidateResolver;
  let mockBlsSource: FoodCatalogSource;
  let mockOffSource: FoodCatalogSource;
  let mockUsdaSource: FoodCatalogSource;

  beforeEach(() => {
    mockBlsSource = createMockSource('bls');
    mockOffSource = createMockSource('off');
    mockUsdaSource = createMockSource('usda');

    resolver = new FusionCandidateResolver([mockBlsSource, mockOffSource, mockUsdaSource]);
  });

  describe('BLS vs USDA vs OFF scenarios', () => {
    it('should prefer BLS for strong DACH match', async () => {
      // Setup: BLS has exact German match, USDA has weaker English match
      mockBlsSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'bls-apfel-123',
          name: 'Apfel',
          normalizedName: 'apfel',
          source: 'bls',
          similarity: 0.95,
          exact: true,
        }),
      ]);

      mockUsdaSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'usda-apple-456',
          name: 'Apple, raw',
          normalizedName: 'apple raw',
          source: 'usda',
          similarity: 0.8,
          exact: false,
        }),
      ]);

      mockOffSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Apfel',
        normalized: 'apfel',
        locale: 'de',
        traceId: 'test-trace-1',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('bls');
      expect(result.best?.food.name).toBe('Apfel');
      expect(result.reasonCodes).toContain('ACCEPTED');
    });

    it('should prefer OFF for branded match over generic USDA', async () => {
      // Setup: OFF has exact branded match, USDA has generic match
      mockOffSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'off-cocacola-789',
          name: 'Coca-Cola Original',
          normalizedName: 'coca cola original',
          source: 'off',
          similarity: 0.95,
          exact: true,
        }),
      ]);

      mockUsdaSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'usda-cola-123',
          name: 'Cola, carbonated',
          normalizedName: 'cola carbonated',
          source: 'usda',
          similarity: 0.75,
          exact: false,
        }),
      ]);

      mockBlsSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Coca Cola',
        normalized: 'coca cola',
        locale: 'en',
        traceId: 'test-trace-2',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('off');
      expect(result.best?.food.name).toBe('Coca-Cola Original');
    });

    it('should handle conflicting high scores as ambiguous', async () => {
      // Setup: Two sources with very similar high scores
      mockBlsSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'bls-ei-123',
          name: 'Hühnerei',
          normalizedName: 'hühnerei',
          source: 'bls',
          similarity: 0.9,
          exact: false,
        }),
      ]);

      mockOffSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'off-ei-456',
          name: 'Ei, Huhn',
          normalizedName: 'ei huhn',
          source: 'off',
          similarity: 0.88,
          exact: false,
        }),
      ]);

      mockUsdaSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Ei',
        normalized: 'ei',
        locale: 'de',
        traceId: 'test-trace-3',
      };

      const result = await resolver.resolve(query);

      // Should be accepted (BLS wins due to locale boost) or ambiguous
      expect(['accepted', 'ambiguous']).toContain(result.status);
      expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle alias/narrowing with lower confidence', async () => {
      // Setup: Match uses alias heuristic
      mockBlsSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'bls-magerquark-123',
          name: 'Magerquark',
          normalizedName: 'magerquark',
          source: 'bls',
          similarity: 0.85,
          exact: false,
          usedHeuristic: 'alias', // quark -> magerquark
        }),
      ]);

      mockOffSource.search = jest.fn().mockResolvedValue([]);
      mockUsdaSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Quark',
        normalized: 'quark',
        locale: 'de',
        traceId: 'test-trace-4',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('bls');
      expect(result.reasonCodes).toContain('ACCEPTED_WITH_ASSUMPTION');
    });

    it('should reject when all scores are too low', async () => {
      // Setup: All sources return weak matches
      mockBlsSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'bls-weak-123',
          name: 'Unrelated Food',
          normalizedName: 'unrelated food',
          source: 'bls',
          similarity: 0.3,
          exact: false,
          usedHeuristic: 'fuzzy',
        }),
      ]);

      mockOffSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'off-weak-456',
          name: 'Another Unrelated',
          normalizedName: 'another unrelated',
          source: 'off',
          similarity: 0.25,
          exact: false,
          usedHeuristic: 'fuzzy',
        }),
      ]);

      mockUsdaSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Unknown Food Item',
        normalized: 'unknown food item',
        locale: 'de',
        traceId: 'test-trace-5',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('rejected');
      expect(result.reasonCodes).toContain('LOW_CONFIDENCE_MATCHES');
      expect(result.candidates.length).toBeGreaterThan(0); // Should still return candidates for inspection
    });

    it('should handle no candidates found', async () => {
      // Setup: All sources return empty results
      mockBlsSource.search = jest.fn().mockResolvedValue([]);
      mockOffSource.search = jest.fn().mockResolvedValue([]);
      mockUsdaSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Nonexistent Food',
        normalized: 'nonexistent food',
        locale: 'de',
        traceId: 'test-trace-6',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('rejected');
      expect(result.reasonCodes).toContain('NO_CANDIDATES_FOUND');
      expect(result.candidates).toHaveLength(0);
    });

    it('should handle source failures gracefully', async () => {
      // Setup: One source fails, others succeed
      mockBlsSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'bls-success-123',
          name: 'Successful Match',
          normalizedName: 'successful match',
          source: 'bls',
          similarity: 0.85,
          exact: true,
        }),
      ]);

      mockOffSource.search = jest.fn().mockRejectedValue(new Error('OFF source timeout'));
      mockUsdaSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Test Food',
        normalized: 'test food',
        locale: 'de',
        traceId: 'test-trace-7',
      };

      const result = await resolver.resolve(query);

      expect(result.status).toBe('accepted');
      expect(result.best?.source).toBe('bls');
      // Should continue with available sources despite OFF failure
    });
  });

  describe('logging verification', () => {
    it('should log fusion input, scores, and winner', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockBlsSource.search = jest.fn().mockResolvedValue([
        createMockCandidate({
          id: 'bls-test-123',
          name: 'Test Food',
          normalizedName: 'test food',
          source: 'bls',
          similarity: 0.85,
          exact: true,
        }),
      ]);

      mockOffSource.search = jest.fn().mockResolvedValue([]);
      mockUsdaSource.search = jest.fn().mockResolvedValue([]);

      const query: FoodSearchQuery = {
        raw: 'Test Food',
        normalized: 'test food',
        locale: 'de',
        traceId: 'test-trace-log',
      };

      await resolver.resolve(query);

      // Verify logging calls
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test-trace-log] PROOF_FUSION_INPUT'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test-trace-log] PROOF_FUSION_SCORES'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test-trace-log] PROOF_FUSION_WINNER'),
      );

      consoleSpy.mockRestore();
    });
  });
});

// Helper functions
function createMockSource(type: 'bls' | 'off' | 'usda'): FoodCatalogSource {
  return {
    type,
    search: jest.fn().mockResolvedValue([]),
  };
}

function createMockCandidate(overrides: {
  id: string;
  name: string;
  normalizedName: string;
  source: 'bls' | 'off' | 'usda';
  similarity: number;
  exact: boolean;
  usedHeuristic?: 'alias' | 'fuzzy' | 'plural';
}): FoodCandidate {
  return {
    food: {
      id: overrides.id,
      name: overrides.name,
      normalizedName: overrides.normalizedName,
      macrosPer100g: {
        kcal: 100,
        protein: 10,
        carbs: 15,
        fat: 5,
      },
      source: overrides.source,
      sourceId: overrides.id,
    },
    match: {
      exact: overrides.exact,
      similarity: overrides.similarity,
      usedHeuristic: overrides.usedHeuristic,
    },
    confidence: overrides.similarity,
    reasons: overrides.usedHeuristic
      ? [`Used ${overrides.usedHeuristic} matching`]
      : ['Direct match'],
  };
}
