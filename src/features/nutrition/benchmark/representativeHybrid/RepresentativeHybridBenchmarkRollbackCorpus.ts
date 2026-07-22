import { REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION } from './RepresentativeHybridBenchmarkTypes';
import type { RepresentativeHybridBenchmarkRollbackScenario } from './RepresentativeHybridBenchmarkTypes';
import type { LearningBenchmarkV2FixtureObservationInput } from '../learningV2/LearningBenchmarkV2Types';

/**
 * RESOLVER-V3-038 rollback scenarios: the second half of the split that fixes the RESOLVER-V3-024
 * §24 frozen-fixture coupling. Every scenario here exercises rollback/revoke_approval/idempotent-
 * retry against a candidate that reached its approved state through contradiction-free evidence only
 * (`contradictionStatus: 'none'`, no `forceContradiction` step anywhere in this file) --
 * `RepresentativeHybridBenchmarkValidator.ts` fails closed if any `forceContradiction: true` step
 * appears here. This guarantees a rollback outcome in this corpus can never again be entangled with
 * a contradiction-gate outcome, unlike the frozen `LBV2-GC-DEV-006` fixture.
 *
 * This task does not execute these steps against the real service (RESOLVER-V3-038 non-goal: no
 * production wiring); `groundTruthClass` is `not_evaluable` throughout.
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

export const REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_DEVELOPMENT: readonly RepresentativeHybridBenchmarkRollbackScenario[] =
  [
    {
      scenarioId: 'RHB-RB-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'rollback_sequence',
      difficulty: 'medium',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: [
        'rollback-deactivates-payload-without-deletion',
        'rollback-retry-is-idempotent',
      ],
      reproducibilityNotes:
        'Not yet executed by this task (design/corpus-authoring only). Contradiction-free approval ' +
        '(independent-user evidence forced confirmed, contradictionStatus none) followed by rollback ' +
        'and an idempotent rollback retry -- no forced contradiction anywhere in this scenario ' +
        '(RESOLVER-V3-024 §24 frozen-fixture-coupling fix).',
      tags: ['review-rollback', 'contradiction-free'],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('off'),
          observation: observation({ observationId: 'rhb-rb-dev-001-a' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approve',
          decisionId: 'decision-rhb-rb-dev-001-approve',
          candidateStepId: 'candidate',
          action: 'approve',
          reasonCode: 'INDEPENDENT_EVIDENCE_CONFIRMED',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          forceIndependentUserEvidence: 'independently_confirmed',
          expectedResult: 'applied',
        },
        {
          kind: 'review_decision',
          stepId: 'rollback',
          decisionId: 'decision-rhb-rb-dev-001-rollback',
          candidateStepId: 'candidate',
          action: 'rollback',
          reasonCode: 'ROLLBACK_TO_PRIOR_STATE',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
        {
          kind: 'review_decision',
          stepId: 'rollbackRetry',
          decisionId: 'decision-rhb-rb-dev-001-rollback',
          candidateStepId: 'candidate',
          action: 'rollback',
          reasonCode: 'ROLLBACK_TO_PRIOR_STATE',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'already_applied',
        },
      ],
    },
    {
      scenarioId: 'RHB-RB-DEV-002',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'rollback_sequence',
      difficulty: 'medium',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['revoke-approval-deactivates-payload-without-deletion'],
      reproducibilityNotes:
        'Not yet executed by this task. Contradiction-free approval followed by an explicit ' +
        'revoke_approval action (distinct from rollback), again with no forced contradiction ' +
        'anywhere in this scenario.',
      tags: ['review-revoke-approval', 'contradiction-free'],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('bls'),
          observation: observation({ observationId: 'rhb-rb-dev-002-a' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approve',
          decisionId: 'decision-rhb-rb-dev-002-approve',
          candidateStepId: 'candidate',
          action: 'approve',
          reasonCode: 'INDEPENDENT_EVIDENCE_CONFIRMED',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          forceIndependentUserEvidence: 'independently_confirmed',
          expectedResult: 'applied',
        },
        {
          kind: 'review_decision',
          stepId: 'revoke',
          decisionId: 'decision-rhb-rb-dev-002-revoke',
          candidateStepId: 'candidate',
          action: 'revoke_approval',
          reasonCode: 'APPROVAL_REVOKED',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_HOLDOUT: readonly RepresentativeHybridBenchmarkRollbackScenario[] =
  [
    {
      scenarioId: 'RHB-RB-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'rollback_sequence',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['rollback-idempotent-retry-holdout'],
      reproducibilityNotes:
        'Holdout-only case; never used during harness/corpus development. Contradiction-free ' +
        'approval, rollback, and a repeated idempotent rollback retry.',
      tags: ['review-rollback', 'contradiction-free', 'holdout'],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('usda'),
          observation: observation({ observationId: 'rhb-rb-hold-001-a' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approve',
          decisionId: 'decision-rhb-rb-hold-001-approve',
          candidateStepId: 'candidate',
          action: 'approve',
          reasonCode: 'INDEPENDENT_EVIDENCE_CONFIRMED',
          riskDecision: 'medium',
          localeRestriction: 'not_applicable',
          forceIndependentUserEvidence: 'independently_confirmed',
          expectedResult: 'applied',
        },
        {
          kind: 'review_decision',
          stepId: 'rollback',
          decisionId: 'decision-rhb-rb-hold-001-rollback',
          candidateStepId: 'candidate',
          action: 'rollback',
          reasonCode: 'ROLLBACK_TO_PRIOR_STATE',
          riskDecision: 'medium',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
        {
          kind: 'review_decision',
          stepId: 'rollbackRetry',
          decisionId: 'decision-rhb-rb-hold-001-rollback',
          candidateStepId: 'candidate',
          action: 'rollback',
          reasonCode: 'ROLLBACK_TO_PRIOR_STATE',
          riskDecision: 'medium',
          localeRestriction: 'not_applicable',
          expectedResult: 'already_applied',
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_SCENARIOS: readonly RepresentativeHybridBenchmarkRollbackScenario[] =
  [
    ...REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_DEVELOPMENT,
    ...REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_HOLDOUT,
  ];
