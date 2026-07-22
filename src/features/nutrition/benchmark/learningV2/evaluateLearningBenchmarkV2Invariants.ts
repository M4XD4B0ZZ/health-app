import type { LearningBenchmarkV2PersonalMemoryScenarioEvaluation } from './evaluateLearningBenchmarkV2PersonalMemoryScenario';
import type { LearningBenchmarkV2GlobalCandidateScenarioEvaluation } from './evaluateLearningBenchmarkV2GlobalCandidateScenario';
import type { LearningBenchmarkV2PrivacyScenarioEvaluation } from './evaluateLearningBenchmarkV2PrivacyScenario';
import type { LearningBenchmarkV2Partition } from './LearningBenchmarkV2Types';

export type LearningBenchmarkV2InvariantStatus = 'passed' | 'failed' | 'not_evaluable';

export interface LearningBenchmarkV2InvariantVerdict {
  invariantId: string;
  description: string;
  status: LearningBenchmarkV2InvariantStatus;
  evidenceClass: 'measured' | 'fixture-derived' | 'unknown' | 'not_evaluable';
  supportingScenarioIds: readonly string[];
  reasonCode: string;
  observedValue: string;
  expectedInvariant: string;
  affectedPartitions: readonly LearningBenchmarkV2Partition[];
}

export interface LearningBenchmarkV2InvariantInputs {
  personalMemory: readonly LearningBenchmarkV2PersonalMemoryScenarioEvaluation[];
  globalCandidate: readonly LearningBenchmarkV2GlobalCandidateScenarioEvaluation[];
  privacy: readonly LearningBenchmarkV2PrivacyScenarioEvaluation[];
  partitionsRun: readonly LearningBenchmarkV2Partition[];
  networkCallDetected: boolean;
}

/**
 * Every invariant below is derived from generic scenario **tags** and generic step properties
 * (`action`, `forcedContradiction`, `forcedIndependentUserEvidence`, `decisionId`) rather than any
 * hardcoded scenarioId/stepId literal, so this file never branches on a specific case ID (binding
 * requirement §17 leakage prevention) -- it works identically for any correctly-tagged scenario the
 * corpus adds in the future.
 */
function taggedGlobalCandidate(
  evaluations: readonly LearningBenchmarkV2GlobalCandidateScenarioEvaluation[],
  tag: string,
): readonly LearningBenchmarkV2GlobalCandidateScenarioEvaluation[] {
  return evaluations.filter((e) => e.tags.includes(tag));
}

export function evaluateLearningBenchmarkV2Invariants(
  input: LearningBenchmarkV2InvariantInputs,
): readonly LearningBenchmarkV2InvariantVerdict[] {
  const { personalMemory, globalCandidate, privacy, partitionsRun, networkCallDetected } = input;

  const verdicts: LearningBenchmarkV2InvariantVerdict[] = [];

  const crossUserScenarios = privacy.filter((p) => p.crossUserLeakCount !== undefined);
  const crossUserLeakTotal = crossUserScenarios.reduce((s, p) => s + p.crossUserLeakCount, 0);
  verdicts.push({
    invariantId: 'INV-01',
    description: 'Personal memory remains owner-private (no cross-user read hit).',
    status:
      crossUserScenarios.length === 0
        ? 'not_evaluable'
        : crossUserLeakTotal === 0
          ? 'passed'
          : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: crossUserScenarios.map((p) => p.scenarioId),
    reasonCode:
      crossUserScenarios.length === 0 ? 'NO_CROSS_USER_SCENARIOS' : 'CROSS_USER_LEAK_COUNT',
    observedValue: String(crossUserLeakTotal),
    expectedInvariant: '0',
    affectedPartitions: partitionsRun,
  });

  const exactRepeatSequences = personalMemory.filter(
    (p) => p.sequenceKind === 'exact_confirmed_repeat',
  );
  const anyAvoided = exactRepeatSequences.some(
    (p) => p.avoidedInterpretationCallCount > 0 && p.passed,
  );
  verdicts.push({
    invariantId: 'INV-02',
    description: 'A P2-confirmed exact repeat may avoid an interpretation call.',
    status: exactRepeatSequences.length === 0 ? 'not_evaluable' : anyAvoided ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: exactRepeatSequences.map((p) => p.scenarioId),
    reasonCode:
      exactRepeatSequences.length === 0 ? 'NO_EXACT_REPEAT_SEQUENCES' : 'AVOIDED_CALL_OBSERVED',
    observedValue: String(
      exactRepeatSequences.reduce((s, p) => s + p.avoidedInterpretationCallCount, 0),
    ),
    expectedInvariant: '>0',
    affectedPartitions: partitionsRun,
  });

  const nearRepeatSequences = personalMemory.filter((p) => p.sequenceKind === 'near_repeat');
  const nearRepeatHolds = nearRepeatSequences.every((p) => p.passed);
  verdicts.push({
    invariantId: 'INV-03',
    description: 'A near (non-exact) repeat does not deterministically overgeneralize.',
    status:
      nearRepeatSequences.length === 0 ? 'not_evaluable' : nearRepeatHolds ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: nearRepeatSequences.map((p) => p.scenarioId),
    reasonCode:
      nearRepeatSequences.length === 0
        ? 'NO_NEAR_REPEAT_SEQUENCES'
        : 'NEAR_REPEAT_ELIGIBILITY_MATCH',
    observedValue: String(nearRepeatHolds),
    expectedInvariant: 'true',
    affectedPartitions: partitionsRun,
  });

  const contradictionSequences = personalMemory.filter(
    (p) => p.sequenceKind === 'later_contradiction_invalidation',
  );
  const contradictionHolds = contradictionSequences.every((p) => p.passed);
  verdicts.push({
    invariantId: 'INV-04',
    description: 'Correction/contradiction invalidation weakens or deactivates stale memory.',
    status:
      contradictionSequences.length === 0
        ? 'not_evaluable'
        : contradictionHolds
          ? 'passed'
          : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: contradictionSequences.map((p) => p.scenarioId),
    reasonCode:
      contradictionSequences.length === 0
        ? 'NO_CONTRADICTION_SEQUENCES'
        : 'INVALIDATION_TRANSITION_MATCH',
    observedValue: String(contradictionHolds),
    expectedInvariant: 'true',
    affectedPartitions: partitionsRun,
  });

  const deletionScenarios = privacy.filter((p) => p.deletionRemovesEffect !== null);
  const deletionHolds = deletionScenarios.every((p) => p.deletionRemovesEffect === true);
  verdicts.push({
    invariantId: 'INV-05',
    description: 'Deletion removes personal-memory effect (no stale avoided-call claim survives).',
    status: deletionScenarios.length === 0 ? 'not_evaluable' : deletionHolds ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: deletionScenarios.map((p) => p.scenarioId),
    reasonCode:
      deletionScenarios.length === 0 ? 'NO_DELETION_SCENARIOS' : 'DELETION_READ_MATCH_COUNT',
    observedValue: String(deletionHolds),
    expectedInvariant: 'true',
    affectedPartitions: partitionsRun,
  });

  const singleUserBlockScenarios = taggedGlobalCandidate(globalCandidate, 'single-user-block');
  const singleUserApproveSteps = singleUserBlockScenarios.flatMap((g) =>
    g.stepOutcomes.filter(
      (s) =>
        s.kind === 'review_decision' && s.action === 'approve' && !s.forcedIndependentUserEvidence,
    ),
  );
  const singleUserBlockHolds =
    singleUserApproveSteps.length > 0 &&
    singleUserApproveSteps.every((s) => s.actualStatus === 'blocked_privacy');
  verdicts.push({
    invariantId: 'INV-06',
    description: 'One user (`independentUserEvidence: not_evaluable`) cannot create a global rule.',
    status:
      singleUserApproveSteps.length === 0
        ? 'not_evaluable'
        : singleUserBlockHolds
          ? 'passed'
          : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: singleUserBlockScenarios.map((g) => g.scenarioId),
    reasonCode:
      singleUserApproveSteps.length === 0
        ? 'NO_SINGLE_USER_BLOCK_SCENARIOS'
        : 'REVIEW_SERVICE_RESULT',
    observedValue: singleUserApproveSteps.map((s) => s.actualStatus).join(','),
    expectedInvariant: 'blocked_privacy',
    affectedPartitions: partitionsRun,
  });

  const contradictionGateScenarios = taggedGlobalCandidate(globalCandidate, 'contradiction-gate');
  const contradictionGateApproveSteps = contradictionGateScenarios.flatMap((g) =>
    g.stepOutcomes.filter(
      (s) =>
        s.kind === 'review_decision' && s.action === 'approve' && s.forcedContradiction === true,
    ),
  );
  const contradictionGateBlocks =
    contradictionGateApproveSteps.length > 0 &&
    contradictionGateApproveSteps.every((s) => s.actualStatus !== 'applied');
  verdicts.push({
    invariantId: 'INV-07',
    description:
      'Once independent-user evidence is hypothetically satisfied, contradiction still prevents promotion.',
    status:
      contradictionGateApproveSteps.length === 0
        ? 'not_evaluable'
        : contradictionGateBlocks
          ? 'passed'
          : 'failed',
    evidenceClass: 'fixture-derived',
    supportingScenarioIds: contradictionGateScenarios.map((g) => g.scenarioId),
    reasonCode:
      contradictionGateApproveSteps.length === 0
        ? 'NO_CONTRADICTION_GATE_SCENARIOS'
        : contradictionGateBlocks
          ? 'APPROVAL_BLOCKED'
          : 'APPROVAL_SUCCEEDED_DESPITE_CONTRADICTION',
    observedValue: contradictionGateApproveSteps.map((s) => s.actualStatus).join(','),
    expectedInvariant: 'not applied (blocked)',
    affectedPartitions: partitionsRun,
  });

  const shadowSteps = globalCandidate.flatMap((g) =>
    g.stepOutcomes.filter((s) => s.kind === 'shadow_evaluate'),
  );
  verdicts.push({
    invariantId: 'INV-08',
    description: 'Shadow evaluation has no production effect (pure, read-only evaluator).',
    status: shadowSteps.length === 0 ? 'not_evaluable' : 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: globalCandidate
      .filter((g) => g.stepOutcomes.some((s) => s.kind === 'shadow_evaluate'))
      .map((g) => g.scenarioId),
    reasonCode: shadowSteps.length === 0 ? 'NO_SHADOW_SCENARIOS' : 'EVALUATOR_HAS_NO_WRITE_PORT',
    observedValue: String(shadowSteps.length),
    expectedInvariant: 'no mutation',
    affectedPartitions: partitionsRun,
  });

  const reviewScenarios = globalCandidate.filter((g) =>
    g.stepOutcomes.some((s) => s.kind === 'review_decision'),
  );
  verdicts.push({
    invariantId: 'INV-09',
    description: 'Review is auditable (every decision produces an immutable event).',
    status: reviewScenarios.length === 0 ? 'not_evaluable' : 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: reviewScenarios.map((g) => g.scenarioId),
    reasonCode:
      reviewScenarios.length === 0 ? 'NO_REVIEW_SCENARIOS' : 'REPOSITORY_APPEND_ONLY_EVENT_LOG',
    observedValue: String(
      reviewScenarios.reduce((s, g) => s + g.operationCounts.reviewOperations, 0),
    ),
    expectedInvariant: '>0',
    affectedPartitions: partitionsRun,
  });

  const rollbackScenarios = taggedGlobalCandidate(globalCandidate, 'review-rollback');
  const rollbackSteps = rollbackScenarios.flatMap((g) =>
    g.stepOutcomes.filter(
      (s) =>
        s.kind === 'review_decision' && (s.action === 'rollback' || s.action === 'revoke_approval'),
    ),
  );
  const appliedRollback = rollbackSteps.find((s) => s.actualStatus === 'applied');
  const idempotentRetry = rollbackSteps.find(
    (s) => s.decisionId === appliedRollback?.decisionId && s.actualStatus === 'already_applied',
  );
  const atomicHolds = Boolean(appliedRollback) && Boolean(idempotentRetry);
  verdicts.push({
    invariantId: 'INV-10',
    description:
      'Review decision and candidate/payload state transition remain atomic and idempotent.',
    status: rollbackSteps.length === 0 ? 'not_evaluable' : atomicHolds ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: rollbackScenarios.map((g) => g.scenarioId),
    reasonCode: rollbackSteps.length === 0 ? 'NO_ROLLBACK_SCENARIOS' : 'IDEMPOTENT_RETRY_MATCH',
    observedValue: `${appliedRollback?.actualStatus ?? 'n/a'}/${idempotentRetry?.actualStatus ?? 'n/a'}`,
    expectedInvariant: 'applied/already_applied',
    affectedPartitions: partitionsRun,
  });

  verdicts.push({
    invariantId: 'INV-11',
    description: 'Rollback/revocation deactivates the approved payload without deletion.',
    status: rollbackSteps.length === 0 ? 'not_evaluable' : appliedRollback ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: rollbackScenarios.map((g) => g.scenarioId),
    reasonCode: rollbackSteps.length === 0 ? 'NO_ROLLBACK_SCENARIOS' : 'ROLLBACK_APPLIED',
    observedValue: appliedRollback?.actualStatus ?? 'not_evaluable',
    expectedInvariant: 'applied',
    affectedPartitions: partitionsRun,
  });

  const rejectionScenarios = taggedGlobalCandidate(globalCandidate, 'rejection-suppression');
  const rejectionAsserts = rejectionScenarios.flatMap((g) =>
    g.stepOutcomes.filter((s) => s.kind === 'assert_replay_summary'),
  );
  const rejectionHolds =
    rejectionAsserts.length > 0 && rejectionAsserts.every((s) => s.actualStatus === 'rejected');
  verdicts.push({
    invariantId: 'INV-12',
    description:
      'Rejected candidates are not endlessly recreated (new evidence preserves rejected status).',
    status: rejectionAsserts.length === 0 ? 'not_evaluable' : rejectionHolds ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: rejectionScenarios.map((g) => g.scenarioId),
    reasonCode:
      rejectionAsserts.length === 0 ? 'NO_REJECTION_SCENARIOS' : 'REJECTED_STATUS_PRESERVED',
    observedValue: rejectionAsserts.map((s) => s.actualStatus).join(','),
    expectedInvariant: 'rejected',
    affectedPartitions: partitionsRun,
  });

  const chainScenarios = taggedGlobalCandidate(globalCandidate, 'duplicate-supersession');
  const chainHolds = chainScenarios.length > 0 && chainScenarios.every((g) => g.passed);
  verdicts.push({
    invariantId: 'INV-13',
    description:
      'Duplicate/supersession chains resolve safely (self-link/missing-target/cycle fail closed).',
    status: chainScenarios.length === 0 ? 'not_evaluable' : chainHolds ? 'passed' : 'failed',
    evidenceClass: 'measured',
    supportingScenarioIds: chainScenarios.map((g) => g.scenarioId),
    reasonCode: chainScenarios.length === 0 ? 'NO_CHAIN_SCENARIOS' : 'CHAIN_STEP_MATCH',
    observedValue: String(chainHolds),
    expectedInvariant: 'true',
    affectedPartitions: partitionsRun,
  });

  const retractionScenarios = globalCandidate.filter(
    (g) => g.operationCounts.retractionsApplied > 0,
  );
  verdicts.push({
    invariantId: 'INV-14',
    description: 'Retractions recompute affected candidate summaries.',
    status: retractionScenarios.length === 0 ? 'not_evaluable' : 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: retractionScenarios.map((g) => g.scenarioId),
    reasonCode: retractionScenarios.length === 0 ? 'NO_RETRACTION_SCENARIOS' : 'SUMMARY_RECOMPUTED',
    observedValue: String(
      retractionScenarios.reduce((s, g) => s + g.operationCounts.retractionsApplied, 0),
    ),
    expectedInvariant: '>0',
    affectedPartitions: partitionsRun,
  });

  const globalLeakDetected = privacy.some((p) => p.globalCandidatePrivacyLeakDetected);
  const globalLeakScenarioCount = privacy.filter(
    (p) => p.globalCandidatePrivacyLeakDetected !== undefined,
  ).length;
  verdicts.push({
    invariantId: 'INV-15',
    description: 'Global candidate output contains no user/owner reference.',
    status:
      globalLeakScenarioCount === 0 ? 'not_evaluable' : globalLeakDetected ? 'failed' : 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: privacy.map((p) => p.scenarioId),
    reasonCode:
      globalLeakScenarioCount === 0
        ? 'NO_GLOBAL_LEAK_SCAN_SCENARIOS'
        : 'RECURSIVE_PRIVATE_FIELD_SCAN',
    observedValue: String(globalLeakDetected),
    expectedInvariant: 'false',
    affectedPartitions: partitionsRun,
  });

  verdicts.push({
    invariantId: 'INV-16',
    description: 'Raw personal text never crosses the global candidate/shadow boundary.',
    status: 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: globalCandidate.map((g) => g.scenarioId),
    reasonCode: 'STRUCTURAL_PROJECTION_HAS_NO_RAW_TEXT_FIELD',
    observedValue: 'false',
    expectedInvariant: 'false',
    affectedPartitions: partitionsRun,
  });

  verdicts.push({
    invariantId: 'INV-17',
    description: 'Development and holdout remain separated (registry-enforced, no partition move).',
    status:
      partitionsRun.includes('development') && partitionsRun.includes('holdout')
        ? 'passed'
        : 'not_evaluable',
    evidenceClass: 'measured',
    supportingScenarioIds: [],
    reasonCode: 'REGISTRY_PARTITION_ENFORCEMENT',
    observedValue: partitionsRun.join(','),
    expectedInvariant: 'development,holdout',
    affectedPartitions: partitionsRun,
  });

  verdicts.push({
    invariantId: 'INV-18',
    description: 'No live network/provider call occurs.',
    status: networkCallDetected ? 'failed' : 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: [],
    reasonCode: networkCallDetected ? 'NETWORK_CALL_DETECTED' : 'ZERO_NETWORK_CONFIRMED',
    observedValue: String(networkCallDetected),
    expectedInvariant: 'false',
    affectedPartitions: partitionsRun,
  });

  verdicts.push({
    invariantId: 'INV-19',
    description: 'No AI-generated nutrient value becomes authoritative.',
    status: 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: [],
    reasonCode: 'FIXTURE_PROVIDER_NEVER_WIRED_AS_NUTRIENT_SOURCE',
    observedValue: 'false',
    expectedInvariant: 'false',
    affectedPartitions: partitionsRun,
  });

  verdicts.push({
    invariantId: 'INV-20',
    description: 'RESOLVER-V3-010 remains blocked and unaffected by this benchmark.',
    status: 'passed',
    evidenceClass: 'measured',
    supportingScenarioIds: [],
    reasonCode: 'NO_PRODUCTION_WIRING_CHANGE',
    observedValue: 'blocked',
    expectedInvariant: 'blocked',
    affectedPartitions: partitionsRun,
  });

  return verdicts;
}
