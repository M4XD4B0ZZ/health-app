import {
  FusionCandidate,
  ConfidenceBreakdown,
  FusionScoringWeights,
  DEFAULT_FUSION_WEIGHTS,
  SOURCE_TRUST_SCORES,
  FUSION_PENALTIES,
} from './FusionCandidate';

/**
 * Deterministic scoring engine for fusion candidates
 * Implements the scoring model from the architecture plan
 */
export class CandidateScorer {
  constructor(private readonly weights: FusionScoringWeights = {
  lexical: 0.40,
  tokenOverlap: 0.25,
  sourceTrust: 0.12,
  localeMatch: 0.10,
  completeness: 0.05,
  plausibility: 0.08
}) {}

  /**
   * Calculate final score for a fusion candidate
   * Returns score breakdown for explainability
   */
  scoreCandidate(
    candidate: FusionCandidate,
    query: { normalized: string; locale: 'de' | 'en' },
  ): ConfidenceBreakdown {
    // Calculate individual score components
    const lexicalContribution = this.weights.lexical * candidate.matchSignals.lexicalScore;
    const tokenContribution = this.weights.tokenOverlap * candidate.matchSignals.tokenOverlap;
    const sourceTrustContribution = this.weights.sourceTrust * this.getSourceTrustScore(candidate.source);
    const localeContribution = this.weights.localeMatch * this.getLocaleMatchScore(candidate, query.locale);
    const completenessContribution = this.weights.completeness * candidate.metadata.dataCompleteness;
    const plausibilityContribution = this.weights.plausibility * candidate.macrosPer100g.plausibilityScore;

    // Calculate penalties
    const totalPenalties = this.calculatePenalties(candidate);

    // Final score calculation
    const baseScore = 
      lexicalContribution +
      tokenContribution +
      sourceTrustContribution +
      localeContribution +
      completenessContribution +
      plausibilityContribution;

    const finalScore = Math.max(0, baseScore - totalPenalties);

    return {
      lexicalContribution,
      tokenContribution,
      sourceTrustContribution,
      localeContribution,
      completenessContribution,
      plausibilityContribution,
      totalPenalties,
      finalScore,
    };
  }

  /**
   * Get source trust score from predefined mapping
   */
  private getSourceTrustScore(source: FusionCandidate['source']): number {
    return SOURCE_TRUST_SCORES[source] || 0.5; // Fallback for unknown sources
  }

  /**
   * Calculate locale match score with DACH strategy boost
   */
  private getLocaleMatchScore(candidate: FusionCandidate, queryLocale: 'de' | 'en'): number {
    const baseScore = this.getBaseLocaleScore(candidate.source, queryLocale);
    const boost = this.getLocaleBoost(candidate.source, queryLocale);
    
    return Math.min(1.0, baseScore + boost);
  }

  /**
   * Base locale compatibility scores from architecture plan
   */
  private getBaseLocaleScore(source: FusionCandidate['source'], queryLocale: 'de' | 'en'): number {
    if (queryLocale === 'de') {
      switch (source) {
        case 'bls': return 1.0;   // Perfect for German
        case 'off': return 0.8;   // Good multilingual coverage
        case 'usda': return 0.6;  // English-focused but usable
        case 'user': return 1.0;  // User data is always relevant
        case 'ai': return 0.7;    // AI can adapt to locale
        default: return 0.5;
      }
    } else { // 'en'
      switch (source) {
        case 'usda': return 1.0;  // Perfect for English
        case 'off': return 0.8;   // Good multilingual coverage
        case 'bls': return 0.4;   // German-focused
        case 'user': return 1.0;  // User data is always relevant
        case 'ai': return 0.7;    // AI can adapt to locale
        default: return 0.5;
      }
    }
  }

  /**
   * Locale boost for DACH strategy priority
   */
  private getLocaleBoost(source: FusionCandidate['source'], queryLocale: 'de' | 'en'): number {
    if (queryLocale === 'de') {
      switch (source) {
        case 'bls': return 0.1;   // Strong boost for German queries
        case 'off': return 0.05;  // Small boost for multilingual
        default: return 0;
      }
    } else { // 'en'
      switch (source) {
        case 'usda': return 0.1;  // Strong boost for English queries
        case 'off': return 0.05;  // Small boost for multilingual
        default: return 0;
      }
    }
  }

  /**
   * Calculate total penalties based on match signals and data quality
   */
  private calculatePenalties(candidate: FusionCandidate): number {
    let totalPenalties = 0;

    // Match signal penalties
    if (candidate.matchSignals.aliasUsed) {
      totalPenalties += -0.08;
    }

    if (candidate.matchSignals.fuzzyMatch) {
      totalPenalties += -0.15;
    }

    if (candidate.matchSignals.semanticNarrowing) {
      totalPenalties += -0.20;
    }

    // Data quality penalties
    if (candidate.macrosPer100g.hasIncompleteData) {
      totalPenalties += FUSION_PENALTIES.INCOMPLETE_DATA;
    }

    if (candidate.macrosPer100g.plausibilityScore < 0.5) {
      totalPenalties += FUSION_PENALTIES.LOW_PLAUSIBILITY;
    }

    return totalPenalties;
  }

  /**
   * Generate human-readable explanation for score components
   */
  generateScoreExplanation(breakdown: ConfidenceBreakdown, candidate: FusionCandidate): string[] {
    const explanations: string[] = [];

    // Positive contributions
    if (breakdown.lexicalContribution > 0.25) {
      explanations.push(`Strong lexical match (${(breakdown.lexicalContribution * 100).toFixed(0)}%)`);
    }

    if (breakdown.sourceTrustContribution > 0.15) {
      explanations.push(`High source trust: ${candidate.source.toUpperCase()} (${(breakdown.sourceTrustContribution * 100).toFixed(0)}%)`);
    }

    if (breakdown.localeContribution > 0.10) {
      explanations.push(`Good locale match (${(breakdown.localeContribution * 100).toFixed(0)}%)`);
    }

    // Penalties
    if (candidate.matchSignals.fuzzyMatch) {
      explanations.push(`Fuzzy matching penalty (-${(FUSION_PENALTIES.FUZZY_MATCH * 100).toFixed(0)}%)`);
    }

    if (candidate.matchSignals.aliasUsed) {
      explanations.push(`Alias usage penalty (-${(FUSION_PENALTIES.ALIAS_USAGE * 100).toFixed(0)}%)`);
    }

    if (candidate.macrosPer100g.hasIncompleteData) {
      explanations.push(`Incomplete data penalty (-${(FUSION_PENALTIES.INCOMPLETE_DATA * 100).toFixed(0)}%)`);
    }

    return explanations;
  }
}