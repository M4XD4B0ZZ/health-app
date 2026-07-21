import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidatePayload,
  ResolverKnowledgeCandidateStatus,
} from './ResolverKnowledgeCandidate';
import { RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION } from './ResolverObservationPrivacy';

export const RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION = 'resolver-knowledge-review-v1' as const;
export const RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION =
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION;

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

/** `conflict` (RESOLVER-V3-028) is distinct from `already_applied`: a decision-id reused with
 * different decision content must never be reported as an idempotent no-op. */
export type ResolverKnowledgeReviewResult =
  | 'applied'
  | 'already_applied'
  | 'conflict'
  | 'blocked_unauthorized'
  | 'blocked_privacy'
  | 'invalid_transition'
  | 'candidate_not_found'
  | 'validation_failed'
  | 'persistence_failed';

/** Closed decision-reason enum (RESOLVER-V3-028) — no free-text reasons are accepted. */
export const RESOLVER_KNOWLEDGE_REVIEW_DECISION_REASON_CODES = [
  'INDEPENDENT_EVIDENCE_CONFIRMED',
  'INSUFFICIENT_INDEPENDENT_EVIDENCE',
  'PRIVACY_OR_PROVENANCE_RISK',
  'CONTRADICTING_EVIDENCE',
  'DUPLICATE_OF_EXISTING_CANDIDATE',
  'SUPERSEDED_BY_NEWER_CANDIDATE',
  'REGRESSION_OR_ERROR_DETECTED',
  'ROLLBACK_TO_PRIOR_STATE',
] as const;
export type ResolverKnowledgeReviewDecisionReasonCode =
  (typeof RESOLVER_KNOWLEDGE_REVIEW_DECISION_REASON_CODES)[number];

/** Closed map of which decision reasons are legal for which review action. Anything else fails closed. */
export const RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS: Record<
  ResolverKnowledgeReviewAction,
  readonly ResolverKnowledgeReviewDecisionReasonCode[]
> = {
  approve: ['INDEPENDENT_EVIDENCE_CONFIRMED'],
  reject: [
    'INSUFFICIENT_INDEPENDENT_EVIDENCE',
    'PRIVACY_OR_PROVENANCE_RISK',
    'CONTRADICTING_EVIDENCE',
  ],
  needs_more_evidence: ['INSUFFICIENT_INDEPENDENT_EVIDENCE', 'CONTRADICTING_EVIDENCE'],
  quarantine: ['PRIVACY_OR_PROVENANCE_RISK'],
  mark_duplicate: ['DUPLICATE_OF_EXISTING_CANDIDATE'],
  supersede: ['SUPERSEDED_BY_NEWER_CANDIDATE'],
  revoke_approval: ['REGRESSION_OR_ERROR_DETECTED', 'PRIVACY_OR_PROVENANCE_RISK'],
  rollback: ['ROLLBACK_TO_PRIOR_STATE', 'REGRESSION_OR_ERROR_DETECTED'],
};

/** No unsupported region taxonomy is invented; `unknown` fails closed for `approve`. */
export const RESOLVER_KNOWLEDGE_REVIEW_LOCALE_RESTRICTIONS = [
  'not_applicable',
  'restricted_to_candidate_locale',
  'unknown',
] as const;
export type ResolverKnowledgeReviewLocaleRestriction =
  (typeof RESOLVER_KNOWLEDGE_REVIEW_LOCALE_RESTRICTIONS)[number];

/** Deliberately privacy-safe, immutable review-material snapshot; excludes personal identifiers/text. */
export interface ResolverKnowledgeReviewMaterial {
  candidateType: ResolverKnowledgeCandidate['candidateType'];
  payload: ResolverKnowledgeCandidatePayload;
  evidence: ResolverKnowledgeCandidate['evidence'];
  risk: ResolverKnowledgeCandidate['risk'];
  candidateStatus: ResolverKnowledgeCandidateStatus;
  contractVersion: string;
  lifecycleHistory: readonly { nextStatus: string; reasonCode: string; occurredAt: string }[];
}

interface ResolverKnowledgeReviewDecisionBase {
  decisionId: string;
  candidateId: string;
  occurredAt: string;
  reviewContractVersion: typeof RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION;
  privacyPolicyVersion: typeof RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION;
  /** The exact candidate.updatedAt snapshot the reviewer decided against; a stale value fails closed. */
  candidateVersionAtDecision: string;
  riskDecision: ResolverKnowledgeCandidate['risk'];
  localeRestriction: ResolverKnowledgeReviewLocaleRestriction;
}

/** Discriminated per-action review command; duplicate/supersede require an explicit target. */
export type ResolverKnowledgeReviewRequest =
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'approve';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'reject';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'needs_more_evidence';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'quarantine';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'mark_duplicate';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
      targetCandidateId: string;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'supersede';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
      targetCandidateId: string;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'revoke_approval';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
    })
  | (ResolverKnowledgeReviewDecisionBase & {
      action: 'rollback';
      reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
    });

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

/** Immutable, append-only audit record. Persists reviewer identity, versions, closed reason,
 * risk decision, locale restriction, and the privacy-safe review-material snapshot presented. */
export interface ResolverKnowledgeReviewEvent {
  eventId: string;
  decisionId: string;
  candidateId: string;
  action: ResolverKnowledgeReviewAction;
  reasonCode: ResolverKnowledgeReviewDecisionReasonCode;
  result: ResolverKnowledgeReviewResult;
  /** From the trusted server/admin authorization context only — never an app-user-supplied value. */
  reviewerId: string;
  reviewContractVersion: typeof RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION;
  privacyPolicyVersion: typeof RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION;
  candidateVersionAtDecision: string;
  riskDecision: ResolverKnowledgeCandidate['risk'];
  localeRestriction: ResolverKnowledgeReviewLocaleRestriction;
  targetCandidateId: string | null;
  reviewMaterialSnapshot: ResolverKnowledgeReviewMaterial;
  occurredAt: string;
  approvedKnowledgeId: string | null;
}

/** Deterministic key/value pairs a byte-equivalent retry must match; reused for both storing the
 * comparison basis and detecting conflicting reuse of a decisionId (RESOLVER-V3-028 §5). The
 * review-material snapshot is deliberately excluded: it is never part of the caller's request (it
 * is computed server-side from the candidate at decision time), so it cannot differ between an
 * original request and its retry, and comparing it directly would incorrectly flag a legitimate
 * retry as changed once the candidate's lifecycle state has since moved on (e.g. to `approved`). */
export function resolverKnowledgeReviewDecisionFingerprint(
  request: ResolverKnowledgeReviewRequest,
  reviewerId: string,
): string {
  const targetCandidateId =
    request.action === 'mark_duplicate' || request.action === 'supersede'
      ? request.targetCandidateId
      : null;
  return JSON.stringify({
    candidateId: request.candidateId,
    action: request.action,
    reasonCode: request.reasonCode,
    reviewerId,
    targetCandidateId,
    riskDecision: request.riskDecision,
    localeRestriction: request.localeRestriction,
    reviewContractVersion: request.reviewContractVersion,
    privacyPolicyVersion: request.privacyPolicyVersion,
    candidateVersionAtDecision: request.candidateVersionAtDecision,
    occurredAt: request.occurredAt,
  });
}

/** Compares an incoming request against a previously persisted event for the same decisionId. */
export function resolverKnowledgeReviewRequestMatchesEvent(
  request: ResolverKnowledgeReviewRequest,
  reviewerId: string,
  event: ResolverKnowledgeReviewEvent,
): boolean {
  return (
    resolverKnowledgeReviewDecisionFingerprint(request, reviewerId) ===
    JSON.stringify({
      candidateId: event.candidateId,
      action: event.action,
      reasonCode: event.reasonCode,
      reviewerId: event.reviewerId,
      targetCandidateId: event.targetCandidateId,
      riskDecision: event.riskDecision,
      localeRestriction: event.localeRestriction,
      reviewContractVersion: event.reviewContractVersion,
      privacyPolicyVersion: event.privacyPolicyVersion,
      candidateVersionAtDecision: event.candidateVersionAtDecision,
      occurredAt: event.occurredAt,
    })
  );
}
