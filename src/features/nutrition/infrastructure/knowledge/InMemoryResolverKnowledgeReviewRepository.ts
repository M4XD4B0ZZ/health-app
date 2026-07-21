import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidateLifecycleEvent,
} from '../../domain/models/ResolverKnowledgeCandidate';
import type {
  ApprovedResolverKnowledgePayload,
  ResolverKnowledgeReviewEvent,
} from '../../domain/models/ResolverKnowledgeReview';
import type {
  ResolverKnowledgeReviewCandidateReader,
  ResolverKnowledgeReviewDecisionPlan,
  ResolverKnowledgeReviewRepository,
} from '../../application/ports/ResolverKnowledgeReviewPorts';

/** Structural shape shared with `InMemoryResolverKnowledgeCandidateRepository` — both its
 * candidate rows and its lifecycle-event log are read/written here so review-caused transitions
 * are visible to (and readable by) the same store the aggregation pipeline uses. */
export interface ResolverKnowledgeReviewSharedCandidateStore {
  readonly candidates: ResolverKnowledgeCandidate[];
  readonly events: ResolverKnowledgeCandidateLifecycleEvent[];
}

export class InMemoryResolverKnowledgeReviewCandidateReader implements ResolverKnowledgeReviewCandidateReader {
  constructor(private readonly store: ResolverKnowledgeReviewSharedCandidateStore) {}
  async getById(candidateId: string): Promise<ResolverKnowledgeCandidate | null> {
    return this.store.candidates.find((candidate) => candidate.candidateId === candidateId) ?? null;
  }
  async getLifecycleHistory(candidateId: string) {
    return this.store.events
      .filter((event) => event.candidateId === candidateId)
      .map((event) => ({
        nextStatus: event.nextStatus,
        reasonCode: event.reasonCode,
        occurredAt: event.occurredAt,
      }));
  }
}

export type ResolverKnowledgeReviewFailureStage = 'candidate' | 'payload' | 'event';

/**
 * Reference atomic adapter (RESOLVER-V3-028). `applyDecision` applies the candidate lifecycle
 * transition, the approved-payload write, and the immutable event append as a single operation:
 * every mutation is staged against a pre-call snapshot and only committed once all internal steps
 * complete without throwing. Any thrown error (including test-injected failures) restores all
 * three stores to their pre-call state and returns `persistence_failed` — there is no partial
 * commit and no compensating best-effort write.
 */
export class InMemoryResolverKnowledgeReviewRepository implements ResolverKnowledgeReviewRepository {
  readonly events: ResolverKnowledgeReviewEvent[] = [];
  readonly approved: ApprovedResolverKnowledgePayload[] = [];
  /** Test-only deterministic failure injection hook; must stay unset in any real usage. */
  failureInjector: ((stage: ResolverKnowledgeReviewFailureStage) => void) | null = null;

  constructor(private readonly candidateStore: ResolverKnowledgeReviewSharedCandidateStore) {}

  async findDecisionByDecisionId(decisionId: string): Promise<ResolverKnowledgeReviewEvent | null> {
    return this.events.find((event) => event.decisionId === decisionId) ?? null;
  }

  async findApprovedByCandidate(
    candidateId: string,
  ): Promise<ApprovedResolverKnowledgePayload | null> {
    return this.approved.find((value) => value.candidateId === candidateId) ?? null;
  }

  async applyDecision(
    plan: ResolverKnowledgeReviewDecisionPlan,
  ): Promise<'applied' | 'persistence_failed'> {
    const candidate = this.candidateStore.candidates.find(
      (value) => value.candidateId === plan.candidateId,
    );
    if (!candidate) return 'persistence_failed';

    const candidateSnapshot = {
      status: candidate.status,
      duplicateOfCandidateId: candidate.duplicateOfCandidateId,
      supersededByCandidateId: candidate.supersededByCandidateId,
      quarantineReasonCode: candidate.quarantineReasonCode,
      updatedAt: candidate.updatedAt,
    };
    const candidateEventsSnapshot = this.candidateStore.events.slice();
    const approvedSnapshot = this.approved.slice();
    const reviewEventsSnapshot = this.events.slice();

    try {
      this.failureInjector?.('candidate');
      if (plan.candidateTransition) {
        const previousStatus = candidate.status;
        candidate.status = plan.candidateTransition.nextStatus;
        candidate.duplicateOfCandidateId = plan.candidateTransition.duplicateOfCandidateId;
        candidate.supersededByCandidateId = plan.candidateTransition.supersededByCandidateId;
        candidate.quarantineReasonCode = plan.candidateTransition.quarantineReasonCode;
        candidate.updatedAt = plan.event.occurredAt;
        this.candidateStore.events.push({
          eventId: `${plan.candidateId}:${this.candidateStore.events.length + 1}`,
          candidateId: plan.candidateId,
          previousStatus,
          nextStatus: plan.candidateTransition.nextStatus,
          reasonCode: plan.candidateTransition.reasonCode,
          actorType: 'developer',
          payloadVersion: candidate.contractVersion,
          occurredAt: plan.event.occurredAt,
        });
      }

      this.failureInjector?.('payload');
      if (plan.approvedPayload) {
        const index = this.approved.findIndex(
          (value) => value.candidateId === plan.approvedPayload!.candidateId,
        );
        if (index < 0) this.approved.push(plan.approvedPayload);
        else this.approved[index] = plan.approvedPayload;
      }

      this.failureInjector?.('event');
      this.events.push(plan.event);

      return 'applied';
    } catch {
      Object.assign(candidate, candidateSnapshot);
      this.candidateStore.events.splice(
        0,
        this.candidateStore.events.length,
        ...candidateEventsSnapshot,
      );
      this.approved.splice(0, this.approved.length, ...approvedSnapshot);
      this.events.splice(0, this.events.length, ...reviewEventsSnapshot);
      return 'persistence_failed';
    }
  }
}
