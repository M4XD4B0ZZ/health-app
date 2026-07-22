import { createHash } from 'node:crypto';
import {
  LEARNING_BENCHMARK_V2_CORPUS_VERSION,
  LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
  type LearningBenchmarkV2RegistryManifest,
  type LearningBenchmarkV2Scenario,
} from './LearningBenchmarkV2Types';
import { LEARNING_BENCHMARK_V2_RESOLUTION_SCENARIOS } from './LearningBenchmarkV2ResolutionCorpus';
import { LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_SCENARIOS } from './LearningBenchmarkV2PersonalMemoryCorpus';
import { LEARNING_BENCHMARK_V2_GLOBAL_CANDIDATE_SCENARIOS } from './LearningBenchmarkV2GlobalCandidateCorpus';
import { LEARNING_BENCHMARK_V2_PRIVACY_SCENARIOS } from './LearningBenchmarkV2PrivacyCorpus';
import { LEARNING_BENCHMARK_V2_ECONOMICS_SCENARIOS } from './LearningBenchmarkV2EconomicsCorpus';

/**
 * The complete, frozen Learning Benchmark V2 corpus (binding requirement §16 corpus-freeze
 * protocol). Combines all five scenario classes. Sorted deterministically by `scenarioId` so
 * fixture declaration order never affects the canonical corpus hash (required test: "fixture order
 * does not affect canonical corpus hash").
 */
export const LEARNING_BENCHMARK_V2_CORPUS: readonly LearningBenchmarkV2Scenario[] = [
  ...LEARNING_BENCHMARK_V2_RESOLUTION_SCENARIOS,
  ...LEARNING_BENCHMARK_V2_PERSONAL_MEMORY_SCENARIOS,
  ...LEARNING_BENCHMARK_V2_GLOBAL_CANDIDATE_SCENARIOS,
  ...LEARNING_BENCHMARK_V2_PRIVACY_SCENARIOS,
  ...LEARNING_BENCHMARK_V2_ECONOMICS_SCENARIOS,
]
  .slice()
  .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

export const LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST: LearningBenchmarkV2RegistryManifest = {
  registryVersion: LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
  entries: LEARNING_BENCHMARK_V2_CORPUS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    partition: scenario.partition,
  })),
};

/** Deterministic, order-independent content hash: sorts scenarios by ID first (done above), then
 * hashes their canonically key-ordered JSON serialization. */
export function computeLearningBenchmarkV2CorpusHash(
  scenarios: readonly LearningBenchmarkV2Scenario[] = LEARNING_BENCHMARK_V2_CORPUS,
): string {
  const sorted = [...scenarios].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  const canonical = sorted.map((scenario) => canonicalStringify(scenario));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export const LEARNING_BENCHMARK_V2_CORPUS_HASH = computeLearningBenchmarkV2CorpusHash();

export { LEARNING_BENCHMARK_V2_CORPUS_VERSION };
