import { createHash } from 'node:crypto';
import { buildVariantAResolver, runVariantACase } from '../../ResolverV3VariantAAdapter';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../RepresentativeHybridV1Manifest';
import type {
  RepresentativeHybridV1Partition,
  RepresentativeHybridV1ResolutionScenario,
  RepresentativeHybridV1Scenario,
} from '../RepresentativeHybridV1Types';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_MIN_OVERLAY_OBSERVATIONS,
  REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
  REPRESENTATIVE_HYBRID_V1_LIVE_REQUEST_RESERVATION,
} from './RepresentativeHybridV1LiveVersions';

/** `REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS` is declared as the broad
 * `RepresentativeHybridV1Scenario[]` union even though, at runtime, it only ever contains
 * `resolution_decomposition` scenarios (the governance-fixture scenario types live in a separate
 * export). Narrow it once, here, rather than casting at every call site. */
function isResolutionScenario(
  scenario: RepresentativeHybridV1Scenario,
): scenario is RepresentativeHybridV1ResolutionScenario {
  return scenario.scenarioType === 'resolution_decomposition';
}

const REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS_NARROWED: readonly RepresentativeHybridV1ResolutionScenario[] =
  REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.filter(isResolutionScenario);

/**
 * RESOLVER-V3-039 deterministic, zero-network route-classification + execution-plan builder.
 *
 * Route classification reuses exactly the same real, unmodified fast-path check Variant C's own
 * orchestrator uses (`ResolverV3VariantCAdapter.ts`'s `buildFastPathMealResult`): run the real
 * Variant A resolver (`buildVariantAResolver()` + `runVariantACase`) and check whether
 * `decision.status === 'accepted'`. No new confidence threshold is invented here, and this
 * classification never depends on any live provider result -- it is 100% local (BLS static
 * source only, no network), so it can run before any credential is even checked.
 */

export type RepresentativeHybridV1LiveRoute = 'fast_path' | 'ai_routed';

export interface RepresentativeHybridV1LiveRouteEntry {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
  isOverlay: boolean;
  route: RepresentativeHybridV1LiveRoute;
}

/** Deterministic, zero-network preflight (task requirement 1 of the "Minimum sample protocol"). */
export async function computeRepresentativeHybridV1LiveRouteClassification(
  scenarios: readonly RepresentativeHybridV1ResolutionScenario[] = REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS_NARROWED,
): Promise<RepresentativeHybridV1LiveRouteEntry[]> {
  const { resolver } = buildVariantAResolver();
  const entries: RepresentativeHybridV1LiveRouteEntry[] = [];
  // Sequential and sorted by scenarioId first: deterministic ordering, independent of corpus
  // module declaration order or any later Promise scheduling nondeterminism.
  const sorted = [...scenarios].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  for (const scenario of sorted) {
    const raw = await runVariantACase(scenario.case, resolver);
    const route: RepresentativeHybridV1LiveRoute =
      raw.decision.status === 'accepted' ? 'fast_path' : 'ai_routed';
    entries.push({
      scenarioId: scenario.scenarioId,
      partition: scenario.partition,
      isOverlay: Boolean(scenario.repeatOverlay),
      route,
    });
  }
  return entries;
}

export type RepresentativeHybridV1LiveObservationKind =
  | 'variant_b_primary'
  | 'variant_b_consistency'
  | 'variant_c_primary'
  | 'variant_c_consistency'
  | 'variant_c_sample_floor_supplement';

export interface RepresentativeHybridV1LivePlannedObservation {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
  variant: 'B' | 'C';
  kind: RepresentativeHybridV1LiveObservationKind;
  /** 0-based repeat index within this scenario's own observation sequence for this variant. */
  runIndex: number;
  /** For Variant C only: the deterministic route this scenario/run is expected to take. Always
   * `null` for Variant B (Variant B has no fast path). */
  expectedRoute: RepresentativeHybridV1LiveRoute | null;
  /** True when this observation is a deterministic lexicographic-cycle sample-floor repeat of a
   * scenario already observed at least once, added only to reach n >= 30 for a path/partition. */
  isSampleFloorSupplement: boolean;
}

export interface RepresentativeHybridV1LiveExecutionPlan {
  planVersion: string;
  observations: readonly RepresentativeHybridV1LivePlannedObservation[];
  routeClassification: readonly RepresentativeHybridV1LiveRouteEntry[];
  counts: {
    variantBCalls: number;
    variantBCallsByPartition: Record<RepresentativeHybridV1Partition, number>;
    variantCPrimaryAttempts: number;
    variantCMaxAiRoutedCalls: number;
    variantCMaxAiRoutedCallsByPartition: Record<RepresentativeHybridV1Partition, number>;
    variantCFastPathAttempts: number;
    sampleFloorSupplementCount: number;
  };
  budget: {
    currency: 'USD';
    maxCalls: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    worstCaseReservedCostUsd: number;
    perRequestCostUsd: number;
  };
  /** Deterministic content hash over the frozen, sorted observation list -- proves the plan cannot
   * silently change after freeze (task requirement: "Plan cannot change after freeze"). */
  planHash: string;
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

function computePlanHash(
  observations: readonly RepresentativeHybridV1LivePlannedObservation[],
): string {
  const canonical = observations.map((o) => JSON.stringify(sortKeysDeep(o)));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Deterministic lexicographic-cycle sample-floor supplementation (task requirement: "select
 * eligible scenario IDs lexicographically; cycle through them deterministically; add only enough
 * repeated observations to reach 30"). Only cycles through scenarios that ALREADY, independently,
 * classified as `ai_routed` for this partition -- never fabricates a route population. Each
 * supplement's `runIndex` continues that scenario's own existing run-index sequence.
 */
function supplementToSampleFloor(
  partition: RepresentativeHybridV1Partition,
  eligibleScenarioIdsLexicographic: readonly string[],
  nextRunIndexByScenario: Map<string, number>,
  currentCount: number,
): RepresentativeHybridV1LivePlannedObservation[] {
  if (
    eligibleScenarioIdsLexicographic.length === 0 ||
    currentCount >= REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE
  ) {
    return [];
  }
  const needed = REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE - currentCount;
  const supplements: RepresentativeHybridV1LivePlannedObservation[] = [];
  for (let i = 0; i < needed; i += 1) {
    const scenarioId =
      eligibleScenarioIdsLexicographic[i % eligibleScenarioIdsLexicographic.length];
    const runIndex = nextRunIndexByScenario.get(scenarioId) ?? 0;
    nextRunIndexByScenario.set(scenarioId, runIndex + 1);
    supplements.push({
      scenarioId,
      partition,
      variant: 'C',
      kind: 'variant_c_sample_floor_supplement',
      runIndex,
      expectedRoute: 'ai_routed',
      isSampleFloorSupplement: true,
    });
  }
  return supplements;
}

export async function buildRepresentativeHybridV1LiveExecutionPlan(
  scenarios: readonly RepresentativeHybridV1ResolutionScenario[] = REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS_NARROWED,
): Promise<RepresentativeHybridV1LiveExecutionPlan> {
  const routeClassification = await computeRepresentativeHybridV1LiveRouteClassification(scenarios);
  const routeById = new Map(routeClassification.map((r) => [r.scenarioId, r]));
  const sortedScenarios = [...scenarios].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  const observations: RepresentativeHybridV1LivePlannedObservation[] = [];

  for (const scenario of sortedScenarios) {
    const route = routeById.get(scenario.scenarioId);
    if (!route) throw new Error(`Route classification missing for ${scenario.scenarioId}`);
    const isOverlay = Boolean(scenario.repeatOverlay);
    const bRuns = isOverlay ? REPRESENTATIVE_HYBRID_V1_LIVE_MIN_OVERLAY_OBSERVATIONS : 1;
    const cRuns = isOverlay ? REPRESENTATIVE_HYBRID_V1_LIVE_MIN_OVERLAY_OBSERVATIONS : 1;

    for (let i = 0; i < bRuns; i += 1) {
      observations.push({
        scenarioId: scenario.scenarioId,
        partition: scenario.partition,
        variant: 'B',
        kind: i === 0 ? 'variant_b_primary' : 'variant_b_consistency',
        runIndex: i,
        expectedRoute: null,
        isSampleFloorSupplement: false,
      });
    }
    for (let i = 0; i < cRuns; i += 1) {
      observations.push({
        scenarioId: scenario.scenarioId,
        partition: scenario.partition,
        variant: 'C',
        kind: i === 0 ? 'variant_c_primary' : 'variant_c_consistency',
        runIndex: i,
        expectedRoute: route.route,
        isSampleFloorSupplement: false,
      });
    }
  }

  // Sample-floor supplementation for Variant C AI-routed attempts, per partition (task
  // requirement: n >= 30 per gate-evaluable path/partition, or explicitly not_evaluable if the
  // route population is structurally empty for that partition -- never manufactured).
  for (const partition of ['development', 'holdout'] as const) {
    const aiRoutedForPartition = observations.filter(
      (o) => o.variant === 'C' && o.partition === partition && o.expectedRoute === 'ai_routed',
    );
    if (aiRoutedForPartition.length === 0) continue; // structurally empty -- not_evaluable, not supplemented
    const eligibleScenarioIds = [...new Set(aiRoutedForPartition.map((o) => o.scenarioId))].sort(
      (a, b) => a.localeCompare(b),
    );
    const nextRunIndexByScenario = new Map<string, number>();
    for (const o of aiRoutedForPartition) {
      nextRunIndexByScenario.set(
        o.scenarioId,
        Math.max(nextRunIndexByScenario.get(o.scenarioId) ?? 0, o.runIndex + 1),
      );
    }
    const supplements = supplementToSampleFloor(
      partition,
      eligibleScenarioIds,
      nextRunIndexByScenario,
      aiRoutedForPartition.length,
    );
    observations.push(...supplements);
  }

  const variantBObservations = observations.filter((o) => o.variant === 'B');
  const variantCObservations = observations.filter((o) => o.variant === 'C');
  const variantCAiRouted = variantCObservations.filter((o) => o.expectedRoute === 'ai_routed');
  const variantCFastPath = variantCObservations.filter((o) => o.expectedRoute === 'fast_path');

  const byPartition = (list: readonly RepresentativeHybridV1LivePlannedObservation[]) => ({
    development: list.filter((o) => o.partition === 'development').length,
    holdout: list.filter((o) => o.partition === 'holdout').length,
  });

  const maxCalls = variantBObservations.length + variantCAiRouted.length;
  const { inputPerMillion, outputPerMillion } = REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT;
  const {
    variantBMaxInputTokens,
    variantBMaxOutputTokens,
    variantCMaxInputTokens,
    variantCMaxOutputTokens,
  } = REPRESENTATIVE_HYBRID_V1_LIVE_REQUEST_RESERVATION;

  const bCost =
    (variantBMaxInputTokens / 1_000_000) * inputPerMillion +
    (variantBMaxOutputTokens / 1_000_000) * outputPerMillion;
  const cCost =
    (variantCMaxInputTokens / 1_000_000) * inputPerMillion +
    (variantCMaxOutputTokens / 1_000_000) * outputPerMillion;

  const maxInputTokens =
    variantBObservations.length * variantBMaxInputTokens +
    variantCAiRouted.length * variantCMaxInputTokens;
  const maxOutputTokens =
    variantBObservations.length * variantBMaxOutputTokens +
    variantCAiRouted.length * variantCMaxOutputTokens;
  const worstCaseReservedCostUsd =
    variantBObservations.length * bCost + variantCAiRouted.length * cCost;

  const sortedObservations = observations
    .slice()
    .sort(
      (a, b) =>
        a.scenarioId.localeCompare(b.scenarioId) ||
        a.variant.localeCompare(b.variant) ||
        a.runIndex - b.runIndex,
    );

  return {
    planVersion: '1',
    observations: sortedObservations,
    routeClassification,
    counts: {
      variantBCalls: variantBObservations.length,
      variantBCallsByPartition: byPartition(variantBObservations),
      variantCPrimaryAttempts: variantCObservations.filter((o) => !o.isSampleFloorSupplement)
        .length,
      variantCMaxAiRoutedCalls: variantCAiRouted.length,
      variantCMaxAiRoutedCallsByPartition: byPartition(variantCAiRouted),
      variantCFastPathAttempts: variantCFastPath.length,
      sampleFloorSupplementCount: observations.filter((o) => o.isSampleFloorSupplement).length,
    },
    budget: {
      currency: 'USD',
      maxCalls,
      maxInputTokens,
      maxOutputTokens,
      worstCaseReservedCostUsd,
      perRequestCostUsd: bCost,
    },
    planHash: computePlanHash(sortedObservations),
  };
}
