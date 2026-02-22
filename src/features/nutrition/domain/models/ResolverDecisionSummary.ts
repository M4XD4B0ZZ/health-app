import { ResolverStatus } from './ResolverDecision';

export type ResolverSourceLabel =
  | 'OFF'
  | 'USDA'
  | 'MOCK_OFF'
  | 'MOCK_USDA'
  | 'USER'
  | 'AI'
  | 'UNKNOWN';

export interface ResolverDecisionSummaryCandidate {
  source: ResolverSourceLabel;
  name: string;
  brand?: string;
  score: number;
}

export interface ResolverDecisionSummary {
  source: ResolverSourceLabel;
  chosenName: string;
  chosenBrand?: string;
  bestScore: number;
  status: ResolverStatus;
  reasonCodes: string[];
  topCandidates?: ResolverDecisionSummaryCandidate[];
}
