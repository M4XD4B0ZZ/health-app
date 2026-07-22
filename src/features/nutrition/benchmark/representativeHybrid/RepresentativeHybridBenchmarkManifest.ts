import { createHash } from 'node:crypto';
import {
  REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION,
  type RepresentativeHybridBenchmarkRegistryManifest,
  type RepresentativeHybridBenchmarkScenario,
} from './RepresentativeHybridBenchmarkTypes';
import { REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_SCENARIOS } from './RepresentativeHybridBenchmarkResolutionCorpus';
import { REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_SCENARIOS } from './RepresentativeHybridBenchmarkContradictionGateCorpus';
import { REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_SCENARIOS } from './RepresentativeHybridBenchmarkRollbackCorpus';

/**
 * The complete RESOLVER-V3-038 successor corpus, mirroring `LearningBenchmarkV2Manifest.ts`'s
 * corpus-freeze pattern. Combines all three scenario classes. Sorted deterministically by
 * `scenarioId` so fixture declaration order never affects the canonical corpus hash.
 */
export const REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS: readonly RepresentativeHybridBenchmarkScenario[] =
  [
    ...REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_BENCHMARK_CONTRADICTION_GATE_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_BENCHMARK_ROLLBACK_SCENARIOS,
  ]
    .slice()
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

export const REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST: RepresentativeHybridBenchmarkRegistryManifest =
  {
    registryVersion: REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_VERSION,
    entries: REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      partition: scenario.partition,
    })),
  };

/** Deterministic, order-independent content hash: sorts scenarios by ID first (done above), then
 * hashes their canonically key-ordered JSON serialization. Mirrors
 * `computeLearningBenchmarkV2CorpusHash` exactly. */
export function computeRepresentativeHybridBenchmarkCorpusHash(
  scenarios: readonly RepresentativeHybridBenchmarkScenario[] = REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS,
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

export const REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_HASH =
  computeRepresentativeHybridBenchmarkCorpusHash();

export { REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION };
