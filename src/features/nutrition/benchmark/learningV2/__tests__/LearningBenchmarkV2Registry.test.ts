import { describe, it, expect } from '@jest/globals';
import { LearningBenchmarkV2Registry } from '../LearningBenchmarkV2Registry';
import { LEARNING_BENCHMARK_V2_REGISTRY_VERSION } from '../LearningBenchmarkV2Types';
import {
  LEARNING_BENCHMARK_V2_CORPUS,
  LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST,
  computeLearningBenchmarkV2CorpusHash,
} from '../LearningBenchmarkV2Manifest';

describe('LearningBenchmarkV2Registry', () => {
  it('rejects an unknown registry version', () => {
    expect(
      () =>
        new LearningBenchmarkV2Registry({ registryVersion: 'unknown-v0' as never, entries: [] }),
    ).toThrow('LEARNING_BENCHMARK_V2_REGISTRY_UNKNOWN_VERSION');
  });

  it('rejects a duplicate scenario ID assigned to more than one partition', () => {
    expect(
      () =>
        new LearningBenchmarkV2Registry({
          registryVersion: LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
          entries: [
            { scenarioId: 'dup', partition: 'development' },
            { scenarioId: 'dup', partition: 'holdout' },
          ],
        }),
    ).toThrow('LEARNING_BENCHMARK_V2_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
  });

  it('reports an unregistered scenario as undefined, never a fabricated partition', () => {
    const registry = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);
    expect(registry.partitionFor('does-not-exist')).toBeUndefined();
    expect(registry.has('does-not-exist')).toBe(false);
  });

  it('every real corpus scenario is registered under exactly its own declared partition', () => {
    const registry = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);
    for (const scenario of LEARNING_BENCHMARK_V2_CORPUS) {
      expect(registry.partitionFor(scenario.scenarioId)).toBe(scenario.partition);
    }
    expect(registry.size).toBe(LEARNING_BENCHMARK_V2_CORPUS.length);
  });

  it('reconstructing the registry from the same manifest is deterministic (no partition move)', () => {
    const first = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);
    const second = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);
    for (const scenario of LEARNING_BENCHMARK_V2_CORPUS) {
      expect(first.partitionFor(scenario.scenarioId)).toBe(
        second.partitionFor(scenario.scenarioId),
      );
    }
  });

  it('allocates at least 20% of scenario IDs to holdout', () => {
    const registry = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);
    const holdoutCount = registry.scenarioIdsFor('holdout').length;
    const total = registry.size;
    expect(holdoutCount / total).toBeGreaterThanOrEqual(0.2);
  });

  it('every scenario class appears in holdout', () => {
    const registry = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);
    const holdoutIds = new Set(registry.scenarioIdsFor('holdout'));
    const holdoutTypes = new Set(
      LEARNING_BENCHMARK_V2_CORPUS.filter((s) => holdoutIds.has(s.scenarioId)).map(
        (s) => s.scenarioType,
      ),
    );
    expect([...holdoutTypes].sort()).toEqual(
      [
        'economics_sequence',
        'global_candidate_sequence',
        'personal_memory_sequence',
        'privacy_deletion_sequence',
        'resolution_decomposition',
      ].sort(),
    );
  });

  it('holdout includes at least one hard/adversarial case', () => {
    const holdout = LEARNING_BENCHMARK_V2_CORPUS.filter((s) => s.partition === 'holdout');
    expect(holdout.some((s) => s.difficulty === 'hard' || s.difficulty === 'adversarial')).toBe(
      true,
    );
  });

  it('the corpus hash is deterministic and independent of declaration order', () => {
    const hashA = computeLearningBenchmarkV2CorpusHash(LEARNING_BENCHMARK_V2_CORPUS);
    const shuffled = [...LEARNING_BENCHMARK_V2_CORPUS].reverse();
    const hashB = computeLearningBenchmarkV2CorpusHash(shuffled);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });
});
