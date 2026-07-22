import {
  computeResolverKnowledgeContributionId,
  computeResolverKnowledgeRetractionEventId,
} from '../application/knowledge/ResolverKnowledgeContributionIdCalculator';
import { NodeCryptoResolverKnowledgeFingerprintHasher } from '../infrastructure/knowledge/NodeCryptoResolverKnowledgeFingerprintHasher';
import { RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION } from '../domain/models/ResolverKnowledgeCandidateFingerprintV2';

const hasher = new NodeCryptoResolverKnowledgeFingerprintHasher();

const fingerprintA = {
  fingerprintVersion: RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
  digest: 'aaaa',
};
const fingerprintB = {
  fingerprintVersion: RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
  digest: 'bbbb',
};

describe('RESOLVER-V3-032 private contribution-ID derivation', () => {
  it('is deterministic for the same observation/run/target-fingerprint triple', async () => {
    const first = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintA,
      hasher,
    );
    const second = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintA,
      hasher,
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different ID for a different target fingerprint', async () => {
    const first = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintA,
      hasher,
    );
    const second = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintB,
      hasher,
    );
    expect(first).not.toBe(second);
  });

  it('produces a different ID for a different observation ID', async () => {
    const first = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintA,
      hasher,
    );
    const second = await computeResolverKnowledgeContributionId(
      'obs-2',
      'run-1',
      fingerprintA,
      hasher,
    );
    expect(first).not.toBe(second);
  });

  it('produces a different ID for a different resolver-run ID', async () => {
    const first = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintA,
      hasher,
    );
    const second = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-2',
      fingerprintA,
      hasher,
    );
    expect(first).not.toBe(second);
  });

  it('lets one observation/run pair produce two distinct contribution IDs for two distinct targets', async () => {
    const toTargetA = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintA,
      hasher,
    );
    const toTargetB = await computeResolverKnowledgeContributionId(
      'obs-1',
      'run-1',
      fingerprintB,
      hasher,
    );
    expect(toTargetA).not.toBe(toTargetB);
  });

  it('derives retraction-event IDs deterministically from action ID + contribution ID', async () => {
    const first = await computeResolverKnowledgeRetractionEventId(
      'action-1',
      'contribution-1',
      hasher,
    );
    const second = await computeResolverKnowledgeRetractionEventId(
      'action-1',
      'contribution-1',
      hasher,
    );
    const differentContribution = await computeResolverKnowledgeRetractionEventId(
      'action-1',
      'contribution-2',
      hasher,
    );
    expect(first).toBe(second);
    expect(first).not.toBe(differentContribution);
  });
});
