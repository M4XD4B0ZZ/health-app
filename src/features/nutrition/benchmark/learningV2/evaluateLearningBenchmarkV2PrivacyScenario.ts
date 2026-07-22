import { runLearningBenchmarkV2PersonalMemorySteps } from './LearningBenchmarkV2PersonalMemoryEngine';
import { runLearningBenchmarkV2GlobalCandidateScenario } from './LearningBenchmarkV2GlobalCandidateAdapter';
import type {
  LearningBenchmarkV2GlobalCandidateScenario,
  LearningBenchmarkV2PrivacyScenario,
} from './LearningBenchmarkV2Types';

const PRIVATE_FIELD_NAMES = [
  'ownerId',
  'observationId',
  'resolverRunId',
  'contributionId',
  'contributorToken',
];

/** Recursive scan for private/linkable field names -- defense in depth mirroring the review
 * service's own `containsPrivateField` walk, applied here to the benchmark's own reported output. */
function containsPrivateField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsPrivateField(item));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => PRIVATE_FIELD_NAMES.includes(key) || containsPrivateField(nested),
    );
  }
  return false;
}

export interface LearningBenchmarkV2PrivacyScenarioEvaluation {
  scenarioId: string;
  passed: boolean;
  crossUserLeakCount: number;
  deletionRemovesEffect: boolean | null;
  globalCandidatePrivacyLeakDetected: boolean;
  personalMemoryStepsMatched: boolean | null;
}

export async function evaluateLearningBenchmarkV2PrivacyScenario(
  scenario: LearningBenchmarkV2PrivacyScenario,
): Promise<LearningBenchmarkV2PrivacyScenarioEvaluation> {
  let crossUserLeakCount = 0;
  let personalMemoryStepsMatched: boolean | null = null;
  let deletionRemovesEffect: boolean | null = null;

  if (scenario.personalMemorySteps) {
    const run = await runLearningBenchmarkV2PersonalMemorySteps(scenario.personalMemorySteps);
    crossUserLeakCount += run.crossUserLeakCount;
    personalMemoryStepsMatched = run.allStepsMatched;
    if (scenario.assertDeletionRemovesEffect) {
      const lastRead = [...run.stepOutcomes].reverse().find((outcome) => outcome.kind === 'read');
      deletionRemovesEffect = lastRead ? lastRead.matchCount === 0 : null;
    }
  }

  let globalCandidatePrivacyLeakDetected = false;
  if (scenario.globalCandidateSteps) {
    const globalScenario: LearningBenchmarkV2GlobalCandidateScenario = {
      scenarioId: scenario.scenarioId,
      corpusVersion: scenario.corpusVersion,
      partition: scenario.partition,
      scenarioType: 'global_candidate_sequence',
      locale: scenario.locale,
      difficulty: scenario.difficulty,
      groundTruthClass: scenario.groundTruthClass,
      personalDataFree: scenario.personalDataFree,
      expectedInvariantOutcomes: scenario.expectedInvariantOutcomes,
      reproducibilityNotes: scenario.reproducibilityNotes,
      tags: scenario.tags,
      fixtureVersionsUsed: scenario.fixtureVersionsUsed,
      steps: scenario.globalCandidateSteps,
    };
    const outcome = await runLearningBenchmarkV2GlobalCandidateScenario(globalScenario);
    globalCandidatePrivacyLeakDetected = containsPrivateField(outcome.finalCandidates);
  }

  const passed =
    (!scenario.assertNoCrossUserLeak || crossUserLeakCount === 0) &&
    (!scenario.assertDeletionRemovesEffect || deletionRemovesEffect === true) &&
    !globalCandidatePrivacyLeakDetected &&
    personalMemoryStepsMatched !== false;

  return {
    scenarioId: scenario.scenarioId,
    passed,
    crossUserLeakCount,
    deletionRemovesEffect,
    globalCandidatePrivacyLeakDetected,
    personalMemoryStepsMatched,
  };
}
