import { CandidateScorer } from '../domain/fusion/CandidateScorer';
import {
  FusionCandidate,
  DEFAULT_FUSION_WEIGHTS,
  FUSION_PENALTIES,
} from '../domain/fusion/FusionCandidate';

describe('CandidateScorer', () => {
  let scorer: CandidateScorer;

  beforeEach(() => {
    scorer = new CandidateScorer();
  });

  describe('deterministic scoring', () => {
    it('should score exact matches higher than fuzzy matches', () => {
      const exactCandidate = createTestCandidate({
        source: 'bls',
        matchSignals: {
          lexicalScore: 1.0,
          tokenOverlap: 0.9,
          exactMatch: true,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: false,
        },
      });

      const fuzzyCandidate = createTestCandidate({
        source: 'bls',
        matchSignals: {
          lexicalScore: 0.8,
          tokenOverlap: 0.7,
          exactMatch: false,
          aliasUsed: false,
          fuzzyMatch: true,
          semanticNarrowing: false,
        },
      });

      const query = { normalized: 'apfel', locale: 'de' as const };

      const exactScore = scorer.scoreCandidate(exactCandidate, query);
      const fuzzyScore = scorer.scoreCandidate(fuzzyCandidate, query);

      expect(exactScore.finalScore).toBeGreaterThan(fuzzyScore.finalScore);
      expect(fuzzyScore.totalPenalties).toBeGreaterThan(exactScore.totalPenalties);
      expect(fuzzyScore.totalPenalties).toBe(FUSION_PENALTIES.FUZZY_MATCH);
    });

    it('should apply locale boost for BLS with German input', () => {
      const blsCandidate = createTestCandidate({
        source: 'bls',
      });

      const usdaCandidate = createTestCandidate({
        source: 'usda',
      });

      const deQuery = { normalized: 'apfel', locale: 'de' as const };

      const blsScore = scorer.scoreCandidate(blsCandidate, deQuery);
      const usdaScore = scorer.scoreCandidate(usdaCandidate, deQuery);

      // BLS should get locale boost for German queries
      expect(blsScore.localeContribution).toBeGreaterThan(usdaScore.localeContribution);
      expect(blsScore.finalScore).toBeGreaterThan(usdaScore.finalScore);
    });

    it('should penalize semantic narrowing', () => {
      const normalCandidate = createTestCandidate({
        matchSignals: {
          lexicalScore: 0.9,
          tokenOverlap: 0.8,
          exactMatch: false,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: false,
        },
      });

      const narrowedCandidate = createTestCandidate({
        matchSignals: {
          lexicalScore: 0.9,
          tokenOverlap: 0.8,
          exactMatch: false,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: true,
        },
      });

      const query = { normalized: 'quark', locale: 'de' as const };

      const normalScore = scorer.scoreCandidate(normalCandidate, query);
      const narrowedScore = scorer.scoreCandidate(narrowedCandidate, query);

      expect(narrowedScore.finalScore).toBeLessThan(normalScore.finalScore);
      expect(narrowedScore.totalPenalties).toBe(FUSION_PENALTIES.SEMANTIC_NARROWING);
    });

    it('should handle missing macro data gracefully', () => {
      const completeCandidate = createTestCandidate({
        macrosPer100g: {
          kcal: 100,
          protein: 10,
          carbs: 15,
          fat: 5,
          isEstimated: false,
          hasIncompleteData: false,
          plausibilityScore: 0.9,
        },
      });

      const incompleteCandidate = createTestCandidate({
        macrosPer100g: {
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isEstimated: false,
          hasIncompleteData: true,
          plausibilityScore: 0.3,
        },
      });

      const query = { normalized: 'test', locale: 'de' as const };

      const completeScore = scorer.scoreCandidate(completeCandidate, query);
      const incompleteScore = scorer.scoreCandidate(incompleteCandidate, query);

      expect(completeScore.finalScore).toBeGreaterThan(incompleteScore.finalScore);
      expect(incompleteScore.totalPenalties).toBeGreaterThan(completeScore.totalPenalties);
    });

    it('should apply correct source trust scores', () => {
      const sources: FusionCandidate['source'][] = ['user', 'bls', 'usda', 'off', 'ai'];
      const query = { normalized: 'test', locale: 'de' as const };

      const scores = sources.map((source) => {
        const candidate = createTestCandidate({ source });
        return {
          source,
          score: scorer.scoreCandidate(candidate, query),
        };
      });

      // Verify trust score ordering: user > bls > usda > off > ai
      expect(scores[0].score.sourceTrustContribution).toBeGreaterThan(
        scores[1].score.sourceTrustContribution,
      ); // user > bls
      expect(scores[1].score.sourceTrustContribution).toBeGreaterThan(
        scores[2].score.sourceTrustContribution,
      ); // bls > usda
      expect(scores[2].score.sourceTrustContribution).toBeGreaterThan(
        scores[3].score.sourceTrustContribution,
      ); // usda > off
      expect(scores[3].score.sourceTrustContribution).toBeGreaterThan(
        scores[4].score.sourceTrustContribution,
      ); // off > ai
    });
  });

  describe('score components validation', () => {
    it('should use correct default weights', () => {
      const weights = DEFAULT_FUSION_WEIGHTS;

      expect(weights.lexical).toBe(0.35);
      expect(weights.tokenOverlap).toBe(0.2);
      expect(weights.sourceTrust).toBe(0.2);
      expect(weights.localeMatch).toBe(0.15);
      expect(weights.completeness).toBe(0.05);
      expect(weights.plausibility).toBe(0.05);

      // Weights should sum to 1.0
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      expect(total).toBeCloseTo(1.0, 3);
    });

    it('should never return negative scores', () => {
      const heavilyPenalizedCandidate = createTestCandidate({
        matchSignals: {
          lexicalScore: 0.1, // Very low
          tokenOverlap: 0.1,
          exactMatch: false,
          aliasUsed: true,
          fuzzyMatch: true,
          semanticNarrowing: true,
        },
        macrosPer100g: {
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isEstimated: false,
          hasIncompleteData: true,
          plausibilityScore: 0.1,
        },
      });

      const query = { normalized: 'test', locale: 'de' as const };
      const score = scorer.scoreCandidate(heavilyPenalizedCandidate, query);

      expect(score.finalScore).toBeGreaterThanOrEqual(0);
    });

    it('should be deterministic for identical inputs', () => {
      const candidate = createTestCandidate({
        source: 'bls',
      });

      const query = { normalized: 'apfel', locale: 'de' as const };

      const score1 = scorer.scoreCandidate(candidate, query);
      const score2 = scorer.scoreCandidate(candidate, query);

      expect(score1.finalScore).toBe(score2.finalScore);
      expect(score1.lexicalContribution).toBe(score2.lexicalContribution);
      expect(score1.totalPenalties).toBe(score2.totalPenalties);
    });
  });

  describe('BLS vs USDA vs OFF scenarios', () => {
    it('should prefer BLS for strong DACH match', () => {
      const blsCandidate = createTestCandidate({
        source: 'bls',
        name: 'Apfel',
        matchSignals: {
          lexicalScore: 0.95,
          tokenOverlap: 0.9,
          exactMatch: true,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: false,
        },
      });

      const usdaCandidate = createTestCandidate({
        source: 'usda',
        name: 'Apple',
        matchSignals: {
          lexicalScore: 0.9,
          tokenOverlap: 0.8,
          exactMatch: false,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: false,
        },
      });

      const query = { normalized: 'apfel', locale: 'de' as const };

      const blsScore = scorer.scoreCandidate(blsCandidate, query);
      const usdaScore = scorer.scoreCandidate(usdaCandidate, query);

      expect(blsScore.finalScore).toBeGreaterThan(usdaScore.finalScore);
    });

    it('should prefer OFF for branded match over generic USDA', () => {
      const offCandidate = createTestCandidate({
        source: 'off',
        name: 'Coca Cola',
        matchSignals: {
          lexicalScore: 0.95,
          tokenOverlap: 0.9,
          exactMatch: true,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: false,
        },
      });

      const usdaCandidate = createTestCandidate({
        source: 'usda',
        name: 'Cola beverage',
        matchSignals: {
          lexicalScore: 0.8,
          tokenOverlap: 0.7,
          exactMatch: false,
          aliasUsed: false,
          fuzzyMatch: false,
          semanticNarrowing: false,
        },
      });

      const query = { normalized: 'coca cola', locale: 'en' as const };

      const offScore = scorer.scoreCandidate(offCandidate, query);
      const usdaScore = scorer.scoreCandidate(usdaCandidate, query);

      expect(offScore.finalScore).toBeGreaterThan(usdaScore.finalScore);
    });
  });
});

// Helper function to create test candidates with sensible defaults
function createTestCandidate(overrides: Partial<FusionCandidate> = {}): FusionCandidate {
  const defaultCandidate: FusionCandidate = {
    id: 'test-candidate',
    source: 'bls',
    sourceId: 'test-123',
    name: 'Test Food',
    normalizedName: 'test food',
    macrosPer100g: {
      kcal: 100,
      protein: 10,
      carbs: 15,
      fat: 5,
      isEstimated: false,
      hasIncompleteData: false,
      plausibilityScore: 0.9,
    },
    matchSignals: {
      lexicalScore: 0.8,
      tokenOverlap: 0.7,
      exactMatch: false,
      aliasUsed: false,
      fuzzyMatch: false,
      semanticNarrowing: false,
    },
    metadata: {
      locale: 'de',
      sourceQuality: {
        trustLevel: 0.9,
        dataFreshness: 1.0,
        coverageRelevance: 1.0,
      },
      dataCompleteness: 1.0,
      assumptions: [],
      usedHeuristic: [],
      queryUsed: 'test',
    },
  };

  // Deep merge overrides
  return {
    ...defaultCandidate,
    ...overrides,
    macrosPer100g: {
      ...defaultCandidate.macrosPer100g,
      ...overrides.macrosPer100g,
    },
    matchSignals: {
      ...defaultCandidate.matchSignals,
      ...overrides.matchSignals,
    },
    metadata: {
      ...defaultCandidate.metadata,
      ...overrides.metadata,
      sourceQuality: {
        ...defaultCandidate.metadata.sourceQuality,
        ...overrides.metadata?.sourceQuality,
      },
    },
  };
}
