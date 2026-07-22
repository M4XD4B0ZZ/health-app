import {
  REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
  type RepresentativeHybridV1Partition,
  type RepresentativeHybridV1RegistryManifest,
  type RepresentativeHybridV1Scenario,
} from './RepresentativeHybridV1Types';

/**
 * Immutable dev/holdout registry (requirement 25). Fails closed on an unknown registry version or a
 * scenario ID assigned to more than one partition. A scenario's authoritative partition is looked up
 * here, never trusted from a caller/request. `assertNoOverlayPartitionDrift` additionally rejects a
 * repeat/paraphrase overlay whose own `partition` differs from its base scenario's registered
 * partition (requirement 8: "prevent an overlay from silently moving partitions independently of its
 * base case").
 */
export class RepresentativeHybridV1Registry {
  readonly version: typeof REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION;
  private readonly partitionByScenarioId: ReadonlyMap<string, RepresentativeHybridV1Partition>;

  constructor(manifest: RepresentativeHybridV1RegistryManifest) {
    if (manifest.registryVersion !== REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION) {
      throw new Error('REPRESENTATIVE_HYBRID_V1_REGISTRY_UNKNOWN_VERSION');
    }
    const index = new Map<string, RepresentativeHybridV1Partition>();
    for (const entry of manifest.entries) {
      if (index.has(entry.scenarioId)) {
        throw new Error('REPRESENTATIVE_HYBRID_V1_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
      }
      index.set(entry.scenarioId, entry.partition);
    }
    this.version = manifest.registryVersion;
    this.partitionByScenarioId = index;
  }

  partitionFor(scenarioId: string): RepresentativeHybridV1Partition | undefined {
    return this.partitionByScenarioId.get(scenarioId);
  }

  has(scenarioId: string): boolean {
    return this.partitionByScenarioId.has(scenarioId);
  }

  get size(): number {
    return this.partitionByScenarioId.size;
  }

  scenarioIdsFor(partition: RepresentativeHybridV1Partition): readonly string[] {
    return [...this.partitionByScenarioId.entries()]
      .filter(([, p]) => p === partition)
      .map(([id]) => id)
      .sort();
  }
}

export class RepresentativeHybridV1OverlayPartitionDriftError extends Error {
  constructor(
    public readonly overlayScenarioId: string,
    public readonly baseScenarioId: string,
  ) {
    super(
      `Overlay "${overlayScenarioId}" partition does not match its base scenario "${baseScenarioId}"'s ` +
        'registered partition.',
    );
    this.name = 'RepresentativeHybridV1OverlayPartitionDriftError';
  }
}

/** Throws if any resolution scenario's `repeatOverlay.baseScenarioId` (a) does not exist in the
 * registry, or (b) is registered under a different partition than the overlay itself. */
export function assertNoOverlayPartitionDrift(
  scenarios: readonly RepresentativeHybridV1Scenario[],
  registry: RepresentativeHybridV1Registry,
): void {
  for (const scenario of scenarios) {
    if (scenario.scenarioType !== 'resolution_decomposition' || !scenario.repeatOverlay) continue;
    const basePartition = registry.partitionFor(scenario.repeatOverlay.baseScenarioId);
    if (basePartition === undefined) {
      throw new Error(
        `Overlay "${scenario.scenarioId}" references unknown base scenario ` +
          `"${scenario.repeatOverlay.baseScenarioId}".`,
      );
    }
    if (basePartition !== scenario.partition) {
      throw new RepresentativeHybridV1OverlayPartitionDriftError(
        scenario.scenarioId,
        scenario.repeatOverlay.baseScenarioId,
      );
    }
  }
}
