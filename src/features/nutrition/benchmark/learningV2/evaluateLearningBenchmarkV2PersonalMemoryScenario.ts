import {
  runLearningBenchmarkV2PersonalMemorySteps,
  type LearningBenchmarkV2PersonalMemoryStepOutcome,
} from './LearningBenchmarkV2PersonalMemoryEngine';
import type { LearningBenchmarkV2PersonalMemoryScenario } from './LearningBenchmarkV2Types';

export interface LearningBenchmarkV2PersonalMemoryScenarioEvaluation {
  scenarioId: string;
  sequenceKind: LearningBenchmarkV2PersonalMemoryScenario['sequenceKind'];
  passed: boolean;
  stepOutcomes: readonly LearningBenchmarkV2PersonalMemoryStepOutcome[];
  avoidedInterpretationCallCount: number;
  interpretationCallsInvoked: number;
}

export async function evaluateLearningBenchmarkV2PersonalMemoryScenario(
  scenario: LearningBenchmarkV2PersonalMemoryScenario,
): Promise<LearningBenchmarkV2PersonalMemoryScenarioEvaluation> {
  const run = await runLearningBenchmarkV2PersonalMemorySteps(scenario.steps);
  return {
    scenarioId: scenario.scenarioId,
    sequenceKind: scenario.sequenceKind,
    passed: run.allStepsMatched,
    stepOutcomes: run.stepOutcomes,
    avoidedInterpretationCallCount: run.avoidedInterpretationCallCount,
    interpretationCallsInvoked: run.interpretationCallsInvoked,
  };
}
