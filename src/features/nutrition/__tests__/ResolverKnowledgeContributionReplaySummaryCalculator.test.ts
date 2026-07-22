import {
  computeResolverKnowledgeContributionReplaySummary,
  mapResolverKnowledgeContributionReplaySummaryToLegacyEvidence,
} from '../application/knowledge/ResolverKnowledgeContributionReplaySummaryCalculator';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../domain/models/ResolverKnowledgeCandidate';
import { RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION } from '../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import type { ResolverKnowledgeContribution } from '../domain/models/ResolverKnowledgeContributionLedger';
import type { ResolverKnowledgeCandidatePayload } from '../domain/models/ResolverKnowledgeCandidate';

const routingPayload: ResolverKnowledgeCandidatePayload = {
  type: 'source-routing-pattern',
  locale: 'de',
  inputType: 'generic',
  sourceType: 'bls',
};

function contribution(
  overrides: Partial<ResolverKnowledgeContribution> = {},
): ResolverKnowledgeContribution {
  return {
    ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
    contributionId: 'contribution-1',
    observationId: 'obs-1',
    resolverRunId: 'run-1',
    originalCandidateFingerprint: {
      fingerprintVersion: RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
      digest: 'aaaa',
    },
    originalCandidateId: 'rkc-v2:fp',
    candidatePayload: routingPayload,
    relation: 'support',
    projectionVersion: 'resolver-observation-aggregation-projection-v2',
    privacyPolicyVersion: 'resolver-observation-privacy-v1',
    observationContractVersion: 'resolver-observation-v1',
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
    ...overrides,
  };
}

describe('RESOLVER-V3-032 pure replay-summary derivation', () => {
  it('produces deterministic zero/empty output for an empty replay', () => {
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(summary.activeContributionCount).toBe(0);
    expect(summary.supportCount).toBe(0);
    expect(summary.contradictionCount).toBe(0);
    expect(summary.orthogonalCount).toBe(0);
    expect(summary.notEvaluableCount).toBe(0);
    expect(summary.contradictionStatus).toBe('none');
    expect(summary.negativeEvidenceSummary).toBe('none');
    expect(summary.independentUserEvidence).toBe('not_evaluable');
    expect(summary.locales).toEqual([]);
    expect(summary.reasonCodes).toEqual([]);
  });

  it('counts matching payloads as support', () => {
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [contribution(), contribution({ contributionId: 'contribution-2' })],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(summary.supportCount).toBe(2);
    expect(summary.activeContributionCount).toBe(2);
  });

  it('counts a matching negative-routing contribution as contradiction', () => {
    const negative = contribution({
      contributionId: 'contribution-neg',
      candidatePayload: {
        type: 'negative-source-routing-rule',
        locale: 'de',
        inputType: 'generic',
        sourceType: 'bls',
        reasonCode: 'LOW_SCORE',
      },
    });
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [contribution(), negative],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(summary.supportCount).toBe(1);
    expect(summary.contradictionCount).toBe(1);
    expect(summary.contradictionStatus).toBe('present');
    expect(summary.negativeEvidenceSummary).toBe('source_unsuitable_signal');
  });

  it('retains orthogonal and not-evaluable counts separately without affecting support/contradiction', () => {
    const orthogonal = contribution({
      contributionId: 'contribution-orth',
      candidatePayload: {
        type: 'source-routing-pattern',
        locale: 'de',
        inputType: 'generic',
        sourceType: 'usda',
      },
    });
    const notEvaluable = contribution({
      contributionId: 'contribution-ne',
      candidatePayload: {
        type: 'abstention-policy-signal',
        locale: 'en',
        inputType: 'unknown',
        reasonCode: 'NO_CANDIDATES',
      },
    });
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [contribution(), orthogonal, notEvaluable],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(summary.supportCount).toBe(1);
    expect(summary.contradictionCount).toBe(0);
    expect(summary.orthogonalCount).toBe(1);
    expect(summary.notEvaluableCount).toBe(1);
  });

  it('derives abstention and clarification signal counts from the safe evidence snapshot outcome', () => {
    const abstained = contribution({
      contributionId: 'c-abstain',
      evidenceSnapshot: { ...contribution().evidenceSnapshot, outcome: 'abstained' },
    });
    const ambiguous = contribution({
      contributionId: 'c-ambiguous',
      evidenceSnapshot: { ...contribution().evidenceSnapshot, outcome: 'ambiguous' },
    });
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [abstained, ambiguous],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(summary.abstentionSignalCount).toBe(1);
    expect(summary.clarificationSignalCount).toBe(1);
  });

  it('deduplicates and deterministically sorts every array field', () => {
    const a = contribution({
      contributionId: 'c-1',
      evidenceSnapshot: { ...contribution().evidenceSnapshot, reasonCodes: ['ZETA', 'ALPHA'] },
    });
    const b = contribution({
      contributionId: 'c-2',
      evidenceSnapshot: { ...contribution().evidenceSnapshot, reasonCodes: ['ALPHA', 'BETA'] },
    });
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [a, b],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(summary.reasonCodes).toEqual(['ALPHA', 'BETA', 'ZETA']);
    expect(summary.locales).toEqual(['de']);
  });

  it('is deterministic across repeated calls and never mutates its inputs', () => {
    const contributions = [contribution(), contribution({ contributionId: 'contribution-2' })];
    const before = JSON.parse(JSON.stringify(contributions));
    const first = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      contributions,
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    const second = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      contributions,
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(contributions))).toEqual(before);
  });

  it('maps deterministically to the legacy evidence shape, dropping orthogonal/not-evaluable counts', () => {
    const orthogonal = contribution({
      contributionId: 'contribution-orth',
      candidatePayload: {
        type: 'source-routing-pattern',
        locale: 'de',
        inputType: 'generic',
        sourceType: 'usda',
      },
    });
    const summary = computeResolverKnowledgeContributionReplaySummary(
      routingPayload,
      [contribution(), orthogonal],
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    );
    const legacy = mapResolverKnowledgeContributionReplaySummaryToLegacyEvidence(summary);
    expect(legacy.supportingEvidenceCount).toBe(1);
    expect(legacy.contradictingEvidenceCount).toBe(0);
    expect(legacy.independentUserEvidence).toBe('not_evaluable');
    expect(legacy).not.toHaveProperty('orthogonalCount');
    expect(legacy).not.toHaveProperty('notEvaluableCount');
  });
});
