import { ResolvedFoodCandidate, ResolverDecision } from '../../domain/models/ResolverDecision';

const ACCEPT_THRESHOLD = 0.75;
const AMBIGUOUS_THRESHOLD = 0.7;
const DELTA_THRESHOLD = 0.08;

export function sortResolvedCandidates(
  candidates: ResolvedFoodCandidate[],
): ResolvedFoodCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.breakdown.matchScore !== a.breakdown.matchScore) {
      return b.breakdown.matchScore - a.breakdown.matchScore;
    }

    if (b.breakdown.dataQualityScore !== a.breakdown.dataQualityScore) {
      return b.breakdown.dataQualityScore - a.breakdown.dataQualityScore;
    }

    if (b.breakdown.kcalConsistencyScore !== a.breakdown.kcalConsistencyScore) {
      return b.breakdown.kcalConsistencyScore - a.breakdown.kcalConsistencyScore;
    }

    if (b.breakdown.sourceTrustScore !== a.breakdown.sourceTrustScore) {
      return b.breakdown.sourceTrustScore - a.breakdown.sourceTrustScore;
    }

    return a.id.localeCompare(b.id);
  });
}

export function buildResolverDecision(input: {
  normalizedQuery: string;
  candidates: ResolvedFoodCandidate[];
  topN?: number;
  createdAt?: string;
}): ResolverDecision {
  const sorted = sortResolvedCandidates(input.candidates);
  const best = sorted[0];
  const secondBest = sorted[1];

  let status: ResolverDecision['status'] = 'rejected';
  let reasonCodes: string[] = ['NO_CANDIDATES'];

  if (best) {
    const scoreDelta = secondBest ? best.score - secondBest.score : 1;

    if (best.score >= ACCEPT_THRESHOLD && scoreDelta >= DELTA_THRESHOLD) {
      status = 'accepted';
      reasonCodes = ['ACCEPTED_STRONG_MATCH'];
    } else if (best.score >= AMBIGUOUS_THRESHOLD && scoreDelta < DELTA_THRESHOLD) {
      status = 'ambiguous';
      reasonCodes = ['MULTIPLE_CLOSE_MATCHES'];
    } else {
      status = 'rejected';
      reasonCodes = ['LOW_SCORE'];
    }
  }

  return {
    normalizedQuery: input.normalizedQuery,
    status,
    reasonCodes,
    candidates: sorted.slice(0, input.topN ?? 5),
    best,
    secondBest,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
