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
] as const;
export type ResolverKnowledgeCandidateReasonCode =
  (typeof RESOLVER_KNOWLEDGE_CANDIDATE_REASON_CODES)[number];

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
  independentUserEvidence: 'not_evaluable';
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
  status: Exclude<ResolverKnowledgeCandidateStatus, 'approved'>;
  duplicateOfCandidateId: string | null;
  supersededByCandidateId: string | null;
  quarantineReasonCode: ResolverKnowledgeCandidateReasonCode | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolverKnowledgeCandidateLifecycleEvent {
  eventId: string;
  candidateId: string;
  previousStatus: Exclude<ResolverKnowledgeCandidateStatus, 'approved'> | null;
  nextStatus: Exclude<ResolverKnowledgeCandidateStatus, 'approved'>;
  reasonCode: ResolverKnowledgeCandidateReasonCode;
  actorType: 'system' | 'developer';
  payloadVersion: typeof RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION;
  occurredAt: string;
}

export type ResolverKnowledgeCandidateAggregationInput = ResolverObservationAggregationProjectionV1;
