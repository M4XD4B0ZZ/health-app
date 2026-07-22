import { createHash } from 'node:crypto';
import { LEARNING_BENCHMARK_V3_CORPUS } from './LearningBenchmarkV3Corpus';
import { LEARNING_BENCHMARK_V3_REGISTRY_VERSION } from './LearningBenchmarkV3Types';
import type {
  LearningBenchmarkV3RegistryManifest,
  LearningBenchmarkV3Scenario,
} from './LearningBenchmarkV3Types';

export const LEARNING_BENCHMARK_V3_REGISTRY_MANIFEST: LearningBenchmarkV3RegistryManifest = {
  registryVersion: LEARNING_BENCHMARK_V3_REGISTRY_VERSION,
  entries: LEARNING_BENCHMARK_V3_CORPUS.map(({ scenarioId, partition }) => ({
    scenarioId,
    partition,
  })),
};

export function computeLearningBenchmarkV3CorpusHash(
  corpus: readonly LearningBenchmarkV3Scenario[] = LEARNING_BENCHMARK_V3_CORPUS,
): string {
  return createHash('sha256')
    .update(JSON.stringify([...corpus].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))))
    .digest('hex');
}

export const LEARNING_BENCHMARK_V3_CORPUS_HASH = computeLearningBenchmarkV3CorpusHash();
