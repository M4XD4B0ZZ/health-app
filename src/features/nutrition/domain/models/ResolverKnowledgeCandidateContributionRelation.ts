/**
 * Closed relation type computed between two closed candidate payloads (RESOLVER-V3-030 design §10).
 * This is a pure classification result; it never accumulates evidence, mutates a candidate, or
 * writes to any ledger/repository — that is RESOLVER-V3-032's scope.
 */
export const RESOLVER_KNOWLEDGE_CANDIDATE_CONTRIBUTION_RELATIONS = [
  'support',
  'contradiction',
  'orthogonal',
  'not_evaluable',
] as const;
export type ResolverKnowledgeCandidateContributionRelation =
  (typeof RESOLVER_KNOWLEDGE_CANDIDATE_CONTRIBUTION_RELATIONS)[number];
