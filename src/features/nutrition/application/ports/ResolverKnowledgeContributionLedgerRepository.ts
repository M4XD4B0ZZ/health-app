import type { ResolverKnowledgeContributionRecordingRequest } from '../knowledge/ResolverKnowledgeContributionRecordingPlanner';

export type ResolverKnowledgeContributionRecordingResult =
  | { status: 'recorded'; contributionId: string; candidateId: string }
  | { status: 'already_recorded'; contributionId: string; candidateId: string }
  | { status: 'conflict'; contributionId: string }
  | { status: 'failed'; code: string };

export type ResolverKnowledgeContributionRetractionResult =
  | {
      status: 'applied';
      retractedContributionIds: readonly string[];
      affectedCandidateIds: readonly string[];
    }
  | { status: 'already_recorded' }
  | { status: 'conflict' }
  | { status: 'no_op' }
  | { status: 'failed'; code: string };

/**
 * Private contribution-ledger repository port (RESOLVER-V3-032 binding requirement §23). Deliberately
 * separate from `ResolverKnowledgeCandidateRepository` — it never overloads that port's
 * `upsertInactive` additive-counter semantics with contribution-ledger semantics.
 */
export interface ResolverKnowledgeContributionLedgerRepository {
  recordContribution(
    request: ResolverKnowledgeContributionRecordingRequest,
  ): Promise<ResolverKnowledgeContributionRecordingResult>;
  retractContributions(request: unknown): Promise<ResolverKnowledgeContributionRetractionResult>;
}
