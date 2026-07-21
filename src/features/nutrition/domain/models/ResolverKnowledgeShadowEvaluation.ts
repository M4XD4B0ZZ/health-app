import type { ResolverDecision, ResolverStatus } from './ResolverDecision';
import type {
  ResolverKnowledgeCandidatePayload,
  ResolverKnowledgeCandidateType,
} from './ResolverKnowledgeCandidate';

export const RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION =
  'resolver-knowledge-shadow-evaluation-v1' as const;
export type ResolverKnowledgeShadowCorpusPartition = 'development' | 'holdout';
export type ResolverKnowledgeShadowDeltaCategory =
  | 'no_change'
  | 'hypothetical_source_change'
  | 'hypothetical_abstention'
  | 'hypothetical_clarification'
  | 'hypothetical_provenance_warning'
  | 'blocked_locale'
  | 'not_evaluable'
  | 'invalid_candidate'
  | 'privacy_blocked';
export type ResolverKnowledgeShadowRisk = 'none' | 'low' | 'medium' | 'high';

/** Deliberately contains no raw input, owner, observation, run, or source identifier. */
export interface ResolverKnowledgeShadowCandidateSnapshot {
  candidateId: string;
  fingerprint: string;
  candidateType: ResolverKnowledgeCandidateType | string;
  candidateVersion: string;
  payload: ResolverKnowledgeCandidatePayload | Record<string, unknown>;
}
export interface ResolverKnowledgeShadowEvaluationRequest {
  evaluationVersion: typeof RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION;
  caseId: string;
  locale: 'de' | 'en';
  inputType: string;
  productionDecision: ResolverDecision;
  candidate: ResolverKnowledgeShadowCandidateSnapshot;
  resolverVersion: string;
  corpusPartition: ResolverKnowledgeShadowCorpusPartition;
  /** Optional fixture-only ground truth; never inferred from a decision. */
  fixtureExpectedStatus?: ResolverStatus;
}
export interface ResolverKnowledgeShadowDelta {
  category: ResolverKnowledgeShadowDeltaCategory;
  candidateId: string;
  candidateFingerprint: string;
  reasonCodes: readonly string[];
  risk: ResolverKnowledgeShadowRisk;
}
export interface ResolverKnowledgeShadowEvaluationResult {
  evaluationVersion: typeof RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION;
  caseId: string;
  corpusPartition: ResolverKnowledgeShadowCorpusPartition;
  productionDecision: ResolverDecision;
  hypotheticalShadowStatus: ResolverStatus;
  delta: ResolverKnowledgeShadowDelta;
  fixtureExpectedStatus?: ResolverStatus;
}
export interface ResolverKnowledgeShadowMetrics {
  evaluatedCaseCount: number;
  noChangeCount: number;
  changedDecisionCount: number;
  abstentionDeltaCount: number;
  clarificationDeltaCount: number;
  sourceRoutingDeltaCount: number;
  provenanceGapCount: number;
  falseConfidenceRegressionCount: number;
  falseConfidenceImprovementCount: number;
  localeBlockedCount: number;
  notEvaluableCount: number;
  invalidCandidateCount: number;
  identificationAccuracy: 'unknown';
  abstentionPrecision: 'unknown';
  clarificationRate: 'unknown';
  regressionCount: number;
}
