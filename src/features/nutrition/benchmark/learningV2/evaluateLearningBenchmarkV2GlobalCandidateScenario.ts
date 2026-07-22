import {
  runLearningBenchmarkV2GlobalCandidateScenario,
  type LearningBenchmarkV2GlobalCandidateOperationCounts,
  type LearningBenchmarkV2GlobalCandidateStepOutcome,
} from './LearningBenchmarkV2GlobalCandidateAdapter';
import type { LearningBenchmarkV2GlobalCandidateScenario } from './LearningBenchmarkV2Types';

function expectedFor(
  scenario: LearningBenchmarkV2GlobalCandidateScenario,
  stepId: string,
): string | undefined {
  const step = scenario.steps.find((candidate) => candidate.stepId === stepId);
  if (!step) return undefined;
  switch (step.kind) {
    case 'record_contribution':
      return step.expectedStatus;
    case 'review_decision':
      return step.expectedResult;
    case 'retract_contributions':
      return step.expectedStatus;
    case 'shadow_evaluate':
      return step.expectedDeltaCategory;
    case 'assert_replay_summary':
      return step.expectStatus;
  }
}

export interface LearningBenchmarkV2GlobalCandidateScenarioEvaluation {
  scenarioId: string;
  tags: readonly string[];
  passed: boolean;
  stepOutcomes: readonly (LearningBenchmarkV2GlobalCandidateStepOutcome & {
    expected?: string;
    matched: boolean;
  })[];
  operationCounts: LearningBenchmarkV2GlobalCandidateOperationCounts;
  replaySummaryInvariantsHold: boolean;
}

export async function evaluateLearningBenchmarkV2GlobalCandidateScenario(
  scenario: LearningBenchmarkV2GlobalCandidateScenario,
): Promise<LearningBenchmarkV2GlobalCandidateScenarioEvaluation> {
  const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(scenario);

  const stepOutcomes = outcome.stepOutcomes.map((stepOutcome) => {
    const expected = expectedFor(scenario, stepOutcome.stepId);
    return {
      ...stepOutcome,
      expected,
      matched: expected === undefined || expected === stepOutcome.actualStatus,
    };
  });

  const replayOutcomes = stepOutcomes.filter((step) => step.kind === 'assert_replay_summary');
  const replaySummaryInvariantsHold = replayOutcomes.every((step) => {
    const scenarioStep = scenario.steps.find((candidate) => candidate.stepId === step.stepId);
    if (!scenarioStep || scenarioStep.kind !== 'assert_replay_summary') return true;
    const observedSupport = Number(step.observed?.supportingEvidenceCount ?? 0);
    const observedContradiction = Number(step.observed?.contradictingEvidenceCount ?? 0);
    const supportOk =
      scenarioStep.expectSupportAtLeast === undefined ||
      observedSupport >= scenarioStep.expectSupportAtLeast;
    const contradictionOk =
      scenarioStep.expectContradictionAtLeast === undefined ||
      observedContradiction >= scenarioStep.expectContradictionAtLeast;
    return supportOk && contradictionOk;
  });

  return {
    scenarioId: scenario.scenarioId,
    tags: outcome.tags,
    passed: stepOutcomes.every((step) => step.matched) && replaySummaryInvariantsHold,
    stepOutcomes,
    operationCounts: outcome.operationCounts,
    replaySummaryInvariantsHold,
  };
}
