/**
 * Operational replay-summary contract (RESOLVER-V3-032 binding requirement §8-§9). Richer than the
 * legacy `ResolverKnowledgeCandidateEvidence` shape: it retains the orthogonal and not-evaluable
 * contribution counts the legacy shape has no field for, and every version axis a contribution
 * carries. Always computed by pure replay over currently-active contributions — never
 * incrementally authored as its own source of truth.
 */
export const RESOLVER_KNOWLEDGE_CONTRIBUTION_REPLAY_SUMMARY_VERSION =
  'resolver-knowledge-contribution-replay-summary-v1' as const;

export interface ResolverKnowledgeContributionReplaySummary {
  replaySummaryVersion: typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_REPLAY_SUMMARY_VERSION;
  activeContributionCount: number;
  supportCount: number;
  contradictionCount: number;
  orthogonalCount: number;
  notEvaluableCount: number;
  abstentionSignalCount: number;
  clarificationSignalCount: number;
  contradictionStatus: 'none' | 'present';
  negativeEvidenceSummary: 'none' | 'source_unsuitable_signal';
  /** Always `not_evaluable` in this version — RESOLVER-V3-035 is blocked and not authorized here. */
  independentUserEvidence: 'not_evaluable';
  locales: readonly ('de' | 'en')[];
  inputTypes: readonly string[];
  sourceTypes: readonly ('bls' | 'off' | 'usda')[];
  provenanceStatuses: readonly ('source_grounded' | 'not_resolved')[];
  reasonCodes: readonly string[];
  privacyPolicyVersions: readonly string[];
  observationContractVersions: readonly string[];
  projectionVersions: readonly string[];
  resolverVersions: readonly string[];
  fingerprintVersions: readonly string[];
}
