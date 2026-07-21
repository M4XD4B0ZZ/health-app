import { validateResolverKnowledgeCandidate } from '../../application/knowledge/ResolverKnowledgeCandidateValidator';
import type {
  ResolverKnowledgeCandidateRepository,
  ResolverKnowledgeCandidateWriteResult,
} from '../../application/ports/ResolverKnowledgeCandidateRepository';
import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidateLifecycleEvent,
  ResolverKnowledgeCandidateStatus,
} from '../../domain/models/ResolverKnowledgeCandidate';
const allowed: Record<
  Exclude<ResolverKnowledgeCandidateStatus, 'approved'>,
  readonly Exclude<ResolverKnowledgeCandidateStatus, 'approved'>[]
> = {
  candidate: [
    'needs_more_evidence',
    'pending_review',
    'duplicate',
    'quarantined',
    'rejected',
    'superseded',
  ],
  needs_more_evidence: ['candidate'],
  pending_review: [],
  rejected: [],
  duplicate: [],
  superseded: [],
  quarantined: [],
};
const unique = <T>(values: readonly T[]) => [...new Set(values)];
/** Test/server-boundary implementation only; it has no private-observation dependency. */
export class InMemoryResolverKnowledgeCandidateRepository implements ResolverKnowledgeCandidateRepository {
  readonly candidates: ResolverKnowledgeCandidate[] = [];
  readonly events: ResolverKnowledgeCandidateLifecycleEvent[] = [];
  async upsertInactive(
    candidate: ResolverKnowledgeCandidate,
  ): Promise<ResolverKnowledgeCandidateWriteResult> {
    try {
      validateResolverKnowledgeCandidate(candidate);
    } catch {
      return { status: 'failed', code: 'validation_failed' };
    }
    if ((candidate.status as string) === 'approved')
      return { status: 'failed', code: 'approval_not_supported' };
    const existing = this.candidates.find((value) => value.fingerprint === candidate.fingerprint);
    if (!existing) {
      this.candidates.push(candidate);
      return { status: 'created', candidate };
    }
    existing.evidence = {
      ...existing.evidence,
      supportingEvidenceCount:
        existing.evidence.supportingEvidenceCount + candidate.evidence.supportingEvidenceCount,
      contradictingEvidenceCount:
        existing.evidence.contradictingEvidenceCount +
        candidate.evidence.contradictingEvidenceCount,
      abstentionSignalCount:
        existing.evidence.abstentionSignalCount + candidate.evidence.abstentionSignalCount,
      clarificationSignalCount:
        existing.evidence.clarificationSignalCount + candidate.evidence.clarificationSignalCount,
      contradictionStatus:
        existing.evidence.contradictingEvidenceCount +
          candidate.evidence.contradictingEvidenceCount >
        0
          ? 'present'
          : 'none',
      negativeEvidenceSummary:
        existing.evidence.negativeEvidenceSummary === 'source_unsuitable_signal' ||
        candidate.evidence.negativeEvidenceSummary === 'source_unsuitable_signal'
          ? 'source_unsuitable_signal'
          : 'none',
      locales: unique([...existing.evidence.locales, ...candidate.evidence.locales]),
      inputTypes: unique([...existing.evidence.inputTypes, ...candidate.evidence.inputTypes]),
      sourceTypes: unique([...existing.evidence.sourceTypes, ...candidate.evidence.sourceTypes]),
      provenanceStatuses: unique([
        ...existing.evidence.provenanceStatuses,
        ...candidate.evidence.provenanceStatuses,
      ]),
      reasonCodes: unique([...existing.evidence.reasonCodes, ...candidate.evidence.reasonCodes]),
      privacyPolicyVersions: unique([
        ...existing.evidence.privacyPolicyVersions,
        ...candidate.evidence.privacyPolicyVersions,
      ]),
      observationContractVersions: unique([
        ...existing.evidence.observationContractVersions,
        ...candidate.evidence.observationContractVersions,
      ]),
      resolverVersions: unique([
        ...existing.evidence.resolverVersions,
        ...candidate.evidence.resolverVersions,
      ]),
    };
    existing.updatedAt = candidate.updatedAt;
    return { status: 'updated', candidate: existing };
  }
  async transitionInactive({
    candidateId,
    nextStatus,
    reasonCode,
    actorType,
    occurredAt,
  }: Parameters<
    ResolverKnowledgeCandidateRepository['transitionInactive']
  >[0]): Promise<ResolverKnowledgeCandidateWriteResult> {
    const candidate = this.candidates.find((value) => value.candidateId === candidateId);
    if (!candidate || (nextStatus as string) === 'approved')
      return { status: 'failed', code: 'approval_not_supported' };
    if (!allowed[candidate.status].includes(nextStatus))
      return { status: 'failed', code: 'invalid_transition' };
    const previousStatus = candidate.status;
    candidate.status = nextStatus;
    candidate.updatedAt = occurredAt;
    this.events.push({
      eventId: `${candidateId}:${this.events.length + 1}`,
      candidateId,
      previousStatus,
      nextStatus,
      reasonCode,
      actorType,
      payloadVersion: candidate.contractVersion,
      occurredAt,
    });
    return { status: 'updated', candidate };
  }
}
