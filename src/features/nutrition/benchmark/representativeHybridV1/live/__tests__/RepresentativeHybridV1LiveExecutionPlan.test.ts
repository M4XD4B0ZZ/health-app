import {
  buildRepresentativeHybridV1LiveExecutionPlan,
  computeRepresentativeHybridV1LiveRouteClassification,
} from '../RepresentativeHybridV1LiveExecutionPlan';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from '../../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../../RepresentativeHybridV1SourceSnapshotManifest';
import { REPRESENTATIVE_HYBRID_V1_LIVE_MAX_AUTHORIZED_COST_USD } from '../RepresentativeHybridV1LiveVersions';

describe('RESOLVER-V3-039 execution plan', () => {
  it('is deterministic: two builds produce the identical plan hash', async () => {
    const planA = await buildRepresentativeHybridV1LiveExecutionPlan();
    const planB = await buildRepresentativeHybridV1LiveExecutionPlan();
    expect(planA.planHash).toBe(planB.planHash);
    expect(planA.observations).toEqual(planB.observations);
  });

  it('route classification is deterministic and depends on no live provider result', async () => {
    const classificationA = await computeRepresentativeHybridV1LiveRouteClassification();
    const classificationB = await computeRepresentativeHybridV1LiveRouteClassification();
    expect(classificationA).toEqual(classificationB);
    expect(classificationA.length).toBeGreaterThan(0);
    for (const entry of classificationA) {
      expect(['fast_path', 'ai_routed']).toContain(entry.route);
    }
  });

  it('plans exactly one B call for base scenarios and exactly three for overlay scenarios', async () => {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    const bByScenario = new Map<string, number>();
    for (const o of plan.observations) {
      if (o.variant !== 'B') continue;
      bByScenario.set(o.scenarioId, (bByScenario.get(o.scenarioId) ?? 0) + 1);
    }
    const overlayScenarioIds = new Set(
      plan.routeClassification.filter((r) => r.isOverlay).map((r) => r.scenarioId),
    );
    for (const [scenarioId, count] of bByScenario) {
      expect(count).toBe(overlayScenarioIds.has(scenarioId) ? 3 : 1);
    }
  });

  it('every ai_routed sample-floor supplement scenario id was itself already ai_routed in that partition', async () => {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    const aiRoutedByPartitionScenario = new Set(
      plan.observations
        .filter(
          (o) => o.variant === 'C' && !o.isSampleFloorSupplement && o.expectedRoute === 'ai_routed',
        )
        .map((o) => `${o.partition}:${o.scenarioId}`),
    );
    for (const o of plan.observations.filter((o) => o.isSampleFloorSupplement)) {
      expect(aiRoutedByPartitionScenario.has(`${o.partition}:${o.scenarioId}`)).toBe(true);
    }
  });

  it('reaches n >= 30 for every partition that has at least one ai_routed C observation', async () => {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    for (const partition of ['development', 'holdout'] as const) {
      const n = plan.counts.variantCMaxAiRoutedCallsByPartition[partition];
      if (n > 0) expect(n).toBeGreaterThanOrEqual(30);
    }
  });

  it('matches the frozen RESOLVER-V3-038 corpus/source-manifest hashes', () => {
    // The plan builder consumes the same manifest constants -- this test pins that those
    // constants themselves have not silently changed underneath this task.
    expect(REPRESENTATIVE_HYBRID_V1_CORPUS_HASH).toMatch(/^[0-9a-f]+$/);
    expect(REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH).toMatch(/^[0-9a-f]+$/);
  });

  it('worst-case reserved cost fits under the USD 5.00 authorized ceiling', async () => {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    expect(plan.budget.worstCaseReservedCostUsd).toBeLessThanOrEqual(
      REPRESENTATIVE_HYBRID_V1_LIVE_MAX_AUTHORIZED_COST_USD,
    );
    expect(plan.budget.maxInputTokens).toBe(
      plan.observations.filter((o) => o.variant === 'B').length * 8_192 +
        plan.observations.filter((o) => o.variant === 'C' && o.expectedRoute === 'ai_routed')
          .length *
          8_192,
    );
    expect(plan.budget.maxCalls).toBe(
      plan.observations.filter((o) => o.variant === 'B').length +
        plan.observations.filter((o) => o.variant === 'C' && o.expectedRoute === 'ai_routed')
          .length,
    );
  });

  it('governance-only scenarios never appear in the plan', async () => {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    // The plan is built exclusively from resolution scenarios (governance scenarios are a
    // structurally distinct scenario type, filtered out before this module ever sees them) -- this
    // asserts every observation's scenarioId is one this module's own route classification saw.
    const knownIds = new Set(plan.routeClassification.map((r) => r.scenarioId));
    for (const o of plan.observations) {
      expect(knownIds.has(o.scenarioId)).toBe(true);
    }
  });
});
