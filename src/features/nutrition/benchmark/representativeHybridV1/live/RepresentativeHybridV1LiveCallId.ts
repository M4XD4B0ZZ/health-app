import { createHash } from 'node:crypto';
import type {
  RepresentativeHybridV1LiveExecutionPlan,
  RepresentativeHybridV1LivePlannedObservation,
} from './RepresentativeHybridV1LiveExecutionPlan';

/**
 * RESOLVER-V3-039 protocol-v2 remediation: a stable, deterministic call identity for every planned
 * Variant B/C observation, derived only from frozen plan data (never from wall-clock time, process
 * ID, or any other non-reproducible input). Two independent processes computing the plan from the
 * same frozen protocol always produce the exact same call ID for the exact same observation --
 * this is what lets a durable ledger keyed by call ID survive a process restart and be recognized
 * by the next process.
 *
 * Tied to `planHash`: any plan change (corpus/route-classification/consistency-protocol/sample-
 * floor-supplementation drift) changes every call ID derived from it, so a stale ledger can never
 * silently match a new, different plan.
 */
export function computeRepresentativeHybridV1LiveCallId(
  observation: Pick<
    RepresentativeHybridV1LivePlannedObservation,
    'scenarioId' | 'partition' | 'variant' | 'kind' | 'runIndex' | 'expectedRoute'
  >,
  planHash: string,
): string {
  const canonical = JSON.stringify([
    'resolver-representative-hybrid-live-call-id-v1',
    planHash,
    observation.partition,
    observation.variant,
    observation.scenarioId,
    observation.kind,
    observation.runIndex,
    observation.expectedRoute ?? 'none',
  ]);
  return `call_${createHash('sha256').update(canonical).digest('hex').slice(0, 32)}`;
}

/**
 * Deterministic execution order for a partition's observations: grouped by scenario (sorted
 * lexicographically), then within each scenario Variant B runs (by `runIndex`) followed by Variant
 * C runs (by `runIndex`) -- this exactly mirrors `RepresentativeHybridV1LiveRunner.ts`'s actual
 * iteration order (`runRepresentativeHybridV1LivePartition`'s per-scenario B-then-C loop), which is
 * what a ledger-recording provider decorator needs to know which planned observation a given call
 * corresponds to, without threading scenario/runIndex through the unmodified Variant B/C provider
 * call signatures.
 */
export function orderRepresentativeHybridV1LiveObservationsForExecution(
  observations: readonly RepresentativeHybridV1LivePlannedObservation[],
  partitions: readonly RepresentativeHybridV1LivePlannedObservation['partition'][],
): readonly RepresentativeHybridV1LivePlannedObservation[] {
  const inScope = observations.filter((o) => partitions.includes(o.partition));
  const scenarioIds = [...new Set(inScope.map((o) => o.scenarioId))].sort((a, b) =>
    a.localeCompare(b),
  );
  const ordered: RepresentativeHybridV1LivePlannedObservation[] = [];
  for (const scenarioId of scenarioIds) {
    const forScenario = inScope.filter((o) => o.scenarioId === scenarioId);
    const bRuns = forScenario
      .filter((o) => o.variant === 'B')
      .sort((a, b) => a.runIndex - b.runIndex);
    const cRuns = forScenario
      .filter((o) => o.variant === 'C')
      .sort((a, b) => a.runIndex - b.runIndex);
    ordered.push(...bRuns, ...cRuns);
  }
  return ordered;
}

/**
 * Every call ID that is actually able to reserve budget for `partition` -- every Variant B
 * observation plus every Variant C observation whose deterministic route is `ai_routed` (a
 * fast-path C observation never dispatches to the live interpreter at all, per
 * `ResolverV3VariantCAdapter.ts`'s `runVariantCCase`, so it never appears in the ledger and must
 * never be counted as a "planned call" for checkpoint/ledger accounting purposes).
 */
export function computeRepresentativeHybridV1LivePlannedCallIds(
  plan: RepresentativeHybridV1LiveExecutionPlan,
  partition: RepresentativeHybridV1LivePlannedObservation['partition'],
): readonly string[] {
  return plan.observations
    .filter(
      (o) => o.partition === partition && (o.variant === 'B' || o.expectedRoute === 'ai_routed'),
    )
    .map((o) => computeRepresentativeHybridV1LiveCallId(o, plan.planHash));
}
