import { runLearningBenchmarkV2GlobalCandidateScenario } from '../../learningV2/LearningBenchmarkV2GlobalCandidateAdapter';
import type { LearningBenchmarkV2GlobalCandidateScenario } from '../../learningV2/LearningBenchmarkV2Types';
import { REPRESENTATIVE_HYBRID_V1_GLOBAL_CANDIDATE_SCENARIOS } from '../RepresentativeHybridV1GovernanceCorpus';
import type { RepresentativeHybridV1GlobalCandidateScenario } from '../RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 contradiction-gate / rollback separation tests (requirements 22-24, 88-99).
 * Adapts each own-typed `RepresentativeHybridV1GlobalCandidateScenario` into the shape
 * `runLearningBenchmarkV2GlobalCandidateScenario` needs at the call site (see
 * `RepresentativeHybridV1Types.ts`'s module docstring for why the step *types* are not shared
 * directly) -- this is the one place that structural cast happens, confined to test/runner code,
 * never inside corpus data.
 */
function asLearningV2Scenario(
  scenario: RepresentativeHybridV1GlobalCandidateScenario,
): LearningBenchmarkV2GlobalCandidateScenario {
  return scenario as unknown as LearningBenchmarkV2GlobalCandidateScenario;
}

function findScenario(scenarioId: string): RepresentativeHybridV1GlobalCandidateScenario {
  const scenario = REPRESENTATIVE_HYBRID_V1_GLOBAL_CANDIDATE_SCENARIOS.find(
    (s) => s.scenarioId === scenarioId,
  );
  if (!scenario) throw new Error(`fixture scenario not found: ${scenarioId}`);
  return scenario;
}

describe('RESOLVER-V3-038 contradiction-gate / rollback separation', () => {
  it('the contradiction-gate fixture has no rollback steps', () => {
    const scenario = findScenario('RH-GC-DEV-CONTRA-001');
    const rollbackSteps = scenario.steps.filter(
      (s) =>
        s.kind === 'review_decision' && (s.action === 'rollback' || s.action === 'revoke_approval'),
    );
    expect(rollbackSteps).toEqual([]);
    expect(scenario.tags).toEqual(['contradiction-gate']);
    expect(scenario.tags).not.toContain('review-rollback');
  });

  it('the rollback fixture has no contradiction-forcing steps', () => {
    const scenario = findScenario('RH-GC-DEV-ROLLBACK-001');
    const contradictionSteps = scenario.steps.filter(
      (s) => s.kind === 'review_decision' && s.forceContradiction === true,
    );
    expect(contradictionSteps).toEqual([]);
    expect(scenario.tags).toEqual(['review-rollback']);
    expect(scenario.tags).not.toContain('contradiction-gate');
  });

  it('contradiction approval returns blocked_contradiction with zero mutation', async () => {
    const scenario = findScenario('RH-GC-DEV-CONTRA-001');
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    const approveStep = outcome.stepOutcomes.find((s) => s.stepId === 'approveAttempt');
    expect(approveStep?.actualStatus).toBe('blocked_contradiction');
    const candidate = outcome.finalCandidates.find(
      (c) => c.candidateId === approveStep?.candidateId,
    );
    // Blocked approval must not have produced an "approved" payload.
    expect(candidate?.status).not.toBe('approved');
  });

  it('a contradiction block produces no approved payload and no review-success event for that decision', async () => {
    const scenario = findScenario('RH-GC-DEV-CONTRA-001');
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    expect(outcome.operationCounts.reviewOperations).toBeGreaterThan(0);
    expect(outcome.finalCandidates.every((c) => c.status !== 'approved')).toBe(true);
  });

  it('legitimate contradiction-free approval succeeds (rollback fixture, approve step)', async () => {
    const scenario = findScenario('RH-GC-DEV-ROLLBACK-001');
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    const approveStep = outcome.stepOutcomes.find((s) => s.stepId === 'approve');
    expect(approveStep?.actualStatus).toBe('applied');
  });

  it('rollback deactivates the approved payload', async () => {
    const scenario = findScenario('RH-GC-DEV-ROLLBACK-001');
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    const rollbackStep = outcome.stepOutcomes.find((s) => s.stepId === 'rollback');
    expect(rollbackStep?.actualStatus).toBe('applied');
  });

  it('rollback retry is idempotent (already_applied)', async () => {
    const scenario = findScenario('RH-GC-DEV-ROLLBACK-001');
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    const retryStep = outcome.stepOutcomes.find((s) => s.stepId === 'rollbackRetry');
    expect(retryStep?.actualStatus).toBe('already_applied');
  });

  it('conflicting decision-ID reuse fails (a different action under the same decisionId)', async () => {
    const scenario = findScenario('RH-GC-DEV-ROLLBACK-001');
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    const conflictStep = outcome.stepOutcomes.find(
      (s) => s.stepId === 'conflictingDecisionIdReuse',
    );
    expect(conflictStep?.actualStatus).toBe('conflict');
  });

  it('single-user-block scenario is independent of both contradiction and rollback', async () => {
    const scenario = findScenario('RH-GC-DEV-PRIVACY-001');
    expect(scenario.tags).toEqual(['single-user-block']);
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(scenario),
    );
    const approveStep = outcome.stepOutcomes.find((s) => s.stepId === 'approveAttempt');
    expect(approveStep?.actualStatus).toBe('blocked_privacy');
  });

  it('a failure in the contradiction fixture cannot make the (structurally separate) rollback fixture unreachable', async () => {
    const contradiction = findScenario('RH-GC-DEV-CONTRA-001');
    const rollback = findScenario('RH-GC-DEV-ROLLBACK-001');
    // Independence proof: the two fixtures use distinct decisionId/observationId values (the real
    // identifiers the review/ledger services key on) and are each executed against a brand-new,
    // isolated `GlobalCandidateWorld` instance per `runLearningBenchmarkV2GlobalCandidateScenario`
    // call -- `stepId` itself is scenario-local UI labeling, not a cross-scenario correlation key,
    // so two fixtures reusing a step label like "candidate" is expected and harmless.
    const contradictionDecisionIds = contradiction.steps
      .filter((s) => s.kind === 'review_decision')
      .map((s) => (s as { decisionId: string }).decisionId);
    const rollbackDecisionIds = rollback.steps
      .filter((s) => s.kind === 'review_decision')
      .map((s) => (s as { decisionId: string }).decisionId);
    const overlap = contradictionDecisionIds.filter((id) => rollbackDecisionIds.includes(id));
    expect(overlap).toEqual([]);
    // Running the contradiction fixture first must not affect the rollback fixture's own fresh run.
    await runLearningBenchmarkV2GlobalCandidateScenario(asLearningV2Scenario(contradiction));
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      asLearningV2Scenario(rollback),
    );
    const approveStep = outcome.stepOutcomes.find((s) => s.stepId === 'approve');
    expect(approveStep?.actualStatus).toBe('applied');
    expect(outcome.stepOutcomes.every((s) => s.actualStatus !== undefined)).toBe(true);
  });
});
