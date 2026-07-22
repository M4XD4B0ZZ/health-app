import { describe, it, expect } from '@jest/globals';
import { evaluateLearningBenchmarkV2PrivacyScenario } from '../evaluateLearningBenchmarkV2PrivacyScenario';
import {
  LEARNING_BENCHMARK_V2_PRIVACY_DEVELOPMENT,
  LEARNING_BENCHMARK_V2_PRIVACY_HOLDOUT,
} from '../LearningBenchmarkV2PrivacyCorpus';

function scenarioById(id: string) {
  const scenario = [
    ...LEARNING_BENCHMARK_V2_PRIVACY_DEVELOPMENT,
    ...LEARNING_BENCHMARK_V2_PRIVACY_HOLDOUT,
  ].find((s) => s.scenarioId === id);
  if (!scenario) throw new Error(`missing fixture scenario ${id}`);
  return scenario;
}

describe('evaluateLearningBenchmarkV2PrivacyScenario', () => {
  it('Sequence D: cross-user isolation passes with zero leak count', async () => {
    const result = await evaluateLearningBenchmarkV2PrivacyScenario(
      scenarioById('LBV2-PRIV-DEV-001'),
    );
    expect(result.crossUserLeakCount).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('Sequence E: deletion removes personal-memory effect', async () => {
    const result = await evaluateLearningBenchmarkV2PrivacyScenario(
      scenarioById('LBV2-PRIV-DEV-002'),
    );
    expect(result.deletionRemovesEffect).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('owner-deletion retraction leaves no global user linkage', async () => {
    const result = await evaluateLearningBenchmarkV2PrivacyScenario(
      scenarioById('LBV2-PRIV-DEV-003'),
    );
    expect(result.globalCandidatePrivacyLeakDetected).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('holdout cross-user isolation case passes independently of development cases', async () => {
    const result = await evaluateLearningBenchmarkV2PrivacyScenario(
      scenarioById('LBV2-PRIV-HOLD-001'),
    );
    expect(result.crossUserLeakCount).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('a passing cross-user-isolation invariant requires exactly zero observed violations', async () => {
    const results = await Promise.all(
      [...LEARNING_BENCHMARK_V2_PRIVACY_DEVELOPMENT, ...LEARNING_BENCHMARK_V2_PRIVACY_HOLDOUT]
        .filter((s) => s.assertNoCrossUserLeak)
        .map((s) => evaluateLearningBenchmarkV2PrivacyScenario(s)),
    );
    expect(results.every((r) => r.crossUserLeakCount === 0)).toBe(true);
  });
});
