import { LEARNING_BENCHMARK_V2_CORPUS_VERSION } from './LearningBenchmarkV2Types';
import type {
  LearningBenchmarkV2FixtureObservationInput,
  LearningBenchmarkV2PrivacyScenario,
} from './LearningBenchmarkV2Types';

/**
 * Sequence D (cross-user isolation) and Sequence E (deletion) from binding requirement §9, plus a
 * global-candidate-ledger owner-deletion retraction privacy scenario, as `privacy_deletion_sequence`
 * scenarios. Fictional deterministic owner IDs only.
 */

const CV = LEARNING_BENCHMARK_V2_CORPUS_VERSION;

function observation(
  overrides: Partial<LearningBenchmarkV2FixtureObservationInput> & { observationId: string },
): LearningBenchmarkV2FixtureObservationInput {
  return {
    resolverRunId: `${overrides.observationId}-run`,
    rawInput: 'benchmark fixture raw input',
    normalizedInput: 'benchmark fixture raw input',
    locale: 'de',
    inputType: 'generic',
    outcome: 'accepted',
    candidateCount: 1,
    selectedSource: { type: 'bls' },
    provenanceStatus: 'source_grounded',
    resolverVersion: 'learning-benchmark-v2-fixture-resolver-v1',
    totalLatencyMs: 10,
    reasonCodes: [],
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const LEARNING_BENCHMARK_V2_PRIVACY_DEVELOPMENT: readonly LearningBenchmarkV2PrivacyScenario[] =
  [
    {
      scenarioId: 'LBV2-PRIV-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'privacy_deletion_sequence',
      locale: 'de',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['cross-user-personal-memory-isolation'],
      reproducibilityNotes:
        'Sequence D -- user B submits the same target user A confirmed; no hit, no leak.',
      tags: ['sequence:D'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      assertNoCrossUserLeak: true,
      assertDeletionRemovesEffect: false,
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'ownerAConfirms',
          ownerId: 'owner-fixture-a',
          actionId: 'action-priv-1-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-linsen',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'ownerBReadsSameTarget',
          ownerId: 'owner-fixture-b',
          sourceType: 'bls',
          sourceId: 'bls-fixture-linsen',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
    {
      scenarioId: 'LBV2-PRIV-DEV-002',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'privacy_deletion_sequence',
      locale: 'de',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['deletion-removes-personal-memory-effect'],
      reproducibilityNotes:
        'Sequence E -- active memory, deletion applied, subsequent read finds nothing.',
      tags: ['sequence:E'],
      fixtureVersionsUsed: [
        'personal-resolution-memory-v1',
        'personal-resolution-memory-invalidation-v1',
      ],
      assertNoCrossUserLeak: false,
      assertDeletionRemovesEffect: true,
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-alpha',
          actionId: 'action-priv-2-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-erbsen',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'beforeDeletion',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-erbsen',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
        {
          kind: 'invalidate',
          stepId: 'delete',
          ownerId: 'owner-fixture-alpha',
          actionId: 'action-priv-2-delete',
          targetMemoryStepId: 'confirm',
          reason: 'explicit_user_delete',
          expectedStatus: 'invalidated',
        },
        {
          kind: 'read',
          stepId: 'afterDeletion',
          ownerId: 'owner-fixture-alpha',
          sourceType: 'bls',
          sourceId: 'bls-fixture-erbsen',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
    {
      scenarioId: 'LBV2-PRIV-DEV-003',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'privacy_deletion_sequence',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: [
        'global-candidate-contains-no-user-reference',
        'owner-deletion-retraction',
      ],
      reproducibilityNotes:
        'Owner-deletion retraction over an explicitly supplied private contribution-ID set (RESOLVER-V3-032 §15 -- ' +
        'no owner-ID lookup is implemented or claimed); global candidate output scanned for private fields.',
      tags: ['owner-deletion', 'global-ledger'],
      fixtureVersionsUsed: ['resolver-knowledge-contribution-ledger-v1'],
      assertNoCrossUserLeak: false,
      assertDeletionRemovesEffect: false,
      globalCandidateSteps: [
        {
          kind: 'record_contribution',
          stepId: 'ownerContribution',
          payload: {
            type: 'source-routing-pattern',
            locale: 'de',
            inputType: 'generic',
            sourceType: 'bls',
          },
          observation: observation({ observationId: 'obs-priv-3' }),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'retract_contributions',
          stepId: 'ownerDeletion',
          retractionActionId: 'retraction-priv-3-owner-deletion',
          reason: 'owner_deletion',
          selector: { kind: 'contribution_ids', contributionIds: ['ownerContribution'] },
          expectedStatus: 'applied',
        },
      ],
    },
  ];

export const LEARNING_BENCHMARK_V2_PRIVACY_HOLDOUT: readonly LearningBenchmarkV2PrivacyScenario[] =
  [
    {
      scenarioId: 'LBV2-PRIV-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'privacy_deletion_sequence',
      locale: 'de',
      difficulty: 'adversarial',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      expectedInvariantOutcomes: ['cross-user-isolation-holdout'],
      reproducibilityNotes: 'Holdout Sequence D variant.',
      tags: ['sequence:D', 'holdout'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      assertNoCrossUserLeak: true,
      assertDeletionRemovesEffect: false,
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'ownerAConfirms',
          ownerId: 'owner-fixture-holdout-a',
          actionId: 'action-priv-holdout-confirm',
          sourceType: 'usda',
          sourceId: 'usda-fixture-quinoa',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'ownerBReadsSameTarget',
          ownerId: 'owner-fixture-holdout-b',
          sourceType: 'usda',
          sourceId: 'usda-fixture-quinoa',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
  ];

export const LEARNING_BENCHMARK_V2_PRIVACY_SCENARIOS: readonly LearningBenchmarkV2PrivacyScenario[] =
  [...LEARNING_BENCHMARK_V2_PRIVACY_DEVELOPMENT, ...LEARNING_BENCHMARK_V2_PRIVACY_HOLDOUT];
