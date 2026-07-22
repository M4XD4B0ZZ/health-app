import {
  LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
  type LearningBenchmarkV2Partition,
  type LearningBenchmarkV2RegistryManifest,
} from './LearningBenchmarkV2Types';

/**
 * Immutable dev/holdout registry, mirroring `ResolverKnowledgeShadowCorpusRegistry`'s pattern
 * (RESOLVER-V3-029): a plain, source-controlled manifest value plus a thin indexing class. Fails
 * closed on an unknown registry version or a scenario ID assigned to more than one partition. A
 * scenario's authoritative partition is looked up here, never trusted from a caller/request.
 */
export class LearningBenchmarkV2Registry {
  readonly version: typeof LEARNING_BENCHMARK_V2_REGISTRY_VERSION;
  private readonly partitionByScenarioId: ReadonlyMap<string, LearningBenchmarkV2Partition>;

  constructor(manifest: LearningBenchmarkV2RegistryManifest) {
    if (manifest.registryVersion !== LEARNING_BENCHMARK_V2_REGISTRY_VERSION) {
      throw new Error('LEARNING_BENCHMARK_V2_REGISTRY_UNKNOWN_VERSION');
    }
    const index = new Map<string, LearningBenchmarkV2Partition>();
    for (const entry of manifest.entries) {
      if (index.has(entry.scenarioId)) {
        throw new Error('LEARNING_BENCHMARK_V2_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
      }
      index.set(entry.scenarioId, entry.partition);
    }
    this.version = manifest.registryVersion;
    this.partitionByScenarioId = index;
  }

  partitionFor(scenarioId: string): LearningBenchmarkV2Partition | undefined {
    return this.partitionByScenarioId.get(scenarioId);
  }

  has(scenarioId: string): boolean {
    return this.partitionByScenarioId.has(scenarioId);
  }

  get size(): number {
    return this.partitionByScenarioId.size;
  }

  scenarioIdsFor(partition: LearningBenchmarkV2Partition): readonly string[] {
    return [...this.partitionByScenarioId.entries()]
      .filter(([, p]) => p === partition)
      .map(([id]) => id)
      .sort();
  }
}
