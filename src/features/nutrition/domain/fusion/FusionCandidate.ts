import { FoodSourceType } from '../catalog/FoodCatalogSource';

/**
 * Unified candidate type for the Fusion Layer
 * Combines candidates from all sources for deterministic comparison
 */
export interface FusionCandidate {
  // Core Identity
  id: string;                    // Unique fusion candidate ID
  source: FoodSourceType;        // 'bls' | 'off' | 'usda' | 'user' | 'ai'
  sourceId: string;              // Original ID in source system
  
  // Food Data
  name: string;                  // Original name from source
  normalizedName: string;        // Normalized for comparison
  macrosPer100g: MacroProfile;   // Standardized macro structure
  
  // Match Signals
  matchSignals: MatchSignals;
  
  // Metadata
  metadata: CandidateMetadata;
}

export interface MatchSignals {
  lexicalScore: number;          // 0.0 - 1.0: exact text similarity
  tokenOverlap: number;          // 0.0 - 1.0: token intersection ratio
  exactMatch: boolean;           // Perfect name match
  aliasUsed: boolean;            // Used alias/synonym
  fuzzyMatch: boolean;           // Used fuzzy matching
  semanticNarrowing: boolean;    // quark → magerquark
}

export interface CandidateMetadata {
  locale: string;                // Source locale (de/en/multi)
  sourceQuality: SourceQuality;  // Source-specific quality metrics
  dataCompleteness: number;      // 0.0 - 1.0: macro completeness
  assumptions: string[];         // Applied assumptions/heuristics
  usedHeuristic: string[];       // Specific heuristics used
  queryUsed: string;             // Actual query sent to source
}

export interface SourceQuality {
  trustLevel: number;            // 0.0 - 1.0: source reliability
  dataFreshness: number;         // 0.0 - 1.0: data recency
  coverageRelevance: number;     // 0.0 - 1.0: locale/domain relevance
}

export interface MacroProfile {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  
  // Quality indicators
  isEstimated: boolean;
  hasIncompleteData: boolean;
  plausibilityScore: number;     // 0.0 - 1.0: macro consistency
}

/**
 * Enhanced ResolverDecision with fusion-specific information
 */
export interface FusionResolverDecision {
  // Base ResolverDecision fields
  normalizedQuery: string;
  status: 'accepted' | 'ambiguous' | 'rejected';
  reasonCodes: string[];
  candidates: FusionCandidate[];
  best?: FusionCandidate;
  secondBest?: FusionCandidate;
  createdAt: string;
  
  // Fusion-specific fields
  explanation: FusionExplanation;
  fusionMetrics: FusionMetrics;
}

export interface FusionExplanation {
  winningReasons: string[];           // Why this candidate won
  rejectedCandidates: RejectedCandidate[]; // Top 3 alternatives
  assumptions: string[];              // Applied assumptions
  confidenceBreakdown: ConfidenceBreakdown;
  sourceComparison: SourceComparison;
}

export interface RejectedCandidate {
  candidate: FusionCandidate;
  score: number;
  rejectionReasons: string[];
}

export interface ConfidenceBreakdown {
  lexicalContribution: number;
  tokenContribution: number;
  sourceTrustContribution: number;
  localeContribution: number;
  completenessContribution: number;
  plausibilityContribution: number;
  totalPenalties: number;
  finalScore: number;
}

export interface SourceComparison {
  sourcesQueried: string[];
  candidatesPerSource: Record<string, number>;
  bestPerSource: Record<string, number>; // Best score per source
}

export interface FusionMetrics {
  traceId?: string;
  totalCandidates: number;
  processingTimeMs: number;
  sourcesQueried: string[];
  sourcesSucceeded: string[];
  sourcesFailed: string[];
  cacheHits: number;
  degradedMode: boolean;
}

/**
 * Scoring weights for deterministic fusion
 */
export interface FusionScoringWeights {
  lexical: number;        // 0.35 - Primary signal for user intent
  tokenOverlap: number;   // 0.20 - Handles partial matches
  sourceTrust: number;    // 0.20 - Quality differentiation
  localeMatch: number;    // 0.15 - DACH strategy priority
  completeness: number;   // 0.05 - Prefer complete data
  plausibility: number;   // 0.05 - Sanity check
}

/**
 * Default scoring weights from architecture plan
 */
export const DEFAULT_FUSION_WEIGHTS: FusionScoringWeights = {
  lexical: 0.35,
  tokenOverlap: 0.20,
  sourceTrust: 0.20,
  localeMatch: 0.15,
  completeness: 0.05,
  plausibility: 0.05,
};

/**
 * Source trust scores from architecture plan
 */
export const SOURCE_TRUST_SCORES: Record<FoodSourceType, number> = {
  user: 1.0,    // User-validated, highest trust
  bls: 0.9,     // Official German database
  usda: 0.8,    // Official US database
  off: 0.7,     // Community-driven, variable quality
  ai: 0.3,      // Estimated, lowest trust
};

/**
 * Penalty values from architecture plan
 */
export const FUSION_PENALTIES = {
  ALIAS_USAGE: 0.05,        // aliasUsed = true
  FUZZY_MATCH: 0.10,        // fuzzyMatch = true
  SEMANTIC_NARROWING: 0.15, // semanticNarrowing = true
  INCOMPLETE_DATA: 0.08,    // Missing macros
  LOW_PLAUSIBILITY: 0.12,   // plausibilityScore < 0.5
} as const;

/**
 * Decision thresholds from architecture plan
 */
export const FUSION_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.82,    // Auto-accept (CALIBRATION-004)
  MEDIUM_CONFIDENCE: 0.62,  // Accept with assumption
  LOW_CONFIDENCE: 0.42,     // Ambiguous/reject threshold
  AMBIGUOUS_DIFF: 0.04,     // Max diff between top 2 for clear winner (CALIBRATION-004)
} as const;