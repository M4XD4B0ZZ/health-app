import {
  assertNoOverlayPartitionDrift,
  RepresentativeHybridV1OverlayPartitionDriftError,
  RepresentativeHybridV1Registry,
} from '../RepresentativeHybridV1Registry';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST,
  computeRepresentativeHybridV1CorpusHash,
} from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION } from '../RepresentativeHybridV1Types';
import type { RepresentativeHybridV1Scenario } from '../RepresentativeHybridV1Types';
import {
  computeRepresentativeHybridV1SourceManifestHash,
  REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS,
} from '../RepresentativeHybridV1SourceSnapshotManifest';

describe('RESOLVER-V3-038 registry and freeze protocol', () => {
  it('builds successfully from the real frozen manifest', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    expect(registry.size).toBe(REPRESENTATIVE_HYBRID_V1_CORPUS.length);
  });

  it('rejects an unknown registry version', () => {
    expect(
      () =>
        new RepresentativeHybridV1Registry({
          registryVersion: 'some-other-version' as never,
          entries: [],
        }),
    ).toThrow('REPRESENTATIVE_HYBRID_V1_REGISTRY_UNKNOWN_VERSION');
  });

  it('rejects a duplicate scenarioId assigned to two partitions', () => {
    expect(
      () =>
        new RepresentativeHybridV1Registry({
          registryVersion: REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
          entries: [
            { scenarioId: 'dup', partition: 'development' },
            { scenarioId: 'dup', partition: 'holdout' },
          ],
        }),
    ).toThrow('REPRESENTATIVE_HYBRID_V1_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
  });

  it('reports missing scenarios as absent (has() returns false)', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    expect(registry.has('RH-RES-DOES-NOT-EXIST')).toBe(false);
  });

  it('every corpus scenario is present in the registry under the same partition', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    for (const scenario of REPRESENTATIVE_HYBRID_V1_CORPUS) {
      expect(registry.has(scenario.scenarioId)).toBe(true);
      expect(registry.partitionFor(scenario.scenarioId)).toBe(scenario.partition);
    }
  });

  it('detects no overlay/base partition drift in the real frozen corpus', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    expect(() =>
      assertNoOverlayPartitionDrift(REPRESENTATIVE_HYBRID_V1_CORPUS, registry),
    ).not.toThrow();
  });

  it('rejects an overlay whose partition differs from its base scenario', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    const base = REPRESENTATIVE_HYBRID_V1_CORPUS.find(
      (s) => s.scenarioType === 'resolution_decomposition' && s.partition === 'development',
    ) as Extract<RepresentativeHybridV1Scenario, { scenarioType: 'resolution_decomposition' }>;
    const driftedOverlay = {
      ...base,
      scenarioId: 'RH-RES-DRIFT-TEST',
      partition: 'holdout' as const,
      repeatOverlay: { baseScenarioId: base.scenarioId, overlayKind: 'exact_repeat' as const },
    };
    expect(() =>
      assertNoOverlayPartitionDrift([...REPRESENTATIVE_HYBRID_V1_CORPUS, driftedOverlay], registry),
    ).toThrow(RepresentativeHybridV1OverlayPartitionDriftError);
  });

  it('rejects an overlay referencing an unknown base scenario', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    const base = REPRESENTATIVE_HYBRID_V1_CORPUS.find(
      (s) => s.scenarioType === 'resolution_decomposition',
    ) as Extract<RepresentativeHybridV1Scenario, { scenarioType: 'resolution_decomposition' }>;
    const orphanOverlay = {
      ...base,
      scenarioId: 'RH-RES-ORPHAN-TEST',
      repeatOverlay: {
        baseScenarioId: 'RH-RES-DOES-NOT-EXIST',
        overlayKind: 'exact_repeat' as const,
      },
    };
    expect(() =>
      assertNoOverlayPartitionDrift([...REPRESENTATIVE_HYBRID_V1_CORPUS, orphanOverlay], registry),
    ).toThrow(/unknown base scenario/);
  });

  it('produces a deterministic corpus hash regardless of declaration order', () => {
    const forward = computeRepresentativeHybridV1CorpusHash(REPRESENTATIVE_HYBRID_V1_CORPUS);
    const reversed = computeRepresentativeHybridV1CorpusHash(
      [...REPRESENTATIVE_HYBRID_V1_CORPUS].reverse(),
    );
    expect(forward).toBe(reversed);
  });

  it('produces a different hash when a scenario is mutated', () => {
    const original = computeRepresentativeHybridV1CorpusHash(REPRESENTATIVE_HYBRID_V1_CORPUS);
    const mutated = REPRESENTATIVE_HYBRID_V1_CORPUS.map((s, i) =>
      i === 0 ? { ...s, reproducibilityNotes: `${s.reproducibilityNotes} (mutated)` } : s,
    );
    const mutatedHash = computeRepresentativeHybridV1CorpusHash(mutated);
    expect(mutatedHash).not.toBe(original);
  });

  it('scenarioIdsFor returns sorted, partition-filtered IDs', () => {
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    const holdoutIds = registry.scenarioIdsFor('holdout');
    expect(holdoutIds.length).toBeGreaterThan(0);
    expect([...holdoutIds].sort()).toEqual(holdoutIds);
    for (const id of holdoutIds) {
      expect(registry.partitionFor(id)).toBe('holdout');
    }
  });

  it('produces a deterministic source-manifest hash regardless of declaration order', () => {
    const forward = computeRepresentativeHybridV1SourceManifestHash(
      REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS,
    );
    const reversed = computeRepresentativeHybridV1SourceManifestHash(
      [...REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS].reverse(),
    );
    expect(forward).toBe(reversed);
  });

  it('every source snapshot has a covered case ID that actually exists in the corpus', () => {
    const resolutionCaseIds = new Set(
      REPRESENTATIVE_HYBRID_V1_CORPUS.filter(
        (s) => s.scenarioType === 'resolution_decomposition',
      ).map((s) => s.scenarioId),
    );
    for (const snapshot of REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS) {
      for (const caseId of snapshot.coveredCaseIds) {
        expect(resolutionCaseIds.has(caseId)).toBe(true);
      }
    }
  });
});
