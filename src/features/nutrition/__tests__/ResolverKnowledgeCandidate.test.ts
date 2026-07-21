import { ResolverKnowledgeCandidateAggregator } from '../application/knowledge/ResolverKnowledgeCandidateAggregator';
import { InMemoryResolverKnowledgeCandidateRepository } from '../infrastructure/knowledge/InMemoryResolverKnowledgeCandidateRepository';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';
import { RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION } from '../domain/models/ResolverObservationPrivacy';

const projection = (overrides: Record<string, unknown> = {}) => ({
  privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
  locale: 'de' as const,
  inputType: 'generic' as const,
  outcome: 'accepted' as const,
  candidateCount: 1,
  selectedSource: { type: 'bls' as const, id: 'personal-source-id-must-not-leak' },
  provenanceStatus: 'source_grounded' as const,
  resolverVersion: 'resolver-v3',
  totalLatencyMs: 'unknown' as const,
  reasonCodes: ['ACCEPTED_STRONG_MATCH'] as const,
  ...overrides,
});
const now = '2026-07-20T12:00:00.000Z';
describe('ResolverKnowledgeCandidateAggregator', () => {
  it('deterministically creates an inactive privacy-safe candidate without source ids', () => {
    const aggregator = new ResolverKnowledgeCandidateAggregator();
    const first = aggregator.aggregate(projection(), now);
    const second = aggregator.aggregate(projection(), now);
    expect(first).toEqual(second);
    expect(first?.status).toBe('candidate');
    expect(first?.evidence.independentUserEvidence).toBe('not_evaluable');
    expect(JSON.stringify(first)).not.toContain('personal-source-id');
  });
  it.each([
    ['rawInput'],
    ['normalizedInput'],
    ['ownerId'],
    ['observationId'],
    ['resolverRunId'],
    ['rowId'],
  ])('rejects private input field %s', (field) => {
    expect(() =>
      new ResolverKnowledgeCandidateAggregator().aggregate(
        { ...projection(), [field]: 'private' } as any,
        now,
      ),
    ).toThrow('AGGREGATION_UNSAFE_INPUT');
  });
  it.each([
    ['privacyPolicyVersion', 'future', 'AGGREGATION_UNKNOWN_PRIVACY_POLICY'],
    ['contractVersion', 'future', 'AGGREGATION_UNKNOWN_OBSERVATION_CONTRACT'],
    ['reasonCodes', ['UNKNOWN'], 'AGGREGATION_UNSAFE_REASON_CODE'],
    ['selectedSource', { type: 'user', id: 'x' }, 'AGGREGATION_UNSAFE_SOURCE'],
  ])('fails closed for unsafe projection %s', (field, value, code) => {
    expect(() =>
      new ResolverKnowledgeCandidateAggregator().aggregate(
        projection({ [field]: value }) as any,
        now,
      ),
    ).toThrow(code);
  });
  it('models negative knowledge separately and preserves contradictions during deduplication', async () => {
    const aggregator = new ResolverKnowledgeCandidateAggregator();
    const candidate = aggregator.aggregate(
      projection({
        outcome: 'abstained',
        provenanceStatus: 'not_resolved',
        reasonCodes: ['NO_CANDIDATES'],
        selectedSource: { type: 'bls', id: 'safe-id' },
      }) as any,
      now,
    )!;
    // A provenance gap takes precedence when no route was resolved; a source-specific abstention is represented when grounded.
    const negative = aggregator.aggregate(
      projection({
        outcome: 'abstained',
        provenanceStatus: 'source_grounded',
        reasonCodes: ['NO_CANDIDATES'],
      }) as any,
      now,
    )!;
    expect(negative.candidateType).toBe('negative-source-routing-rule');
    const repository = new InMemoryResolverKnowledgeCandidateRepository();
    await repository.upsertInactive(negative);
    const contradictory = {
      ...negative,
      evidence: {
        ...negative.evidence,
        supportingEvidenceCount: 0,
        contradictingEvidenceCount: 1,
        contradictionStatus: 'present' as const,
      },
    };
    const result = await repository.upsertInactive(contradictory);
    expect(result.status).toBe('updated');
    if (result.status === 'updated')
      expect(result.candidate.evidence).toMatchObject({
        supportingEvidenceCount: 1,
        contradictingEvidenceCount: 1,
        contradictionStatus: 'present',
      });
    expect(candidate.candidateType).toBe('provenance-gap');
  });
  it('permits only inactive audited lifecycle transitions and never approval', async () => {
    const candidate = new ResolverKnowledgeCandidateAggregator().aggregate(projection(), now)!;
    const repository = new InMemoryResolverKnowledgeCandidateRepository();
    await repository.upsertInactive(candidate);
    expect(
      await repository.transitionInactive({
        candidateId: candidate.candidateId,
        nextStatus: 'needs_more_evidence',
        reasonCode: 'INSUFFICIENT_EVIDENCE',
        actorType: 'system',
        occurredAt: now,
      }),
    ).toMatchObject({ status: 'updated' });
    expect(repository.events).toHaveLength(1);
    expect(
      await repository.transitionInactive({
        candidateId: candidate.candidateId,
        nextStatus: 'approved' as any,
        reasonCode: 'READY_FOR_REVIEW',
        actorType: 'developer',
        occurredAt: now,
      }),
    ).toEqual({ status: 'failed', code: 'approval_not_supported' });
  });
});
