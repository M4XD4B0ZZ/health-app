import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import type { ResolverKnowledgeReviewResult } from '../../domain/models/ResolverKnowledgeReview';

/**
 * RESOLVER-V3-038: successor benchmark contract. A closed, versioned, data-only discriminated
 * union, structurally mirroring `learningV2/LearningBenchmarkV2Types.ts`'s pattern (RESOLVER-V3-023)
 * but under distinct version literals on every axis (corpus/registry/harness/report-schema/
 * source-manifest), per the task's explicit "must not reuse a V3-023 version literal" requirement.
 *
 * This module does not edit `learningV2/**`. The governance-fixture step shapes below
 * (`RepresentativeHybridV1PersonalMemoryStep`/`RepresentativeHybridV1GlobalCandidateStep`)
 * intentionally do NOT type-import `learningV2/LearningBenchmarkV2Types.ts`'s equivalents: that
 * module's `GlobalCandidateStep.expectedResult` union predates RESOLVER-V3-037 and is missing the
 * real `blocked_contradiction` result the production `ResolverKnowledgeReviewService` has returned
 * since that task -- reusing it verbatim would make this successor's contradiction-gate fixture
 * (which must assert `blocked_contradiction`) untypeable. This module instead reuses the real,
 * authoritative `ResolverKnowledgeReviewResult` domain type directly, and reuses the real execution
 * *engines* (`LearningBenchmarkV2PersonalMemoryEngine.ts`,
 * `LearningBenchmarkV2GlobalCandidateAdapter.ts`) at the runner layer via a structural adapter,
 * never their step *types*. The resolution scenario type reuses `BenchmarkCase` (RESOLVER-V3-003)
 * unmodified -- the successor does not reinvent the case schema, only versions its own
 * corpus/registry/harness/report axes.
 *
 * Key difference from `learningV2`: resolution scenarios here are executed through the three-arm
 * A/B/C harness (`runRepresentativeHybridV1.ts`), never through Variant A alone, and the
 * contradiction-gate / rollback governance concerns are separate scenarios by construction (never
 * one fixture carrying both tags), closing the RESOLVER-V3-024 §24 coupling finding structurally
 * rather than by discipline.
 */

export const REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION =
  'resolver-representative-hybrid-benchmark-corpus-1.0.0';
export const REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION =
  'resolver-representative-hybrid-benchmark-registry-v1';
export const REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION = '1.0.0';
export const REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION =
  'resolver-representative-hybrid-benchmark-report-v1';
export const REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION =
  'resolver-representative-hybrid-benchmark-source-manifest-v1';

/** The `BenchmarkCase.corpusVersion` field (SemVer, validated by the reused `validateBenchmarkCase`)
 * used by every resolution scenario's inner `case` -- deliberately the numeric axis only; the long
 * `REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION` string above is the scenario-envelope's own version. */
export const REPRESENTATIVE_HYBRID_V1_CASE_SCHEMA_VERSION = '1.0.0';

export type RepresentativeHybridV1Partition = 'development' | 'holdout';

export const REPRESENTATIVE_HYBRID_V1_PARTITIONS: readonly RepresentativeHybridV1Partition[] = [
  'development',
  'holdout',
];

export type RepresentativeHybridV1ScenarioType =
  | 'resolution_decomposition'
  | 'personal_memory_sequence'
  | 'global_candidate_sequence'
  | 'privacy_deletion_sequence'
  | 'economics_sequence';

export const REPRESENTATIVE_HYBRID_V1_SCENARIO_TYPES: readonly RepresentativeHybridV1ScenarioType[] =
  [
    'resolution_decomposition',
    'personal_memory_sequence',
    'global_candidate_sequence',
    'privacy_deletion_sequence',
    'economics_sequence',
  ];

export type RepresentativeHybridV1Difficulty = 'easy' | 'medium' | 'hard' | 'adversarial';

export const REPRESENTATIVE_HYBRID_V1_DIFFICULTIES: readonly RepresentativeHybridV1Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'adversarial',
];

export type RepresentativeHybridV1GroundTruthClass =
  | 'measured'
  | 'fixture-derived'
  | 'unknown'
  | 'not_evaluable';

export const REPRESENTATIVE_HYBRID_V1_GROUND_TRUTH_CLASSES: readonly RepresentativeHybridV1GroundTruthClass[] =
  ['measured', 'fixture-derived', 'unknown', 'not_evaluable'];

/** Fields every scenario, regardless of type, must carry. */
export interface RepresentativeHybridV1ScenarioBase {
  scenarioId: string;
  corpusVersion: typeof REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION;
  partition: RepresentativeHybridV1Partition;
  scenarioType: RepresentativeHybridV1ScenarioType;
  difficulty: RepresentativeHybridV1Difficulty;
  groundTruthClass: RepresentativeHybridV1GroundTruthClass;
  personalDataFree: true;
  /** Provenance link only -- reused requirement 2/"predecessorScenarioId": this successor never
   * reuses an unchanged `LBV2-*` ID for changed content, but may record which (if any) predecessor
   * scenario motivated it. */
  predecessorScenarioId?: string;
  reproducibilityNotes: string;
  tags: readonly string[];
  fixtureVersionsUsed: readonly string[];
}

export type RepresentativeHybridV1RepeatOverlayKind =
  | 'exact_repeat'
  | 'paraphrase'
  | 'singular_plural'
  | 'number_word_vs_digit'
  | 'household_wording_equivalent'
  | 'non_equivalent_near_repeat';

export const REPRESENTATIVE_HYBRID_V1_REPEAT_OVERLAY_KINDS: readonly RepresentativeHybridV1RepeatOverlayKind[] =
  [
    'exact_repeat',
    'paraphrase',
    'singular_plural',
    'number_word_vs_digit',
    'household_wording_equivalent',
    'non_equivalent_near_repeat',
  ];

/** Links a repeat/paraphrase overlay case to exactly one base resolution scenario (requirement 8).
 * The registry (`RepresentativeHybridV1Registry.ts`) rejects an overlay whose own `partition` does
 * not match its base scenario's registered partition, so an overlay can never silently move
 * partitions independently of its base case. */
export interface RepresentativeHybridV1RepeatOverlay {
  baseScenarioId: string;
  overlayKind: RepresentativeHybridV1RepeatOverlayKind;
}

export interface RepresentativeHybridV1ResolutionScenario extends RepresentativeHybridV1ScenarioBase {
  scenarioType: 'resolution_decomposition';
  locale: 'de' | 'en';
  /** Reused unmodified from RESOLVER-V3-003 -- the successor does not redefine the case schema. */
  case: BenchmarkCase;
  /** Source-snapshot manifest IDs (`RepresentativeHybridV1SourceSnapshotManifest.ts`) this case's
   * ground truth and/or C's retrieval catalog depend on. Empty for pure-BLS/no-numeric cases. */
  sourceSnapshotRefs: readonly string[];
  repeatOverlay?: RepresentativeHybridV1RepeatOverlay;
}

/** Own copy of the personal-memory step vocabulary (structurally identical to
 * `learningV2/LearningBenchmarkV2Types.ts`'s `LearningBenchmarkV2PersonalMemoryStep` -- that one had
 * no known defect, but this successor keeps its own governance-fixture step types independent of
 * `learningV2/**` rather than importing across the frozen-history boundary). Fictional, deterministic
 * owner IDs only -- never a real user identifier. */
export type RepresentativeHybridV1PersonalMemoryStep =
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

/** Own copy of the global-candidate step vocabulary. Unlike `learningV2`'s equivalent, `
 * expectedResult` reuses the real, authoritative `ResolverKnowledgeReviewResult` domain type
 * directly (which includes `blocked_contradiction`, added by RESOLVER-V3-037) instead of a
 * hand-duplicated, now-stale literal union. */
export type RepresentativeHybridV1GlobalCandidateStep =
  | {
      kind: 'record_contribution';
      stepId: string;
      payload: unknown;
      observation: {
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
      };
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
      expectedResult: ResolverKnowledgeReviewResult;
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

export interface RepresentativeHybridV1PersonalMemoryScenario extends RepresentativeHybridV1ScenarioBase {
  scenarioType: 'personal_memory_sequence';
  sequenceKind: 'exact_confirmed_repeat' | 'near_repeat';
  steps: readonly RepresentativeHybridV1PersonalMemoryStep[];
}

export interface RepresentativeHybridV1GlobalCandidateScenario extends RepresentativeHybridV1ScenarioBase {
  scenarioType: 'global_candidate_sequence';
  steps: readonly RepresentativeHybridV1GlobalCandidateStep[];
}

export interface RepresentativeHybridV1PrivacyScenario extends RepresentativeHybridV1ScenarioBase {
  scenarioType: 'privacy_deletion_sequence';
  personalMemorySteps?: readonly RepresentativeHybridV1PersonalMemoryStep[];
  assertNoCrossUserLeak: boolean;
  assertDeletionRemovesEffect: boolean;
}

export interface RepresentativeHybridV1EconomicsScenario extends RepresentativeHybridV1ScenarioBase {
  scenarioType: 'economics_sequence';
  personalMemorySteps: readonly RepresentativeHybridV1PersonalMemoryStep[];
  expectedAvoidedCallsAtLeast: number;
}

export type RepresentativeHybridV1Scenario =
  | RepresentativeHybridV1ResolutionScenario
  | RepresentativeHybridV1PersonalMemoryScenario
  | RepresentativeHybridV1GlobalCandidateScenario
  | RepresentativeHybridV1PrivacyScenario
  | RepresentativeHybridV1EconomicsScenario;

export interface RepresentativeHybridV1RegistryEntry {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
}

export interface RepresentativeHybridV1RegistryManifest {
  registryVersion: typeof REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION;
  entries: readonly RepresentativeHybridV1RegistryEntry[];
}
