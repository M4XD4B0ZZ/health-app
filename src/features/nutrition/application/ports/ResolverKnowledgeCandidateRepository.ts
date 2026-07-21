import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidateLifecycleEvent,
  ResolverKnowledgeCandidateReasonCode,
  ResolverKnowledgeCandidateStatus,
} from '../../domain/models/ResolverKnowledgeCandidate';
export type ResolverKnowledgeCandidateWriteResult =
  | { status: 'created' | 'updated'; candidate: ResolverKnowledgeCandidate }
  | {
      status: 'failed';
      code: 'validation_failed' | 'approval_not_supported' | 'invalid_transition';
    };
/** Server/admin-only future persistence boundary; never injected into resolver composition. */
export interface ResolverKnowledgeCandidateRepository {
  getById(candidateId: string): Promise<ResolverKnowledgeCandidate | null>;
  upsertInactive(
    candidate: ResolverKnowledgeCandidate,
  ): Promise<ResolverKnowledgeCandidateWriteResult>;
  transitionInactive(input: {
    candidateId: string;
    nextStatus: Exclude<ResolverKnowledgeCandidateStatus, 'approved'>;
    reasonCode: ResolverKnowledgeCandidateReasonCode;
    actorType: 'system' | 'developer';
    occurredAt: string;
  }): Promise<ResolverKnowledgeCandidateWriteResult>;
  readonly events: readonly ResolverKnowledgeCandidateLifecycleEvent[];
}
