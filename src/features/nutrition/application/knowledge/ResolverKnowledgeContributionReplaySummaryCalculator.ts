import { classifyResolverKnowledgeCandidateContributionRelation } from './ResolverKnowledgeCandidateContributionRelationClassifier';
import {
  RESOLVER_KNOWLEDGE_CONTRIBUTION_REPLAY_SUMMARY_VERSION,
  type ResolverKnowledgeContributionReplaySummary,
} from '../../domain/models/ResolverKnowledgeContributionReplaySummary';
import type { ResolverKnowledgeContribution } from '../../domain/models/ResolverKnowledgeContributionLedger';
import type {
  ResolverKnowledgeCandidateEvidence,
  ResolverKnowledgeCandidatePayload,
} from '../../domain/models/ResolverKnowledgeCandidate';

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

/**
 * Pure replay-summary derivation (RESOLVER-V3-032 binding requirement §9). Takes the terminal
 * candidate's own payload and the set of contributions currently routed to it and active (already
 * filtered by the caller — this function performs no chain-walking or retraction lookup itself),
 * and derives the complete summary. Never mutates its inputs; repeated replay of the same input is
 * byte-for-byte deterministic (array fields are unique and sorted).
 *
 * The relation used for every count is *recomputed* here via the V3-031 classifier against the
 * terminal candidate's current payload — never read from a contribution's own stored `relation`
 * field — so that a duplicate/supersession chain change is correctly reflected the next time the
 * terminal's summary is replayed (RESOLVER-V3-032 binding requirement §13).
 */
export function computeResolverKnowledgeContributionReplaySummary(
  terminalCandidatePayload: ResolverKnowledgeCandidatePayload,
  activeContributions: readonly ResolverKnowledgeContribution[],
  candidateContractVersion: string,
): ResolverKnowledgeContributionReplaySummary {
  let supportCount = 0;
  let contradictionCount = 0;
  let orthogonalCount = 0;
  let notEvaluableCount = 0;
  let abstentionSignalCount = 0;
  let clarificationSignalCount = 0;
  let negative = false;

  const locales: string[] = [];
  const inputTypes: string[] = [];
  const sourceTypes: string[] = [];
  const provenanceStatuses: string[] = [];
  const reasonCodes: string[] = [];
  const privacyPolicyVersions: string[] = [];
  const observationContractVersions: string[] = [];
  const projectionVersions: string[] = [];
  const resolverVersions: string[] = [];
  const fingerprintVersions: string[] = [];

  for (const contribution of activeContributions) {
    const relation = classifyResolverKnowledgeCandidateContributionRelation(
      terminalCandidatePayload,
      contribution.candidatePayload,
      candidateContractVersion,
    );
    if (relation === 'support') supportCount += 1;
    else if (relation === 'contradiction') contradictionCount += 1;
    else if (relation === 'orthogonal') orthogonalCount += 1;
    else notEvaluableCount += 1;

    const snapshot = contribution.evidenceSnapshot;
    if (snapshot.outcome === 'abstained') abstentionSignalCount += 1;
    if (snapshot.outcome === 'ambiguous') clarificationSignalCount += 1;
    if (contribution.candidatePayload.type === 'negative-source-routing-rule') negative = true;

    locales.push(snapshot.locale);
    inputTypes.push(snapshot.inputType);
    if (snapshot.sourceType) sourceTypes.push(snapshot.sourceType);
    provenanceStatuses.push(snapshot.provenanceStatus);
    reasonCodes.push(...snapshot.reasonCodes);
    privacyPolicyVersions.push(contribution.privacyPolicyVersion);
    observationContractVersions.push(contribution.observationContractVersion);
    projectionVersions.push(contribution.projectionVersion);
    resolverVersions.push(snapshot.resolverVersion);
    fingerprintVersions.push(contribution.fingerprintVersion);
  }

  return {
    replaySummaryVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_REPLAY_SUMMARY_VERSION,
    activeContributionCount: activeContributions.length,
    supportCount,
    contradictionCount,
    orthogonalCount,
    notEvaluableCount,
    abstentionSignalCount,
    clarificationSignalCount,
    contradictionStatus: contradictionCount > 0 ? 'present' : 'none',
    negativeEvidenceSummary: negative ? 'source_unsuitable_signal' : 'none',
    independentUserEvidence: 'not_evaluable',
    locales: uniqueSorted(locales) as readonly ('de' | 'en')[],
    inputTypes: uniqueSorted(inputTypes),
    sourceTypes: uniqueSorted(sourceTypes) as readonly ('bls' | 'off' | 'usda')[],
    provenanceStatuses: uniqueSorted(provenanceStatuses) as readonly (
      | 'source_grounded'
      | 'not_resolved'
    )[],
    reasonCodes: uniqueSorted(reasonCodes),
    privacyPolicyVersions: uniqueSorted(privacyPolicyVersions),
    observationContractVersions: uniqueSorted(observationContractVersions),
    projectionVersions: uniqueSorted(projectionVersions),
    resolverVersions: uniqueSorted(resolverVersions),
    fingerprintVersions: uniqueSorted(fingerprintVersions),
  };
}

/**
 * Deliberate, documented mapping to the legacy `ResolverKnowledgeCandidateEvidence` shape
 * (RESOLVER-V3-032 binding requirement §8). The legacy shape has no field for
 * `orthogonalCount`/`notEvaluableCount`/`projectionVersions`/`fingerprintVersions` — those are
 * retained on the richer replay summary but intentionally dropped here rather than silently
 * amending the historical candidate contract. A future schema extension to retain them on the
 * candidate row itself is an explicit RESOLVER-V3-033 handoff item, not decided in this mapping.
 */
export function mapResolverKnowledgeContributionReplaySummaryToLegacyEvidence(
  summary: ResolverKnowledgeContributionReplaySummary,
): ResolverKnowledgeCandidateEvidence {
  return {
    supportingEvidenceCount: summary.supportCount,
    contradictingEvidenceCount: summary.contradictionCount,
    abstentionSignalCount: summary.abstentionSignalCount,
    clarificationSignalCount: summary.clarificationSignalCount,
    contradictionStatus: summary.contradictionStatus,
    negativeEvidenceSummary: summary.negativeEvidenceSummary,
    independentUserEvidence: 'not_evaluable',
    locales: summary.locales,
    inputTypes: summary.inputTypes,
    sourceTypes: summary.sourceTypes,
    provenanceStatuses: summary.provenanceStatuses,
    reasonCodes: summary.reasonCodes,
    privacyPolicyVersions: summary.privacyPolicyVersions,
    observationContractVersions: summary.observationContractVersions,
    resolverVersions: summary.resolverVersions,
  };
}
