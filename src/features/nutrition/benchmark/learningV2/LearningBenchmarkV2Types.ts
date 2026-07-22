import type { BenchmarkCase } from '../BenchmarkCaseTypes';

/**
 * RESOLVER-V3-023: Learning Benchmark V2 corpus contract. A closed, versioned, data-only
 * discriminated union of scenario classes. Scenarios never carry executable callbacks -- the
 * harness (`runLearningBenchmarkV2.ts`) interprets each scenario's data against real production
 * use cases/services. See `docs/domains/ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md`.
 */
export const LEARNING_BENCHMARK_V2_CORPUS_VERSION = 'resolver-learning-benchmark-v2-corpus-1.0.0';
export const LEARNING_BENCHMARK_V2_REGISTRY_VERSION = 'resolver-learning-benchmark-v2-registry-v1';
export const LEARNING_BENCHMARK_V2_HARNESS_VERSION = '1.0.0';

export type LearningBenchmarkV2Partition = 'development' | 'holdout';

export type LearningBenchmarkV2ScenarioType =
  | 'resolution_decomposition'
  | 'personal_memory_sequence'
  | 'global_candidate_sequence'
  | 'privacy_deletion_sequence'
  | 'economics_sequence';

export type LearningBenchmarkV2Difficulty = 'easy' | 'medium' | 'hard' | 'adversarial';

export type LearningBenchmarkV2GroundTruthClass =
  | 'measured'
  | 'fixture-derived'
  | 'unknown'
  | 'not_evaluable';

/** Fields every scenario, regardless of type, must carry (binding requirement §6). */
export interface LearningBenchmarkV2ScenarioBase {
  scenarioId: string;
  corpusVersion: typeof LEARNING_BENCHMARK_V2_CORPUS_VERSION;
  partition: LearningBenchmarkV2Partition;
  scenarioType: LearningBenchmarkV2ScenarioType;
  locale?: 'de' | 'en';
  difficulty: LearningBenchmarkV2Difficulty;
  groundTruthClass: LearningBenchmarkV2GroundTruthClass;
  personalDataFree: true;
  expectedInvariantOutcomes: readonly string[];
  reproducibilityNotes: string;
  tags: readonly string[];
  fixtureVersionsUsed: readonly string[];
}

export interface LearningBenchmarkV2ResolutionScenario extends LearningBenchmarkV2ScenarioBase {
  scenarioType: 'resolution_decomposition';
  locale: 'de' | 'en';
  case: BenchmarkCase;
}

/** Fictional, deterministic owner IDs only -- never a real user identifier (binding req. §3/§9). */
export type LearningBenchmarkV2PersonalMemorySequenceKind =
  | 'exact_confirmed_repeat'
  | 'near_repeat'
  | 'later_contradiction_invalidation'
  | 'cross_user_isolation'
  | 'deletion';

export type LearningBenchmarkV2PersonalMemoryStep =
  | {
      kind: 'read';
      stepId: string;
      ownerId: string;
      sourceType: string;
      sourceId: string;
      expectDeterministicReuse: boolean;
      expectAnyMatch: boolean;
    }
  | {
      kind: 'record';
      stepId: string;
      ownerId: string;
      actionId: string;
      sourceType: string;
      sourceId: string;
      evidenceType: string;
      priorMemoryId?: string;
      expectedStatus: 'written' | 'duplicate' | 'invalid_request' | 'failed';
    }
  | {
      kind: 'invalidate';
      stepId: string;
      ownerId: string;
      actionId: string;
      targetMemoryStepId: string;
      reason: string;
      expectedStatus: 'invalidated' | 'no_op' | 'already_processed' | 'blocked_owner_mismatch';
    };

export interface LearningBenchmarkV2PersonalMemoryScenario extends LearningBenchmarkV2ScenarioBase {
  scenarioType: 'personal_memory_sequence';
  sequenceKind: LearningBenchmarkV2PersonalMemorySequenceKind;
  steps: readonly LearningBenchmarkV2PersonalMemoryStep[];
}

/** Plain-data fixture observation (private, full-fidelity shape mirroring `ResolverObservation`).
 * The harness passes this through the real `projectResolverObservationForAggregationV2` producer
 * -- it is never hand-projected here, so no privacy-projection policy is duplicated. */
export interface LearningBenchmarkV2FixtureObservationInput {
  observationId: string;
  resolverRunId: string;
  rawInput: string;
  normalizedInput: string;
  locale: 'de' | 'en';
  inputType: 'generic' | 'branded' | 'ambiguous' | 'unknown';
  outcome: 'accepted' | 'ambiguous' | 'abstained' | 'technical_error';
  candidateCount: number;
  selectedSource: { type: 'bls' | 'off' | 'usda' } | null;
  provenanceStatus: 'source_grounded' | 'not_resolved';
  resolverVersion: string;
  totalLatencyMs: number | 'unknown';
  reasonCodes: readonly string[];
  occurredAt: string;
}

export type LearningBenchmarkV2GlobalCandidateStep =
  | {
      kind: 'record_contribution';
      stepId: string;
      payload: unknown;
      observation: LearningBenchmarkV2FixtureObservationInput;
      explicitOriginalTargetStepId: string | null;
      expectedStatus: 'recorded' | 'already_recorded' | 'conflict' | 'failed';
    }
  | {
      kind: 'review_decision';
      stepId: string;
      decisionId: string;
      candidateStepId: string;
      action:
        | 'approve'
        | 'reject'
        | 'needs_more_evidence'
        | 'quarantine'
        | 'mark_duplicate'
        | 'supersede'
        | 'revoke_approval'
        | 'rollback';
      reasonCode: string;
      riskDecision: 'low' | 'medium' | 'high';
      localeRestriction: 'not_applicable' | 'restricted_to_candidate_locale' | 'unknown';
      targetCandidateStepId?: string;
      forceIndependentUserEvidence?: 'independently_confirmed';
      forceContradiction?: boolean;
      expectedResult:
        | 'applied'
        | 'already_applied'
        | 'conflict'
        | 'blocked_unauthorized'
        | 'blocked_privacy'
        | 'invalid_transition'
        | 'candidate_not_found'
        | 'validation_failed'
        | 'persistence_failed';
    }
  | {
      kind: 'retract_contributions';
      stepId: string;
      retractionActionId: string;
      reason: string;
      selector: unknown;
      expectedStatus: 'applied' | 'already_recorded' | 'conflict' | 'no_op' | 'failed';
    }
  | {
      kind: 'assert_replay_summary';
      stepId: string;
      candidateStepId: string;
      expectSupportAtLeast?: number;
      expectContradictionAtLeast?: number;
      expectStatus?: string;
    }
  | {
      kind: 'shadow_evaluate';
      stepId: string;
      caseId: string;
      candidateStepId: string;
      productionStatus: 'accepted' | 'ambiguous' | 'rejected';
      productionSourceType: 'bls' | 'off' | 'usda' | 'user' | 'ai' | 'none';
      inputType: 'generic' | 'branded' | 'ambiguous';
      expectedDeltaCategory: string;
    };

export interface LearningBenchmarkV2GlobalCandidateScenario extends LearningBenchmarkV2ScenarioBase {
  scenarioType: 'global_candidate_sequence';
  steps: readonly LearningBenchmarkV2GlobalCandidateStep[];
}

export interface LearningBenchmarkV2PrivacyScenario extends LearningBenchmarkV2ScenarioBase {
  scenarioType: 'privacy_deletion_sequence';
  personalMemorySteps?: readonly LearningBenchmarkV2PersonalMemoryStep[];
  globalCandidateSteps?: readonly LearningBenchmarkV2GlobalCandidateStep[];
  assertNoCrossUserLeak: boolean;
  assertDeletionRemovesEffect: boolean;
}

export interface LearningBenchmarkV2EconomicsScenario extends LearningBenchmarkV2ScenarioBase {
  scenarioType: 'economics_sequence';
  personalMemorySteps: readonly LearningBenchmarkV2PersonalMemoryStep[];
  /** Number of fixture AI-interpretation calls expected to be avoided across the sequence. */
  expectedAvoidedCallsAtLeast: number;
}

export type LearningBenchmarkV2Scenario =
  | LearningBenchmarkV2ResolutionScenario
  | LearningBenchmarkV2PersonalMemoryScenario
  | LearningBenchmarkV2GlobalCandidateScenario
  | LearningBenchmarkV2PrivacyScenario
  | LearningBenchmarkV2EconomicsScenario;

export interface LearningBenchmarkV2RegistryEntry {
  scenarioId: string;
  partition: LearningBenchmarkV2Partition;
}

export interface LearningBenchmarkV2RegistryManifest {
  registryVersion: typeof LEARNING_BENCHMARK_V2_REGISTRY_VERSION;
  entries: readonly LearningBenchmarkV2RegistryEntry[];
}

export const LEARNING_BENCHMARK_V2_SCENARIO_TYPES: readonly LearningBenchmarkV2ScenarioType[] = [
  'resolution_decomposition',
  'personal_memory_sequence',
  'global_candidate_sequence',
  'privacy_deletion_sequence',
  'economics_sequence',
];

export const LEARNING_BENCHMARK_V2_PARTITIONS: readonly LearningBenchmarkV2Partition[] = [
  'development',
  'holdout',
];
