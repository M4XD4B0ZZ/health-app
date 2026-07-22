import { describe, it, expect } from '@jest/globals';
import { evaluateLearningBenchmarkV2Invariants } from '../evaluateLearningBenchmarkV2Invariants';
import type { LearningBenchmarkV2PersonalMemoryScenarioEvaluation } from '../evaluateLearningBenchmarkV2PersonalMemoryScenario';

function pm(
  overrides: Partial<LearningBenchmarkV2PersonalMemoryScenarioEvaluation> = {},
): LearningBenchmarkV2PersonalMemoryScenarioEvaluation {
  return {
    scenarioId: 's1',
    sequenceKind: 'exact_confirmed_repeat',
    passed: true,
    stepOutcomes: [],
    avoidedInterpretationCallCount: 1,
    interpretationCallsInvoked: 1,
    ...overrides,
  };
}

describe('evaluateLearningBenchmarkV2Invariants', () => {
  it('every invariant carries a closed status and non-empty description/reasonCode', () => {
    const verdicts = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [],
      globalCandidate: [],
      privacy: [],
      partitionsRun: ['development'],
      networkCallDetected: false,
    });
    expect(verdicts).toHaveLength(20);
    for (const v of verdicts) {
      expect(['passed', 'failed', 'not_evaluable']).toContain(v.status);
      expect(v.description.length).toBeGreaterThan(0);
      expect(v.reasonCode.length).toBeGreaterThan(0);
    }
  });

  it('returns not_evaluable (never a fabricated pass) when no supporting scenario exists', () => {
    const verdicts = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [],
      globalCandidate: [],
      privacy: [],
      partitionsRun: ['development'],
      networkCallDetected: false,
    });
    const inv02 = verdicts.find((v) => v.invariantId === 'INV-02');
    expect(inv02?.status).toBe('not_evaluable');
  });

  it('P2 exact-repeat invariant passes when avoided calls are actually observed', () => {
    const verdicts = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [pm()],
      globalCandidate: [],
      privacy: [],
      partitionsRun: ['development'],
      networkCallDetected: false,
    });
    expect(verdicts.find((v) => v.invariantId === 'INV-02')?.status).toBe('passed');
  });

  it('a detected network call fails INV-18 (no live network call occurs)', () => {
    const verdicts = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [],
      globalCandidate: [],
      privacy: [],
      partitionsRun: ['development'],
      networkCallDetected: true,
    });
    expect(verdicts.find((v) => v.invariantId === 'INV-18')?.status).toBe('failed');
  });

  it('INV-17 (dev/holdout separated) is only passed when both partitions actually ran', () => {
    const onlyDev = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [],
      globalCandidate: [],
      privacy: [],
      partitionsRun: ['development'],
      networkCallDetected: false,
    });
    const both = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [],
      globalCandidate: [],
      privacy: [],
      partitionsRun: ['development', 'holdout'],
      networkCallDetected: false,
    });
    expect(onlyDev.find((v) => v.invariantId === 'INV-17')?.status).toBe('not_evaluable');
    expect(both.find((v) => v.invariantId === 'INV-17')?.status).toBe('passed');
  });

  it('a global-candidate privacy leak detection fails INV-15, never silently passes', () => {
    const verdicts = evaluateLearningBenchmarkV2Invariants({
      personalMemory: [],
      globalCandidate: [],
      privacy: [
        {
          scenarioId: 'p1',
          passed: false,
          crossUserLeakCount: 0,
          deletionRemovesEffect: null,
          globalCandidatePrivacyLeakDetected: true,
          personalMemoryStepsMatched: null,
        },
      ],
      partitionsRun: ['development'],
      networkCallDetected: false,
    });
    expect(verdicts.find((v) => v.invariantId === 'INV-15')?.status).toBe('failed');
  });
});
