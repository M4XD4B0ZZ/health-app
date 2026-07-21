import type { ResolverObservationAggregationProjectionV1 } from './ResolverObservationPrivacy';

export const RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION =
  'resolver-knowledge-candidate-v1' as const;

export const RESOLVER_KNOWLEDGE_CANDIDATE_TYPES = [
  'source-routing-pattern',
  'abstention-policy-signal',
  'clarification-policy-signal',
  'provenance-gap',
  'negative-source-routing-rule',
] as const;
export type ResolverKnowledgeCandidateType = (typeof RESOLVER_KNOWLEDGE_CANDIDATE_TYPES)[number];

export const RESOLVER_KNOWLEDGE_CANDIDATE_STATUSES = [
  'candidate',
  'needs_more_evidence',
  'pending_review',
  'rejected',
  'duplicate',
  'superseded',
  'quarantined',
  'approved',
] as const;
export type ResolverKnowledgeCandidateStatus =
  (typeof RESOLVER_KNOWLEDGE_CANDIDATE_STATUSES)[number];

export const RESOLVER_KNOWLEDGE_CANDIDATE_REASON_CODES = [
  'OBSERVATION_PATTERN',
  'CONTRADICTING_PROJECTION',
  'INSUFFICIENT_EVIDENCE',
  'READY_FOR_REVIEW',
  'DUPLICATE_FINGERPRINT',
  'QUARANTINE_PRIVACY_REVIEW',
  'REJECTED_BY_REVIEW',
  'SUPERSEDED_BY_CANDIDATE',
  'APPROVED_BY_REVIEW',
] as const;
export type ResolverKnowledgeCandidateReasonCode =
  (typeof RESOLVER_KNOWLEDGE_CANDIDATE_REASON_CODES)[number];

/**
 * Closed distinction (RESOLVER-V3-028) between evidence that is not evaluated/insufficient and
 * evidence positively evaluated through a privacy-safe independent-user boundary. No numeric
 * user-count threshold is invented here; the current aggregation pipeline (RESOLVER-V3-020) only
 * ever produces `not_evaluable`, so approval remains fail-closed until an accepted independent-user
 * aggregation mechanism exists to produce `independently_confirmed`.
 */
export const RESOLVER_KNOWLEDGE_INDEPENDENT_USER_EVIDENCE_STATUSES = [
  'not_evaluable',
  'independently_confirmed',
] as const;
export type ResolverKnowledgeIndependentUserEvidenceStatus =
  (typeof RESOLVER_KNOWLEDGE_INDEPENDENT_USER_EVIDENCE_STATUSES)[number];

export type ResolverKnowledgeCandidatePayload =
  | {
      type: 'source-routing-pattern';
      locale: 'de' | 'en';
      inputType: string;
      sourceType: 'bls' | 'off' | 'usda';
    }
  | {
      type: 'abstention-policy-signal';
      locale: 'de' | 'en';
      inputType: string;
      reasonCode: 'NO_CANDIDATES' | 'LOW_SCORE';
    }
  | {
      type: 'clarification-policy-signal';
      locale: 'de' | 'en';
      inputType: string;
      reasonCode: 'MULTIPLE_CLOSE_MATCHES';
    }
  | { type: 'provenance-gap'; locale: 'de' | 'en'; inputType: string }
  | {
      type: 'negative-source-routing-rule';
      locale: 'de' | 'en';
      inputType: string;
      sourceType: 'bls' | 'off' | 'usda';
      reasonCode: 'NO_CANDIDATES' | 'LOW_SCORE';
    };

export interface ResolverKnowledgeCandidateEvidence {
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  abstentionSignalCount: number;
  clarificationSignalCount: number;
  contradictionStatus: 'none' | 'present';
  negativeEvidenceSummary: 'none' | 'source_unsuitable_signal';
  independentUserEvidence: ResolverKnowledgeIndependentUserEvidenceStatus;
  locales: readonly ('de' | 'en')[];
  inputTypes: readonly string[];
  sourceTypes: readonly ('bls' | 'off' | 'usda')[];
  provenanceStatuses: readonly ('source_grounded' | 'not_resolved')[];
  reasonCodes: readonly string[];
  privacyPolicyVersions: readonly string[];
  observationContractVersions: readonly string[];
  resolverVersions: readonly string[];
}

export interface ResolverKnowledgeCandidate {
  candidateId: string;
  contractVersion: typeof RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION;
  candidateType: ResolverKnowledgeCandidateType;
  fingerprint: string;
  payload: ResolverKnowledgeCandidatePayload;
  evidence: ResolverKnowledgeCandidateEvidence;
  risk: 'low' | 'medium' | 'high';
  /**
   * Full closed status set, including `approved` (RESOLVER-V3-028). Only the review service's
   * atomic `applyDecision` operation may legally set this to `approved`; the candidate
   * aggregation/upsert path (`ResolverKnowledgeCandidateRepository`) continues to reject it.
   */
  status: ResolverKnowledgeCandidateStatus;
  duplicateOfCandidateId: string | null;
  supersededByCandidateId: string | null;
  quarantineReasonCode: ResolverKnowledgeCandidateReasonCode | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolverKnowledgeCandidateLifecycleEvent {
  eventId: string;
  candidateId: string;
  /** Full closed status set: a review-caused transition may legitimately record `approved`. */
  previousStatus: ResolverKnowledgeCandidateStatus | null;
  nextStatus: ResolverKnowledgeCandidateStatus;
  reasonCode: ResolverKnowledgeCandidateReasonCode;
  actorType: 'system' | 'developer';
  payloadVersion: typeof RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION;
  occurredAt: string;
}

export type ResolverKnowledgeCandidateAggregationInput = ResolverObservationAggregationProjectionV1;
