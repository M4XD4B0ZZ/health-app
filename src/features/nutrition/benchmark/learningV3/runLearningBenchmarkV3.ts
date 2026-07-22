import { LEARNING_BENCHMARK_V3_CORPUS } from './LearningBenchmarkV3Corpus';
import { LEARNING_BENCHMARK_V3_REGISTRY_MANIFEST } from './LearningBenchmarkV3Manifest';
import { LearningBenchmarkV3Registry } from './LearningBenchmarkV3Registry';
import { assertValidLearningBenchmarkV3Corpus } from './LearningBenchmarkV3Validator';
import type {
  LearningBenchmarkV3Partition,
  LearningBenchmarkV3Scenario,
} from './LearningBenchmarkV3Types';

/** Planning harness only: it makes an accidental fixture fallback impossible by refusing execution.
 * RESOLVER-V3-039 must supply the pinned, budget-authorized live executor in a separate task. */
export function prepareLearningBenchmarkV3Run(
  partition: LearningBenchmarkV3Partition | 'all' = 'all',
): readonly LearningBenchmarkV3Scenario[] {
  assertValidLearningBenchmarkV3Corpus(LEARNING_BENCHMARK_V3_CORPUS);
  const registry = new LearningBenchmarkV3Registry(LEARNING_BENCHMARK_V3_REGISTRY_MANIFEST);
  const selected = LEARNING_BENCHMARK_V3_CORPUS.filter(
    (scenario) => partition === 'all' || scenario.partition === partition,
  );
  for (const scenario of selected) {
    if (registry.partitionFor(scenario.scenarioId) !== scenario.partition)
      throw new Error('LEARNING_BENCHMARK_V3_REGISTRY_PARTITION_MISMATCH');
  }
  return selected;
}

export function runLearningBenchmarkV3(): never {
  throw new Error('LEARNING_BENCHMARK_V3_LIVE_EXECUTOR_NOT_AUTHORIZED');
}
