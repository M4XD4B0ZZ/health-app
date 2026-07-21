import type { ResolverKnowledgeCandidate } from '../../domain/models/ResolverKnowledgeCandidate';
import type {
  ApprovedResolverKnowledgePayload,
  ResolverKnowledgeReviewEvent,
} from '../../domain/models/ResolverKnowledgeReview';

/** Server-side authorization boundary. App-user identity and client booleans are intentionally absent. */
export interface ResolverKnowledgeReviewAuthorizer {
  isDeveloperReviewAuthorized(): Promise<boolean>;
}
export interface ResolverKnowledgeReviewCandidateReader {
  getById(candidateId: string): Promise<ResolverKnowledgeCandidate | null>;
}
export interface ResolverKnowledgeReviewRepository {
  findEventByDecisionId(decisionId: string): Promise<ResolverKnowledgeReviewEvent | null>;
  appendEvent(event: ResolverKnowledgeReviewEvent): Promise<void>;
  saveApproved(payload: ApprovedResolverKnowledgePayload): Promise<void>;
  findApprovedByCandidate(candidateId: string): Promise<ApprovedResolverKnowledgePayload | null>;
}
