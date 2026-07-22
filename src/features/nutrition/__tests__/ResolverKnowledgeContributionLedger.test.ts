import {
  validateResolverKnowledgeContribution,
  validateResolverKnowledgeContributionRetractionEvent,
  validateResolverKnowledgeContributionRetractionRequest,
} from '../application/knowledge/ResolverKnowledgeContributionLedgerValidator';
import { RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION } from '../domain/models/ResolverKnowledgeContributionLedger';
import { RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION } from '../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../domain/models/ResolverKnowledgeCandidate';
import { RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION } from '../domain/models/ResolverObservationAggregationProjectionV2';
import { RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION } from '../domain/models/ResolverObservationPrivacy';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';

function validContribution(): Record<string, unknown> {
  return {
    ledgerContractVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
    contributionId: 'contribution-1',
    observationId: 'observation-1',
    resolverRunId: 'run-1',
    originalCandidateFingerprint: {
      fingerprintVersion: RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
      digest: 'deadbeef',
    },
    originalCandidateId: 'rkc-v2:resolver-knowledge-fingerprint-v2::deadbeef',
    candidatePayload: {
      type: 'source-routing-pattern',
      locale: 'de',
      inputType: 'generic',
      sourceType: 'bls',
    },
    relation: 'support',
    projectionVersion: RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
    privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
    observationContractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
    candidateContractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    fingerprintVersion: RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
    evidenceSnapshot: {
      locale: 'de',
      inputType: 'generic',
      outcome: 'accepted',
      sourceType: 'bls',
      provenanceStatus: 'source_grounded',
      resolverVersion: 'resolver-v1',
      reasonCodes: [],
    },
    contributorToken: null,
    recordedAt: '2026-07-22T00:00:00.000Z',
  };
}

function validRetractionEvent(): Record<string, unknown> {
  return {
    ledgerContractVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
    retractionEventId: 'retraction-event-1',
    retractionActionId: 'action-1',
    contributionId: 'contribution-1',
    reason: 'developer_action',
    occurredAt: '2026-07-22T00:00:00.000Z',
  };
}

function validRetractionRequest(): Record<string, unknown> {
  return {
    ledgerContractVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
    retractionActionId: 'action-1',
    reason: 'developer_action',
    selector: { kind: 'contribution_ids', contributionIds: ['contribution-1'] },
    occurredAt: '2026-07-22T00:00:00.000Z',
  };
}

describe('RESOLVER-V3-032 contribution-ledger contract', () => {
  it('has an explicit closed contract version', () => {
    expect(RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION).toBe(
      'resolver-knowledge-contribution-ledger-v1',
    );
    expect(RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION).not.toBe(
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
  });

  it('accepts a valid contribution', () => {
    expect(() => validateResolverKnowledgeContribution(validContribution())).not.toThrow();
  });

  it('rejects an unknown root field', () => {
    expect(() =>
      validateResolverKnowledgeContribution({ ...validContribution(), ownerId: 'user-1' }),
    ).toThrow('CONTRIBUTION_UNKNOWN_ROOT_FIELD');
  });

  it.each(['ownerId', 'rawInput', 'normalizedInput', 'sourceId', 'journalText', 'correctionText'])(
    'never accepts a %s field on the private contribution',
    (privateField) => {
      expect(() =>
        validateResolverKnowledgeContribution({ ...validContribution(), [privateField]: 'value' }),
      ).toThrow('CONTRIBUTION_UNKNOWN_ROOT_FIELD');
    },
  );

  it('rejects a missing candidate/food/nutrient payload shape (extra fields inside payload)', () => {
    const contribution = validContribution();
    expect(() =>
      validateResolverKnowledgeContribution({
        ...contribution,
        candidatePayload: {
          ...(contribution.candidatePayload as object),
          nutrients: { kcal: 100 },
        },
      }),
    ).toThrow();
  });

  it('rejects a non-null contributor token (V1 fail-closed)', () => {
    expect(() =>
      validateResolverKnowledgeContribution({
        ...validContribution(),
        contributorToken: 'token-1',
      }),
    ).toThrow('CONTRIBUTION_CONTRIBUTOR_TOKEN_NOT_AUTHORIZED');
  });

  it('rejects an unknown ledger contract version', () => {
    expect(() =>
      validateResolverKnowledgeContribution({
        ...validContribution(),
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v2',
      }),
    ).toThrow('CONTRIBUTION_UNSUPPORTED_LEDGER_CONTRACT_VERSION');
  });

  it('rejects an unknown fingerprint version', () => {
    expect(() =>
      validateResolverKnowledgeContribution({
        ...validContribution(),
        fingerprintVersion: 'resolver-knowledge-fingerprint-v1',
      }),
    ).toThrow('CONTRIBUTION_UNSUPPORTED_FINGERPRINT_VERSION');
  });

  it('rejects a mixed-version original fingerprint object', () => {
    const contribution = validContribution();
    expect(() =>
      validateResolverKnowledgeContribution({
        ...contribution,
        originalCandidateFingerprint: {
          fingerprintVersion: 'resolver-knowledge-fingerprint-v1',
          digest: 'x',
        },
      }),
    ).toThrow('CONTRIBUTION_INVALID_ORIGINAL_FINGERPRINT');
  });

  it('rejects an unknown relation value (bypassing the classifier)', () => {
    expect(() =>
      validateResolverKnowledgeContribution({ ...validContribution(), relation: 'forced_support' }),
    ).toThrow('CONTRIBUTION_UNKNOWN_RELATION');
  });

  it('rejects nested unknown fields inside the evidence snapshot', () => {
    const contribution = validContribution();
    expect(() =>
      validateResolverKnowledgeContribution({
        ...contribution,
        evidenceSnapshot: { ...(contribution.evidenceSnapshot as object), ownerId: 'user-1' },
      }),
    ).toThrow('CONTRIBUTION_EVIDENCE_SNAPSHOT_UNKNOWN_FIELD');
  });

  it('rejects a non-finite recordedAt timestamp', () => {
    expect(() =>
      validateResolverKnowledgeContribution({ ...validContribution(), recordedAt: 'not-a-date' }),
    ).toThrow('CONTRIBUTION_INVALID_RECORDED_AT');
  });

  it('validates a retraction event and rejects unknown reasons', () => {
    expect(() =>
      validateResolverKnowledgeContributionRetractionEvent(validRetractionEvent()),
    ).not.toThrow();
    expect(() =>
      validateResolverKnowledgeContributionRetractionEvent({
        ...validRetractionEvent(),
        reason: 'because_i_said_so',
      }),
    ).toThrow('RETRACTION_EVENT_UNKNOWN_REASON');
  });

  it('validates a retraction request and rejects a reason/selector mismatch', () => {
    expect(() =>
      validateResolverKnowledgeContributionRetractionRequest(validRetractionRequest()),
    ).not.toThrow();
    expect(() =>
      validateResolverKnowledgeContributionRetractionRequest({
        ...validRetractionRequest(),
        reason: 'privacy_policy_revoked',
        selector: { kind: 'contribution_ids', contributionIds: ['contribution-1'] },
      }),
    ).toThrow('RETRACTION_REQUEST_SELECTOR_REASON_MISMATCH');
  });

  it('rejects an unsafe reason code in the retraction request', () => {
    expect(() =>
      validateResolverKnowledgeContributionRetractionRequest({
        ...validRetractionRequest(),
        reason: 'not_a_real_reason',
      }),
    ).toThrow('RETRACTION_REQUEST_UNKNOWN_REASON');
  });

  it('rejects an unknown selector kind', () => {
    expect(() =>
      validateResolverKnowledgeContributionRetractionRequest({
        ...validRetractionRequest(),
        selector: { kind: 'owner_id', ownerId: 'user-1' },
      }),
    ).toThrow('RETRACTION_REQUEST_UNKNOWN_SELECTOR_KIND');
  });
});
