import {
  isMockResolverSourceLabel,
  isRealResolverSourceLabel,
  ResolverSourceLabel,
} from '../ResolverSourceLabel';

export function filterMockCandidatesIfRealExist<T extends { source: ResolverSourceLabel }>(
  candidates: T[],
): T[] {
  const hasRealCandidate = candidates.some((candidate) =>
    isRealResolverSourceLabel(candidate.source),
  );

  if (!hasRealCandidate) {
    return candidates;
  }

  return candidates.filter((candidate) => !isMockResolverSourceLabel(candidate.source));
}
