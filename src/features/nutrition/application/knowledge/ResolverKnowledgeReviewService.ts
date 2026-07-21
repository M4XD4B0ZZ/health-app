import type {
  ResolverKnowledgeReviewCandidateReader,
  ResolverKnowledgeReviewAuthorizer,
  ResolverKnowledgeReviewRepository,
} from '../ports/ResolverKnowledgeReviewPorts';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeCandidate';
import {
  RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
  type ApprovedResolverKnowledgePayload,
  type ResolverKnowledgeReviewRequest,
  type ResolverKnowledgeReviewResult,
} from '../../domain/models/ResolverKnowledgeReview';

const privateKeys = [
  'rawInput',
  'normalizedInput',
  'ownerId',
  'observationId',
  'runId',
  'rowId',
  'personalSourceId',
  'journal',
  'correction',
  'prompt',
  'secret',
];
export class ResolverKnowledgeReviewService {
  constructor(
    private readonly authorizer: ResolverKnowledgeReviewAuthorizer,
    private readonly candidates: ResolverKnowledgeReviewCandidateReader,
    private readonly repository: ResolverKnowledgeReviewRepository,
  ) {}
  async review(request: ResolverKnowledgeReviewRequest): Promise<ResolverKnowledgeReviewResult> {
    if (!(await this.authorizer.isDeveloperReviewAuthorized())) return 'blocked_unauthorized';
    if (await this.repository.findEventByDecisionId(request.decisionId)) return 'already_applied';
    const candidate = await this.candidates.getById(request.candidateId);
    if (!candidate) return 'candidate_not_found';
    if (
      candidate.contractVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION ||
      candidate.evidence.privacyPolicyVersions.some(
        (v) => v !== 'resolver-observation-privacy-v1',
      ) ||
      candidate.evidence.independentUserEvidence !== 'not_evaluable'
    )
      return 'blocked_privacy';
    if (
      privateKeys.some((key) => JSON.stringify(candidate).includes(key)) ||
      candidate.evidence.sourceTypes.some((type) => !['bls', 'off', 'usda'].includes(type))
    )
      return 'blocked_privacy';
    const prior = await this.repository.findApprovedByCandidate(candidate.candidateId);
    const approvalAction = request.action === 'approve';
    const reversal = request.action === 'revoke_approval' || request.action === 'rollback';
    if (approvalAction && candidate.status !== 'pending_review') return 'invalid_transition';
    if (reversal && (!prior || prior.status !== 'active')) return 'invalid_transition';
    if (!approvalAction && !reversal && candidate.status === ('approved' as never))
      return 'invalid_transition';
    let approvedKnowledgeId: string | null = null;
    try {
      if (approvalAction) {
        const payload: ApprovedResolverKnowledgePayload = {
          approvedKnowledgeId: `ark-v1-${request.decisionId}`,
          candidateId: candidate.candidateId,
          decisionId: request.decisionId,
          payloadVersion: RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
          payload: candidate.payload,
          locale: candidate.payload.locale,
          risk: candidate.risk,
          provenanceStatus: candidate.evidence.provenanceStatuses[0] ?? 'not_resolved',
          status: 'active',
          revokedByDecisionId: null,
          rollbackByDecisionId: null,
        };
        await this.repository.saveApproved(payload);
        approvedKnowledgeId = payload.approvedKnowledgeId;
      } else if (reversal && prior) {
        await this.repository.saveApproved({
          ...prior,
          status: request.action === 'revoke_approval' ? 'revoked' : 'rolled_back',
          revokedByDecisionId:
            request.action === 'revoke_approval' ? request.decisionId : prior.revokedByDecisionId,
          rollbackByDecisionId:
            request.action === 'rollback' ? request.decisionId : prior.rollbackByDecisionId,
        });
        approvedKnowledgeId = prior.approvedKnowledgeId;
      }
      await this.repository.appendEvent({
        eventId: `rke-v1-${request.decisionId}`,
        decisionId: request.decisionId,
        candidateId: candidate.candidateId,
        action: request.action,
        result: 'applied',
        occurredAt: request.occurredAt,
        approvedKnowledgeId,
      });
      return 'applied';
    } catch {
      return 'persistence_failed';
    }
  }
}
