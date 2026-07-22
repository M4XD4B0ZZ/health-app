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
  });

  // RESOLVER-V3-037: INV-07 (the contradiction-specific approval gate) now passes against the real,
  // fixed `ResolverKnowledgeReviewService` -- the fixture-only contradiction-gate candidate is
  // correctly refused as `blocked_contradiction`. This does not make the overall system verdict
  // `PASSED`: the frozen LBV2-GC-DEV-006 fixture also tags its now-unreachable rollback steps as
  // `review-rollback` (the only scenario carrying that tag), so INV-10/INV-11 (rollback
  // atomicity/deactivation) newly report `failed` against this specific fixture -- a documented
  // historical-fixture consequence of tightening the gate, not a regression in rollback logic itself
  // (rollback/revoke coverage for a legitimately approved, contradiction-free candidate remains green
  // in `ResolverKnowledgeReview.test.ts`). See
  // `reports/RESOLVER_V3_037_CONTRADICTION_APPROVAL_GATE_REMEDIATION_REPORT.md` for the focused
  // remediation verdict; the historical `reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md` (which
  // recorded INV-07 as failed) is untouched and remains historical evidence of the pre-fix state.
  it('RESOLVER-V3-037: INV-07 now passes against the real service; the frozen rollback fixture surfaces INV-10/INV-11 instead', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'all' });
    const machine = buildLearningBenchmarkV2MachineReport(result);
    const inv07 = machine.invariantVerdicts.find((v) => v.invariantId === 'INV-07');
    expect(inv07?.status).toBe('passed');
    const inv10 = machine.invariantVerdicts.find((v) => v.invariantId === 'INV-10');
    const inv11 = machine.invariantVerdicts.find((v) => v.invariantId === 'INV-11');
    expect(inv10?.status).toBe('failed');
    expect(inv11?.status).toBe('failed');
    expect(machine.systemVerdict).toBe('NOT_PASSED');
    const human = buildLearningBenchmarkV2HumanReport(result);
    expect(human).not.toContain('INV-07 FAILED');
    expect(human).toContain('INV-10');
    expect(human).toContain('INV-11');
    expect(human).toContain('Failed invariants (2)');
  });
});
