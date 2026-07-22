import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import type { LearningBenchmarkV2FixtureObservationInput } from '../learningV2/LearningBenchmarkV2Types';
import type {
  ResolverKnowledgeReviewAction,
  ResolverKnowledgeReviewLocaleRestriction,
  ResolverKnowledgeReviewResult,
} from '../../domain/models/ResolverKnowledgeReview';
import type { ResolverKnowledgeCandidate } from '../../domain/models/ResolverKnowledgeCandidate';

/**
 * RESOLVER-V3-038: successor benchmark contract, created as the required concrete follow-up to
 * RESOLVER-V3-024's `NOT_PASSED` gate verdict (see
 * `reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` §26/§27). This
 * contract is entirely new and additive: it does not import, edit, or extend the frozen
 * `resolver-learning-benchmark-v2-corpus-1.0.0` corpus data (`../learningV2/*Corpus.ts`), which
 * remains immutable history per RESOLVER-V3-023's corpus-freeze protocol. Only the generic,
 * data-only observation-fixture shape (`LearningBenchmarkV2FixtureObservationInput`) is reused (a
 * type import has no effect on the frozen corpus's data or version), consistent with this
 * repository's existing convention of reusing rather than reinventing shared vocabulary (e.g.
 * `BenchmarkCase` is already shared across Variant A/B/C and Learning Benchmark V2). Candidate-
 * lifecycle steps here use a locally-defined step type built directly from the real, current
 * `ResolverKnowledgeReviewAction`/`ResolverKnowledgeReviewResult` domain types
 * (`../../domain/models/ResolverKnowledgeReview.ts`) rather than V1's `LearningBenchmarkV2GlobalCandidateStep`,
 * because that V1 step type's `expectedResult` union predates and does not include
 * `'blocked_contradiction'` (added to the domain model by RESOLVER-V3-037, after V1's corpus froze) --
 * reusing it here would make it impossible to correctly express the very gate this corpus exists to
 * exercise.
 *
 * Design differences from `resolver-learning-benchmark-v2-corpus-1.0.0`, each directly answering a
 * RESOLVER-V3-024 finding:
 * - Resolution/decomposition scenarios declare `executionEngine: 'hybrid_c'` (a fixed literal) --
 *   RESOLVER-V3-024 found that Learning Benchmark V2's resolution scenarios only ever exercised
 *   Variant A (zero AI), never live Hybrid C, so no representative Hybrid C evidence has ever been
 *   collected (§12/§13/§26.1). This contract's harness contract point is that a future execution
 *   (RESOLVER-V3-039) MUST route these scenarios through the Hybrid C adapter, not Variant A.
 * - `global_candidate_sequence` is split into two disjoint scenario types,
 *   `contradiction_gate_sequence` and `rollback_sequence`, each carrying its own steps. This is the
 *   structural fix for the frozen-fixture coupling RESOLVER-V3-024 §24 documented: the single V1
 *   scenario `LBV2-GC-DEV-006` tested a forced-contradiction approval AND then rolled back that same
 *   candidate, so RESOLVER-V3-037's later contradiction-gate fix changed that one fixture's outcome
 *   on an axis (rollback) it was never meant to test. `RepresentativeHybridBenchmarkValidator.ts`
 *   enforces the split at the type-contract level (not just by convention): a
 *   `contradiction_gate_sequence` scenario may never contain a `rollback`/`revoke_approval` step, and
 *   a `rollback_sequence` scenario may never contain a `forceContradiction: true` step.
 *
 * No live provider call, no production wiring, and no change to any RESOLVER-V3-023 v1 corpus file
 * is introduced by this contract (RESOLVER-V3-038 scope/non-goals).
 */
export const REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION =
  'resolver-representative-hybrid-benchmark-corpus-1.0.0';
export const REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION =
  'resolver-representative-hybrid-benchmark-registry-v1';
export const REPRESENTATIVE_HYBRID_BENCHMARK_HARNESS_CONTRACT_VERSION = '1.0.0';

export type RepresentativeHybridBenchmarkPartition = 'development' | 'holdout';

export type RepresentativeHybridBenchmarkScenarioType =
  | 'resolution_decomposition_hybrid_c'
  | 'contradiction_gate_sequence'
  | 'rollback_sequence';

export type RepresentativeHybridBenchmarkDifficulty = 'easy' | 'medium' | 'hard' | 'adversarial';

export type RepresentativeHybridBenchmarkGroundTruthClass =
  | 'measured'
  | 'fixture-derived'
  | 'unknown'
  | 'not_evaluable';

/** Fields every scenario, regardless of type, must carry -- mirrors the binding field set already
 * accepted for `resolver-learning-benchmark-v2-corpus-1.0.0` (see its spec §2), so a future reader
 * does not have to learn a second unrelated vocabulary for the same kind of evidence record. */
export interface RepresentativeHybridBenchmarkScenarioBase {
  scenarioId: string;
  corpusVersion: typeof REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION;
  partition: RepresentativeHybridBenchmarkPartition;
  scenarioType: RepresentativeHybridBenchmarkScenarioType;
  difficulty: RepresentativeHybridBenchmarkDifficulty;
  groundTruthClass: RepresentativeHybridBenchmarkGroundTruthClass;
  personalDataFree: true;
  expectedInvariantOutcomes: readonly string[];
  reproducibilityNotes: string;
  tags: readonly string[];
  fixtureVersionsUsed: readonly string[];
}

/**
 * `executionEngine` is a fixed literal (`'hybrid_c'`), not a free-form field -- this contract has no
 * "run against Variant A" option. That decision was made deliberately once, here, rather than left
 * as a per-scenario choice a future task/PR could quietly default back to Variant A (RESOLVER-V3-024
 * finding §12/§13). If a Variant A comparison is ever wanted again for this corpus, that requires an
 * explicit new corpus version, not a field flip on this one.
 */
export interface RepresentativeHybridBenchmarkResolutionScenario extends RepresentativeHybridBenchmarkScenarioBase {
  scenarioType: 'resolution_decomposition_hybrid_c';
  executionEngine: 'hybrid_c';
  case: BenchmarkCase;
}

/** Candidate-lifecycle step vocabulary for this contract, built from the real, current domain
 * result/action types (not V1's now-stale `expectedResult` union -- see the module docstring). */
export type RepresentativeHybridBenchmarkCandidateStep =
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
      action: ResolverKnowledgeReviewAction;
      reasonCode: string;
      riskDecision: ResolverKnowledgeCandidate['risk'];
      localeRestriction: ResolverKnowledgeReviewLocaleRestriction;
      targetCandidateStepId?: string;
      forceIndependentUserEvidence?: 'independently_confirmed';
      forceContradiction?: boolean;
      expectedResult: ResolverKnowledgeReviewResult;
    };

/** Candidate-lifecycle steps up to and including approval/rejection/quarantine/duplicate/
 * supersession. A `rollback`/`revoke_approval` action step is a corpus-authoring error here
 * (enforced by `RepresentativeHybridBenchmarkValidator.ts`, not just by this comment). */
export interface RepresentativeHybridBenchmarkContradictionGateScenario extends RepresentativeHybridBenchmarkScenarioBase {
  scenarioType: 'contradiction_gate_sequence';
  steps: readonly RepresentativeHybridBenchmarkCandidateStep[];
}

/** Rollback/revocation/idempotent-retry steps against a candidate that reached its prior state
 * through contradiction-free evidence only. A `forceContradiction: true` step is a corpus-authoring
 * error here (enforced by `RepresentativeHybridBenchmarkValidator.ts`, not just by this comment). */
export interface RepresentativeHybridBenchmarkRollbackScenario extends RepresentativeHybridBenchmarkScenarioBase {
  scenarioType: 'rollback_sequence';
  steps: readonly RepresentativeHybridBenchmarkCandidateStep[];
}

export type RepresentativeHybridBenchmarkScenario =
  | RepresentativeHybridBenchmarkResolutionScenario
  | RepresentativeHybridBenchmarkContradictionGateScenario
  | RepresentativeHybridBenchmarkRollbackScenario;

export interface RepresentativeHybridBenchmarkRegistryEntry {
  scenarioId: string;
  partition: RepresentativeHybridBenchmarkPartition;
}

export interface RepresentativeHybridBenchmarkRegistryManifest {
  registryVersion: typeof REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION;
  entries: readonly RepresentativeHybridBenchmarkRegistryEntry[];
}

export const REPRESENTATIVE_HYBRID_BENCHMARK_SCENARIO_TYPES: readonly RepresentativeHybridBenchmarkScenarioType[] =
  ['resolution_decomposition_hybrid_c', 'contradiction_gate_sequence', 'rollback_sequence'];

export const REPRESENTATIVE_HYBRID_BENCHMARK_PARTITIONS: readonly RepresentativeHybridBenchmarkPartition[] =
  ['development', 'holdout'];

/** Required `BenchmarkCategory` coverage per RESOLVER-V3-024 §26.1 / ROADMAP RESOLVER-V3-038 scope
 * item (e); checked by `RepresentativeHybridBenchmarkValidator.ts`'s corpus-level coverage check,
 * never by convention alone. */
export const REPRESENTATIVE_HYBRID_BENCHMARK_REQUIRED_CATEGORIES = [
  'DACH',
  'COMPOSED',
  'HOMEMADE',
  'RESTAURANT',
  'SIMPLE',
  'HOUSEHOLD',
] as const;
