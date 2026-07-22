import { LEARNING_BENCHMARK_V2_CORPUS_VERSION } from './LearningBenchmarkV2Types';
import type { LearningBenchmarkV2PersonalMemoryScenario } from './LearningBenchmarkV2Types';

/**
 * Personal-memory Sequences A (exact confirmed repeat), B (near repeat), and C (later
 * contradiction/invalidation) per binding requirement §9 -- driven by the real
 * `RecordPersonalResolutionMemoryUseCase`/`ReadPersonalResolutionMemoryUseCase`/
 * `InvalidatePersonalResolutionMemoryUseCase` via `LearningBenchmarkV2PersonalMemoryEngine.ts`.
 * Sequences D (cross-user isolation) and E (deletion) live in
 * `LearningBenchmarkV2PrivacyCorpus.ts` as `privacy_deletion_sequence` scenarios. Fictional
 * deterministic owner IDs only; no real user identifier appears anywhere.
 */

const CV = LEARNING_BENCHMARK_V2_CORPUS_VERSION;

export const LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_DEVELOPMENT: readonly LearningBenchmarkV2PersonalMemoryScenario[] =
  [
    {
      scenarioId: 'LBV2-PM-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'personal_memory_sequence',
      locale: 'de',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['exact-repeat-avoids-interpretation-call'],
      reproducibilityNotes:
        'Unknown/unconfirmed first use, explicit confirmation, then exact repeat.',
      tags: ['sequence:A'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      sequenceKind: 'exact_confirmed_repeat',
      steps: [
        {
          kind: 'read',
          stepId: 'firstRead',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-magerquark',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-alpha',
          actionId: 'action-pm-1-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-magerquark',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'exactRepeat',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-magerquark',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
    },
    {
      scenarioId: 'LBV2-PM-DEV-002',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'personal_memory_sequence',
      locale: 'de',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['near-repeat-does-not-overgeneralize'],
      reproducibilityNotes:
        'Confirmed exact identity exists; a different (near) target must not transfer.',
      tags: ['sequence:B'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      sequenceKind: 'near_repeat',
      steps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-alpha',
          actionId: 'action-pm-2-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-magerquark',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'nearRepeat',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-magerquark-10prozent',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
    {
      scenarioId: 'LBV2-PM-DEV-003',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'personal_memory_sequence',
      locale: 'de',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['contradiction-invalidates-stale-reuse'],
      reproducibilityNotes:
        'Confirmed memory, later contradiction, exact repeat no longer deterministically reused.',
      tags: ['sequence:C'],
      fixtureVersionsUsed: [
        'personal-resolution-memory-v1',
        'personal-resolution-memory-invalidation-v1',
      ],
      sequenceKind: 'later_contradiction_invalidation',
      steps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-alpha',
          actionId: 'action-pm-3-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-hafermilch',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'confirmedRepeat',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-hafermilch',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
        {
          kind: 'invalidate',
          stepId: 'contradict',
          ownerId: 'owner-fixture-alpha',
          actionId: 'action-pm-3-invalidate',
          targetMemoryStepId: 'confirm',
          reason: 'contradiction',
          expectedStatus: 'invalidated',
        },
        {
          kind: 'read',
          stepId: 'afterContradiction',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-hafermilch',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
  ];

export const LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_HOLDOUT: readonly LearningBenchmarkV2PersonalMemoryScenario[] =
  [
    {
      scenarioId: 'LBV2-PM-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'personal_memory_sequence',
      locale: 'de',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['exact-repeat-avoids-interpretation-call-holdout'],
      reproducibilityNotes: 'Holdout-only Sequence A variant with different fixture food.',
      tags: ['sequence:A', 'holdout'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      sequenceKind: 'exact_confirmed_repeat',
      steps: [
        {
          kind: 'read',
          stepId: 'firstRead',
          ownerId: 'owner-fixture-holdout',
          sourceType: 'off',
          sourceId: 'off-fixture-proteinriegel',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-holdout',
          actionId: 'action-pm-holdout-confirm',
          sourceType: 'off',
          sourceId: 'off-fixture-proteinriegel',
          evidenceType: 'deliberately_saved_personal_meal',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'exactRepeat',
          ownerId: 'owner-fixture-holdout',
          sourceType: 'off',
          sourceId: 'off-fixture-proteinriegel',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
    },
  ];

export const LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_SCENARIOS: readonly LearningBenchmarkV2PersonalMemoryScenario[] =
  [
    ...LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_DEVELOPMENT,
    ...LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_HOLDOUT,
  ];
