import { CanonicalFood } from '../catalog/FoodCatalogSource';

export type ResolverStatus = 'accepted' | 'ambiguous' | 'rejected';

export interface ResolvedFoodCandidateBreakdown {
  matchScore: number;
  dataQualityScore: number;
  kcalConsistencyScore: number;
  sourceTrustScore: number;
  finalScore: number;
  notes: string[];
}

export interface ResolvedFoodCandidate {
  id: string;
  source: string;
  food: CanonicalFood;
  score: number;
  breakdown: ResolvedFoodCandidateBreakdown;
}

export interface ResolverDecision {
  normalizedQuery: string;
  status: ResolverStatus;
  reasonCodes: string[];
  candidates: ResolvedFoodCandidate[];
  best?: ResolvedFoodCandidate;
  secondBest?: ResolvedFoodCandidate;
  createdAt: string;
}
