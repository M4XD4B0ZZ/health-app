/**
 * Closed duplicate/supersession terminal-chain result (RESOLVER-V3-032 binding requirement §12).
 * A pure chain resolver never mutates candidates and never picks an endpoint when the graph is
 * invalid — every invalid shape is one of these closed failure codes, never a guess.
 */
export const RESOLVER_KNOWLEDGE_CANDIDATE_TERMINAL_CHAIN_FAILURE_CODES = [
  'start_not_found',
  'target_not_found',
  'self_reference',
  'cycle',
  'both_links_present',
  'link_status_inconsistency',
  'duplicate_without_target',
  'superseded_without_target',
  'non_terminal_corruption',
] as const;
export type ResolverKnowledgeCandidateTerminalChainFailureCode =
  (typeof RESOLVER_KNOWLEDGE_CANDIDATE_TERMINAL_CHAIN_FAILURE_CODES)[number];

export type ResolverKnowledgeCandidateTerminalChainResult =
  | { status: 'resolved'; terminalCandidateId: string; visited: readonly string[] }
  | { status: 'failed'; code: ResolverKnowledgeCandidateTerminalChainFailureCode };
