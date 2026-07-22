import type { ResolverKnowledgeCandidate } from '../../domain/models/ResolverKnowledgeCandidate';
import type { ResolverKnowledgeCandidateTerminalChainResult } from '../../domain/models/ResolverKnowledgeCandidateTerminalChain';

/**
 * Pure duplicate/supersession terminal-chain resolver (RESOLVER-V3-032 binding requirement §12).
 * Follows `duplicateOfCandidateId`/`supersededByCandidateId` until a terminal candidate (neither
 * field set) is reached. Never mutates any candidate; never chooses an endpoint when the graph is
 * invalid. The visited-set bound is the finite candidate array itself — no fixed traversal
 * threshold is invented.
 */
export function resolveResolverKnowledgeCandidateTerminalChain(
  startCandidateId: string,
  candidates: readonly ResolverKnowledgeCandidate[],
): ResolverKnowledgeCandidateTerminalChainResult {
  const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate] as const));
  let current = byId.get(startCandidateId);
  if (!current) return { status: 'failed', code: 'start_not_found' };

  const visited = new Set<string>([current.candidateId]);

  for (let hop = 0; hop <= candidates.length; hop += 1) {
    const hasDuplicateLink = current.duplicateOfCandidateId !== null;
    const hasSupersessionLink = current.supersededByCandidateId !== null;

    if (hasDuplicateLink && hasSupersessionLink)
      return { status: 'failed', code: 'both_links_present' };
    if (current.status === 'duplicate' && !hasDuplicateLink)
      return { status: 'failed', code: 'duplicate_without_target' };
    if (current.status === 'superseded' && !hasSupersessionLink)
      return { status: 'failed', code: 'superseded_without_target' };
    if (hasDuplicateLink && current.status !== 'duplicate')
      return { status: 'failed', code: 'link_status_inconsistency' };
    if (hasSupersessionLink && current.status !== 'superseded')
      return { status: 'failed', code: 'link_status_inconsistency' };

    const nextId = current.duplicateOfCandidateId ?? current.supersededByCandidateId;
    if (nextId === null) {
      if (current.status === 'duplicate' || current.status === 'superseded')
        return { status: 'failed', code: 'non_terminal_corruption' };
      return {
        status: 'resolved',
        terminalCandidateId: current.candidateId,
        visited: [...visited],
      };
    }

    if (nextId === current.candidateId) return { status: 'failed', code: 'self_reference' };
    const next = byId.get(nextId);
    if (!next) return { status: 'failed', code: 'target_not_found' };
    if (visited.has(nextId)) return { status: 'failed', code: 'cycle' };
    visited.add(nextId);
    current = next;
  }

  // Defensive invariant: with a visited-set bound by the finite candidate array, every valid
  // (acyclic) chain terminates within `candidates.length` hops and every cyclic chain is caught by
  // the `visited.has(nextId)` check above. Reaching this line means that invariant was violated.
  return { status: 'failed', code: 'non_terminal_corruption' };
}
