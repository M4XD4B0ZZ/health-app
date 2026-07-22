import { REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION } from './RepresentativeHybridBenchmarkTypes';
import type { RepresentativeHybridBenchmarkContradictionGateScenario } from './RepresentativeHybridBenchmarkTypes';
import type { LearningBenchmarkV2FixtureObservationInput } from '../learningV2/LearningBenchmarkV2Types';

/**
 * RESOLVER-V3-038 contradiction-gate scenarios: the first half of the split that fixes the
 * RESOLVER-V3-024 §24 frozen-fixture coupling (`LBV2-GC-DEV-006` combined a forced-contradiction
 * approval attempt AND a rollback of the same candidate in one scenario). Every scenario here tests
 * only approve/reject/quarantine/duplicate/supersession outcomes against
 * `ResolverKnowledgeReviewService`'s real, post-RESOLVER-V3-037 `blocked_contradiction` gate
 * (`src/features/nutrition/application/knowledge/ResolverKnowledgeReviewService.ts`) --
 * `RepresentativeHybridBenchmarkValidator.ts` fails closed if any `rollback`/`revoke_approval` step
 * appears here.
 *
 * `expectedResult` values reflect the real, current (post-RESOLVER-V3-037) service behavior read
 * directly from source: a forced-contradiction approve attempt (`contradictionStatus: 'present'`,
 * nonzero `contradictingEvidenceCount`) returns `blocked_contradiction` unconditionally, with no risk-
 * level threshold; a default (`not_evaluable`) independent-user-evidence approve attempt returns
 * `blocked_privacy`. This task does not execute these steps against the real service (RESOLVER-V3-038
 * non-goal: no production wiring) -- that is deferred to a future harness wiring
 * (mirrors RESOLVER-V3-023's `LearningBenchmarkV2GlobalCandidateAdapter.ts` precedent), so
 * `groundTruthClass` is `not_evaluable` throughout this file, not `fixture-derived`.
 */

const CV = REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION;

function observation(
  overrides: Partial<LearningBenchmarkV2FixtureObservationInput> & { observationId: string },
): LearningBenchmarkV2FixtureObservationInput {
  return {
    resolverRunId: `${overrides.observationId}-run`,
    rawInput: 'representative hybrid benchmark fixture raw input',
    normalizedInput: 'representative hybrid benchmark fixture raw input',
    locale: 'de',
    inputType: 'generic',
    outcome: 'accepted',
    candidateCount: 1,
    selectedSource: { type: 'bls' },
    provenanceStatus: 'source_grounded',
    resolverVersion: 'representative-hybrid-benchmark-fixture-resolver-v1',
    totalLatencyMs: 10,
    reasonCodes: [],
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const routingPayload = (sourceType: 'bls' | 'off' | 'usda' = 'bls') => ({
  type: 'source-routing-pattern' as const,
  locale: 'de' as const,
  inputType: 'generic',
  sourceType,
});

export const REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_DEVELOPMENT: readonly RepresentativeHybridBenchmarkContradictionGateScenario[] =
  [
    {
      scenarioId: 'RHB-CG-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'contradiction_gate_sequence',
      difficulty: 'easy',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['single-user-evidence-blocks-approval'],
      reproducibilityNotes:
        'Not yet executed by this task (design/corpus-authoring only). Default independent-user ' +
        'evidence (not_evaluable) approve attempt; contradiction-free.',
      tags: ['single-user-block', 'contradiction-gate-free'],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('bls'),
          observation: observation({ observationId: 'rhb-cg-dev-001-a' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approveAttempt',
          decisionId: 'decision-rhb-cg-dev-001',
          candidateStepId: 'candidate',
          action: 'approve',
          reasonCode: 'INDEPENDENT_EVIDENCE_CONFIRMED',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'blocked_privacy',
        },
      ],
    },
    {
      scenarioId: 'RHB-CG-DEV-002',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'contradiction_gate_sequence',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['contradiction-blocks-approval-even-with-confirmed-evidence'],
      reproducibilityNotes:
        'Not yet executed by this task. Forced independent-user evidence confirmed AND forced ' +
        'contradiction present -- isolates whether the RESOLVER-V3-037 contradiction gate blocks ' +
        'approval independent of independent-user evidence, without any rollback step (RESOLVER-V3-024 ' +
        '§24 frozen-fixture-coupling fix). This is not a claim that RESOLVER-V3-035/independent-user ' +
        'aggregation exists in production -- see RESOLVER-V3-038 corpus header.',
      tags: ['contradiction-gate', 'no-rollback'],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('off'),
          observation: observation({ observationId: 'rhb-cg-dev-002-a' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approveAttempt',
          decisionId: 'decision-rhb-cg-dev-002',
          candidateStepId: 'candidate',
          action: 'approve',
          reasonCode: 'INDEPENDENT_EVIDENCE_CONFIRMED',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          forceIndependentUserEvidence: 'independently_confirmed',
          forceContradiction: true,
          expectedResult: 'blocked_contradiction',
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_HOLDOUT: readonly RepresentativeHybridBenchmarkContradictionGateScenario[] =
  [
    {
      scenarioId: 'RHB-CG-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'contradiction_gate_sequence',
      difficulty: 'adversarial',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['contradiction-blocks-approval-regardless-of-risk-level'],
      reproducibilityNotes:
        'Holdout-only case; never used during harness/corpus development. Forced contradiction on a ' +
        'high-risk candidate, confirming no risk-level threshold exists for the contradiction gate.',
      tags: ['contradiction-gate', 'no-rollback', 'holdout'],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('usda'),
          observation: observation({ observationId: 'rhb-cg-hold-001-a' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approveAttempt',
          decisionId: 'decision-rhb-cg-hold-001',
          candidateStepId: 'candidate',
          action: 'approve',
          reasonCode: 'INDEPENDENT_EVIDENCE_CONFIRMED',
          riskDecision: 'high',
          localeRestriction: 'not_applicable',
          forceIndependentUserEvidence: 'independently_confirmed',
          forceContradiction: true,
          expectedResult: 'blocked_contradiction',
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_SCENARIOS: readonly RepresentativeHybridBenchmarkContradictionGateScenario[] =
  [
    ...REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_DEVELOPMENT,
    ...REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_HOLDOUT,
  ];
