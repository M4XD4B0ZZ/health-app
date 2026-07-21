import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidatePayload,
} from './ResolverKnowledgeCandidate';

export const RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION = 'resolver-knowledge-review-v1' as const;
export const RESOLVER_KNOWLEDGE_REVIEW_ACTIONS = [
  'approve',
  'reject',
  'needs_more_evidence',
  'quarantine',
  'mark_duplicate',
  'supersede',
  'revoke_approval',
  'rollback',
] as const;
export type ResolverKnowledgeReviewAction = (typeof RESOLVER_KNOWLEDGE_REVIEW_ACTIONS)[number];
export type ResolverKnowledgeReviewResult =
  | 'applied'
  | 'already_applied'
  | 'blocked_unauthorized'
  | 'blocked_privacy'
  | 'invalid_transition'
  | 'candidate_not_found'
  | 'validation_failed'
  | 'persistence_failed';

/** Deliberately privacy-safe review projection; this type excludes all personal identifiers and text. */
export interface ResolverKnowledgeReviewMaterial {
  candidateType: ResolverKnowledgeCandidate['candidateType'];
  payload: ResolverKnowledgeCandidatePayload;
  evidence: ResolverKnowledgeCandidate['evidence'];
  risk: ResolverKnowledgeCandidate['risk'];
  candidateStatus: ResolverKnowledgeCandidate['status'];
  contractVersion: string;
  lifecycleHistory: readonly { nextStatus: string; reasonCode: string; occurredAt: string }[];
}
export interface ResolverKnowledgeReviewRequest {
  decisionId: string;
  candidateId: string;
  action: ResolverKnowledgeReviewAction;
  occurredAt: string;
}
export interface ApprovedResolverKnowledgePayload {
  approvedKnowledgeId: string;
  candidateId: string;
  decisionId: string;
  payloadVersion: typeof RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION;
  payload: ResolverKnowledgeCandidatePayload;
  locale: 'de' | 'en';
  risk: 'low' | 'medium' | 'high';
  provenanceStatus: 'source_grounded' | 'not_resolved';
  status: 'active' | 'revoked' | 'rolled_back';
  revokedByDecisionId: string | null;
  rollbackByDecisionId: string | null;
}
export interface ResolverKnowledgeReviewEvent {
  eventId: string;
  decisionId: string;
  candidateId: string;
  action: ResolverKnowledgeReviewAction;
  result: ResolverKnowledgeReviewResult;
  occurredAt: string;
  approvedKnowledgeId: string | null;
}
