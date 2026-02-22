import { ResolverDecision } from '../../../domain/models/ResolverDecision';
import {
  ResolverDecisionSummary,
  ResolverDecisionSummaryCandidate,
  ResolverSourceLabel,
} from '../../../domain/models/ResolverDecisionSummary';

function toResolverSourceLabel(value: string): ResolverSourceLabel {
  const normalized = value.toUpperCase();
  switch (normalized) {
    case 'OFF':
    case 'USDA':
    case 'MOCK_OFF':
    case 'MOCK_USDA':
    case 'USER':
    case 'AI':
      return normalized;
    default:
      return 'UNKNOWN';
  }
}

function toSummaryCandidate(input: {
  source: string;
  name: string;
  score: number;
}): ResolverDecisionSummaryCandidate {
  return {
    source: toResolverSourceLabel(input.source),
    name: input.name,
    score: input.score,
  };
}

export function summarizeResolverDecision(
  resolverDecision?: ResolverDecision,
): ResolverDecisionSummary | undefined {
  if (!resolverDecision?.best) {
    return undefined;
  }

  return {
    source: toResolverSourceLabel(resolverDecision.best.source),
    chosenName: resolverDecision.best.food.name,
    bestScore: resolverDecision.best.score,
    status: resolverDecision.status,
    reasonCodes: resolverDecision.reasonCodes,
    topCandidates: resolverDecision.candidates.slice(0, 3).map((candidate) =>
      toSummaryCandidate({
        source: candidate.source,
        name: candidate.food.name,
        score: candidate.score,
      }),
    ),
  };
}
