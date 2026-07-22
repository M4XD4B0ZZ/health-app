import { LEARNING_BENCHMARK_V2_CORPUS_VERSION } from './LearningBenchmarkV2Types';
import type { LearningBenchmarkV2EconomicsScenario } from './LearningBenchmarkV2Types';

/**
 * Economics sequences (binding requirement §27) reusing the personal-memory real-use-case engine:
 * avoided-call economics is fundamentally the personal-memory eligibility outcome, counted from
 * actual fixture-interpretation-provider invocations, never invented.
 */

const CV = LEARNING_BENCHMARK_V2_CORPUS_VERSION;

export const LEARNING_BENCHMARK_V2_ECONOMICS_DEVELOPMENT: readonly LearningBenchmarkV2EconomicsScenario[] =
  [
    {
      scenarioId: 'LBV2-ECON-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'economics_sequence',
      locale: 'de',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['avoided-call-count-from-actual-invocations'],
      reproducibilityNotes:
        'First use calls the fixture interpreter; exact repeat avoids it twice.',
      tags: ['economics'],
      fixtureVersionsUsed: ['learning-benchmark-v2-fixture-v1'],
      personalMemorySteps: [
        {
          kind: 'read',
          stepId: 'firstUse',
          ownerId: 'owner-fixture-econ',
          sourceType: 'bls',
          sourceId: 'bls-fixture-banane',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-econ',
          actionId: 'action-econ-1-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-banane',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'repeatOne',
          ownerId: 'owner-fixture-econ',
          sourceType: 'bls',
          sourceId: 'bls-fixture-banane',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
        {
          kind: 'read',
          stepId: 'repeatTwo',
          ownerId: 'owner-fixture-econ',
          sourceType: 'bls',
          sourceId: 'bls-fixture-banane',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
      expectedAvoidedCallsAtLeast: 2,
    },
    {
      scenarioId: 'LBV2-ECON-DEV-002',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'economics_sequence',
      locale: 'de',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['mixed-sequence-operation-counts'],
      reproducibilityNotes: 'Two distinct owners/foods mixed in one sequence.',
      tags: ['economics'],
      fixtureVersionsUsed: ['learning-benchmark-v2-fixture-v1'],
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'confirmA',
          ownerId: 'owner-fixture-econ-2',
          actionId: 'action-econ-2-confirm-a',
          sourceType: 'off',
          sourceId: 'off-fixture-quark-becher',
          evidenceType: 'deliberately_saved_personal_meal',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'repeatA',
          ownerId: 'owner-fixture-econ-2',
          sourceType: 'off',
          sourceId: 'off-fixture-quark-becher',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
        {
          kind: 'read',
          stepId: 'unrelatedFirstUse',
          ownerId: 'owner-fixture-econ-2',
          sourceType: 'usda',
          sourceId: 'usda-fixture-mandeln',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
      expectedAvoidedCallsAtLeast: 1,
    },
  ];

export const LEARNING_BENCHMARK_V2_ECONOMICS_HOLDOUT: readonly LearningBenchmarkV2EconomicsScenario[] =
  [
    {
      scenarioId: 'LBV2-ECON-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'economics_sequence',
      locale: 'de',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['avoided-call-count-holdout'],
      reproducibilityNotes: 'Holdout economics sequence.',
      tags: ['economics', 'holdout'],
      fixtureVersionsUsed: ['learning-benchmark-v2-fixture-v1'],
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-econ-holdout',
          actionId: 'action-econ-holdout-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-apfel',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'repeat',
          ownerId: 'owner-fixture-econ-holdout',
          sourceType: 'bls',
          sourceId: 'bls-fixture-apfel',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
      expectedAvoidedCallsAtLeast: 1,
    },
  ];

export const LEARNING_BENCHMARK_V2_ECONOMICS_SCENARIOS: readonly LearningBenchmarkV2EconomicsScenario[] =
  [...LEARNING_BENCHMARK_V2_ECONOMICS_DEVELOPMENT, ...LEARNING_BENCHMARK_V2_ECONOMICS_HOLDOUT];
