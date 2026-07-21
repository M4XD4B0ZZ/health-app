import type {
  ApprovedResolverKnowledgePayload,
  ResolverKnowledgeReviewEvent,
} from '../../domain/models/ResolverKnowledgeReview';
import type { ResolverKnowledgeReviewRepository } from '../../application/ports/ResolverKnowledgeReviewPorts';
export class InMemoryResolverKnowledgeReviewRepository implements ResolverKnowledgeReviewRepository {
  readonly events: ResolverKnowledgeReviewEvent[] = [];
  readonly approved: ApprovedResolverKnowledgePayload[] = [];
  async findEventByDecisionId(id: string) {
    return this.events.find((e) => e.decisionId === id) ?? null;
  }
  async appendEvent(event: ResolverKnowledgeReviewEvent) {
    this.events.push(event);
  }
  async saveApproved(payload: ApprovedResolverKnowledgePayload) {
    const index = this.approved.findIndex((value) => value.candidateId === payload.candidateId);
    if (index < 0) this.approved.push(payload);
    else this.approved[index] = payload;
  }
  async findApprovedByCandidate(id: string) {
    return this.approved.find((value) => value.candidateId === id) ?? null;
  }
}
