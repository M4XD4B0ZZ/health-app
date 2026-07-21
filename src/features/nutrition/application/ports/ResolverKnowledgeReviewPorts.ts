import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidateReasonCode,
  ResolverKnowledgeCandidateStatus,
} from '../../domain/models/ResolverKnowledgeCandidate';
import type {
  ApprovedResolverKnowledgePayload,
  ResolverKnowledgeReviewEvent,
} from '../../domain/models/ResolverKnowledgeReview';

/** Server-side authorization boundary. App-user identity and client booleans are intentionally
 * absent from the review request itself; the trusted reviewer identity is supplied only here,
 * from a real server/admin authorization context — never from request/body input. */
export type ResolverKnowledgeReviewAuthorizationContext =
  | { authorized: true; reviewerId: string }
  | { authorized: false };
export interface ResolverKnowledgeReviewAuthorizer {
  authorizeDeveloperReview(): Promise<ResolverKnowledgeReviewAuthorizationContext>;
}

export interface ResolverKnowledgeReviewCandidateReader {
  getById(candidateId: string): Promise<ResolverKnowledgeCandidate | null>;
  getLifecycleHistory(
    candidateId: string,
  ): Promise<readonly { nextStatus: string; reasonCode: string; occurredAt: string }[]>;
}

/** Fully-computed, business-rule-free write plan. Persistence adapters apply this verbatim —
 * they make no lifecycle or eligibility decisions of their own. */
export interface ResolverKnowledgeReviewDecisionPlan {
  candidateId: string;
  /** Non-null for approve/reject/needs_more_evidence/quarantine/mark_duplicate/supersede; null for
   * revoke_approval/rollback, which only change the approved payload, not the candidate lifecycle. */
  candidateTransition: {
    nextStatus: ResolverKnowledgeCandidateStatus;
    reasonCode: ResolverKnowledgeCandidateReasonCode;
    duplicateOfCandidateId: string | null;
    supersededByCandidateId: string | null;
    quarantineReasonCode: ResolverKnowledgeCandidateReasonCode | null;
  } | null;
  /** Non-null exactly for approve/revoke_approval/rollback. */
  approvedPayload: ApprovedResolverKnowledgePayload | null;
  /** Fully-formed immutable audit record with `result` already set to `'applied'`. */
  event: ResolverKnowledgeReviewEvent;
}

/**
 * Server/admin-only atomic decision boundary (RESOLVER-V3-028).
 *
 * `applyDecision` MUST atomically apply the candidate lifecycle transition, the approved-payload
 * create/state-change (when present), and the immutable review-event append as a single
 * all-or-nothing operation — one database transaction or a single RPC call in any production
 * adapter. A failure at any internal step MUST leave candidate state, approved-payload state, and
 * audit history completely unchanged; adapters MUST NOT perform compensating best-effort writes
 * that can themselves fail. There is deliberately no separate `saveApproved`/`appendEvent`/
 * candidate-mutation method on this port — an adapter has no way to expose a partial write through
 * this interface, which is what makes a non-atomic adapter clearly non-conforming rather than
 * merely discouraged.
 */
export interface ResolverKnowledgeReviewRepository {
  findDecisionByDecisionId(decisionId: string): Promise<ResolverKnowledgeReviewEvent | null>;
  findApprovedByCandidate(candidateId: string): Promise<ApprovedResolverKnowledgePayload | null>;
  applyDecision(
    plan: ResolverKnowledgeReviewDecisionPlan,
  ): Promise<'applied' | 'persistence_failed'>;
}
