import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../../domain/models/ResolverObservation';
import {
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  RESOLVER_OBSERVATION_SAFE_REASON_CODES,
  type ResolverObservationAggregationProjectionV1,
} from '../../domain/models/ResolverObservationPrivacy';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidate,
  type ResolverKnowledgeCandidatePayload,
} from '../../domain/models/ResolverKnowledgeCandidate';
import { validateResolverKnowledgeCandidate } from './ResolverKnowledgeCandidateValidator';

const safeSourceTypes = ['bls', 'off', 'usda'] as const;
const candidateReasonCodes = ['NO_CANDIDATES', 'LOW_SCORE', 'MULTIPLE_CLOSE_MATCHES'] as const;
const stable = (value: unknown): string => JSON.stringify(value);
const fingerprintFor = (payload: ResolverKnowledgeCandidatePayload) => {
  let hash = 2166136261;
  for (const character of stable(payload)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `rkc-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

function validateProjection(projection: ResolverObservationAggregationProjectionV1): void {
  const expected = [
    'privacyPolicyVersion',
    'contractVersion',
    'locale',
    'inputType',
    'outcome',
    'candidateCount',
    'selectedSource',
    'provenanceStatus',
    'resolverVersion',
    'totalLatencyMs',
    'reasonCodes',
  ];
  if (
    Object.keys(projection).length !== expected.length ||
    expected.some((key) => !(key in projection))
  )
    throw new Error('AGGREGATION_UNSAFE_INPUT');
  if (projection.privacyPolicyVersion !== RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION)
    throw new Error('AGGREGATION_UNKNOWN_PRIVACY_POLICY');
  if (projection.contractVersion !== RESOLVER_OBSERVATION_CONTRACT_VERSION)
    throw new Error('AGGREGATION_UNKNOWN_OBSERVATION_CONTRACT');
  if (
    !projection.inputType ||
    !['de', 'en'].includes(projection.locale) ||
    !Number.isInteger(projection.candidateCount) ||
    projection.candidateCount < 0
  )
    throw new Error('AGGREGATION_INVALID_PROJECTION');
  if (
    !projection.reasonCodes.every((code) =>
      RESOLVER_OBSERVATION_SAFE_REASON_CODES.includes(code as any),
    )
  )
    throw new Error('AGGREGATION_UNSAFE_REASON_CODE');
  if (projection.selectedSource && !safeSourceTypes.includes(projection.selectedSource.type))
    throw new Error('AGGREGATION_UNSAFE_SOURCE');
}

function payloadFor(
  projection: ResolverObservationAggregationProjectionV1,
): ResolverKnowledgeCandidatePayload | null {
  const inputType = projection.inputType;
  if (!inputType) throw new Error('AGGREGATION_INVALID_PROJECTION');
  const reason = projection.reasonCodes.find((code) => candidateReasonCodes.includes(code as any));
  if (
    projection.outcome === 'accepted' &&
    projection.provenanceStatus === 'source_grounded' &&
    projection.selectedSource
  )
    return {
      type: 'source-routing-pattern',
      locale: projection.locale,
      inputType,
      sourceType: projection.selectedSource.type,
    };
  if (projection.outcome === 'ambiguous' && reason === 'MULTIPLE_CLOSE_MATCHES')
    return {
      type: 'clarification-policy-signal',
      locale: projection.locale,
      inputType,
      reasonCode: reason,
    };
  if (projection.provenanceStatus === 'not_resolved')
    return { type: 'provenance-gap', locale: projection.locale, inputType };
  if (
    projection.outcome === 'abstained' &&
    (reason === 'NO_CANDIDATES' || reason === 'LOW_SCORE')
  ) {
    if (projection.selectedSource)
      return {
        type: 'negative-source-routing-rule',
        locale: projection.locale,
        inputType,
        sourceType: projection.selectedSource.type,
        reasonCode: reason,
      };
    return {
      type: 'abstention-policy-signal',
      locale: projection.locale,
      inputType,
      reasonCode: reason,
    };
  }
  return null;
}

/** Pure, deterministic boundary: accepts only already privacy-safe V1 projections. */
export class ResolverKnowledgeCandidateAggregator {
  aggregate(
    projection: ResolverObservationAggregationProjectionV1,
    now: string,
  ): ResolverKnowledgeCandidate | null {
    validateProjection(projection);
    const payload = payloadFor(projection);
    if (!payload) return null;
    const fingerprint = fingerprintFor(payload);
    const candidate: ResolverKnowledgeCandidate = {
      candidateId: fingerprint,
      contractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
      candidateType: payload.type,
      fingerprint,
      payload,
      evidence: {
        supportingEvidenceCount: 1,
        contradictingEvidenceCount: 0,
        abstentionSignalCount: projection.outcome === 'abstained' ? 1 : 0,
        clarificationSignalCount: projection.outcome === 'ambiguous' ? 1 : 0,
        contradictionStatus: 'none',
        negativeEvidenceSummary:
          payload.type === 'negative-source-routing-rule' ? 'source_unsuitable_signal' : 'none',
        independentUserEvidence: 'not_evaluable',
        locales: [projection.locale],
        inputTypes: [payload.inputType],
        sourceTypes: projection.selectedSource ? [projection.selectedSource.type] : [],
        provenanceStatuses: [projection.provenanceStatus],
        reasonCodes: [...projection.reasonCodes],
        privacyPolicyVersions: [projection.privacyPolicyVersion],
        observationContractVersions: [projection.contractVersion],
        resolverVersions: [projection.resolverVersion],
      },
      risk:
        payload.type === 'negative-source-routing-rule'
          ? 'high'
          : payload.type === 'source-routing-pattern'
            ? 'low'
            : 'medium',
      status: 'candidate',
      duplicateOfCandidateId: null,
      supersededByCandidateId: null,
      quarantineReasonCode: null,
      createdAt: now,
      updatedAt: now,
    };
    validateResolverKnowledgeCandidate(candidate);
    return candidate;
  }
}

export { fingerprintFor as resolverKnowledgeCandidateFingerprintFor };
