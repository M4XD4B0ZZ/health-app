import { describe, it, expect } from '@jest/globals';
import { runLearningBenchmarkV2 } from '../runLearningBenchmarkV2';
import {
  buildLearningBenchmarkV2HumanReport,
  buildLearningBenchmarkV2MachineReport,
} from '../buildLearningBenchmarkV2Reports';

describe('buildLearningBenchmarkV2Reports', () => {
  it('machine and human reports agree on the system verdict and invariant counts', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'all' });
    const machine = buildLearningBenchmarkV2MachineReport(result);
    const human = buildLearningBenchmarkV2HumanReport(result);
    expect(human).toContain(machine.systemVerdict);
    expect(human).toContain(`Failed invariants (${machine.failedInvariantCount})`);
    expect(human).toContain(`Not-evaluable invariants (${machine.notEvaluableInvariantCount})`);
  });

  it('reports are sorted deterministically by invariantId', async () => {
    const result = await runLearningBenchmarkV2();
    const machine = buildLearningBenchmarkV2MachineReport(result);
    const ids = machine.invariantVerdicts.map((v) => v.invariantId);
    expect(ids).toEqual([...ids].sort());
  });

  it('never claims production readiness or V3-010 unblocking', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'all' });
    const human = buildLearningBenchmarkV2HumanReport(result);
    expect(human.toLowerCase()).not.toMatch(/production[- ]ready|v3-010.*unblock/);
    expect(human).toContain('RESOLVER-V3-010 remains blocked');
  });

  it('explicitly distinguishes task completion from system passing', async () => {
    const result = await runLearningBenchmarkV2();
    const human = buildLearningBenchmarkV2HumanReport(result);
    expect(human).toContain('Task completion and system-passing are explicitly distinct');
  });

  it('states the zero-network / no-production-effect boundary explicitly', async () => {
    const result = await runLearningBenchmarkV2();
    const human = buildLearningBenchmarkV2HumanReport(result);
    expect(human).toContain('Zero network calls were made');
    const machine = buildLearningBenchmarkV2MachineReport(result);
    expect(machine.noLiveNetworkConfirmed).toBe(true);
    expect(machine.noProductionEffectConfirmed).toBe(true);
  });

  it('failed and not-evaluable cases remain present in the report, never silently excluded', async () => {
    const result = await runLearningBenchmarkV2({ partition: 'all' });
    const machine = buildLearningBenchmarkV2MachineReport(result);
    expect(machine.invariantVerdicts.some((v) => v.status === 'failed')).toBe(true);
  });
});
