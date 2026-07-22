import { runLearningBenchmarkV2PersonalMemorySteps } from './LearningBenchmarkV2PersonalMemoryEngine';
import type { LearningBenchmarkV2EconomicsScenario } from './LearningBenchmarkV2Types';

export interface LearningBenchmarkV2EconomicsScenarioEvaluation {
  scenarioId: string;
  passed: boolean;
  avoidedInterpretationCallCount: number;
  interpretationCallsInvoked: number;
  personalMemoryReads: number;
  personalMemoryWrites: number;
  personalMemoryInvalidations: number;
}

/**
 * Economics sequences reuse the same real-use-case engine as personal-memory sequences (avoided-
 * call economics ultimately IS the personal-memory eligibility outcome) but report actual benchmark
 * operation counts rather than eligibility correctness per binding requirement §27. Fixture billed
 * cost is always exactly `0` for this zero-network run; production cost stays `unknown`.
 */
export async function evaluateLearningBenchmarkV2EconomicsScenario(
  scenario: LearningBenchmarkV2EconomicsScenario,
): Promise<LearningBenchmarkV2EconomicsScenarioEvaluation> {
  const run = await runLearningBenchmarkV2PersonalMemorySteps(scenario.personalMemorySteps);
  return {
    scenarioId: scenario.scenarioId,
    passed: run.avoidedInterpretationCallCount >= scenario.expectedAvoidedCallsAtLeast,
    avoidedInterpretationCallCount: run.avoidedInterpretationCallCount,
    interpretationCallsInvoked: run.interpretationCallsInvoked,
    personalMemoryReads: run.readCount,
    personalMemoryWrites: run.writeCount,
    personalMemoryInvalidations: run.invalidationCount,
  };
}
