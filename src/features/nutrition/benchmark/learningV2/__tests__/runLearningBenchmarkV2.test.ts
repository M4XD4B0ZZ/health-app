import { describe, it, expect } from '@jest/globals';
import { runLearningBenchmarkV2 } from '../runLearningBenchmarkV2';
import {
  buildLearningBenchmarkV2HumanReport,
  buildLearningBenchmarkV2MachineReport,
} from '../buildLearningBenchmarkV2Reports';

describe('runLearningBenchmarkV2 (end-to-end, zero network)', () => {
  it('defaults to the development partition only', async () => {
    const result = await runLearningBenchmarkV2();
    expect(result.partitionsRun).toEqual(['development']);
    expect(result.development).not.toBeNull();
    expect(result.holdout).toBeNull();
  });

  it('runs holdout when explicitly requested by the caller', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'holdout' });
    expect(result.partitionsRun).toEqual(['holdout']);
    expect(result.holdout).not.toBeNull();
    expect(result.development).toBeNull();
  });

  it('runs both partitions with partition: "all", separately', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'all' });
    expect(result.partitionsRun).toEqual(['development', 'holdout']);
    expect(result.development?.metrics.scenarioCount).toBeGreaterThan(0);
    expect(result.holdout?.metrics.scenarioCount).toBeGreaterThan(0);
  });

  it('rejects an unknown scenario ID', async () => {
    await expect(runLearningBenchmarkV2({ scenarioIds: ['does-not-exist'] })).rejects.toThrow(
      'LEARNING_BENCHMARK_V2_UNKNOWN_SCENARIO_ID',
    );
  });

  it('restricting to specific case IDs only runs those cases', async () => {
    const result = await runLearningBenchmarkV2({ scenarioIds: ['LBV2-RES-DEV-001'] });
    expect(result.development?.metrics.scenarioCount).toBe(1);
  });

  it('never touches the network (global.fetch throws if called during a full run)', async () => {
    const originalFetch = global.fetch;
    global.fetch = (() => {
      throw new Error('LEARNING_BENCHMARK_V2_UNEXPECTED_NETWORK_CALL');
    }) as never;
    try {
      const result = await runLearningBenchmarkV2({ partition: 'all' });
      expect(result.partitionsRun).toEqual(['development', 'holdout']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('reports the corpus version, hash, and registry version', async () => {
    const result = await runLearningBenchmarkV2();
    expect(result.corpusVersion).toBe('resolver-learning-benchmark-v2-corpus-1.0.0');
    expect(result.registryVersion).toBe('resolver-learning-benchmark-v2-registry-v1');
    expect(result.corpusHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces failed and not-evaluable invariants without hiding them', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'all' });
    const machine = buildLearningBenchmarkV2MachineReport(result);
    expect(machine.failedInvariantCount).toBeGreaterThanOrEqual(1);
    expect(machine.systemVerdict).toBe('NOT_PASSED');
    const human = buildLearningBenchmarkV2HumanReport(result);
    expect(human).toContain('INV-07');
    expect(human).toContain('INV-07 FAILED');
  });
});
