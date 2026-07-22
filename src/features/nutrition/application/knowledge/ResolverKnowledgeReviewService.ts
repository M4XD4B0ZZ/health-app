import type {
  ResolverKnowledgeReviewCandidateReader,
  ResolverKnowledgeReviewAuthorizer,
  ResolverKnowledgeReviewRepository,
  ResolverKnowledgeReviewDecisionPlan,
} from '../ports/ResolverKnowledgeReviewPorts';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeCandidate';
import {
  RESOLVER_KNOWLEDGE_REVIEW_ACTIONS,
  RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
  RESOLVER_KNOWLEDGE_REVIEW_DECISION_REASON_CODES,
  RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS,
  RESOLVER_KNOWLEDGE_REVIEW_LOCALE_RESTRICTIONS,
  RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
  resolverKnowledgeReviewRequestMatchesEvent,
  type ApprovedResolverKnowledgePayload,
  type ResolverKnowledgeReviewMaterial,
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

/** Recursively rejects private/linkable fields by key name at any nesting depth — not only
 * top-level keys of the candidate or its payload (RESOLVER-V3-028 §4). */
function containsPrivateField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsPrivateField(item));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => privateKeys.includes(key) || containsPrivateField(nested),
    );
  }
  return false;
}

const FORWARD_ACTIONS = new Set([
  'approve',
  'reject',
  'needs_more_evidence',
  'quarantine',
  'mark_duplicate',
  'supersede',
]);

export class ResolverKnowledgeReviewService {
  constructor(
    private readonly authorizer: ResolverKnowledgeReviewAuthorizer,
    private readonly candidates: ResolverKnowledgeReviewCandidateReader,
    private readonly repository: ResolverKnowledgeReviewRepository,
  ) {}

  async review(request: ResolverKnowledgeReviewRequest): Promise<ResolverKnowledgeReviewResult> {
    const authorization = await this.authorizer.authorizeDeveloperReview();
    if (!authorization.authorized) return 'blocked_unauthorized';
    const { reviewerId } = authorization;

    if (!RESOLVER_KNOWLEDGE_REVIEW_ACTIONS.includes(request.action)) return 'validation_failed';

    const existingDecision = await this.repository.findDecisionByDecisionId(request.decisionId);
    if (existingDecision) {
      return resolverKnowledgeReviewRequestMatchesEvent(request, reviewerId, existingDecision)
        ? 'already_applied'
        : 'conflict';
    }

    const candidate = await this.candidates.getById(request.candidateId);
    if (!candidate) return 'candidate_not_found';

    if (
      !RESOLVER_KNOWLEDGE_REVIEW_DECISION_REASON_CODES.includes(request.reasonCode) ||
      !RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS[request.action].includes(request.reasonCode) ||
      request.reviewContractVersion !== RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION ||
      !['low', 'medium', 'high'].includes(request.riskDecision) ||
      request.riskDecision !== candidate.risk ||
      !RESOLVER_KNOWLEDGE_REVIEW_LOCALE_RESTRICTIONS.includes(request.localeRestriction)
    )
      return 'validation_failed';

    if (
      candidate.contractVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION ||
      request.privacyPolicyVersion !== RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION ||
      candidate.evidence.privacyPolicyVersions.some(
        (version) => version !== RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
      ) ||
      containsPrivateField(candidate) ||
      candidate.evidence.sourceTypes.some((type) => !['bls', 'off', 'usda'].includes(type))
    )
      return 'blocked_privacy';

    if (request.action === 'approve') {
      // RESOLVER-V3-037: the contradiction gate is checked first, independent of independent-user
      // evidence — a contradictory candidate must be refused as `blocked_contradiction` regardless
      // of whether independent-user evidence is `not_evaluable` or `independently_confirmed`. Runtime
      // coherence is validated defensively (not only trusted from the candidate's own static type),
      // since this service accepts whatever `ResolverKnowledgeReviewCandidateReader.getById` returns.
      const { contradictionStatus, contradictingEvidenceCount } = candidate.evidence;
      const contradictionCountIsValid =
        typeof contradictingEvidenceCount === 'number' &&
        Number.isFinite(contradictingEvidenceCount) &&
        Number.isInteger(contradictingEvidenceCount) &&
        contradictingEvidenceCount >= 0;
      if (!contradictionCountIsValid) return 'validation_failed';
      if (contradictionStatus === 'none') {
        if (contradictingEvidenceCount !== 0) return 'validation_failed';
      } else if (contradictionStatus === 'present') {
        if (contradictingEvidenceCount === 0) return 'validation_failed';
        // No numerical threshold: any coherent nonzero contradiction count blocks approval, for
        // every candidate type, regardless of risk or supporting-evidence count.
        return 'blocked_contradiction';
      } else {
        return 'validation_failed';
      }

      // Fail closed: `not_evaluable` (not evaluated / insufficient) must never approve. Only the
      // closed, positively-evaluated, privacy-safe independent-user state may proceed. The current
      // aggregation pipeline (RESOLVER-V3-020) only ever produces `not_evaluable`, so no candidate
      // can reach `approved` today — this is intentional, not a bug to work around.
      if (candidate.evidence.independentUserEvidence !== 'independently_confirmed')
        return 'blocked_privacy';
      // No unsupported region taxonomy is invented; an undetermined restriction fails closed for
      // a global activation rather than silently defaulting to "no restriction".
      if (request.localeRestriction === 'unknown') return 'blocked_privacy';
    }

    if (request.candidateVersionAtDecision !== candidate.updatedAt) return 'validation_failed';

    let targetCandidateId: string | null = null;
    if (request.action === 'mark_duplicate' || request.action === 'supersede') {
      if (request.targetCandidateId === request.candidateId) return 'validation_failed';
      const target = await this.candidates.getById(request.targetCandidateId);
      if (!target) return 'candidate_not_found';
      targetCandidateId = request.targetCandidateId;
    }

    let prior: ApprovedResolverKnowledgePayload | null = null;
    if (FORWARD_ACTIONS.has(request.action)) {
      if (candidate.status !== 'pending_review') return 'invalid_transition';
    } else {
      prior = await this.repository.findApprovedByCandidate(candidate.candidateId);
      if (candidate.status !== 'approved' || !prior || prior.status !== 'active')
        return 'invalid_transition';
    }

    const lifecycleHistory = await this.candidates.getLifecycleHistory(candidate.candidateId);
    const reviewMaterialSnapshot: ResolverKnowledgeReviewMaterial = {
      candidateType: candidate.candidateType,
      payload: candidate.payload,
      evidence: candidate.evidence,
      risk: candidate.risk,
      candidateStatus: candidate.status,
      contractVersion: candidate.contractVersion,
      lifecycleHistory,
    };

    let candidateTransition: ResolverKnowledgeReviewDecisionPlan['candidateTransition'] = null;
    let approvedPayload: ApprovedResolverKnowledgePayload | null = null;
    let approvedKnowledgeId: string | null = null;

    switch (request.action) {
      case 'approve':
        approvedKnowledgeId = `ark-v1-${request.decisionId}`;
        approvedPayload = {
          approvedKnowledgeId,
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
        candidateTransition = {
          nextStatus: 'approved',
          reasonCode: 'APPROVED_BY_REVIEW',
          duplicateOfCandidateId: null,
          supersededByCandidateId: null,
          quarantineReasonCode: null,
        };
        break;
      case 'reject':
        candidateTransition = {
          nextStatus: 'rejected',
          reasonCode: 'REJECTED_BY_REVIEW',
          duplicateOfCandidateId: null,
          supersededByCandidateId: null,
          quarantineReasonCode: null,
        };
        break;
      case 'needs_more_evidence':
        candidateTransition = {
          nextStatus: 'needs_more_evidence',
          reasonCode: 'INSUFFICIENT_EVIDENCE',
          duplicateOfCandidateId: null,
          supersededByCandidateId: null,
          quarantineReasonCode: null,
        };
        break;
      case 'quarantine':
        candidateTransition = {
          nextStatus: 'quarantined',
          reasonCode: 'QUARANTINE_PRIVACY_REVIEW',
          duplicateOfCandidateId: null,
          supersededByCandidateId: null,
          quarantineReasonCode: 'QUARANTINE_PRIVACY_REVIEW',
        };
        break;
      case 'mark_duplicate':
        candidateTransition = {
          nextStatus: 'duplicate',
          reasonCode: 'DUPLICATE_FINGERPRINT',
          duplicateOfCandidateId: targetCandidateId,
          supersededByCandidateId: null,
          quarantineReasonCode: null,
        };
        break;
      case 'supersede':
        candidateTransition = {
          nextStatus: 'superseded',
          reasonCode: 'SUPERSEDED_BY_CANDIDATE',
          duplicateOfCandidateId: null,
          supersededByCandidateId: targetCandidateId,
          quarantineReasonCode: null,
        };
        break;
      case 'revoke_approval':
        approvedKnowledgeId = prior!.approvedKnowledgeId;
        approvedPayload = {
          ...prior!,
          status: 'revoked',
          revokedByDecisionId: request.decisionId,
        };
        break;
      case 'rollback':
        approvedKnowledgeId = prior!.approvedKnowledgeId;
        approvedPayload = {
          ...prior!,
          status: 'rolled_back',
          rollbackByDecisionId: request.decisionId,
        };
        break;
    }

    const plan: ResolverKnowledgeReviewDecisionPlan = {
      candidateId: candidate.candidateId,
      candidateTransition,
      approvedPayload,
      event: {
        eventId: `rke-v1-${request.decisionId}`,
        decisionId: request.decisionId,
        candidateId: candidate.candidateId,
        action: request.action,
        reasonCode: request.reasonCode,
        result: 'applied',
        reviewerId,
        reviewContractVersion: request.reviewContractVersion,
        privacyPolicyVersion: request.privacyPolicyVersion,
        candidateVersionAtDecision: request.candidateVersionAtDecision,
        riskDecision: request.riskDecision,
        localeRestriction: request.localeRestriction,
        targetCandidateId,
        reviewMaterialSnapshot,
        occurredAt: request.occurredAt,
        approvedKnowledgeId,
      },
    };

    const outcome = await this.repository.applyDecision(plan);
    return outcome === 'applied' ? 'applied' : 'persistence_failed';
  }
}
