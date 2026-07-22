import { resolveResolverKnowledgeCandidateTerminalChain } from '../application/knowledge/ResolverKnowledgeCandidateTerminalChainResolver';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidate,
  type ResolverKnowledgeCandidateStatus,
} from '../domain/models/ResolverKnowledgeCandidate';

function candidate(
  candidateId: string,
  status: ResolverKnowledgeCandidateStatus,
  duplicateOfCandidateId: string | null = null,
  supersededByCandidateId: string | null = null,
): ResolverKnowledgeCandidate {
  return {
    candidateId,
    contractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    candidateType: 'source-routing-pattern',
    fingerprint: `fp-${candidateId}`,
    payload: {
      type: 'source-routing-pattern',
      locale: 'de',
      inputType: 'generic',
      sourceType: 'bls',
    },
    evidence: {
      supportingEvidenceCount: 0,
      contradictingEvidenceCount: 0,
      abstentionSignalCount: 0,
      clarificationSignalCount: 0,
      contradictionStatus: 'none',
      negativeEvidenceSummary: 'none',
      independentUserEvidence: 'not_evaluable',
      locales: [],
      inputTypes: [],
      sourceTypes: [],
      provenanceStatuses: [],
      reasonCodes: [],
      privacyPolicyVersions: [],
      observationContractVersions: [],
      resolverVersions: [],
    },
    risk: 'low',
    status,
    duplicateOfCandidateId,
    supersededByCandidateId,
    quarantineReasonCode: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
  };
}

describe('RESOLVER-V3-032 duplicate/supersession terminal-chain resolver', () => {
  it('resolves immediately for an unlinked candidate', () => {
    const candidates = [candidate('a', 'candidate')];
    const result = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(result).toEqual({ status: 'resolved', terminalCandidateId: 'a', visited: ['a'] });
  });

  it('resolves a one-level duplicate to its target', () => {
    const candidates = [candidate('a', 'duplicate', 'b'), candidate('b', 'candidate')];
    const result = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(result).toEqual({ status: 'resolved', terminalCandidateId: 'b', visited: ['a', 'b'] });
  });

  it('resolves a multi-level duplicate chain to the terminal target', () => {
    const candidates = [
      candidate('a', 'duplicate', 'b'),
      candidate('b', 'duplicate', 'c'),
      candidate('c', 'candidate'),
    ];
    const result = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(result).toEqual({
      status: 'resolved',
      terminalCandidateId: 'c',
      visited: ['a', 'b', 'c'],
    });
  });

  it('resolves a one-level supersession', () => {
    const candidates = [candidate('a', 'superseded', null, 'b'), candidate('b', 'candidate')];
    const result = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(result).toEqual({ status: 'resolved', terminalCandidateId: 'b', visited: ['a', 'b'] });
  });

  it('resolves a mixed duplicate/supersession chain', () => {
    const candidates = [
      candidate('a', 'duplicate', 'b'),
      candidate('b', 'superseded', null, 'c'),
      candidate('c', 'candidate'),
    ];
    const result = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(result).toEqual({
      status: 'resolved',
      terminalCandidateId: 'c',
      visited: ['a', 'b', 'c'],
    });
  });

  it('fails closed on a self-reference', () => {
    const candidates = [candidate('a', 'duplicate', 'a')];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'self_reference',
    });
  });

  it('fails closed on a cycle', () => {
    const candidates = [candidate('a', 'duplicate', 'b'), candidate('b', 'duplicate', 'a')];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'cycle',
    });
  });

  it('fails closed on a missing start candidate', () => {
    expect(resolveResolverKnowledgeCandidateTerminalChain('missing', [])).toEqual({
      status: 'failed',
      code: 'start_not_found',
    });
  });

  it('fails closed on a missing chain target', () => {
    const candidates = [candidate('a', 'duplicate', 'ghost')];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'target_not_found',
    });
  });

  it('fails closed when both link fields are present', () => {
    const candidates = [
      candidate('a', 'duplicate', 'b', 'c'),
      candidate('b', 'candidate'),
      candidate('c', 'candidate'),
    ];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'both_links_present',
    });
  });

  it('fails closed on a link/status inconsistency (link present but status does not authorize it)', () => {
    const candidates = [candidate('a', 'candidate', 'b'), candidate('b', 'candidate')];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'link_status_inconsistency',
    });
  });

  it('fails closed when status says duplicate but no link is set', () => {
    const candidates = [candidate('a', 'duplicate')];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'duplicate_without_target',
    });
  });

  it('fails closed when status says superseded but no link is set', () => {
    const candidates = [candidate('a', 'superseded')];
    expect(resolveResolverKnowledgeCandidateTerminalChain('a', candidates)).toEqual({
      status: 'failed',
      code: 'superseded_without_target',
    });
  });

  it('is deterministic across repeated calls', () => {
    const candidates = [candidate('a', 'duplicate', 'b'), candidate('b', 'candidate')];
    const first = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    const second = resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(first).toEqual(second);
  });

  it('does not mutate any candidate', () => {
    const candidates = [candidate('a', 'duplicate', 'b'), candidate('b', 'candidate')];
    const snapshot = JSON.parse(JSON.stringify(candidates));
    resolveResolverKnowledgeCandidateTerminalChain('a', candidates);
    expect(JSON.parse(JSON.stringify(candidates))).toEqual(snapshot);
  });
});
