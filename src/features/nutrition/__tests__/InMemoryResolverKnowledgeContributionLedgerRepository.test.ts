import { InMemoryResolverKnowledgeContributionLedgerRepository } from '../infrastructure/knowledge/InMemoryResolverKnowledgeContributionLedgerRepository';
import { NodeCryptoResolverKnowledgeFingerprintHasher } from '../infrastructure/knowledge/NodeCryptoResolverKnowledgeFingerprintHasher';
import type { ResolverKnowledgeContributionRecordingRequest } from '../application/knowledge/ResolverKnowledgeContributionRecordingPlanner';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidate,
  type ResolverKnowledgeCandidatePayload,
} from '../domain/models/ResolverKnowledgeCandidate';
import type { ResolverKnowledgeCandidateLifecycleEvent } from '../domain/models/ResolverKnowledgeCandidate';
import { RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION } from '../domain/models/ResolverObservationAggregationProjectionV2';
import { RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION } from '../domain/models/ResolverObservationPrivacy';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';
import type { ResolverKnowledgeContributionLedgerFailureStage } from '../infrastructure/knowledge/InMemoryResolverKnowledgeContributionLedgerRepository';

const hasher = new NodeCryptoResolverKnowledgeFingerprintHasher();

interface SharedStore {
  candidates: ResolverKnowledgeCandidate[];
  events: ResolverKnowledgeCandidateLifecycleEvent[];
}

function newStore(): SharedStore {
  return { candidates: [], events: [] };
}

function newRepo(store: SharedStore): InMemoryResolverKnowledgeContributionLedgerRepository {
  return new InMemoryResolverKnowledgeContributionLedgerRepository(store, hasher);
}

const routingPayload: ResolverKnowledgeCandidatePayload = {
  type: 'source-routing-pattern',
  locale: 'de',
  inputType: 'generic',
  sourceType: 'bls',
};
const orthogonalRoutingPayload: ResolverKnowledgeCandidatePayload = {
  type: 'source-routing-pattern',
  locale: 'de',
  inputType: 'generic',
  sourceType: 'usda',
};
const negativeRoutingPayload: ResolverKnowledgeCandidatePayload = {
  type: 'negative-source-routing-rule',
  locale: 'de',
  inputType: 'generic',
  sourceType: 'bls',
  reasonCode: 'LOW_SCORE',
};

function projection(overrides: Record<string, unknown> = {}) {
  return {
    projectionVersion: RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
    privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
    observationContractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
    locale: 'de',
    inputType: 'generic',
    outcome: 'accepted',
    candidateCount: 1,
    selectedSource: { type: 'bls' },
    provenanceStatus: 'source_grounded',
    resolverVersion: 'resolver-v1',
    totalLatencyMs: 120,
    reasonCodes: [],
    ...overrides,
  };
}

function recordRequest(
  overrides: Partial<ResolverKnowledgeContributionRecordingRequest> = {},
): ResolverKnowledgeContributionRecordingRequest {
  return {
    observationId: 'obs-1',
    resolverRunId: 'run-1',
    candidateContractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    incomingPayload: routingPayload,
    projection: projection(),
    explicitOriginalTargetCandidateId: null,
    now: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

function snapshotOf(
  store: SharedStore,
  repo: InMemoryResolverKnowledgeContributionLedgerRepository,
) {
  return JSON.stringify({
    candidates: store.candidates,
    events: store.events,
    contributions: repo.contributions,
    retractionEvents: repo.retractionEvents,
  });
}

describe('InMemoryResolverKnowledgeContributionLedgerRepository', () => {
  describe('recording, identity, and idempotency', () => {
    it('creates exactly one inactive candidate for an unknown fingerprint', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const result = await repo.recordContribution(recordRequest());
      expect(result.status).toBe('recorded');
      expect(store.candidates).toHaveLength(1);
      expect(store.candidates[0].status).toBe('candidate');
      expect(store.candidates[0].candidateId).toMatch(/^rkc-v2:/);
    });

    it('a later identical fingerprint always resolves to the same candidate identity', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const first = await repo.recordContribution(recordRequest({ observationId: 'obs-1' }));
      const second = await repo.recordContribution(recordRequest({ observationId: 'obs-2' }));
      expect(first.status).toBe('recorded');
      expect(second.status).toBe('recorded');
      expect(store.candidates).toHaveLength(1);
      if (first.status === 'recorded' && second.status === 'recorded') {
        expect(first.candidateId).toBe(second.candidateId);
      }
    });

    it('exact retry returns already_recorded with zero mutation', async () => {
      const store = newStore();
      const repo = newRepo(store);
      await repo.recordContribution(recordRequest());
      const before = snapshotOf(store, repo);
      const retry = await repo.recordContribution(recordRequest());
      expect(retry.status).toBe('already_recorded');
      expect(snapshotOf(store, repo)).toBe(before);
    });

    it('conflicting reuse of the same contribution ID returns conflict with zero mutation', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      expect(created.status).toBe('recorded');
      const targetId = created.status === 'recorded' ? created.candidateId : '';

      await repo.recordContribution(
        recordRequest({
          observationId: 'obs-2',
          resolverRunId: 'run-2',
          explicitOriginalTargetCandidateId: targetId,
          incomingPayload: negativeRoutingPayload,
        }),
      );
      const before = snapshotOf(store, repo);

      const conflicting = await repo.recordContribution(
        recordRequest({
          observationId: 'obs-2',
          resolverRunId: 'run-2',
          explicitOriginalTargetCandidateId: targetId,
          incomingPayload: orthogonalRoutingPayload,
        }),
      );
      expect(conflicting.status).toBe('conflict');
      expect(snapshotOf(store, repo)).toBe(before);
    });

    it('one observation may create distinct contributions for two explicit targets, and a retry to one cannot affect the other', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const candidateA = await repo.recordContribution(
        recordRequest({ observationId: 'seed-a', incomingPayload: routingPayload }),
      );
      const candidateB = await repo.recordContribution(
        recordRequest({ observationId: 'seed-b', incomingPayload: orthogonalRoutingPayload }),
      );
      expect(candidateA.status).toBe('recorded');
      expect(candidateB.status).toBe('recorded');
      const targetA = candidateA.status === 'recorded' ? candidateA.candidateId : '';
      const targetB = candidateB.status === 'recorded' ? candidateB.candidateId : '';

      const toA = await repo.recordContribution(
        recordRequest({
          observationId: 'obs-multi',
          resolverRunId: 'run-multi',
          explicitOriginalTargetCandidateId: targetA,
        }),
      );
      const toB = await repo.recordContribution(
        recordRequest({
          observationId: 'obs-multi',
          resolverRunId: 'run-multi',
          explicitOriginalTargetCandidateId: targetB,
          incomingPayload: orthogonalRoutingPayload,
        }),
      );
      expect(toA.status).toBe('recorded');
      expect(toB.status).toBe('recorded');
      if (toA.status === 'recorded' && toB.status === 'recorded') {
        expect(toA.contributionId).not.toBe(toB.contributionId);
      }

      const beforeRetryB = store.candidates.find((c) => c.candidateId === targetB)!.evidence;
      const retryA = await repo.recordContribution(
        recordRequest({
          observationId: 'obs-multi',
          resolverRunId: 'run-multi',
          explicitOriginalTargetCandidateId: targetA,
        }),
      );
      expect(retryA.status).toBe('already_recorded');
      expect(store.candidates.find((c) => c.candidateId === targetB)!.evidence).toEqual(
        beforeRetryB,
      );
    });

    it('fails closed on invalid input rather than recording anything', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const result = await repo.recordContribution(
        recordRequest({
          incomingPayload: {
            type: 'source-routing-pattern',
            locale: 'de',
            inputType: 'generic',
            sourceType: 'bls',
            extra: 'x',
          },
        }),
      );
      expect(result.status).toBe('failed');
      expect(store.candidates).toHaveLength(0);
      expect(repo.contributions).toHaveLength(0);
    });

    it('fails closed on a fingerprint/payload conflict', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      expect(created.status).toBe('recorded');
      // Simulate a hash-collision-style corruption: same fingerprint string, different stored payload.
      store.candidates[0].payload = orthogonalRoutingPayload;
      const before = snapshotOf(store, repo);
      const result = await repo.recordContribution(
        recordRequest({ observationId: 'obs-collision' }),
      );
      expect(result.status).toBe('failed');
      if (result.status === 'failed') expect(result.code).toBe('fingerprint_payload_conflict');
      expect(snapshotOf(store, repo)).toBe(before);
    });
  });

  describe('rejection suppression', () => {
    it('routes new contributions to a rejected candidate without creating a new one, and preserves its status/history', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      expect(created.status).toBe('recorded');
      const candidateId = created.status === 'recorded' ? created.candidateId : '';
      store.candidates[0].status = 'rejected';
      store.events.push({
        eventId: 'evt-1',
        candidateId,
        previousStatus: 'candidate',
        nextStatus: 'rejected',
        reasonCode: 'REJECTED_BY_REVIEW',
        actorType: 'developer',
        payloadVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
        occurredAt: '2026-07-22T00:00:00.000Z',
      });

      const result = await repo.recordContribution(
        recordRequest({ observationId: 'obs-after-rejection' }),
      );
      expect(result.status).toBe('recorded');
      expect(store.candidates).toHaveLength(1);
      expect(store.candidates[0].status).toBe('rejected');
      expect(store.events).toHaveLength(1);
    });

    it('creates a distinct candidate for a materially changed payload', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const first = await repo.recordContribution(recordRequest());
      const second = await repo.recordContribution(
        recordRequest({ observationId: 'obs-2', incomingPayload: orthogonalRoutingPayload }),
      );
      expect(first.status).toBe('recorded');
      expect(second.status).toBe('recorded');
      expect(store.candidates).toHaveLength(2);
      if (first.status === 'recorded' && second.status === 'recorded') {
        expect(first.candidateId).not.toBe(second.candidateId);
      }
    });
  });

  describe('relation handling via recording', () => {
    it('computes relation internally and a caller cannot forge support', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      const candidateId = created.status === 'recorded' ? created.candidateId : '';

      await repo.recordContribution(
        recordRequest({
          observationId: 'obs-negative',
          resolverRunId: 'run-negative',
          explicitOriginalTargetCandidateId: candidateId,
          incomingPayload: negativeRoutingPayload,
        }),
      );

      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
      expect(candidate.evidence.contradictingEvidenceCount).toBe(1);
      expect(candidate.evidence.contradictionStatus).toBe('present');
    });

    it('does not increment support or contradiction for an orthogonal contribution', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      const candidateId = created.status === 'recorded' ? created.candidateId : '';

      await repo.recordContribution(
        recordRequest({
          observationId: 'obs-orth',
          resolverRunId: 'run-orth',
          explicitOriginalTargetCandidateId: candidateId,
          incomingPayload: orthogonalRoutingPayload,
        }),
      );

      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
      expect(candidate.evidence.contradictingEvidenceCount).toBe(0);
    });

    it('does not increment support or contradiction for a not-evaluable contribution', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      const candidateId = created.status === 'recorded' ? created.candidateId : '';

      await repo.recordContribution(
        recordRequest({
          observationId: 'obs-ne',
          resolverRunId: 'run-ne',
          explicitOriginalTargetCandidateId: candidateId,
          incomingPayload: {
            type: 'clarification-policy-signal',
            locale: 'de',
            inputType: 'generic',
            reasonCode: 'MULTIPLE_CLOSE_MATCHES',
          },
        }),
      );

      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
      expect(candidate.evidence.contradictingEvidenceCount).toBe(0);
    });
  });

  describe('duplicate/supersession routing', () => {
    it('routes new contributions through a duplicate chain to the terminal target, including historical contributions', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const a = await repo.recordContribution(
        recordRequest({ observationId: 'seed-a', incomingPayload: routingPayload }),
      );
      const b = await repo.recordContribution(
        recordRequest({ observationId: 'seed-b', incomingPayload: orthogonalRoutingPayload }),
      );
      const candidateA = a.status === 'recorded' ? a.candidateId : '';
      const candidateB = b.status === 'recorded' ? b.candidateId : '';

      const targetB = store.candidates.find((c) => c.candidateId === candidateB)!;
      const targetA = store.candidates.find((c) => c.candidateId === candidateA)!;
      targetA.status = 'duplicate';
      targetA.duplicateOfCandidateId = candidateB;

      const result = await repo.recordContribution(
        recordRequest({
          observationId: 'obs-after-duplicate',
          explicitOriginalTargetCandidateId: candidateA,
          incomingPayload: orthogonalRoutingPayload,
        }),
      );
      expect(result.status).toBe('recorded');
      if (result.status === 'recorded') expect(result.candidateId).toBe(candidateB);

      // The terminal candidate's summary includes both its own original contribution and the new
      // one routed through the duplicate chain — historical contributions are not rewritten, but
      // are logically included via the chain walk.
      expect(targetB.evidence.supportingEvidenceCount).toBe(2);
      // The duplicate row itself is never reactivated or recomputed again.
      expect(targetA.status).toBe('duplicate');
    });

    it('fails closed with zero mutation when the chain is broken', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const a = await repo.recordContribution(recordRequest());
      const candidateA = a.status === 'recorded' ? a.candidateId : '';
      const target = store.candidates.find((c) => c.candidateId === candidateA)!;
      target.status = 'superseded';
      target.supersededByCandidateId = 'does-not-exist';

      const before = snapshotOf(store, repo);
      const result = await repo.recordContribution(
        recordRequest({
          observationId: 'obs-broken',
          explicitOriginalTargetCandidateId: candidateA,
        }),
      );
      expect(result.status).toBe('failed');
      if (result.status === 'failed') expect(result.code).toBe('chain_resolution_failed');
      expect(snapshotOf(store, repo)).toBe(before);
    });

    it('remains idempotent for a retry after a duplicate/supersession decision', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const a = await repo.recordContribution(recordRequest({ observationId: 'seed-a' }));
      const b = await repo.recordContribution(
        recordRequest({ observationId: 'seed-b', incomingPayload: orthogonalRoutingPayload }),
      );
      const candidateA = a.status === 'recorded' ? a.candidateId : '';
      const candidateB = b.status === 'recorded' ? b.candidateId : '';
      const targetA = store.candidates.find((c) => c.candidateId === candidateA)!;
      targetA.status = 'duplicate';
      targetA.duplicateOfCandidateId = candidateB;

      const first = await repo.recordContribution(
        recordRequest({ observationId: 'obs-x', explicitOriginalTargetCandidateId: candidateA }),
      );
      const before = snapshotOf(store, repo);
      const retry = await repo.recordContribution(
        recordRequest({ observationId: 'obs-x', explicitOriginalTargetCandidateId: candidateA }),
      );
      expect(first.status).toBe('recorded');
      expect(retry.status).toBe('already_recorded');
      expect(snapshotOf(store, repo)).toBe(before);
    });
  });

  describe('retraction', () => {
    async function seedTwoContributions() {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest({ observationId: 'obs-1' }));
      const candidateId = created.status === 'recorded' ? created.candidateId : '';
      await repo.recordContribution(
        recordRequest({ observationId: 'obs-2', resolverRunId: 'run-2' }),
      );
      return { store, repo, candidateId };
    }

    it('leaves the original contribution intact and recomputes the affected summary', async () => {
      const { store, repo, candidateId } = await seedTwoContributions();
      const contributionId = repo.contributions[0].contributionId;

      const result = await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-1',
        reason: 'developer_action',
        selector: { kind: 'contribution_ids', contributionIds: [contributionId] },
        occurredAt: '2026-07-22T01:00:00.000Z',
      });

      expect(result.status).toBe('applied');
      expect(repo.contributions.find((c) => c.contributionId === contributionId)).toBeDefined();
      expect(repo.retractionEvents).toHaveLength(1);
      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
    });

    it('is idempotent on exact retry and fails closed on conflicting reuse', async () => {
      const { store, repo } = await seedTwoContributions();
      const contributionId = repo.contributions[0].contributionId;
      const request = {
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-1',
        reason: 'developer_action',
        selector: { kind: 'contribution_ids', contributionIds: [contributionId] },
        occurredAt: '2026-07-22T01:00:00.000Z',
      };
      await repo.retractContributions(request);
      const before = snapshotOf(store, repo);
      const retry = await repo.retractContributions(request);
      expect(retry.status).toBe('already_recorded');
      expect(snapshotOf(store, repo)).toBe(before);

      const conflicting = await repo.retractContributions({
        ...request,
        reason: 'observation_invalidated',
        selector: { kind: 'observation_id', observationId: 'obs-1' },
      });
      expect(conflicting.status).toBe('conflict');
      expect(snapshotOf(store, repo)).toBe(before);
    });

    it('never reactivates a retracted contribution', async () => {
      const { store, repo, candidateId } = await seedTwoContributions();
      const contributionId = repo.contributions[0].contributionId;
      await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-1',
        reason: 'developer_action',
        selector: { kind: 'contribution_ids', contributionIds: [contributionId] },
        occurredAt: '2026-07-22T01:00:00.000Z',
      });
      // Retracting the same contribution again under a *different* action ID selecting the same ID
      // (e.g. a broader observation-based selector) must not double-retract or reactivate it.
      const secondResult = await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-2',
        reason: 'observation_invalidated',
        selector: { kind: 'observation_id', observationId: 'obs-1' },
        occurredAt: '2026-07-22T02:00:00.000Z',
      });
      expect(secondResult.status).toBe('no_op');
      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
    });

    it('returns a closed no-op for a zero-match selector', async () => {
      const { store, repo } = await seedTwoContributions();
      const before = snapshotOf(store, repo);
      const result = await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-none',
        reason: 'observation_invalidated',
        selector: { kind: 'observation_id', observationId: 'no-such-observation' },
        occurredAt: '2026-07-22T01:00:00.000Z',
      });
      expect(result.status).toBe('no_op');
      expect(snapshotOf(store, repo)).toBe(before);
    });

    it.each([
      ['owner_deletion', { kind: 'contribution_ids', contributionIds: ['REPLACE'] }, 1],
      ['observation_invalidated', { kind: 'observation_id', observationId: 'obs-1' }, 1],
      // Both seeded contributions share the same privacy-policy version and source type, so these
      // two bulk selectors correctly retract both, leaving zero active support — unlike the
      // per-contribution-ID/per-observation selectors above, which scope to exactly one row.
      [
        'privacy_policy_revoked',
        {
          kind: 'privacy_policy_version',
          privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
        },
        0,
      ],
      ['source_update_invalidated', { kind: 'source_type', sourceType: 'bls' }, 0],
      ['developer_action', { kind: 'contribution_ids', contributionIds: ['REPLACE'] }, 1],
    ] as const)(
      'supports the %s retraction trigger and recomputes the affected summary',
      async (reason, selectorTemplate, expectedRemainingSupportCount) => {
        const { store, repo, candidateId } = await seedTwoContributions();
        const contributionId = repo.contributions[0].contributionId;
        const selector =
          selectorTemplate.kind === 'contribution_ids'
            ? { kind: 'contribution_ids' as const, contributionIds: [contributionId] }
            : selectorTemplate;

        const result = await repo.retractContributions({
          ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
          retractionActionId: `retract-${reason}`,
          reason,
          selector,
          occurredAt: '2026-07-22T01:00:00.000Z',
        });
        expect(result.status).toBe('applied');
        const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
        expect(candidate.evidence.supportingEvidenceCount).toBe(expectedRemainingSupportCount);
      },
    );

    it('retracts through a duplicate chain and recomputes only the terminal summary', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const a = await repo.recordContribution(recordRequest({ observationId: 'seed-a' }));
      const b = await repo.recordContribution(
        recordRequest({ observationId: 'seed-b', incomingPayload: orthogonalRoutingPayload }),
      );
      const candidateA = a.status === 'recorded' ? a.candidateId : '';
      const candidateB = b.status === 'recorded' ? b.candidateId : '';
      const targetA = store.candidates.find((c) => c.candidateId === candidateA)!;
      targetA.status = 'duplicate';
      targetA.duplicateOfCandidateId = candidateB;

      const contributionOnA = repo.contributions.find((c) => c.originalCandidateId === candidateA)!;
      const result = await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-chain',
        reason: 'developer_action',
        selector: { kind: 'contribution_ids', contributionIds: [contributionOnA.contributionId] },
        occurredAt: '2026-07-22T01:00:00.000Z',
      });
      expect(result.status).toBe('applied');
      const targetB = store.candidates.find((c) => c.candidateId === candidateB)!;
      expect(targetB.evidence.supportingEvidenceCount).toBe(1);
    });

    it('leaves candidate lifecycle status and approved payload state unchanged after retraction', async () => {
      const { store, repo, candidateId } = await seedTwoContributions();
      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      candidate.status = 'approved';
      const contributionId = repo.contributions[0].contributionId;

      const result = await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-approved',
        reason: 'developer_action',
        selector: { kind: 'contribution_ids', contributionIds: [contributionId] },
        occurredAt: '2026-07-22T01:00:00.000Z',
      });
      expect(result.status).toBe('applied');
      expect(candidate.status).toBe('approved');
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
    });

    it('leaves an unaffected candidate summary byte-for-byte unchanged', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const a = await repo.recordContribution(recordRequest({ observationId: 'seed-a' }));
      const b = await repo.recordContribution(
        recordRequest({ observationId: 'seed-b', incomingPayload: orthogonalRoutingPayload }),
      );
      const candidateB = b.status === 'recorded' ? b.candidateId : '';
      const beforeB = JSON.stringify(
        store.candidates.find((c) => c.candidateId === candidateB)!.evidence,
      );

      const contributionOnA = repo.contributions.find(
        (c) => c.originalCandidateId === (a.status === 'recorded' ? a.candidateId : ''),
      )!;
      await repo.retractContributions({
        ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
        retractionActionId: 'retract-a-only',
        reason: 'developer_action',
        selector: { kind: 'contribution_ids', contributionIds: [contributionOnA.contributionId] },
        occurredAt: '2026-07-22T01:00:00.000Z',
      });

      const afterB = JSON.stringify(
        store.candidates.find((c) => c.candidateId === candidateB)!.evidence,
      );
      expect(afterB).toBe(beforeB);
    });
  });

  describe('correction as contradiction', () => {
    it('records a correction as a new contradiction contribution without retracting the earlier support', async () => {
      const store = newStore();
      const repo = newRepo(store);
      const created = await repo.recordContribution(recordRequest());
      const candidateId = created.status === 'recorded' ? created.candidateId : '';

      await repo.recordContribution(
        recordRequest({
          observationId: 'obs-correction',
          resolverRunId: 'run-correction',
          explicitOriginalTargetCandidateId: candidateId,
          incomingPayload: negativeRoutingPayload,
        }),
      );

      const candidate = store.candidates.find((c) => c.candidateId === candidateId)!;
      expect(candidate.evidence.supportingEvidenceCount).toBe(1);
      expect(candidate.evidence.contradictingEvidenceCount).toBe(1);
      expect(repo.contributions).toHaveLength(2);
      expect(repo.retractionEvents).toHaveLength(0);
    });
  });

  describe('atomic in-memory reference behavior (this proves only the reference contract, not database atomicity)', () => {
    const stages: readonly ResolverKnowledgeContributionLedgerFailureStage[] = [
      'candidate_stage',
      'contribution_stage',
      'chain_resolution_stage',
      'summary_recomputation_stage',
      'cache_replacement_stage',
    ];

    it.each(stages)(
      'a failure during %s leaves recordContribution state exactly unchanged',
      async (stage) => {
        const store = newStore();
        const repo = newRepo(store);
        const before = snapshotOf(store, repo);
        repo.failureInjector = (injectedStage) => {
          if (injectedStage === stage) throw new Error('INJECTED_FAILURE');
        };
        const result = await repo.recordContribution(recordRequest());
        expect(result.status).toBe('failed');
        expect(snapshotOf(store, repo)).toBe(before);

        repo.failureInjector = null;
        const retry = await repo.recordContribution(recordRequest());
        expect(retry.status).toBe('recorded');
      },
    );

    it.each([
      'retraction_stage',
      'summary_recomputation_stage',
      'cache_replacement_stage',
    ] as const)(
      'a failure during %s leaves retractContributions state exactly unchanged',
      async (stage) => {
        const store = newStore();
        const repo = newRepo(store);
        await repo.recordContribution(recordRequest());
        const contributionId = repo.contributions[0].contributionId;
        const before = snapshotOf(store, repo);

        repo.failureInjector = (injectedStage) => {
          if (injectedStage === stage) throw new Error('INJECTED_FAILURE');
        };
        const result = await repo.retractContributions({
          ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
          retractionActionId: 'retract-fail',
          reason: 'developer_action',
          selector: { kind: 'contribution_ids', contributionIds: [contributionId] },
          occurredAt: '2026-07-22T01:00:00.000Z',
        });
        expect(result.status).toBe('failed');
        expect(snapshotOf(store, repo)).toBe(before);

        repo.failureInjector = null;
        const retry = await repo.retractContributions({
          ledgerContractVersion: 'resolver-knowledge-contribution-ledger-v1',
          retractionActionId: 'retract-fail',
          reason: 'developer_action',
          selector: { kind: 'contribution_ids', contributionIds: [contributionId] },
          occurredAt: '2026-07-22T01:00:00.000Z',
        });
        expect(retry.status).toBe('applied');
      },
    );
  });
});
