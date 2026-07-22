import { validateResolverKnowledgeContributionRetractionRequest } from './ResolverKnowledgeContributionLedgerValidator';
import { computeResolverKnowledgeRetractionEventId } from './ResolverKnowledgeContributionIdCalculator';
import { stableJsonStringify } from './ResolverKnowledgeContributionLedgerEquality';
import { RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeContributionLedger';
import type {
  ResolverKnowledgeContribution,
  ResolverKnowledgeContributionRetractionEvent,
  ResolverKnowledgeContributionRetractionRequest,
} from '../../domain/models/ResolverKnowledgeContributionLedger';
import type { ResolverKnowledgeFingerprintHasher } from '../ports/ResolverKnowledgeFingerprintHasher';

export type ResolverKnowledgeContributionRetractionPlan =
  | {
      status: 'applied';
      newEvents: readonly ResolverKnowledgeContributionRetractionEvent[];
      affectedContributionIds: readonly string[];
    }
  | { status: 'already_recorded' }
  | { status: 'conflict' }
  | { status: 'no_op' }
  | { status: 'failed'; code: 'invalid_request' };

function matchesSelector(
  contribution: ResolverKnowledgeContribution,
  selector: ResolverKnowledgeContributionRetractionRequest['selector'],
): boolean {
  switch (selector.kind) {
    case 'contribution_ids':
      return selector.contributionIds.includes(contribution.contributionId);
    case 'observation_id':
      return contribution.observationId === selector.observationId;
    case 'observation_contract_version':
      return contribution.observationContractVersion === selector.observationContractVersion;
    case 'projection_version':
      return contribution.projectionVersion === selector.projectionVersion;
    case 'privacy_policy_version':
      return contribution.privacyPolicyVersion === selector.privacyPolicyVersion;
    case 'source_type':
      return contribution.evidenceSnapshot.sourceType === selector.sourceType;
    default:
      return false;
  }
}

/**
 * Pure(-ish; retraction-event IDs are hashed) planning function for one retraction action
 * (RESOLVER-V3-032 binding requirement §17-§20). Takes read-only snapshots of ledger state plus
 * the action log of previously-seen `retractionActionId`s and returns a closed plan. Never mutates
 * its inputs; the caller (the in-memory repository) stages the plan atomically and is responsible
 * for recording the action log entry afterward (including for a validated `no_op` outcome, so a
 * later conflicting reuse of the same action ID still fails closed).
 */
export async function planResolverKnowledgeContributionRetraction(
  request: unknown,
  currentContributions: readonly ResolverKnowledgeContribution[],
  currentRetractionEvents: readonly ResolverKnowledgeContributionRetractionEvent[],
  actionLog: ReadonlyMap<string, ResolverKnowledgeContributionRetractionRequest>,
  hasher: ResolverKnowledgeFingerprintHasher,
): Promise<ResolverKnowledgeContributionRetractionPlan> {
  try {
    validateResolverKnowledgeContributionRetractionRequest(request);
  } catch {
    return { status: 'failed', code: 'invalid_request' };
  }
  const validatedRequest = request as ResolverKnowledgeContributionRetractionRequest;

  const priorRequest = actionLog.get(validatedRequest.retractionActionId);
  if (priorRequest) {
    return stableJsonStringify(priorRequest) === stableJsonStringify(validatedRequest)
      ? { status: 'already_recorded' }
      : { status: 'conflict' };
  }

  const retractedContributionIds = new Set(
    currentRetractionEvents.map((event) => event.contributionId),
  );
  const matches = currentContributions.filter(
    (contribution) =>
      !retractedContributionIds.has(contribution.contributionId) &&
      matchesSelector(contribution, validatedRequest.selector),
  );

  if (matches.length === 0) return { status: 'no_op' };

  const newEvents: ResolverKnowledgeContributionRetractionEvent[] = [];
  for (const contribution of matches) {
    const retractionEventId = await computeResolverKnowledgeRetractionEventId(
      validatedRequest.retractionActionId,
      contribution.contributionId,
      hasher,
    );
    newEvents.push({
      ledgerContractVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
      retractionEventId,
      retractionActionId: validatedRequest.retractionActionId,
      contributionId: contribution.contributionId,
      reason: validatedRequest.reason,
      occurredAt: validatedRequest.occurredAt,
    });
  }

  return {
    status: 'applied',
    newEvents,
    affectedContributionIds: matches.map((contribution) => contribution.contributionId),
  };
}
