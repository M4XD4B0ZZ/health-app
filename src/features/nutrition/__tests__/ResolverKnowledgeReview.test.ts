import { ResolverKnowledgeCandidateAggregator } from '../application/knowledge/ResolverKnowledgeCandidateAggregator';
import { ResolverKnowledgeReviewService } from '../application/knowledge/ResolverKnowledgeReviewService';
import { InMemoryResolverKnowledgeCandidateRepository } from '../infrastructure/knowledge/InMemoryResolverKnowledgeCandidateRepository';
import { InMemoryResolverKnowledgeReviewRepository } from '../infrastructure/knowledge/InMemoryResolverKnowledgeReviewRepository';

const now = '2026-07-21T12:00:00.000Z';
const projection = {
  privacyPolicyVersion: 'resolver-observation-privacy-v1' as const,
  contractVersion: 'resolver-observation-v1' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  outcome: 'accepted' as const,
  candidateCount: 1,
  selectedSource: { type: 'bls' as const, id: 'excluded' },
  provenanceStatus: 'source_grounded' as const,
  resolverVersion: 'resolver-v3',
  totalLatencyMs: 1,
  reasonCodes: ['ACCEPTED_STRONG_MATCH'] as const,
};
async function subject(authorized = true) {
  const candidates = new InMemoryResolverKnowledgeCandidateRepository();
  const candidate = new ResolverKnowledgeCandidateAggregator().aggregate(projection, now)!;
  candidate.status = 'pending_review';
  await candidates.upsertInactive(candidate);
  const reviews = new InMemoryResolverKnowledgeReviewRepository();
  return {
    candidate,
    candidates,
    reviews,
    service: new ResolverKnowledgeReviewService(
      { isDeveloperReviewAuthorized: async () => authorized },
      candidates,
      reviews,
    ),
  };
}
describe('RESOLVER-V3-021 developer knowledge review', () => {
  it('authorizes approve once, stores a separate payload, and is decision-id idempotent', async () => {
    const { service, candidate, reviews } = await subject();
    const request = {
      decisionId: 'd1',
      candidateId: candidate.candidateId,
      action: 'approve' as const,
      occurredAt: now,
    };
    await expect(service.review(request)).resolves.toBe('applied');
    await expect(service.review(request)).resolves.toBe('already_applied');
    expect(reviews.events).toHaveLength(1);
    expect(reviews.approved[0]).toMatchObject({
      candidateId: candidate.candidateId,
      status: 'active',
    });
  });
  it('blocks unauthorized users and rejects privacy/version failures fail-closed', async () => {
    const unauthorized = await subject(false);
    await expect(
      unauthorized.service.review({
        decisionId: 'd2',
        candidateId: unauthorized.candidate.candidateId,
        action: 'approve',
        occurredAt: now,
      }),
    ).resolves.toBe('blocked_unauthorized');
    const safe = await subject();
    safe.candidate.contractVersion = 'unknown' as any;
    await expect(
      safe.service.review({
        decisionId: 'd3',
        candidateId: safe.candidate.candidateId,
        action: 'approve',
        occurredAt: now,
      }),
    ).resolves.toBe('blocked_privacy');
  });
  it('keeps reject, evidence, quarantine and negative review actions inactive', async () => {
    const { service, candidate, reviews } = await subject();
    for (const [i, action] of (['reject', 'needs_more_evidence', 'quarantine'] as const).entries())
      await expect(
        service.review({
          decisionId: `i${i}`,
          candidateId: candidate.candidateId,
          action,
          occurredAt: now,
        }),
      ).resolves.toBe('applied');
    expect(reviews.approved).toHaveLength(0);
  });
  it('revoke and rollback are append-only-audited and deactivate approval', async () => {
    const { service, candidate, reviews } = await subject();
    await service.review({
      decisionId: 'a',
      candidateId: candidate.candidateId,
      action: 'approve',
      occurredAt: now,
    });
    await expect(
      service.review({
        decisionId: 'r',
        candidateId: candidate.candidateId,
        action: 'revoke_approval',
        occurredAt: now,
      }),
    ).resolves.toBe('applied');
    expect(reviews.approved[0].status).toBe('revoked');
    expect(reviews.events).toHaveLength(2);
  });
});
