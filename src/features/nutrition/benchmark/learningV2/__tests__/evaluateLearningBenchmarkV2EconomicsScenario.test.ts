import { describe, it, expect } from '@jest/globals';
import { evaluateLearningBenchmarkV2EconomicsScenario } from '../evaluateLearningBenchmarkV2EconomicsScenario';
import {
  LEARNING_BENCHMARK_V2_ECONOMICS_DEVELOPMENT,
  LEARNING_BENCHMARK_V2_ECONOMICS_HOLDOUT,
} from '../LearningBenchmarkV2EconomicsCorpus';

function scenarioById(id: string) {
  const scenario = [
    ...LEARNING_BENCHMARK_V2_ECONOMICS_DEVELOPMENT,
    ...LEARNING_BENCHMARK_V2_ECONOMICS_HOLDOUT,
  ].find((s) => s.scenarioId === id);
  if (!scenario) throw new Error(`missing fixture scenario ${id}`);
  return scenario;
}

describe('evaluateLearningBenchmarkV2EconomicsScenario', () => {
  it('avoided-call economics use actual call counts, not declared values', async () => {
    const result = await evaluateLearningBenchmarkV2EconomicsScenario(
      scenarioById('LBV2-ECON-DEV-001'),
    );
    expect(result.avoidedInterpretationCallCount).toBe(2);
    expect(result.passed).toBe(true);
  });

  it('mixed sequences report reads/writes/invalidations as real operation counts', async () => {
    const result = await evaluateLearningBenchmarkV2EconomicsScenario(
      scenarioById('LBV2-ECON-DEV-002'),
    );
    expect(result.personalMemoryWrites).toBe(1);
    expect(result.personalMemoryReads).toBe(2);
    expect(result.passed).toBe(true);
  });

  it('development and holdout economics scenarios evaluate independently', async () => {
    const devResult = await evaluateLearningBenchmarkV2EconomicsScenario(
      scenarioById('LBV2-ECON-DEV-001'),
    );
    const holdResult = await evaluateLearningBenchmarkV2EconomicsScenario(
      scenarioById('LBV2-ECON-HOLD-001'),
    );
    expect(devResult.scenarioId).not.toBe(holdResult.scenarioId);
    expect(holdResult.passed).toBe(true);
  });
});
