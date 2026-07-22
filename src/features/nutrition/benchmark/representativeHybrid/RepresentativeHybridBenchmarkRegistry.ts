import {
  REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION,
  type RepresentativeHybridBenchmarkPartition,
  type RepresentativeHybridBenchmarkRegistryManifest,
} from './RepresentativeHybridBenchmarkTypes';

/**
 * Immutable dev/holdout registry for the RESOLVER-V3-038 successor corpus, mirroring
 * `LearningBenchmarkV2Registry.ts` (itself mirroring the RESOLVER-V3-029
 * `ResolverKnowledgeShadowCorpusRegistry` pattern): a plain, source-controlled manifest value plus a
 * thin indexing class. Fails closed on an unknown registry version or a scenario ID assigned to more
 * than one partition. A scenario's authoritative partition is looked up here, never trusted from a
 * caller/request.
 */
export class RepresentativeHybridBenchmarkRegistry {
  readonly version: typeof REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION;
  private readonly partitionByScenarioId: ReadonlyMap<
    string,
    RepresentativeHybridBenchmarkPartition
  >;

  constructor(manifest: RepresentativeHybridBenchmarkRegistryManifest) {
    if (manifest.registryVersion !== REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION) {
      throw new Error('REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_UNKNOWN_VERSION');
    }
    const index = new Map<string, RepresentativeHybridBenchmarkPartition>();
    for (const entry of manifest.entries) {
      if (index.has(entry.scenarioId)) {
        throw new Error('REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
      }
      index.set(entry.scenarioId, entry.partition);
    }
    this.version = manifest.registryVersion;
    this.partitionByScenarioId = index;
  }

  partitionFor(scenarioId: string): RepresentativeHybridBenchmarkPartition | undefined {
    return this.partitionByScenarioId.get(scenarioId);
  }

  has(scenarioId: string): boolean {
    return this.partitionByScenarioId.has(scenarioId);
  }

  get size(): number {
    return this.partitionByScenarioId.size;
  }

  scenarioIdsFor(partition: RepresentativeHybridBenchmarkPartition): readonly string[] {
    return [...this.partitionByScenarioId.entries()]
      .filter(([, p]) => p === partition)
      .map(([id]) => id)
      .sort();
  }
}
