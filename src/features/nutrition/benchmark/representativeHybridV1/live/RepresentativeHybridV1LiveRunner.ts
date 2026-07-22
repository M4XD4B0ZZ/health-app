import { buildVariantAResolver, runVariantACase } from '../../ResolverV3VariantAAdapter';
import { evaluateVariantACase, type CaseEvaluation } from '../../evaluateVariantACase';
import { runVariantBCase, type VariantBProvider } from '../../ResolverV3VariantBAdapter';
import { evaluateVariantBCase, type CaseEvaluationB } from '../../evaluateVariantBCase';
import { runVariantCCase, type VariantCDependencies } from '../../ResolverV3VariantCAdapter';
import { evaluateVariantCCase, type CaseEvaluationC } from '../../evaluateVariantCCase';
import type { VariantCRawCaseResult } from '../../VariantCTypes';
import type { RepresentativeHybridV1ResolutionScenario } from '../RepresentativeHybridV1Types';
import type { RepresentativeHybridV1LiveExecutionPlan } from './RepresentativeHybridV1LiveExecutionPlan';

/**
 * RESOLVER-V3-039 live orchestration layer.
 *
 * Deliberately calls the real, unmodified Variant A/B/C adapter + evaluator functions directly
 * (`runVariantACase`/`runVariantBCase`/`runVariantCCase`,
 * `evaluateVariantACase`/`evaluateVariantBCase`/`evaluateVariantCCase`) rather than through
 * `RepresentativeHybridV1ThreeArmRunner.ts`'s convenience wrapper. Reason: that wrapper returns
 * only the *evaluated* `CaseEvaluationC` for its one C call, discarding the raw
 * `VariantCRawCaseResult` (fast-path/AI-interpretation/retrieval/total latency breakdown, source
 * request count) this task's raw-telemetry-preservation requirement needs for EVERY Variant C
 * observation, not just consistency repeats. No evaluation/scoring/ranking/decision logic is
 * reimplemented here -- every result is scored by the real evaluator functions, unchanged; only
 * the per-case call sequencing is inlined so raw results survive.
 */

export interface RepresentativeHybridV1LiveRunnerDependencies {
  variantBProvider: VariantBProvider;
  variantCAiInterpreter: VariantCDependencies['aiInterpreter'];
  variantAResolver?: Parameters<typeof runVariantACase>[1];
  variantCFastPathResolver?: VariantCDependencies['fastPathResolver'];
  variantCSourcesByType?: VariantCDependencies['sourcesByType'];
}

export interface RepresentativeHybridV1LiveCObservation {
  runIndex: number;
  kind: 'primary' | 'consistency' | 'sample_floor_supplement';
  raw: VariantCRawCaseResult;
  evaluation: CaseEvaluationC;
}

export interface RepresentativeHybridV1LiveCaseRecord {
  scenarioId: string;
  partition: RepresentativeHybridV1ResolutionScenario['partition'];
  isOverlay: boolean;
  variantA: CaseEvaluation;
  variantB: CaseEvaluationB[];
  variantC: RepresentativeHybridV1LiveCObservation[];
}

interface ScenarioRunPlan {
  bRuns: number;
  cPrimaryPlusConsistencyRuns: number;
  cSupplementRuns: number;
}

function buildScenarioRunPlans(
  plan: RepresentativeHybridV1LiveExecutionPlan,
  partitions: readonly RepresentativeHybridV1ResolutionScenario['partition'][],
): Map<string, ScenarioRunPlan> {
  const byScenario = new Map<string, ScenarioRunPlan>();
  for (const obs of plan.observations) {
    if (!partitions.includes(obs.partition)) continue;
    const existing = byScenario.get(obs.scenarioId) ?? {
      bRuns: 0,
      cPrimaryPlusConsistencyRuns: 0,
      cSupplementRuns: 0,
    };
    if (obs.variant === 'B') existing.bRuns += 1;
    else if (obs.isSampleFloorSupplement) existing.cSupplementRuns += 1;
    else existing.cPrimaryPlusConsistencyRuns += 1;
    byScenario.set(obs.scenarioId, existing);
  }
  return byScenario;
}

/**
 * Runs one partition set. `deps.variantBProvider`/`deps.variantCAiInterpreter` are expected to
 * already be wrapped by the caller with
 * `wrapVariantBProviderWithTelemetry`/`wrapVariantCInterpreterWithTelemetry`
 * (`RepresentativeHybridV1LiveTelemetryProviders.ts`) around a caller-owned raw-telemetry array --
 * this function only produces evaluated (+ raw-C) case records; the caller reads its own
 * telemetry array afterward.
 */
export async function runRepresentativeHybridV1LivePartition(
  scenarios: readonly RepresentativeHybridV1ResolutionScenario[],
  plan: RepresentativeHybridV1LiveExecutionPlan,
  partitions: readonly RepresentativeHybridV1ResolutionScenario['partition'][],
  deps: RepresentativeHybridV1LiveRunnerDependencies,
): Promise<{ caseRecords: RepresentativeHybridV1LiveCaseRecord[] }> {
  const variantAResolver = deps.variantAResolver ?? buildVariantAResolver().resolver;
  const variantCFastPathResolver = deps.variantCFastPathResolver ?? variantAResolver;
  const runPlans = buildScenarioRunPlans(plan, partitions);

  const inScopeScenarios = scenarios
    .filter((s) => partitions.includes(s.partition) && runPlans.has(s.scenarioId))
    .slice()
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  const caseRecords: RepresentativeHybridV1LiveCaseRecord[] = [];

  for (const scenario of inScopeScenarios) {
    const runPlan = runPlans.get(scenario.scenarioId);
    if (!runPlan) continue;

    const rawA = await runVariantACase(scenario.case, variantAResolver);
    const variantA = evaluateVariantACase(scenario.case, rawA);

    const variantB: CaseEvaluationB[] = [];
    for (let i = 0; i < runPlan.bRuns; i += 1) {
      const rawB = await runVariantBCase(scenario.case, deps.variantBProvider, i);
      variantB.push(evaluateVariantBCase(scenario.case, rawB));
    }

    const variantC: RepresentativeHybridV1LiveCObservation[] = [];
    const totalCRuns = runPlan.cPrimaryPlusConsistencyRuns + runPlan.cSupplementRuns;
    for (let i = 0; i < totalCRuns; i += 1) {
      const rawC = await runVariantCCase(scenario.case, {
        aiInterpreter: deps.variantCAiInterpreter,
        fastPathResolver: variantCFastPathResolver,
        sourcesByType: deps.variantCSourcesByType,
      });
      const kind: RepresentativeHybridV1LiveCObservation['kind'] =
        i === 0
          ? 'primary'
          : i < runPlan.cPrimaryPlusConsistencyRuns
            ? 'consistency'
            : 'sample_floor_supplement';
      variantC.push({
        runIndex: i,
        kind,
        raw: rawC,
        evaluation: evaluateVariantCCase(scenario.case, rawC),
      });
    }

    caseRecords.push({
      scenarioId: scenario.scenarioId,
      partition: scenario.partition,
      isOverlay: Boolean(scenario.repeatOverlay),
      variantA,
      variantB,
      variantC,
    });
  }

  return { caseRecords };
}
