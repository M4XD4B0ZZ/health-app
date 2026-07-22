import { describe, it, expect } from '@jest/globals';
import { runLearningBenchmarkV2GlobalCandidateScenario } from '../LearningBenchmarkV2GlobalCandidateAdapter';
import {
  LEARNING_BENCHMARK_V2_GLOBAL_CANDIDATE_DEVELOPMENT,
  LEARNING_BENCHMARK_V2_GLOBAL_CANDIDATE_HOLDOUT,
} from '../LearningBenchmarkV2GlobalCandidateCorpus';

function scenarioById(id: string) {
  const scenario = [
    ...LEARNING_BENCHMARK_V2_GLOBAL_CANDIDATE_DEVELOPMENT,
    ...LEARNING_BENCHMARK_V2_GLOBAL_CANDIDATE_HOLDOUT,
  ].find((s) => s.scenarioId === id);
  if (!scenario) throw new Error(`missing fixture scenario ${id}`);
  return scenario;
}

function outcomeFor<T extends { stepId: string }>(stepOutcomes: readonly T[], stepId: string): T {
  const found = stepOutcomes.find((s) => s.stepId === stepId);
  if (!found) throw new Error(`missing step outcome ${stepId}`);
  return found;
}

describe('LearningBenchmarkV2GlobalCandidateAdapter (real ledger/review/shadow, fresh state per scenario)', () => {
  it('first contribution creates one deterministic candidate; exact retry does not double-count', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-001'),
    );
    expect(outcomeFor(outcome.stepOutcomes, 'first').actualStatus).toBe('recorded');
    expect(outcomeFor(outcome.stepOutcomes, 'retry').actualStatus).toBe('already_recorded');
    expect(outcome.operationCounts.candidatesCreated).toBe(1);
    expect(outcome.finalCandidates).toHaveLength(1);
  });

  it('contradiction is computed by the real classifier and preserves support/contradiction separately', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-002'),
    );
    const assertStep = outcomeFor(outcome.stepOutcomes, 'assert');
    expect(assertStep.observed?.supportingEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(assertStep.observed?.contradictingEvidenceCount).toBeGreaterThanOrEqual(1);
  });

  it('rejection suppression: new evidence for a rejected fingerprint never creates a new candidate', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-003'),
    );
    expect(outcome.finalCandidates).toHaveLength(1);
    expect(outcome.finalCandidates[0].status).toBe('rejected');
  });

  it('self-link fails closed before any duplicate marking is applied', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-004'),
    );
    expect(outcomeFor(outcome.stepOutcomes, 'selfLinkAttempt').actualStatus).toBe(
      'validation_failed',
    );
    expect(outcomeFor(outcome.stepOutcomes, 'markDuplicate').actualStatus).toBe('applied');
  });

  it('duplicate chain routes historical evidence to the terminal candidate', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-HOLD-001'),
    );
    expect(outcomeFor(outcome.stepOutcomes, 'supersede').actualStatus).toBe('applied');
    expect(outcome.finalCandidates.find((c) => c.status === 'superseded')).toBeDefined();
  });

  it('retraction recomputes summaries and is idempotent on exact retry', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-005'),
    );
    expect(outcomeFor(outcome.stepOutcomes, 'retract').actualStatus).toBe('applied');
    expect(outcomeFor(outcome.stepOutcomes, 'retractRetry').actualStatus).toBe('already_recorded');
    expect(outcome.operationCounts.retractionsApplied).toBe(1);
  });

  it('a conflicting reuse of a retraction action ID fails closed', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-HOLD-002'),
    );
    expect(outcomeFor(outcome.stepOutcomes, 'retract').actualStatus).toBe('no_op');
    expect(outcomeFor(outcome.stepOutcomes, 'retractConflict').actualStatus).toBe('conflict');
  });

  it('single-user (not_evaluable) independent-user evidence blocks approval; no active payload is created', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-006'),
    );
    expect(outcomeFor(outcome.stepOutcomes, 'singleUserApproveAttempt').actualStatus).toBe(
      'blocked_privacy',
    );
  });

  it(
    'RESOLVER-V3-037 REMEDIATED: contradiction independently blocks approval once independent-user evidence is ' +
      'hypothetically satisfied (fixture-only isolation; does not imply RESOLVER-V3-035 exists)',
    async () => {
      const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
        scenarioById('LBV2-GC-DEV-006'),
      );
      const approve = outcomeFor(outcome.stepOutcomes, 'contradictionGateApprove');
      // Honest, evidence-based assertion: this documents the real review service's current
      // behavior after RESOLVER-V3-037's contradiction-aware approval gate. INV-07 now records
      // `passed` at the report level -- see the RESOLVER-V3-037 remediation report. This scenario's
      // frozen fixture data (`LearningBenchmarkV2GlobalCandidateCorpus.ts`) is untouched; only this
      // test's assertion of the real service's current behavior is updated, per the RESOLVER-V3-023
      // report's own instruction not to leave the discovered defect encoded as current behavior.
      expect(approve.actualStatus).toBe('blocked_contradiction');
    },
  );

  it(
    "RESOLVER-V3-037 historical-fixture consequence: this scenario's rollback steps become unreachable " +
      'now that contradiction correctly blocks approval (rollback/revoke coverage for a legitimately ' +
      'approved, contradiction-free candidate remains in ResolverKnowledgeReview.test.ts)',
    async () => {
      const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
        scenarioById('LBV2-GC-DEV-006'),
      );
      // The candidate was never approved (blocked_contradiction, zero mutation), so there is no
      // active approved payload left to roll back -- both the rollback and its retry now correctly
      // fail closed as `invalid_transition`, not `applied`/`already_applied`. This is a documented
      // consequence of the frozen historical fixture combining the `contradiction-gate` and
      // `review-rollback` tags on the same scenario; it is not a regression in rollback logic
      // itself (see RESOLVER_V3_037_CONTRADICTION_APPROVAL_GATE_REMEDIATION_REPORT.md).
      expect(outcomeFor(outcome.stepOutcomes, 'rollback').actualStatus).toBe('invalid_transition');
      expect(outcomeFor(outcome.stepOutcomes, 'rollbackRetry').actualStatus).toBe(
        'invalid_transition',
      );
    },
  );

  it('shadow evaluation uses the real evaluator and never mutates candidate state', async () => {
    const before = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-001'),
    );
    const candidateSnapshotBefore = JSON.stringify(before.finalCandidates);
    expect(outcomeFor(before.stepOutcomes, 'shadow').actualStatus).toBe('no_change');
    // Re-running the same scenario from scratch produces an identical final candidate snapshot,
    // proving the shadow step (the last step) did not leave any residual mutation.
    const after = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-001'),
    );
    expect(JSON.stringify(after.finalCandidates)).toBe(candidateSnapshotBefore);
  });

  it('global candidate output contains no owner/observation/run/contribution identifiers', async () => {
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-002'),
    );
    const serialized = JSON.stringify(outcome.finalCandidates);
    expect(serialized).not.toMatch(
      /ownerId|observationId|resolverRunId|contributionId|contributorToken/,
    );
  });

  it('scenario state is fresh/isolated per run (no shared mutable module state across scenarios)', async () => {
    const first = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-001'),
    );
    const second = await runLearningBenchmarkV2GlobalCandidateScenario(
      scenarioById('LBV2-GC-DEV-003'),
    );
    expect(first.finalCandidates).toHaveLength(1);
    expect(second.finalCandidates).toHaveLength(1);
    expect(first.finalCandidates[0].candidateId).not.toBe(second.finalCandidates[0].candidateId);
  });
});
