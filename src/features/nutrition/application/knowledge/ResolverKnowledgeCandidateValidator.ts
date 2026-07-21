import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  RESOLVER_KNOWLEDGE_CANDIDATE_REASON_CODES,
  RESOLVER_KNOWLEDGE_CANDIDATE_STATUSES,
  RESOLVER_KNOWLEDGE_CANDIDATE_TYPES,
  RESOLVER_KNOWLEDGE_INDEPENDENT_USER_EVIDENCE_STATUSES,
  type ResolverKnowledgeCandidate,
} from '../../domain/models/ResolverKnowledgeCandidate';

const sameKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
  );
};

/** Validates the deliberately closed, privacy-safe candidate contract. */
export function validateResolverKnowledgeCandidate(candidate: ResolverKnowledgeCandidate): void {
  if (
    !sameKeys(candidate, [
      'candidateId',
      'contractVersion',
      'candidateType',
      'fingerprint',
      'payload',
      'evidence',
      'risk',
      'status',
      'duplicateOfCandidateId',
      'supersededByCandidateId',
      'quarantineReasonCode',
      'createdAt',
      'updatedAt',
    ])
  )
    throw new Error('CANDIDATE_UNKNOWN_ROOT_FIELD');
  if (candidate.contractVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION)
    throw new Error('CANDIDATE_UNSUPPORTED_CONTRACT_VERSION');
  if (!RESOLVER_KNOWLEDGE_CANDIDATE_TYPES.includes(candidate.candidateType))
    throw new Error('CANDIDATE_UNKNOWN_TYPE');
  if (
    candidate.status === 'approved' ||
    !RESOLVER_KNOWLEDGE_CANDIDATE_STATUSES.includes(candidate.status)
  )
    throw new Error('CANDIDATE_APPROVAL_NOT_SUPPORTED');
  if (!['low', 'medium', 'high'].includes(candidate.risk))
    throw new Error('CANDIDATE_UNKNOWN_RISK');
  if (
    candidate.quarantineReasonCode &&
    !RESOLVER_KNOWLEDGE_CANDIDATE_REASON_CODES.includes(candidate.quarantineReasonCode)
  )
    throw new Error('CANDIDATE_UNKNOWN_REASON_CODE');
  const payloadKeys: Record<string, string[]> = {
    'source-routing-pattern': ['type', 'locale', 'inputType', 'sourceType'],
    'abstention-policy-signal': ['type', 'locale', 'inputType', 'reasonCode'],
    'clarification-policy-signal': ['type', 'locale', 'inputType', 'reasonCode'],
    'provenance-gap': ['type', 'locale', 'inputType'],
    'negative-source-routing-rule': ['type', 'locale', 'inputType', 'sourceType', 'reasonCode'],
  };
  if (!sameKeys(candidate.payload, payloadKeys[candidate.candidateType]))
    throw new Error('CANDIDATE_INVALID_PAYLOAD');
  if (candidate.payload.type !== candidate.candidateType)
    throw new Error('CANDIDATE_PAYLOAD_TYPE_MISMATCH');
  if (
    !sameKeys(candidate.evidence, [
      'supportingEvidenceCount',
      'contradictingEvidenceCount',
      'abstentionSignalCount',
      'clarificationSignalCount',
      'contradictionStatus',
      'negativeEvidenceSummary',
      'independentUserEvidence',
      'locales',
      'inputTypes',
      'sourceTypes',
      'provenanceStatuses',
      'reasonCodes',
      'privacyPolicyVersions',
      'observationContractVersions',
      'resolverVersions',
    ])
  )
    throw new Error('CANDIDATE_UNKNOWN_EVIDENCE_FIELD');
  if (
    !RESOLVER_KNOWLEDGE_INDEPENDENT_USER_EVIDENCE_STATUSES.includes(
      candidate.evidence.independentUserEvidence,
    )
  )
    throw new Error('CANDIDATE_UNKNOWN_INDEPENDENT_USER_EVIDENCE_STATUS');
  if (
    candidate.evidence.contradictionStatus !==
    (candidate.evidence.contradictingEvidenceCount > 0 ? 'present' : 'none')
  )
    throw new Error('CANDIDATE_CONTRADICTION_MISMATCH');
}
