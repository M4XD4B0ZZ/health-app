import type { LearningBenchmarkV2ResolutionScenarioEvaluation } from './evaluateLearningBenchmarkV2ResolutionScenario';
import type { LearningBenchmarkV2PersonalMemoryScenarioEvaluation } from './evaluateLearningBenchmarkV2PersonalMemoryScenario';
import type { LearningBenchmarkV2GlobalCandidateScenarioEvaluation } from './evaluateLearningBenchmarkV2GlobalCandidateScenario';
import type { LearningBenchmarkV2PrivacyScenarioEvaluation } from './evaluateLearningBenchmarkV2PrivacyScenario';
import type { LearningBenchmarkV2EconomicsScenarioEvaluation } from './evaluateLearningBenchmarkV2EconomicsScenario';

export interface LearningBenchmarkV2PartitionMetrics {
  scenarioCount: number;
  resolution: {
    count: number;
    matchCount: number;
    falseConfidenceCount: number;
    categoryBreakdown: Readonly<Record<string, number>>;
    difficultyBreakdown: Readonly<Record<string, number>>;
  };
  personalMemory: {
    sequenceCount: number;
    passedCount: number;
    avoidedInterpretationCallCount: number;
    interpretationCallsInvoked: number;
  };
  globalCandidate: {
    scenarioCount: number;
    passedCount: number;
    contributionsRecorded: number;
    idempotentRetriesSkipped: number;
    contributionConflicts: number;
    candidatesCreated: number;
    reviewOperations: number;
    retractionsApplied: number;
    retractionIdempotentRetries: number;
    shadowEvaluations: number;
    replayComputations: number;
  };
  privacy: {
    scenarioCount: number;
    passedCount: number;
    crossUserLeakCountTotal: number;
    globalCandidatePrivacyLeakDetectedCount: number;
  };
  economics: {
    scenarioCount: number;
    passedCount: number;
    avoidedInterpretationCallCountTotal: number;
    interpretationCallsInvokedTotal: number;
    fixtureBilledCostUsd: 0;
    productionCostUsd: 'unknown';
    databaseBatchCostUsd: 'not_evaluable';
  };
}

function tally(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

export function aggregateLearningBenchmarkV2Metrics(input: {
  resolution: readonly LearningBenchmarkV2ResolutionScenarioEvaluation[];
  personalMemory: readonly LearningBenchmarkV2PersonalMemoryScenarioEvaluation[];
  globalCandidate: readonly LearningBenchmarkV2GlobalCandidateScenarioEvaluation[];
  privacy: readonly LearningBenchmarkV2PrivacyScenarioEvaluation[];
  economics: readonly LearningBenchmarkV2EconomicsScenarioEvaluation[];
}): LearningBenchmarkV2PartitionMetrics {
  const { resolution, personalMemory, globalCandidate, privacy, economics } = input;

  return {
    scenarioCount:
      resolution.length +
      personalMemory.length +
      globalCandidate.length +
      privacy.length +
      economics.length,
    resolution: {
      count: resolution.length,
      matchCount: resolution.filter((r) => r.passed).length,
      falseConfidenceCount: resolution.filter((r) => r.evaluation.falseConfident).length,
      categoryBreakdown: tally(resolution.map((r) => r.category)),
      difficultyBreakdown: tally(resolution.map((r) => r.difficulty)),
    },
    personalMemory: {
      sequenceCount: personalMemory.length,
      passedCount: personalMemory.filter((p) => p.passed).length,
      avoidedInterpretationCallCount: personalMemory.reduce(
        (sum, p) => sum + p.avoidedInterpretationCallCount,
        0,
      ),
      interpretationCallsInvoked: personalMemory.reduce(
        (sum, p) => sum + p.interpretationCallsInvoked,
        0,
      ),
    },
    globalCandidate: {
      scenarioCount: globalCandidate.length,
      passedCount: globalCandidate.filter((g) => g.passed).length,
      contributionsRecorded: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.contributionsRecorded,
        0,
      ),
      idempotentRetriesSkipped: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.idempotentRetriesSkipped,
        0,
      ),
      contributionConflicts: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.contributionConflicts,
        0,
      ),
      candidatesCreated: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.candidatesCreated,
        0,
      ),
      reviewOperations: globalCandidate.reduce((s, g) => s + g.operationCounts.reviewOperations, 0),
      retractionsApplied: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.retractionsApplied,
        0,
      ),
      retractionIdempotentRetries: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.retractionIdempotentRetries,
        0,
      ),
      shadowEvaluations: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.shadowEvaluations,
        0,
      ),
      replayComputations: globalCandidate.reduce(
        (s, g) => s + g.operationCounts.replayComputations,
        0,
      ),
    },
    privacy: {
      scenarioCount: privacy.length,
      passedCount: privacy.filter((p) => p.passed).length,
      crossUserLeakCountTotal: privacy.reduce((s, p) => s + p.crossUserLeakCount, 0),
      globalCandidatePrivacyLeakDetectedCount: privacy.filter(
        (p) => p.globalCandidatePrivacyLeakDetected,
      ).length,
    },
    economics: {
      scenarioCount: economics.length,
      passedCount: economics.filter((e) => e.passed).length,
      avoidedInterpretationCallCountTotal: economics.reduce(
        (s, e) => s + e.avoidedInterpretationCallCount,
        0,
      ),
      interpretationCallsInvokedTotal: economics.reduce(
        (s, e) => s + e.interpretationCallsInvoked,
        0,
      ),
      fixtureBilledCostUsd: 0,
      productionCostUsd: 'unknown',
      databaseBatchCostUsd: 'not_evaluable',
    },
  };
}
