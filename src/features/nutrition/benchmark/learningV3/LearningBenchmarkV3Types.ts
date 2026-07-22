import type { BenchmarkCase } from '../BenchmarkCaseTypes';

/** RESOLVER-V3-038 successor contract. This corpus is deliberately independent of frozen V2. */
export const LEARNING_BENCHMARK_V3_CORPUS_VERSION = 'resolver-learning-benchmark-v3-corpus-1.0.0';
export const LEARNING_BENCHMARK_V3_REGISTRY_VERSION = 'resolver-learning-benchmark-v3-registry-v1';
export const LEARNING_BENCHMARK_V3_HARNESS_VERSION = '1.0.0';

export type LearningBenchmarkV3Partition = 'development' | 'holdout';
export type LearningBenchmarkV3ScenarioType = 'hybrid_resolution' | 'review_gate';

export interface LearningBenchmarkV3ScenarioBase {
  scenarioId: string;
  corpusVersion: typeof LEARNING_BENCHMARK_V3_CORPUS_VERSION;
  partition: LearningBenchmarkV3Partition;
  scenarioType: LearningBenchmarkV3ScenarioType;
  personalDataFree: true;
  reproducibilityNotes: string;
  tags: readonly string[];
}

/** A live Hybrid-C execution is mandatory; a fixture result is never an admissible substitute. */
export interface LearningBenchmarkV3HybridResolutionScenario extends LearningBenchmarkV3ScenarioBase {
  scenarioType: 'hybrid_resolution';
  case: BenchmarkCase;
  requiresLiveHybrid: true;
}

/** Keeps contradiction approval and legitimate rollback as independently executable fixtures. */
export interface LearningBenchmarkV3ReviewGateScenario extends LearningBenchmarkV3ScenarioBase {
  scenarioType: 'review_gate';
  gate: 'contradiction_blocks_approval' | 'rollback_of_approved_candidate';
}

export type LearningBenchmarkV3Scenario =
  | LearningBenchmarkV3HybridResolutionScenario
  | LearningBenchmarkV3ReviewGateScenario;

export interface LearningBenchmarkV3RegistryManifest {
  registryVersion: typeof LEARNING_BENCHMARK_V3_REGISTRY_VERSION;
  entries: readonly { scenarioId: string; partition: LearningBenchmarkV3Partition }[];
}
