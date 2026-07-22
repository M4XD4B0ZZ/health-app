import { describe, it, expect } from '@jest/globals';
import { RepresentativeHybridBenchmarkRegistry } from '../RepresentativeHybridBenchmarkRegistry';
import { REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION } from '../RepresentativeHybridBenchmarkTypes';
import { REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST } from '../RepresentativeHybridBenchmarkManifest';

describe('RESOLVER-V3-038 RepresentativeHybridBenchmarkRegistry', () => {
  it('loads the real manifest and exposes every scenario', () => {
    const registry = new RepresentativeHybridBenchmarkRegistry(
      REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST,
    );
    expect(registry.version).toBe(REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION);
    expect(registry.size).toBe(REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST.entries.length);
    expect(registry.size).toBeGreaterThan(0);
  });

  it('development and holdout partitions are disjoint and cover every scenario', () => {
    const registry = new RepresentativeHybridBenchmarkRegistry(
      REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST,
    );
    const dev = registry.scenarioIdsFor('development');
    const holdout = registry.scenarioIdsFor('holdout');
    expect(dev.length + holdout.length).toBe(registry.size);
    expect(dev.some((id) => holdout.includes(id))).toBe(false);
  });

  it('throws on an unknown registry version', () => {
    expect(
      () =>
        new RepresentativeHybridBenchmarkRegistry({
          registryVersion: 'unknown-version' as never,
          entries: [],
        }),
    ).toThrow('REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_UNKNOWN_VERSION');
  });

  it('throws when a scenario ID is assigned to more than one partition', () => {
    expect(
      () =>
        new RepresentativeHybridBenchmarkRegistry({
          registryVersion: REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION,
          entries: [
            { scenarioId: 'DUP-1', partition: 'development' },
            { scenarioId: 'DUP-1', partition: 'holdout' },
          ],
        }),
    ).toThrow('REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
  });

  it('returns undefined/false for an unknown scenario ID', () => {
    const registry = new RepresentativeHybridBenchmarkRegistry(
      REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST,
    );
    expect(registry.partitionFor('does-not-exist')).toBeUndefined();
    expect(registry.has('does-not-exist')).toBe(false);
  });
});
