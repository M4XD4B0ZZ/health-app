import {
  LEARNING_BENCHMARK_V3_REGISTRY_VERSION,
  type LearningBenchmarkV3Partition,
  type LearningBenchmarkV3RegistryManifest,
} from './LearningBenchmarkV3Types';

/** Source-controlled partition authority; callers cannot reassign holdout cases. */
export class LearningBenchmarkV3Registry {
  private readonly partitionByScenarioId: ReadonlyMap<string, LearningBenchmarkV3Partition>;

  constructor(manifest: LearningBenchmarkV3RegistryManifest) {
    if (manifest.registryVersion !== LEARNING_BENCHMARK_V3_REGISTRY_VERSION) {
      throw new Error('LEARNING_BENCHMARK_V3_REGISTRY_UNKNOWN_VERSION');
    }
    const index = new Map<string, LearningBenchmarkV3Partition>();
    for (const entry of manifest.entries) {
      if (index.has(entry.scenarioId)) {
        throw new Error('LEARNING_BENCHMARK_V3_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
      }
      index.set(entry.scenarioId, entry.partition);
    }
    this.partitionByScenarioId = index;
  }

  partitionFor(scenarioId: string): LearningBenchmarkV3Partition | undefined {
    return this.partitionByScenarioId.get(scenarioId);
  }

  scenarioIdsFor(partition: LearningBenchmarkV3Partition): readonly string[] {
    return [...this.partitionByScenarioId.entries()]
      .filter(([, assigned]) => assigned === partition)
      .map(([scenarioId]) => scenarioId)
      .sort();
  }
}
