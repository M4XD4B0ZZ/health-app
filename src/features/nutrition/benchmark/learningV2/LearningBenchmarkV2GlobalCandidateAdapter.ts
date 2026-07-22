import { projectResolverObservationForAggregationV2 } from '../../application/observations/ResolverObservationAggregationProjectorV2';
import { NodeCryptoResolverKnowledgeFingerprintHasher } from '../../infrastructure/knowledge/NodeCryptoResolverKnowledgeFingerprintHasher';
import { InMemoryResolverKnowledgeContributionLedgerRepository } from '../../infrastructure/knowledge/InMemoryResolverKnowledgeContributionLedgerRepository';
import {
  InMemoryResolverKnowledgeReviewCandidateReader,
  InMemoryResolverKnowledgeReviewRepository,
} from '../../infrastructure/knowledge/InMemoryResolverKnowledgeReviewRepository';
import { ResolverKnowledgeReviewService } from '../../application/knowledge/ResolverKnowledgeReviewService';
import { ResolverKnowledgeShadowEvaluator } from '../../application/shadow/ResolverKnowledgeShadowEvaluator';
import { ResolverKnowledgeShadowCorpusRegistry } from '../../application/shadow/ResolverKnowledgeShadowCorpusRegistry';
import { RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION } from '../../domain/models/ResolverKnowledgeShadowCorpusRegistry';
import {
  RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
  type ResolverKnowledgeShadowEvaluationRequest,
} from '../../domain/models/ResolverKnowledgeShadowEvaluation';
import { projectResolverDecisionForShadowEvaluation } from '../../domain/models/ResolverProductionDecisionProjection';
import type { ResolverDecision } from '../../domain/models/ResolverDecision';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidate,
  type ResolverKnowledgeCandidateLifecycleEvent,
} from '../../domain/models/ResolverKnowledgeCandidate';
import { RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeContributionLedger';
import {
  RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
  RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
} from '../../domain/models/ResolverKnowledgeReview';
import type { ResolverObservation } from '../../domain/models/ResolverObservation';
import type {
  LearningBenchmarkV2FixtureObservationInput,
  LearningBenchmarkV2GlobalCandidateScenario,
  LearningBenchmarkV2GlobalCandidateStep,
} from './LearningBenchmarkV2Types';
import { LearningBenchmarkV2DeterministicClock } from './LearningBenchmarkV2DeterministicClock';

/**
 * RESOLVER-V3-023 authorized benchmark consumer of the RESOLVER-V3-031/032 in-memory reference
 * implementations (see the corresponding allowlist entries added to
 * `ResolverKnowledgeAggregationV2Isolation.test.ts` and
 * `ResolverKnowledgeContributionLedgerIsolation.test.ts`). This is the *only* Learning Benchmark V2
 * file permitted to reference those symbols directly -- every other benchmark file interacts only
 * with the plain-data outcome types this module exports, never with the underlying candidate/ledger
 * types by name. It reuses the real recording planner, terminal-chain resolver, replay-summary
 * calculator, review service, and shadow evaluator; it never reimplements any of their decisions.
 */

export interface LearningBenchmarkV2GlobalCandidateStepOutcome {
  stepId: string;
  kind: LearningBenchmarkV2GlobalCandidateStep['kind'];
  actualStatus: string;
  candidateId?: string;
  observed?: Readonly<Record<string, unknown>>;
  /** Generic, data-driven correlation fields for `review_decision` steps -- filtering invariant
   * checks on these (rather than a hardcoded scenarioId/stepId literal) keeps invariant evaluation
   * scenario-agnostic (binding requirement §17 leakage prevention). */
  action?: string;
  decisionId?: string;
  forcedIndependentUserEvidence?: boolean;
  forcedContradiction?: boolean;
}

export interface LearningBenchmarkV2GlobalCandidateOperationCounts {
  contributionsRecorded: number;
  idempotentRetriesSkipped: number;
  contributionConflicts: number;
  candidatesCreated: number;
  reviewOperations: number;
  retractionsApplied: number;
  retractionIdempotentRetries: number;
  shadowEvaluations: number;
  replayComputations: number;
}

export interface LearningBenchmarkV2GlobalCandidateScenarioOutcome {
  scenarioId: string;
  /** Generic scenario tags (part of the corpus schema, like `difficulty`) -- used by the
   * scenario-agnostic invariant evaluator to select relevant scenarios without matching on a
   * hardcoded scenarioId literal. */
  tags: readonly string[];
  stepOutcomes: readonly LearningBenchmarkV2GlobalCandidateStepOutcome[];
  operationCounts: LearningBenchmarkV2GlobalCandidateOperationCounts;
  /** Global candidate rows as they exist at the end of the scenario, exposed only through a
   * privacy-safe plain-data view (never the raw domain type name, so downstream evaluator/report
   * files never need to import banned symbols themselves). */
  finalCandidates: readonly {
    candidateId: string;
    status: string;
    supportingEvidenceCount: number;
    contradictingEvidenceCount: number;
    contradictionStatus: string;
    independentUserEvidence: string;
  }[];
}

function buildFixtureObservation(
  input: LearningBenchmarkV2FixtureObservationInput,
): ResolverObservation {
  return {
    contractVersion: 'resolver-observation-v1',
    observationId: input.observationId,
    resolverRunId: input.resolverRunId,
    occurredAt: input.occurredAt,
    input: {
      rawInput: input.rawInput,
      normalizedInput: input.normalizedInput,
      locale: input.locale,
      inputType: input.inputType,
    },
    decision: {
      outcome: input.outcome,
      reasonCodes: [...input.reasonCodes],
      candidateCount: input.candidateCount,
      // The real V1 `ResolverObservation` requires a source `id`; the V2 projector strips it
      // structurally regardless of its value (verified: `ResolverObservationAggregationProjectionV2
      // .selectedSource` has no `id` field at all), so a fixture placeholder is safe here.
      selectedSource: input.selectedSource
        ? { type: input.selectedSource.type, id: 'benchmark-fixture-source-id' }
        : null,
      provenanceStatus: input.provenanceStatus,
    },
    versions: { resolverVersion: input.resolverVersion },
    operational: { totalLatencyMs: input.totalLatencyMs },
  };
}

function buildFixtureResolverDecision(
  status: 'accepted' | 'ambiguous' | 'rejected',
  sourceType: 'bls' | 'off' | 'usda' | 'user' | 'ai' | 'none',
): ResolverDecision {
  if (sourceType === 'none' || status !== 'accepted') {
    return {
      normalizedQuery: '',
      status,
      reasonCodes: [],
      candidates: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }
  const food = {
    id: 'shadow-fixture-food',
    name: 'shadow fixture food',
    normalizedName: 'shadow fixture food',
    macrosPer100g: { kcal: 100, protein: 5, carbs: 10, fat: 2 },
    source: sourceType,
  };
  const candidate = {
    id: 'shadow-fixture-candidate',
    source: sourceType,
    food,
    score: 0.9,
    breakdown: {
      matchScore: 0.9,
      dataQualityScore: 0.9,
      kcalConsistencyScore: 0.9,
      sourceTrustScore: 0.9,
      finalScore: 0.9,
      notes: [],
    },
  };
  return {
    normalizedQuery: '',
    status,
    reasonCodes: [],
    candidates: [candidate],
    best: candidate,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

class GlobalCandidateWorld {
  readonly candidates: ResolverKnowledgeCandidate[] = [];
  readonly events: ResolverKnowledgeCandidateLifecycleEvent[] = [];
  private readonly hasher = new NodeCryptoResolverKnowledgeFingerprintHasher();
  private readonly ledgerRepo = new InMemoryResolverKnowledgeContributionLedgerRepository(
    this,
    this.hasher,
  );
  private readonly reviewReader = new InMemoryResolverKnowledgeReviewCandidateReader(this);
  private readonly reviewRepo = new InMemoryResolverKnowledgeReviewRepository(this);
  private readonly reviewService = new ResolverKnowledgeReviewService(
    {
      authorizeDeveloperReview: async () => ({
        authorized: true,
        reviewerId: 'benchmark-reviewer-1',
      }),
    },
    this.reviewReader,
    this.reviewRepo,
  );
  private readonly shadowEvaluator = new ResolverKnowledgeShadowEvaluator();
  private readonly stepIdToCandidateId = new Map<string, string>();
  private readonly stepIdToContributionId = new Map<string, string>();
  private readonly retractionOccurredAtByActionId = new Map<string, string>();
  readonly counts: LearningBenchmarkV2GlobalCandidateOperationCounts = {
    contributionsRecorded: 0,
    idempotentRetriesSkipped: 0,
    contributionConflicts: 0,
    candidatesCreated: 0,
    reviewOperations: 0,
    retractionsApplied: 0,
    retractionIdempotentRetries: 0,
    shadowEvaluations: 0,
    replayComputations: 0,
  };

  private clock = new LearningBenchmarkV2DeterministicClock();

  async runStep(
    step: LearningBenchmarkV2GlobalCandidateStep,
  ): Promise<LearningBenchmarkV2GlobalCandidateStepOutcome> {
    switch (step.kind) {
      case 'record_contribution':
        return this.recordContribution(step);
      case 'review_decision':
        return this.reviewDecision(step);
      case 'retract_contributions':
        return this.retractContributions(step);
      case 'assert_replay_summary':
        return this.assertReplaySummary(step);
      case 'shadow_evaluate':
        return this.shadowEvaluate(step);
    }
  }

  private async recordContribution(
    step: Extract<LearningBenchmarkV2GlobalCandidateStep, { kind: 'record_contribution' }>,
  ): Promise<LearningBenchmarkV2GlobalCandidateStepOutcome> {
    const observation = buildFixtureObservation(step.observation);
    const projectionResult = projectResolverObservationForAggregationV2(observation);
    if (projectionResult.status !== 'projected') {
      return {
        stepId: step.stepId,
        kind: step.kind,
        actualStatus: 'failed',
        observed: { reason: projectionResult.reason },
      };
    }

    const explicitOriginalTargetCandidateId = step.explicitOriginalTargetStepId
      ? (this.stepIdToCandidateId.get(step.explicitOriginalTargetStepId) ?? null)
      : null;
    const candidateCountBefore = this.candidates.length;

    const result = await this.ledgerRepo.recordContribution({
      observationId: step.observation.observationId,
      resolverRunId: step.observation.resolverRunId,
      candidateContractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
      incomingPayload: step.payload,
      projection: projectionResult.projection,
      explicitOriginalTargetCandidateId,
      now: this.clock.next(),
    });

    if (result.status === 'recorded') {
      this.counts.contributionsRecorded += 1;
      if (this.candidates.length > candidateCountBefore) this.counts.candidatesCreated += 1;
      this.stepIdToCandidateId.set(step.stepId, result.candidateId);
      this.stepIdToContributionId.set(step.stepId, result.contributionId);
    } else if (result.status === 'already_recorded') {
      this.counts.idempotentRetriesSkipped += 1;
      this.stepIdToCandidateId.set(step.stepId, result.candidateId);
      this.stepIdToContributionId.set(step.stepId, result.contributionId);
    } else if (result.status === 'conflict') {
      this.counts.contributionConflicts += 1;
    }

    return {
      stepId: step.stepId,
      kind: step.kind,
      actualStatus: result.status,
      candidateId: 'candidateId' in result ? result.candidateId : undefined,
    };
  }

  private markPendingReview(candidateId: string): void {
    const candidate = this.candidates.find((c) => c.candidateId === candidateId);
    if (!candidate || candidate.status !== 'candidate') return;
    candidate.status = 'pending_review';
    candidate.updatedAt = this.clock.next();
    this.events.push({
      eventId: `${candidateId}:${this.events.length + 1}`,
      candidateId,
      previousStatus: 'candidate',
      nextStatus: 'pending_review',
      reasonCode: 'READY_FOR_REVIEW',
      actorType: 'system',
      payloadVersion: candidate.contractVersion,
      occurredAt: candidate.updatedAt,
    });
  }

  private async reviewDecision(
    step: Extract<LearningBenchmarkV2GlobalCandidateStep, { kind: 'review_decision' }>,
  ): Promise<LearningBenchmarkV2GlobalCandidateStepOutcome> {
    const candidateId = this.stepIdToCandidateId.get(step.candidateStepId);
    if (!candidateId) {
      return { stepId: step.stepId, kind: step.kind, actualStatus: 'candidate_not_found' };
    }
    const candidate = this.candidates.find((c) => c.candidateId === candidateId);
    if (!candidate)
      return { stepId: step.stepId, kind: step.kind, actualStatus: 'candidate_not_found' };

    this.markPendingReview(candidateId);

    // Fixture-only, clearly-labeled synthetic evidence injection to isolate the review-policy
    // question ("once independent-user evidence is hypothetically satisfied, does contradiction
    // still block approval?") -- this does NOT claim RESOLVER-V3-035 or a production
    // independent-user aggregation mechanism exists.
    if (step.forceIndependentUserEvidence) {
      candidate.evidence = {
        ...candidate.evidence,
        independentUserEvidence: step.forceIndependentUserEvidence,
      };
    }
    if (step.forceContradiction) {
      candidate.evidence = {
        ...candidate.evidence,
        contradictionStatus: 'present',
        contradictingEvidenceCount: Math.max(1, candidate.evidence.contradictingEvidenceCount),
      };
    }

    const targetCandidateId = step.targetCandidateStepId
      ? this.stepIdToCandidateId.get(step.targetCandidateStepId)
      : undefined;

    const base = {
      decisionId: step.decisionId,
      candidateId,
      // Deterministically derived from decisionId (not the incrementing clock) so an exact retry
      // of the same decisionId reproduces byte-identical request content -- required for the real
      // review service's idempotency comparison, which includes `occurredAt`.
      occurredAt: `occurred-at:${step.decisionId}`,
      reviewContractVersion: RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
      privacyPolicyVersion: RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
      candidateVersionAtDecision: candidate.updatedAt,
      riskDecision: step.riskDecision,
      localeRestriction: step.localeRestriction,
      reasonCode: step.reasonCode,
    };

    const request =
      step.action === 'mark_duplicate' || step.action === 'supersede'
        ? { ...base, action: step.action, targetCandidateId: targetCandidateId ?? '' }
        : { ...base, action: step.action };

    this.counts.reviewOperations += 1;
    const result = await this.reviewService.review(
      request as unknown as Parameters<ResolverKnowledgeReviewService['review']>[0],
    );
    return {
      stepId: step.stepId,
      kind: step.kind,
      actualStatus: result,
      candidateId,
      action: step.action,
      decisionId: step.decisionId,
      forcedIndependentUserEvidence: Boolean(step.forceIndependentUserEvidence),
      forcedContradiction: Boolean(step.forceContradiction),
    };
  }

  private resolveSelector(selector: unknown): unknown {
    if (
      selector &&
      typeof selector === 'object' &&
      (selector as { kind?: unknown }).kind === 'contribution_ids' &&
      Array.isArray((selector as { contributionIds?: unknown }).contributionIds)
    ) {
      const stepRefs = (selector as { contributionIds: readonly string[] }).contributionIds;
      return {
        kind: 'contribution_ids',
        contributionIds: stepRefs.map((ref) => this.stepIdToContributionId.get(ref) ?? ref),
      };
    }
    return selector;
  }

  private async retractContributions(
    step: Extract<LearningBenchmarkV2GlobalCandidateStep, { kind: 'retract_contributions' }>,
  ): Promise<LearningBenchmarkV2GlobalCandidateStepOutcome> {
    // Real ledger validation requires a parseable timestamp (unlike review's occurredAt, which is
    // format-free); cached per retractionActionId so an exact retry reproduces byte-identical
    // request content for the real ledger's idempotency comparison.
    let occurredAt = this.retractionOccurredAtByActionId.get(step.retractionActionId);
    if (!occurredAt) {
      occurredAt = this.clock.next();
      this.retractionOccurredAtByActionId.set(step.retractionActionId, occurredAt);
    }
    const request = {
      ledgerContractVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
      retractionActionId: step.retractionActionId,
      reason: step.reason,
      selector: this.resolveSelector(step.selector),
      occurredAt,
    };
    const result = await this.ledgerRepo.retractContributions(request);
    if (result.status === 'applied') this.counts.retractionsApplied += 1;
    if (result.status === 'already_recorded') this.counts.retractionIdempotentRetries += 1;
    return { stepId: step.stepId, kind: step.kind, actualStatus: result.status };
  }

  private assertReplaySummary(
    step: Extract<LearningBenchmarkV2GlobalCandidateStep, { kind: 'assert_replay_summary' }>,
  ): LearningBenchmarkV2GlobalCandidateStepOutcome {
    this.counts.replayComputations += 1;
    const candidateId = this.stepIdToCandidateId.get(step.candidateStepId);
    const candidate = candidateId
      ? this.candidates.find((c) => c.candidateId === candidateId)
      : undefined;
    if (!candidate) return { stepId: step.stepId, kind: step.kind, actualStatus: 'not_found' };
    return {
      stepId: step.stepId,
      kind: step.kind,
      actualStatus: candidate.status,
      candidateId: candidate.candidateId,
      observed: {
        supportingEvidenceCount: candidate.evidence.supportingEvidenceCount,
        contradictingEvidenceCount: candidate.evidence.contradictingEvidenceCount,
        contradictionStatus: candidate.evidence.contradictionStatus,
      },
    };
  }

  private shadowEvaluate(
    step: Extract<LearningBenchmarkV2GlobalCandidateStep, { kind: 'shadow_evaluate' }>,
  ): LearningBenchmarkV2GlobalCandidateStepOutcome {
    const candidateId = this.stepIdToCandidateId.get(step.candidateStepId);
    const candidate = candidateId
      ? this.candidates.find((c) => c.candidateId === candidateId)
      : undefined;
    if (!candidate)
      return { stepId: step.stepId, kind: step.kind, actualStatus: 'candidate_not_found' };

    const registry = new ResolverKnowledgeShadowCorpusRegistry({
      registryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
      entries: [{ caseId: step.caseId, partition: 'development' }],
    });
    const decision = buildFixtureResolverDecision(step.productionStatus, step.productionSourceType);
    const productionDecisionProjection = projectResolverDecisionForShadowEvaluation(decision);

    const request: ResolverKnowledgeShadowEvaluationRequest = {
      evaluationVersion: RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
      caseId: step.caseId,
      locale: candidate.payload.locale,
      inputType: step.inputType,
      productionDecisionProjection,
      candidate: {
        candidateId: candidate.candidateId,
        fingerprint: candidate.fingerprint,
        candidateType: candidate.candidateType,
        candidateVersion: candidate.contractVersion,
        payload: candidate.payload,
      },
      resolverVersion: 'learning-benchmark-v2-shadow-fixture',
      corpusPartition: 'development',
      groundTruth: {
        evidenceVersion: 'resolver-knowledge-shadow-ground-truth-v1',
        evidenceClass: 'unknown',
      },
    };

    this.counts.shadowEvaluations += 1;
    const result = this.shadowEvaluator.evaluate(request, registry);
    return {
      stepId: step.stepId,
      kind: step.kind,
      actualStatus: result.delta.category,
      candidateId: candidate.candidateId,
      observed: { hypotheticalShadowStatus: result.hypotheticalShadowStatus },
    };
  }
}

export async function runLearningBenchmarkV2GlobalCandidateScenario(
  scenario: LearningBenchmarkV2GlobalCandidateScenario,
): Promise<LearningBenchmarkV2GlobalCandidateScenarioOutcome> {
  const world = new GlobalCandidateWorld();
  const stepOutcomes: LearningBenchmarkV2GlobalCandidateStepOutcome[] = [];
  for (const step of scenario.steps) {
    stepOutcomes.push(await world.runStep(step));
  }
  return {
    scenarioId: scenario.scenarioId,
    tags: scenario.tags,
    stepOutcomes,
    operationCounts: world.counts,
    finalCandidates: world.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      status: candidate.status,
      supportingEvidenceCount: candidate.evidence.supportingEvidenceCount,
      contradictingEvidenceCount: candidate.evidence.contradictingEvidenceCount,
      contradictionStatus: candidate.evidence.contradictionStatus,
      independentUserEvidence: candidate.evidence.independentUserEvidence,
    })),
  };
}
