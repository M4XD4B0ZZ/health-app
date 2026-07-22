import { describe, it, expect } from '@jest/globals';
import { runLearningBenchmarkV2PersonalMemorySteps } from '../LearningBenchmarkV2PersonalMemoryEngine';
import type { LearningBenchmarkV2PersonalMemoryStep } from '../LearningBenchmarkV2Types';

describe('LearningBenchmarkV2PersonalMemoryEngine (real use cases, fresh state per run)', () => {
  it('Sequence A: unconfirmed first use has no match; confirmation then exact repeat avoids the call', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: false,
        expectDeterministicReuse: false,
      },
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r2',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: true,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
    expect(run.avoidedInterpretationCallCount).toBe(1);
    expect(run.interpretationCallsInvoked).toBe(1); // only the first, unconfirmed read invokes it
  });

  it('Sequence B: a near (different sourceId) target never deterministically reuses P2', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1-variant',
        expectAnyMatch: false,
        expectDeterministicReuse: false,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
  });

  it('P0 (deliberate_candidate_selection maps to P1, not P0) never becomes deterministic reuse', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'deliberate_candidate_selection',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: false,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
    expect(run.avoidedInterpretationCallCount).toBe(0);
  });

  it('P0 (logged_without_explicit_confirmation) is not even preferred/matched deterministically', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'logged_without_explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: false,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
  });

  it('Sequence C: contradiction invalidates a confirmed memory; a later exact repeat no longer reuses it', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: true,
      },
      {
        kind: 'invalidate',
        stepId: 'i1',
        ownerId: 'o1',
        actionId: 'inv1',
        targetMemoryStepId: 'w1',
        reason: 'contradiction',
        expectedStatus: 'invalidated',
      },
      {
        kind: 'read',
        stepId: 'r2',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: false,
        expectDeterministicReuse: false,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
    expect(run.invalidationCount).toBe(1);
  });

  it("Sequence D: cross-user isolation -- owner B never sees owner A's confirmed memory", async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'owner-a',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'owner-b',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: false,
        expectDeterministicReuse: false,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
    expect(run.crossUserLeakCount).toBe(0);
  });

  it('Sequence E: deletion removes personal-memory effect for subsequent reads', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: true,
      },
      {
        kind: 'invalidate',
        stepId: 'i1',
        ownerId: 'o1',
        actionId: 'del1',
        targetMemoryStepId: 'w1',
        reason: 'explicit_user_delete',
        expectedStatus: 'invalidated',
      },
      {
        kind: 'read',
        stepId: 'r2',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: false,
        expectDeterministicReuse: false,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.allStepsMatched).toBe(true);
    const lastRead = run.stepOutcomes[run.stepOutcomes.length - 1];
    expect(lastRead.matchCount).toBe(0);
  });

  it('sequence state is isolated from a separate run (no cross-scenario leakage)', async () => {
    const stepsA: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'shared-action-id',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
    ];
    const stepsB: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: false,
        expectDeterministicReuse: false,
      },
    ];
    await runLearningBenchmarkV2PersonalMemorySteps(stepsA);
    const runB = await runLearningBenchmarkV2PersonalMemorySteps(stepsB);
    expect(runB.allStepsMatched).toBe(true);
  });

  it('avoided-call count is measured from actual fixture-provider invocation counts, not declared', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: true,
      },
      {
        kind: 'read',
        stepId: 'r2',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: true,
      },
    ];
    const run = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(run.avoidedInterpretationCallCount).toBe(2);
    expect(run.interpretationCallsInvoked).toBe(0);
  });

  it('rerun from a fresh process-equivalent call is deterministic', async () => {
    const steps: LearningBenchmarkV2PersonalMemoryStep[] = [
      {
        kind: 'record',
        stepId: 'w1',
        ownerId: 'o1',
        actionId: 'a1',
        sourceType: 'bls',
        sourceId: 'food-1',
        evidenceType: 'explicit_confirmation',
        expectedStatus: 'written',
      },
      {
        kind: 'read',
        stepId: 'r1',
        ownerId: 'o1',
        sourceType: 'bls',
        sourceId: 'food-1',
        expectAnyMatch: true,
        expectDeterministicReuse: true,
      },
    ];
    const runA = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    const runB = await runLearningBenchmarkV2PersonalMemorySteps(steps);
    expect(runA.allStepsMatched).toBe(runB.allStepsMatched);
    expect(runA.avoidedInterpretationCallCount).toBe(runB.avoidedInterpretationCallCount);
  });
});
