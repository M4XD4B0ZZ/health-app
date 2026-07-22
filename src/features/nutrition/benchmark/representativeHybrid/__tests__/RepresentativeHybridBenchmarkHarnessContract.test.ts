import { describe, it, expect } from '@jest/globals';
import { selfCheckRepresentativeHybridBenchmarkCorpus } from '../RepresentativeHybridBenchmarkHarnessContract';
import { REPRESENTATIVE_HYBRID_BENCHMARK_REQUIRED_CATEGORIES } from '../RepresentativeHybridBenchmarkTypes';
import {
  REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS,
  REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_HASH,
  computeRepresentativeHybridBenchmarkCorpusHash,
} from '../RepresentativeHybridBenchmarkManifest';

describe('RESOLVER-V3-038 RepresentativeHybridBenchmarkHarnessContract self-check', () => {
  it('reports the corpus as valid with zero registry cross-check mismatches', () => {
    const result = selfCheckRepresentativeHybridBenchmarkCorpus();
    expect(result.valid).toBe(true);
    expect(result.registryCrossCheckMismatches).toEqual([]);
    expect(result.totalScenarios).toBe(REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS.length);
  });

  it('covers every required category (RESOLVER-V3-024 §26.1)', () => {
    const result = selfCheckRepresentativeHybridBenchmarkCorpus();
    for (const category of REPRESENTATIVE_HYBRID_BENCHMARK_REQUIRED_CATEGORIES) {
      expect(result.categoriesCovered).toContain(category);
    }
  });

  it('counts both development and holdout scenarios', () => {
    const result = selfCheckRepresentativeHybridBenchmarkCorpus();
    expect(result.scenariosByPartition.development).toBeGreaterThan(0);
    expect(result.scenariosByPartition.holdout).toBeGreaterThan(0);
  });

  it('counts all three scenario types', () => {
    const result = selfCheckRepresentativeHybridBenchmarkCorpus();
    expect(result.scenariosByType.resolution_decomposition_hybrid_c).toBeGreaterThan(0);
    expect(result.scenariosByType.contradiction_gate_sequence).toBeGreaterThan(0);
    expect(result.scenariosByType.rollback_sequence).toBeGreaterThan(0);
  });

  it('no contradiction_gate_sequence scenario contains a rollback/revoke_approval step', () => {
    for (const scenario of REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS) {
      if (scenario.scenarioType !== 'contradiction_gate_sequence') continue;
      for (const step of scenario.steps) {
        if (step.kind !== 'review_decision') continue;
        expect(['rollback', 'revoke_approval']).not.toContain(step.action);
      }
    }
  });

  it('no rollback_sequence scenario contains a forced contradiction step', () => {
    for (const scenario of REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS) {
      if (scenario.scenarioType !== 'rollback_sequence') continue;
      for (const step of scenario.steps) {
        if (step.kind !== 'review_decision') continue;
        expect(step.forceContradiction).not.toBe(true);
      }
    }
  });

  it('the corpus hash is deterministic and order-independent', () => {
    const shuffled = [...REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS].reverse();
    expect(computeRepresentativeHybridBenchmarkCorpusHash(shuffled)).toBe(
      REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_HASH,
    );
  });

  it('every resolution scenario declares executionEngine "hybrid_c"', () => {
    for (const scenario of REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS) {
      if (scenario.scenarioType !== 'resolution_decomposition_hybrid_c') continue;
      expect(scenario.executionEngine).toBe('hybrid_c');
    }
  });
});
