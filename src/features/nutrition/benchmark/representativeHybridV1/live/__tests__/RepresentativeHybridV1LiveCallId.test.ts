import {
  computeRepresentativeHybridV1LiveCallId,
  computeRepresentativeHybridV1LivePlannedCallIds,
  orderRepresentativeHybridV1LiveObservationsForExecution,
} from '../RepresentativeHybridV1LiveCallId';
import type {
  RepresentativeHybridV1LiveExecutionPlan,
  RepresentativeHybridV1LivePlannedObservation,
} from '../RepresentativeHybridV1LiveExecutionPlan';

const baseObservation: RepresentativeHybridV1LivePlannedObservation = {
  scenarioId: 'RH-RES-SIMPLE-DEV-001',
  partition: 'development',
  variant: 'B',
  kind: 'variant_b_primary',
  runIndex: 0,
  expectedRoute: null,
  isSampleFloorSupplement: false,
};

function fakePlan(
  observations: readonly RepresentativeHybridV1LivePlannedObservation[],
  planHash = 'fake-plan-hash',
): RepresentativeHybridV1LiveExecutionPlan {
  return {
    planVersion: '1',
    observations,
    routeClassification: [],
    counts: {
      variantBCalls: 0,
      variantBCallsByPartition: { development: 0, holdout: 0 },
      variantCPrimaryAttempts: 0,
      variantCMaxAiRoutedCalls: 0,
      variantCMaxAiRoutedCallsByPartition: { development: 0, holdout: 0 },
      variantCFastPathAttempts: 0,
      sampleFloorSupplementCount: 0,
    },
    budget: {
      currency: 'USD',
      maxCalls: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      worstCaseReservedCostUsd: 0,
      perRequestCostUsd: 0,
    },
    planHash,
  };
}

describe('RESOLVER-V3-039 protocol-v2 call ID', () => {
  it('is fully deterministic for the same observation and plan hash', () => {
    const a = computeRepresentativeHybridV1LiveCallId(baseObservation, 'plan-hash-1');
    const b = computeRepresentativeHybridV1LiveCallId(baseObservation, 'plan-hash-1');
    expect(a).toBe(b);
  });

  it('changes when planHash changes (a plan/corpus/route-classification change invalidates every prior call ID)', () => {
    const a = computeRepresentativeHybridV1LiveCallId(baseObservation, 'plan-hash-1');
    const b = computeRepresentativeHybridV1LiveCallId(baseObservation, 'plan-hash-2');
    expect(a).not.toBe(b);
  });

  it('differs across every identity component (scenarioId, partition, variant, kind, runIndex, route)', () => {
    const variants = [
      baseObservation,
      { ...baseObservation, scenarioId: 'RH-RES-SIMPLE-DEV-002' },
      { ...baseObservation, partition: 'holdout' as const },
      { ...baseObservation, variant: 'C' as const, expectedRoute: 'ai_routed' as const },
      { ...baseObservation, kind: 'variant_b_consistency' as const },
      { ...baseObservation, runIndex: 1 },
    ];
    const ids = variants.map((o) => computeRepresentativeHybridV1LiveCallId(o, 'plan-hash'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders observations by scenarioId, then Variant B runs before Variant C runs, each by runIndex', () => {
    const obs: RepresentativeHybridV1LivePlannedObservation[] = [
      {
        ...baseObservation,
        scenarioId: 'Z',
        variant: 'C',
        kind: 'variant_c_primary',
        expectedRoute: 'ai_routed',
      },
      {
        ...baseObservation,
        scenarioId: 'A',
        variant: 'B',
        runIndex: 1,
        kind: 'variant_b_consistency',
      },
      {
        ...baseObservation,
        scenarioId: 'A',
        variant: 'C',
        kind: 'variant_c_primary',
        expectedRoute: 'ai_routed',
      },
      { ...baseObservation, scenarioId: 'A', variant: 'B', runIndex: 0 },
    ];
    const ordered = orderRepresentativeHybridV1LiveObservationsForExecution(obs, ['development']);
    expect(ordered.map((o) => `${o.scenarioId}:${o.variant}:${o.runIndex}`)).toEqual([
      'A:B:0',
      'A:B:1',
      'A:C:0',
      'Z:C:0',
    ]);
  });

  it('planned call IDs include every Variant B observation and only AI-routed Variant C observations', () => {
    const obs: RepresentativeHybridV1LivePlannedObservation[] = [
      baseObservation,
      { ...baseObservation, variant: 'C', kind: 'variant_c_primary', expectedRoute: 'ai_routed' },
      {
        ...baseObservation,
        scenarioId: 'RH-RES-SIMPLE-DEV-002',
        variant: 'C',
        kind: 'variant_c_primary',
        expectedRoute: 'fast_path',
      },
    ];
    const plan = fakePlan(obs);
    const ids = computeRepresentativeHybridV1LivePlannedCallIds(plan, 'development');
    expect(ids).toHaveLength(2); // the B call + the ai_routed C call; the fast_path C call is excluded
  });

  it('planned call IDs are scoped to the requested partition only', () => {
    const obs: RepresentativeHybridV1LivePlannedObservation[] = [
      baseObservation,
      { ...baseObservation, partition: 'holdout' },
    ];
    const plan = fakePlan(obs);
    expect(computeRepresentativeHybridV1LivePlannedCallIds(plan, 'development')).toHaveLength(1);
    expect(computeRepresentativeHybridV1LivePlannedCallIds(plan, 'holdout')).toHaveLength(1);
  });
});
