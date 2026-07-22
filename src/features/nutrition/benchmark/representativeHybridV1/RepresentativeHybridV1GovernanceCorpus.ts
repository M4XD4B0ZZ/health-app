import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  type RepresentativeHybridV1EconomicsScenario,
  type RepresentativeHybridV1GlobalCandidateScenario,
  type RepresentativeHybridV1PersonalMemoryScenario,
  type RepresentativeHybridV1PrivacyScenario,
} from './RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 governance-fixture scenarios (requirements 22-24): personal-memory, global-
 * candidate/review, privacy, and economics sequences, reusing the real step vocabulary and
 * execution engines from `learningV2/LearningBenchmarkV2PersonalMemoryEngine.ts` and
 * `learningV2/LearningBenchmarkV2GlobalCandidateAdapter.ts` (type-imported only in
 * `RepresentativeHybridV1Types.ts` -- no `learningV2/**` file is edited).
 *
 * Central fix over the RESOLVER-V3-024 §24 / RESOLVER-V3-037 finding: the frozen `LBV2-GC-DEV-006`
 * fixture couples a `single-user-block` check, a `contradiction-gate` check, and a `review-rollback`
 * check into ONE scenario and one candidate chain, so fixing the contradiction gate (V3-037) made the
 * rollback steps on that same candidate newly unreachable (`invalid_transition` instead of
 * `applied`/`already_applied`), even though rollback itself was never broken. The three scenarios
 * below give each concern its own scenario and its own candidate, with expectations that match the
 * CURRENT (already-fixed) production `ResolverKnowledgeReviewService` behavior from the start:
 *  - `RH-GC-DEV-PRIVACY-001`: single-user block only, no contradiction, no rollback.
 *  - `RH-GC-DEV-CONTRA-001`: contradiction gate only (`review_decision` -> `blocked_contradiction`),
 *    no rollback steps at all.
 *  - `RH-GC-DEV-ROLLBACK-001`: a legitimately-approved candidate (no contradiction forced), then
 *    rollback + an idempotent retry -- no contradiction-gate step at all.
 */

const CV = REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION;

const routingPayload = (sourceType: 'bls' | 'off' | 'usda' = 'bls') => ({
  type: 'source-routing-pattern' as const,
  locale: 'de' as const,
  inputType: 'generic',
  sourceType,
});

function observation(observationId: string, outcome: 'accepted' | 'ambiguous' = 'accepted') {
  return {
    observationId,
    resolverRunId: `${observationId}-run`,
    rawInput: 'benchmark fixture raw input',
    normalizedInput: 'benchmark fixture raw input',
    locale: 'de' as const,
    inputType: 'generic' as const,
    outcome,
    candidateCount: 1,
    selectedSource: { type: 'bls' as const },
    provenanceStatus: 'source_grounded' as const,
    resolverVersion: 'representative-hybrid-v1-fixture-resolver-v1',
    totalLatencyMs: 10,
    reasonCodes: [],
    occurredAt: '2026-07-22T00:00:00.000Z',
  };
}

export const REPRESENTATIVE_HYBRID_V1_GLOBAL_CANDIDATE_SCENARIOS: readonly RepresentativeHybridV1GlobalCandidateScenario[] =
  [
    {
      scenarioId: 'RH-GC-DEV-PRIVACY-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'global_candidate_sequence',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes:
        'Single-user evidence (no forced independent confirmation) attempting approval -- must ' +
        'block on privacy grounds alone, independent of contradiction/rollback concerns.',
      tags: ['single-user-block'],
      fixtureVersionsUsed: ['resolver-knowledge-review-v1'],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('bls'),
          observation: observation('rh-gc-privacy-1a'),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approveAttempt',
          decisionId: 'rh-gc-privacy-decision-1',
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
      scenarioId: 'RH-GC-DEV-CONTRA-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'global_candidate_sequence',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      predecessorScenarioId: 'LBV2-GC-DEV-006',
      reproducibilityNotes:
        'Contradiction-gate concern isolated onto its own candidate with no rollback steps at all ' +
        '(RESOLVER-V3-024 §24 finding: the predecessor fixture coupled this with rollback on the same ' +
        'candidate). Independent-user evidence is fixture-forced to independently_confirmed and ' +
        'contradiction is fixture-forced present -- this does NOT claim a production independent-user ' +
        'aggregation mechanism exists; it isolates whether contradiction alone still blocks approval ' +
        'once the privacy gate is hypothetically satisfied. Expectation reflects the CURRENT, already ' +
        "-fixed `blocked_contradiction` production behavior (RESOLVER-V3-037), not the predecessor's " +
        'stale pre-fix literal.',
      tags: ['contradiction-gate'],
      fixtureVersionsUsed: ['resolver-knowledge-review-v1'],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('off'),
          observation: observation('rh-gc-contra-1a'),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approveAttempt',
          decisionId: 'rh-gc-contra-decision-1',
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
    {
      scenarioId: 'RH-GC-DEV-ROLLBACK-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'global_candidate_sequence',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      predecessorScenarioId: 'LBV2-GC-DEV-006',
      reproducibilityNotes:
        'Rollback concern isolated onto its own, independently-and-legitimately-approved candidate ' +
        '(independent-user evidence forced satisfied, no contradiction forced) -- no contradiction-gate ' +
        'step at all, so a future contradiction-policy change cannot make this fixture unreachable the ' +
        'way the coupled predecessor did.',
      tags: ['review-rollback'],
      fixtureVersionsUsed: ['resolver-knowledge-review-v1'],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'candidate',
          payload: routingPayload('usda'),
          observation: observation('rh-gc-rollback-1a'),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'review_decision',
          stepId: 'approve',
          decisionId: 'rh-gc-rollback-decision-approve',
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
          decisionId: 'rh-gc-rollback-decision-rollback',
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
          decisionId: 'rh-gc-rollback-decision-rollback',
          candidateStepId: 'candidate',
          action: 'rollback',
          reasonCode: 'ROLLBACK_TO_PRIOR_STATE',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'already_applied',
        },
        {
          kind: 'review_decision',
          stepId: 'conflictingDecisionIdReuse',
          decisionId: 'rh-gc-rollback-decision-rollback',
          candidateStepId: 'candidate',
          action: 'reject',
          reasonCode: 'CONTRADICTING_EVIDENCE',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'conflict',
        },
      ],
    },
    {
      scenarioId: 'RH-GC-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'global_candidate_sequence',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes: 'Holdout idempotent-retry scenario, no contradiction/rollback concern.',
      tags: ['idempotency', 'holdout'],
      fixtureVersionsUsed: ['resolver-knowledge-fingerprint-v2'],
      steps: [
        {
          kind: 'record_contribution',
          stepId: 'first',
          payload: routingPayload('bls'),
          observation: observation('rh-gc-holdout-1a'),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'recorded',
        },
        {
          kind: 'record_contribution',
          stepId: 'retry',
          payload: routingPayload('bls'),
          observation: observation('rh-gc-holdout-1a'),
          explicitOriginalTargetStepId: null,
          expectedStatus: 'already_recorded',
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_V1_PERSONAL_MEMORY_SCENARIOS: readonly RepresentativeHybridV1PersonalMemoryScenario[] =
  [
    {
      scenarioId: 'RH-PM-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'personal_memory_sequence',
      difficulty: 'easy',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes:
        'Confirm then exact-repeat read, expects a deterministic-reuse avoided call.',
      tags: ['exact-repeat'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      sequenceKind: 'exact_confirmed_repeat',
      steps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-rh-pm-1',
          actionId: 'action-rh-pm-1-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-linsen',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'repeat',
          ownerId: 'owner-fixture-rh-pm-1',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-linsen',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
    },
    {
      scenarioId: 'RH-PM-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'personal_memory_sequence',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes:
        'Holdout near-repeat variant -- must not deterministically overgeneralize.',
      tags: ['near-repeat', 'holdout'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      sequenceKind: 'near_repeat',
      steps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-rh-pm-holdout',
          actionId: 'action-rh-pm-holdout-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-erbsen',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'nearRepeatDifferentSource',
          ownerId: 'owner-fixture-rh-pm-holdout',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-erbsen-tiefgefroren',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_V1_PRIVACY_SCENARIOS: readonly RepresentativeHybridV1PrivacyScenario[] =
  [
    {
      scenarioId: 'RH-PRIV-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'privacy_deletion_sequence',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes:
        "Cross-user isolation -- user B must not see user A's confirmed memory.",
      tags: ['sequence:D'],
      fixtureVersionsUsed: ['personal-resolution-memory-v1'],
      assertNoCrossUserLeak: true,
      assertDeletionRemovesEffect: false,
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'ownerAConfirms',
          ownerId: 'owner-fixture-rh-priv-a',
          actionId: 'action-rh-priv-1-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-quark',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'ownerBReadsSameTarget',
          ownerId: 'owner-fixture-rh-priv-b',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-quark',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
    {
      scenarioId: 'RH-PRIV-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'privacy_deletion_sequence',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes:
        'Deletion removes personal-memory effect -- subsequent read finds nothing.',
      tags: ['sequence:E', 'holdout'],
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
          ownerId: 'owner-fixture-rh-priv-holdout',
          actionId: 'action-rh-priv-holdout-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-apfel',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'beforeDeletion',
          ownerId: 'owner-fixture-rh-priv-holdout',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-apfel',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
        {
          kind: 'invalidate',
          stepId: 'delete',
          ownerId: 'owner-fixture-rh-priv-holdout',
          actionId: 'action-rh-priv-holdout-delete',
          targetMemoryStepId: 'confirm',
          reason: 'explicit_user_delete',
          expectedStatus: 'invalidated',
        },
        {
          kind: 'read',
          stepId: 'afterDeletion',
          ownerId: 'owner-fixture-rh-priv-holdout',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-apfel',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
      ],
    },
  ];

export const REPRESENTATIVE_HYBRID_V1_ECONOMICS_SCENARIOS: readonly RepresentativeHybridV1EconomicsScenario[] =
  [
    {
      scenarioId: 'RH-ECON-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'economics_sequence',
      difficulty: 'medium',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes: 'First use calls the fixture interpreter; exact repeat avoids it.',
      tags: ['economics'],
      fixtureVersionsUsed: ['representative-hybrid-v1-fixture-v1'],
      personalMemorySteps: [
        {
          kind: 'read',
          stepId: 'firstUse',
          ownerId: 'owner-fixture-rh-econ',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-banane',
          expectAnyMatch: false,
          expectDeterministicReuse: false,
        },
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-rh-econ',
          actionId: 'action-rh-econ-1-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-banane',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'repeat',
          ownerId: 'owner-fixture-rh-econ',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-banane',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
      expectedAvoidedCallsAtLeast: 1,
    },
    {
      scenarioId: 'RH-ECON-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'economics_sequence',
      difficulty: 'hard',
      groundTruthClass: 'fixture-derived',
      personalDataFree: true,
      reproducibilityNotes: 'Holdout economics sequence.',
      tags: ['economics', 'holdout'],
      fixtureVersionsUsed: ['representative-hybrid-v1-fixture-v1'],
      personalMemorySteps: [
        {
          kind: 'record',
          stepId: 'confirm',
          ownerId: 'owner-fixture-rh-econ-holdout',
          actionId: 'action-rh-econ-holdout-confirm',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-toastbrot',
          evidenceType: 'explicit_confirmation',
          expectedStatus: 'written',
        },
        {
          kind: 'read',
          stepId: 'repeat',
          ownerId: 'owner-fixture-rh-econ-holdout',
          sourceType: 'bls',
          sourceId: 'bls-fixture-rh-toastbrot',
          expectAnyMatch: true,
          expectDeterministicReuse: true,
        },
      ],
      expectedAvoidedCallsAtLeast: 1,
    },
  ];
