import type { FoodCatalogResolver } from '../../../../application/services/FoodCatalogResolver';
import type {
  VariantBProvider,
  VariantBProviderCallResult,
} from '../../../ResolverV3VariantBAdapter';
import type { VariantCAiInterpreter, VariantCAiInterpretationCall } from '../../../VariantCTypes';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../../RepresentativeHybridV1Manifest';
import type { RepresentativeHybridV1ResolutionScenario } from '../../RepresentativeHybridV1Types';
import { runRepresentativeHybridV1LivePartition } from '../RepresentativeHybridV1LiveRunner';
import type {
  RepresentativeHybridV1LiveExecutionPlan,
  RepresentativeHybridV1LivePlannedObservation,
} from '../RepresentativeHybridV1LiveExecutionPlan';

function isResolutionScenario(s: unknown): s is RepresentativeHybridV1ResolutionScenario {
  return (s as { scenarioType?: string }).scenarioType === 'resolution_decomposition';
}

const resolutionScenarios =
  REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.filter(isResolutionScenario);
const baseScenario = resolutionScenarios.find((s) => !s.repeatOverlay)!;
const overlayScenario = resolutionScenarios.find((s) => s.repeatOverlay)!;

/** Always-ambiguous fast-path resolver: forces every Variant C attempt to reach the AI-routed
 * branch, making call counts fully predictable for this test. */
const alwaysAmbiguousResolver: FoodCatalogResolver = {
  async resolve(query) {
    return {
      normalizedQuery: query.normalized,
      status: 'ambiguous',
      reasonCodes: [],
      candidates: [],
      createdAt: new Date().toISOString(),
    };
  },
};

function buildFakePlan(
  scenarios: readonly RepresentativeHybridV1ResolutionScenario[],
): RepresentativeHybridV1LiveExecutionPlan {
  const observations: RepresentativeHybridV1LivePlannedObservation[] = [];
  for (const s of scenarios) {
    const runs = s.repeatOverlay ? 3 : 1;
    for (let i = 0; i < runs; i += 1) {
      observations.push({
        scenarioId: s.scenarioId,
        partition: s.partition,
        variant: 'B',
        kind: i === 0 ? 'variant_b_primary' : 'variant_b_consistency',
        runIndex: i,
        expectedRoute: null,
        isSampleFloorSupplement: false,
      });
      observations.push({
        scenarioId: s.scenarioId,
        partition: s.partition,
        variant: 'C',
        kind: i === 0 ? 'variant_c_primary' : 'variant_c_consistency',
        runIndex: i,
        expectedRoute: 'ai_routed',
        isSampleFloorSupplement: false,
      });
    }
  }
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
    planHash: 'test',
  };
}

describe('RESOLVER-V3-039 live runner', () => {
  it('calls Variant B exactly once for a base scenario and three times for an overlay scenario', async () => {
    const scenarios = [baseScenario, overlayScenario];
    const plan = buildFakePlan(scenarios);
    const bCallCaseIds: string[] = [];
    const fakeB: VariantBProvider = {
      providerId: 'fake',
      modelId: 'fake-model',
      runMode: 'live',
      async call(request): Promise<VariantBProviderCallResult> {
        bCallCaseIds.push(request.caseId);
        return {
          rawText: null,
          usage: null,
          latencyMs: 1,
          httpStatus: null,
          httpError: 'fake: no live provider in this test',
        };
      },
      computeCostUsd: () => ({ costUsd: 0, pricingStatus: 'known' }),
    };
    const cCallCount = { n: 0 };
    const fakeC: VariantCAiInterpreter = {
      async interpret(): Promise<VariantCAiInterpretationCall> {
        cCallCount.n += 1;
        return {
          result: {
            outcome: 'unavailable',
            reason: 'fake test interpreter',
            meta: { interpreterVersion: 'test', contractVersion: '1', latencyMs: 1 },
          } as never,
          runMeta: { costUsd: 0, pricingStatus: 'known', inputTokens: null, outputTokens: null },
        };
      },
    };

    const { caseRecords } = await runRepresentativeHybridV1LivePartition(
      scenarios,
      plan,
      ['development', 'holdout'],
      {
        variantBProvider: fakeB,
        variantCAiInterpreter: fakeC,
        variantCFastPathResolver: alwaysAmbiguousResolver,
      },
    );

    const baseRecord = caseRecords.find((r) => r.scenarioId === baseScenario.scenarioId)!;
    const overlayRecord = caseRecords.find((r) => r.scenarioId === overlayScenario.scenarioId)!;
    expect(baseRecord.variantB).toHaveLength(1);
    expect(overlayRecord.variantB).toHaveLength(3);
    expect(baseRecord.variantC).toHaveLength(1);
    expect(overlayRecord.variantC).toHaveLength(3);
    expect(cCallCount.n).toBe(4); // 1 (base) + 3 (overlay), all AI-routed by construction
    // Runner sorts scenarios by scenarioId, not declaration order -- assert composition, not order.
    const counts = bCallCaseIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts[baseScenario.case.caseId]).toBe(1);
    expect(counts[overlayScenario.case.caseId]).toBe(3);
    expect(bCallCaseIds).toHaveLength(4);
  });

  it('every arm receives the same case identity (caseId/rawInput/locale) for a given scenario', async () => {
    const scenarios = [baseScenario];
    const plan = buildFakePlan(scenarios);
    const seenCaseIds = new Set<string>();
    const fakeB: VariantBProvider = {
      providerId: 'fake',
      modelId: 'fake-model',
      runMode: 'live',
      async call(request) {
        seenCaseIds.add(request.caseId);
        return { rawText: null, usage: null, latencyMs: 1, httpStatus: null, httpError: 'fake' };
      },
      computeCostUsd: () => ({ costUsd: 0, pricingStatus: 'known' }),
    };
    const fakeC: VariantCAiInterpreter = {
      async interpret(request) {
        seenCaseIds.add(request.traceId ?? '');
        return {
          result: {
            outcome: 'unavailable',
            reason: 'fake',
            meta: { interpreterVersion: 'test', contractVersion: '1', latencyMs: 1 },
          } as never,
          runMeta: { costUsd: 0, pricingStatus: 'known', inputTokens: null, outputTokens: null },
        };
      },
    };
    await runRepresentativeHybridV1LivePartition(scenarios, plan, ['development', 'holdout'], {
      variantBProvider: fakeB,
      variantCAiInterpreter: fakeC,
      variantCFastPathResolver: alwaysAmbiguousResolver,
    });
    expect(seenCaseIds.has(baseScenario.case.caseId)).toBe(true);
  });
});
