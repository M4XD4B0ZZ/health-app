import { FoodCatalogResolver } from './FoodCatalogResolver';
import {
  FoodSearchQuery,
  FoodCandidate,
  FoodCatalogSource,
} from '../../domain/catalog/FoodCatalogSource';
import { ResolverDecision } from '../../domain/models/ResolverDecision';
import {
  FusionCandidate,
  FusionResolverDecision,
  FusionMetrics,
  ConfidenceBreakdown,
  SourceComparison,
  FUSION_THRESHOLDS,
} from '../../domain/fusion/FusionCandidate';
import { CandidateScorer } from '../../domain/fusion/CandidateScorer';

/**
 * Minimal Fusion Layer implementation for RESOLVER-V2-004
 * Collects candidates from all sources and applies deterministic scoring
 */
export class FusionCandidateResolver implements FoodCatalogResolver {
  private readonly scorer: CandidateScorer;
  private lastScoredCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown }[] = [];

  constructor(
    private readonly sources: FoodCatalogSource[],
    scorer?: CandidateScorer,
  ) {
    this.scorer = scorer || new CandidateScorer();
  }

  async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
    const startTime = Date.now();
    const traceId = ctx?.traceId || query.traceId || this.generateTraceId();
    
    // Log fusion input
    this.logFusionInput(traceId, query);

    try {
      // Step 1: Collect candidates from all sources in parallel
      const allCandidates = await this.collectCandidatesFromAllSources(query, traceId);
      
      // Step 2: Convert to FusionCandidates
      const fusionCandidates = this.convertToFusionCandidates(allCandidates, query);
      
      // Step 3: Score all candidates
      const scoredCandidates = this.scoreAllCandidates(fusionCandidates, query, traceId);
      
      // Step 4: Rank candidates by score
      const rankedCandidates = this.rankCandidates(scoredCandidates);
      
      // Step 5: Make decision based on thresholds
      const fusionDecision = this.makeDecision(rankedCandidates, query, traceId);
      
      // Step 6: Create metrics
      const metrics = this.createMetrics(startTime, traceId, allCandidates);
      
      // Step 7: Log winner
      this.logFusionWinner(traceId, fusionDecision, metrics);
      
      // Convert to legacy ResolverDecision format
      return this.adaptToLegacyFormat(fusionDecision);
      
    } catch (error) {
      console.error(`[${traceId}] PROOF_FUSION_ERROR`, error);
      return this.createErrorDecision(query, error);
    }
  }

  /**
   * Collect candidates from all sources in parallel
   */
  private async collectCandidatesFromAllSources(
    query: FoodSearchQuery,
    traceId: string,
  ): Promise<{ source: FoodCatalogSource; candidates: FoodCandidate[] }[]> {
    const promises = this.sources.map(async (source) => {
      try {
        // Log source input
        console.log(`[${traceId}] PROOF_SOURCE_INPUT source="${source.type}" input="${query.normalized}"`);
        
        const candidates = await source.search(query);
        
        // Log source output
        console.log(`[${traceId}] PROOF_SOURCE_OUTPUT source="${source.type}" candidates=[${candidates.map(c => `"${c.food.name}"`).join(', ')}]`);
        
        return { source, candidates };
      } catch (error) {
        console.warn(`[${traceId}] Source ${source.type} failed:`, error);
        return { source, candidates: [] };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Convert FoodCandidates to FusionCandidates with enriched metadata
   */
  private convertToFusionCandidates(
    sourceResults: { source: FoodCatalogSource; candidates: FoodCandidate[] }[],
    query: FoodSearchQuery,
  ): FusionCandidate[] {
    const fusionCandidates: FusionCandidate[] = [];

    for (const { source, candidates } of sourceResults) {
      for (const candidate of candidates) {
        const fusionCandidate: FusionCandidate = {
          id: `${source.type}:${candidate.food.id}`,
          source: source.type,
          sourceId: candidate.food.id,
          name: candidate.food.name,
          normalizedName: candidate.food.normalizedName,
          macrosPer100g: {
            kcal: candidate.food.macrosPer100g.kcal,
            protein: candidate.food.macrosPer100g.protein,
            carbs: candidate.food.macrosPer100g.carbs,
            fat: candidate.food.macrosPer100g.fat,
            isEstimated: false, // TODO: Extract from source data
            hasIncompleteData: this.hasIncompleteData(candidate.food.macrosPer100g),
            plausibilityScore: this.calculatePlausibilityScore(candidate.food.macrosPer100g),
          },
          matchSignals: {
            lexicalScore: candidate.match.similarity,
            tokenOverlap: this.calculateTokenOverlap(query.normalized, candidate.food.normalizedName, candidate.match.exact ? 'exact' : candidate.match.similarity > 0.7 ? 'partial' : 'weak'),
            exactMatch: candidate.match.exact,
            aliasUsed: candidate.match.usedHeuristic === 'alias',
            fuzzyMatch: candidate.match.usedHeuristic === 'fuzzy',
            semanticNarrowing: false, // TODO: Detect semantic narrowing
          },
          metadata: {
            locale: this.detectLocale(source.type, candidate.food.name),
            sourceQuality: {
              trustLevel: this.getSourceTrustLevel(source.type),
              dataFreshness: 1.0, // TODO: Extract from source
              coverageRelevance: this.getCoverageRelevance(source.type, query.locale),
            },
            dataCompleteness: this.calculateDataCompleteness(candidate.food.macrosPer100g),
            assumptions: candidate.reasons || [],
            usedHeuristic: candidate.match.usedHeuristic ? [candidate.match.usedHeuristic] : [],
            queryUsed: query.normalized,
          },
        };

        fusionCandidates.push(fusionCandidate);
      }
    }

    return fusionCandidates;
  }

  /**
   * Score all candidates and log individual scores
   */
  private scoreAllCandidates(
    candidates: FusionCandidate[],
    query: FoodSearchQuery,
    traceId: string,
  ): { candidate: FusionCandidate; breakdown: ConfidenceBreakdown }[] {
    const scoredCandidates = candidates.map((candidate, index) => {
      const breakdown = this.scorer.scoreCandidate(candidate, query);
      
      // Log individual score
      this.logFusionScore(traceId, candidate, breakdown, index + 1);
      
      return { candidate, breakdown };
    });
    
    // Store for later use in adaptToLegacyFormat
    this.lastScoredCandidates = scoredCandidates;
    
    return scoredCandidates;
  }

  /**
   * Rank candidates by final score (descending)
   */
  private rankCandidates(
    scoredCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown }[],
  ): { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[] {
    const sorted = scoredCandidates.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);
    
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  /**
   * Make decision based on fusion thresholds
   */
  private makeDecision(
    rankedCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[],
    query: FoodSearchQuery,
    traceId: string,
  ): FusionResolverDecision {
    if (rankedCandidates.length === 0) {
      return this.createNoResultsDecision(query, traceId);
    }

    const best = rankedCandidates[0];
    const secondBest = rankedCandidates[1];

    // Additional guardrail: reject if top candidate has very weak semantic/token relation
    if (best.breakdown.tokenContribution < 0.2 && best.breakdown.lexicalContribution < 0.2) {
      return this.createRejectedDecision(rankedCandidates, query, traceId);
    }

    // Check for conflicting high scores
    const scoreGap = secondBest ? best.breakdown.finalScore - secondBest.breakdown.finalScore : 1.0;

// CALIBRATION-004: Use centralized thresholds
if (secondBest && scoreGap < FUSION_THRESHOLDS.AMBIGUOUS_DIFF) {
  return this.createAmbiguousDecision(rankedCandidates, query, traceId);
}

    // Apply confidence thresholds
    if (best.breakdown.finalScore >= FUSION_THRESHOLDS.HIGH_CONFIDENCE) {
      return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED');
    } else if (best.breakdown.finalScore >= FUSION_THRESHOLDS.MEDIUM_CONFIDENCE) {
      return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED_WITH_ASSUMPTION');
    } else if (best.breakdown.finalScore >= FUSION_THRESHOLDS.LOW_CONFIDENCE) {
      return this.createAmbiguousDecision(rankedCandidates, query, traceId);
    } else {
      return this.createRejectedDecision(rankedCandidates, query, traceId);
    }
  }

  /**
   * Create accepted decision with explanation
   */
  private createAcceptedDecision(
    rankedCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[],
    query: FoodSearchQuery,
    traceId: string,
    reasonCode: string,
  ): FusionResolverDecision {
    const best = rankedCandidates[0];
    const alternatives = rankedCandidates.slice(1, 4); // Top 3 alternatives

    return {
      normalizedQuery: query.normalized,
      status: 'accepted',
      reasonCodes: [reasonCode],
      candidates: rankedCandidates.map(r => r.candidate),
      best: best.candidate,
      secondBest: rankedCandidates[1]?.candidate,
      createdAt: new Date().toISOString(),
      explanation: {
        winningReasons: this.scorer.generateScoreExplanation(best.breakdown, best.candidate),
        rejectedCandidates: alternatives.map(alt => ({
          candidate: alt.candidate,
          score: alt.breakdown.finalScore,
          rejectionReasons: [`Lower score (${alt.breakdown.finalScore.toFixed(3)} vs ${best.breakdown.finalScore.toFixed(3)})`],
        })),
        assumptions: best.candidate.metadata.assumptions,
        confidenceBreakdown: best.breakdown,
        sourceComparison: this.createSourceComparison(rankedCandidates),
      },
      fusionMetrics: this.createMetrics(Date.now(), traceId, []),
    };
  }

  /**
   * Create ambiguous decision
   */
  private createAmbiguousDecision(
    rankedCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[],
    query: FoodSearchQuery,
    traceId: string,
  ): FusionResolverDecision {
    const topCandidates = rankedCandidates.slice(0, 2);

    return {
      normalizedQuery: query.normalized,
      status: 'ambiguous',
      reasonCodes: ['CONFLICTING_HIGH_SCORES'],
      candidates: topCandidates.map(r => r.candidate),
      createdAt: new Date().toISOString(),
      explanation: {
        winningReasons: ['Multiple high-quality matches found'],
        rejectedCandidates: [],
        assumptions: ['User clarification needed'],
        confidenceBreakdown: topCandidates[0].breakdown,
        sourceComparison: this.createSourceComparison(rankedCandidates),
      },
      fusionMetrics: this.createMetrics(Date.now(), traceId, []),
    };
  }

  /**
   * Create rejected decision
   */
  private createRejectedDecision(
    rankedCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[],
    query: FoodSearchQuery,
    traceId: string,
  ): FusionResolverDecision {
    return {
      normalizedQuery: query.normalized,
      status: 'rejected',
      reasonCodes: ['LOW_CONFIDENCE_MATCHES'],
      candidates: rankedCandidates.slice(0, 3).map(r => r.candidate),
      createdAt: new Date().toISOString(),
      explanation: {
        winningReasons: [],
        rejectedCandidates: rankedCandidates.slice(0, 3).map(r => ({
          candidate: r.candidate,
          score: r.breakdown.finalScore,
          rejectionReasons: [`Low confidence score: ${r.breakdown.finalScore.toFixed(3)}`],
        })),
        assumptions: ['Query too vague or unknown food'],
        confidenceBreakdown: rankedCandidates[0]?.breakdown || {} as ConfidenceBreakdown,
        sourceComparison: this.createSourceComparison(rankedCandidates),
      },
      fusionMetrics: this.createMetrics(Date.now(), traceId, []),
    };
  }

  /**
   * Create no results decision
   */
  private createNoResultsDecision(query: FoodSearchQuery, traceId: string): FusionResolverDecision {
    return {
      normalizedQuery: query.normalized,
      status: 'rejected',
      reasonCodes: ['NO_CANDIDATES_FOUND'],
      candidates: [],
      createdAt: new Date().toISOString(),
      explanation: {
        winningReasons: [],
        rejectedCandidates: [],
        assumptions: ['All sources exhausted'],
        confidenceBreakdown: {} as ConfidenceBreakdown,
        sourceComparison: {
          sourcesQueried: this.sources.map(s => s.type),
          candidatesPerSource: Object.fromEntries(this.sources.map(s => [s.type, 0])),
          bestPerSource: {},
        },
      },
      fusionMetrics: this.createMetrics(Date.now(), traceId, []),
    };
  }

  /**
   * Create error decision
   */
  private createErrorDecision(query: FoodSearchQuery, error: any): ResolverDecision {
    return {
      normalizedQuery: query.normalized,
      status: 'rejected',
      reasonCodes: ['FUSION_ERROR'],
      candidates: [],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Convert FusionResolverDecision to legacy ResolverDecision format
   */
  private adaptToLegacyFormat(fusionDecision: FusionResolverDecision): ResolverDecision {
    // We need to preserve the scored candidates with their breakdowns
    const scoredCandidates = this.lastScoredCandidates || [];
    
    return {
      normalizedQuery: fusionDecision.normalizedQuery,
      status: fusionDecision.status,
      reasonCodes: fusionDecision.reasonCodes,
      candidates: fusionDecision.candidates.map(fc => {
        // Find the corresponding scored candidate
        const scoredCandidate = scoredCandidates.find((sc: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown }) => sc.candidate.id === fc.id);
        const breakdown = scoredCandidate?.breakdown || fusionDecision.explanation.confidenceBreakdown;
        
        return {
          id: fc.id,
          source: fc.source,
          food: {
            id: fc.sourceId,
            name: fc.name,
            normalizedName: fc.normalizedName,
            macrosPer100g: {
              kcal: fc.macrosPer100g.kcal,
              protein: fc.macrosPer100g.protein,
              carbs: fc.macrosPer100g.carbs,
              fat: fc.macrosPer100g.fat,
            },
            source: fc.source,
            sourceId: fc.sourceId,
          },
          score: breakdown.finalScore,
          breakdown: {
            matchScore: breakdown.lexicalContribution,
            dataQualityScore: fc.metadata.dataCompleteness,
            kcalConsistencyScore: fc.macrosPer100g.plausibilityScore,
            sourceTrustScore: breakdown.sourceTrustContribution,
            finalScore: breakdown.finalScore,
            notes: fc.metadata.assumptions,
          },
        };
      }),
      best: fusionDecision.best ? {
        id: fusionDecision.best.id,
        source: fusionDecision.best.source,
        food: {
          id: fusionDecision.best.sourceId,
          name: fusionDecision.best.name,
          normalizedName: fusionDecision.best.normalizedName,
          macrosPer100g: {
            kcal: fusionDecision.best.macrosPer100g.kcal,
            protein: fusionDecision.best.macrosPer100g.protein,
            carbs: fusionDecision.best.macrosPer100g.carbs,
            fat: fusionDecision.best.macrosPer100g.fat,
          },
          source: fusionDecision.best.source,
          sourceId: fusionDecision.best.sourceId,
        },
        score: 0, // TODO: Map from fusion score
        breakdown: {
          matchScore: fusionDecision.best.matchSignals.lexicalScore,
          dataQualityScore: fusionDecision.best.metadata.dataCompleteness,
          kcalConsistencyScore: fusionDecision.best.macrosPer100g.plausibilityScore,
          sourceTrustScore: fusionDecision.best.metadata.sourceQuality.trustLevel,
          finalScore: 0, // TODO: Map from fusion score
          notes: fusionDecision.best.metadata.assumptions,
        },
      } : undefined,
      secondBest: fusionDecision.secondBest ? {
        id: fusionDecision.secondBest.id,
        source: fusionDecision.secondBest.source,
        food: {
          id: fusionDecision.secondBest.sourceId,
          name: fusionDecision.secondBest.name,
          normalizedName: fusionDecision.secondBest.normalizedName,
          macrosPer100g: {
            kcal: fusionDecision.secondBest.macrosPer100g.kcal,
            protein: fusionDecision.secondBest.macrosPer100g.protein,
            carbs: fusionDecision.secondBest.macrosPer100g.carbs,
            fat: fusionDecision.secondBest.macrosPer100g.fat,
          },
          source: fusionDecision.secondBest.source,
          sourceId: fusionDecision.secondBest.sourceId,
        },
        score: 0, // TODO: Map from fusion score
        breakdown: {
          matchScore: fusionDecision.secondBest.matchSignals.lexicalScore,
          dataQualityScore: fusionDecision.secondBest.metadata.dataCompleteness,
          kcalConsistencyScore: fusionDecision.secondBest.macrosPer100g.plausibilityScore,
          sourceTrustScore: fusionDecision.secondBest.metadata.sourceQuality.trustLevel,
          finalScore: 0, // TODO: Map from fusion score
          notes: fusionDecision.secondBest.metadata.assumptions,
        },
      } : undefined,
      createdAt: fusionDecision.createdAt,
    };
  }

  // Helper methods for data processing
  private hasIncompleteData(macros: any): boolean {
    return macros.kcal === 0 || macros.protein === 0 || macros.carbs === 0 || macros.fat === 0;
  }


  private calculatePlausibilityScore(macros: any): number {
    // Simple plausibility check: kcal should roughly match macros
    const calculatedKcal = (macros.protein * 4) + (macros.carbs * 4) + (macros.fat * 9);
    const diff = Math.abs(macros.kcal - calculatedKcal);
    return Math.max(0, 1 - (diff / Math.max(macros.kcal, calculatedKcal)));
  }

  private calculateTokenOverlap(query: string, name: string, matchQuality: 'exact' | 'partial' | 'weak'): number {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const nameTokens = new Set(name.toLowerCase().split(/\s+/));
    const intersection = new Set([...queryTokens].filter(x => nameTokens.has(x)));
    const baseOverlap = intersection.size / Math.max(queryTokens.size, nameTokens.size);

    // Scale by match quality
    let scale = 0.1;
    if (matchQuality === 'exact') {
      scale = 1.0;
    } else if (matchQuality === 'partial') {
      scale = 0.5 + 0.2 * baseOverlap; // 0.5 to 0.7 depending on baseOverlap
    } else if (matchQuality === 'weak') {
      scale = 0.1 + 0.2 * baseOverlap; // 0.1 to 0.3 depending on baseOverlap
    }

    return baseOverlap * scale;
  }

  private detectLocale(sourceType: string, name: string): string {
    // Simple heuristic - can be improved
    if (sourceType === 'bls') return 'de';
    if (sourceType === 'usda') return 'en';
    return 'multi';
  }

  private getSourceTrustLevel(sourceType: string): number {
    const trustLevels: Record<string, number> = {
      user: 0.88,
      bls: 0.82,
      usda: 0.76,
      off: 0.72,
      ai: 0.35,
    };
    return trustLevels[sourceType] || 0.5;
  }


  private getCoverageRelevance(sourceType: string, locale: string): number {
    if (locale === 'de' && sourceType === 'bls') return 1.0;
    if (locale === 'en' && sourceType === 'usda') return 1.0;
    if (sourceType === 'off') return 0.8; // Good multilingual coverage
    return 0.6;
  }

  private calculateDataCompleteness(macros: any): number {
    let completeness = 0;
    if (macros.kcal > 0) completeness += 0.25;
    if (macros.protein >= 0) completeness += 0.25;
    if (macros.carbs >= 0) completeness += 0.25;
    if (macros.fat >= 0) completeness += 0.25;
    return completeness;
  }

  private createSourceComparison(
    rankedCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[],
  ): SourceComparison {
    const sourcesQueried = [...new Set(rankedCandidates.map(r => r.candidate.source))];
    const candidatesPerSource: Record<string, number> = {};
    const bestPerSource: Record<string, number> = {};

    for (const source of sourcesQueried) {
      const sourceCandidates = rankedCandidates.filter(r => r.candidate.source === source);
      candidatesPerSource[source] = sourceCandidates.length;
      bestPerSource[source] = sourceCandidates.length > 0 ? sourceCandidates[0].breakdown.finalScore : 0;
    }

    return {
      sourcesQueried,
      candidatesPerSource,
      bestPerSource,
    };
  }

  private createMetrics(startTime: number, traceId: string, sourceResults: any[]): FusionMetrics {
    return {
      traceId,
      totalCandidates: sourceResults.reduce((sum, r) => sum + r.candidates.length, 0),
      processingTimeMs: Date.now() - startTime,
      sourcesQueried: this.sources.map(s => s.type),
      sourcesSucceeded: this.sources.map(s => s.type), // TODO: Track actual success/failure
      sourcesFailed: [],
      cacheHits: 0, // TODO: Implement caching
      degradedMode: false,
    };
  }

  // Logging methods
  private logFusionInput(traceId: string, query: FoodSearchQuery): void {
    console.log(`[${traceId}] PROOF_FUSION_INPUT query="${query.normalized}" sources="${this.sources.map(s => s.type).join(',')}"`);
  }

  private logFusionScore(traceId: string, candidate: FusionCandidate, breakdown: ConfidenceBreakdown, rank: number): void {
    console.log(`[${traceId}] PROOF_FUSION_SCORES id="${candidate.id}" source="${candidate.source}" score=${breakdown.finalScore.toFixed(3)} rank=${rank}`);
  }

  private logFusionWinner(traceId: string, decision: FusionResolverDecision, metrics: FusionMetrics): void {
    const winnerId = decision.best?.id || 'none';
    const winnerSource = decision.best?.source || 'none';
    const winnerScore = decision.explanation.confidenceBreakdown.finalScore || 0;
    
    console.log(`[${traceId}] PROOF_FUSION_WINNER id="${winnerId}" source="${winnerSource}" score=${winnerScore.toFixed(3)} status="${decision.status}"`);
  }

  private generateTraceId(): string {
    return `fusion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}