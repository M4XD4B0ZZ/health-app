import { BenchmarkCase } from './BenchmarkCaseTypes';
import { CaseEvaluationC } from './evaluateVariantCCase';
import { AggregatedVariantCMetrics } from './aggregateVariantCMetrics';
import { VariantCRawCaseResult } from './VariantCTypes';
import {
  LiveProviderUsageRecord,
  aggregateLiveProviderUsage,
  ReservedUsageSummary,
} from './LiveProviderUsage';

/**
 * RESOLVER-V3-005: machine-readable + human-readable report builders for Variant C. Pure
 * functions over already-computed data -- mirrors RESOLVER-V3-003/004's report-builder shape.
 * Writes to its own files (`logs/resolver-v3-variant-c-benchmark.{json,md}`), never touching
 * Variant A/B's own reports.
 */

export const HARNESS_VERSION = '1.0.0';

export interface HarnessRunMetadataC {
  harnessVersion: string;
  corpusVersion: string;
  variant: 'C';
  runMode: 'fixture' | 'live';
  startedAt: string;
  endedAt: string;
  gitCommit: string | null;
  promptVersion: string;
  schemaVersion: string;
  interpreterVersion: string;
  /** Provider/model identity -- run-metadata area only, never the food-facing result
   * (AGENTS.md "no model/provider names in domain or application layer code"). */
  provider: { providerId: string; modelId: string } | null;
  fastPathConfiguration: {
    description: string;
  };
}

export interface MachineCaseResultC {
  caseId: string;
  category: BenchmarkCase['category'];
  difficulty: BenchmarkCase['difficulty'];
  rawInput: string;
  expectedBehavior: BenchmarkCase['expectedBehavior'];
  outcome: CaseEvaluationC['outcome'];
  fastPathUsed: boolean;
  fastPathReason: string;
  aiCalled: boolean;
  identification: CaseEvaluationC['identification'];
  expectedBehaviorEvaluation: CaseEvaluationC['expectedBehavior'];
  falseConfident: boolean;
  partialMisreportedAsComplete: boolean;
  isCriticalFailure: boolean;
  componentMatch: CaseEvaluationC['componentMatch'];
  precisionRecallF1: CaseEvaluationC['precisionRecallF1'];
  macros: CaseEvaluationC['macros'];
  provenance: CaseEvaluationC['provenance'];
  latencyMs: number;
  warnings: string[];
  errors: string[];
}

export interface MachineReportC {
  meta: HarnessRunMetadataC;
  cases: MachineCaseResultC[];
  metrics: AggregatedVariantCMetrics;
  providerUsage?: {
    records: LiveProviderUsageRecord[];
    actual: ReturnType<typeof aggregateLiveProviderUsage>;
    reserved: ReservedUsageSummary | null;
  };
  notEvaluableCases: { caseId: string; reason: string }[];
  warnings: string[];
  errors: string[];
}

function toMachineCaseResult(
  benchmarkCase: BenchmarkCase,
  raw: VariantCRawCaseResult,
  evaluation: CaseEvaluationC,
): MachineCaseResultC {
  return {
    caseId: benchmarkCase.caseId,
    category: benchmarkCase.category,
    difficulty: benchmarkCase.difficulty,
    rawInput: benchmarkCase.rawInput,
    expectedBehavior: benchmarkCase.expectedBehavior,
    outcome: evaluation.outcome,
    fastPathUsed: raw.mealResult.fastPath.used,
    fastPathReason: raw.mealResult.fastPath.reason,
    aiCalled: raw.mealResult.aiInterpretation.called,
    identification: evaluation.identification,
    expectedBehaviorEvaluation: evaluation.expectedBehavior,
    falseConfident: evaluation.falseConfident,
    partialMisreportedAsComplete: evaluation.partialMisreportedAsComplete,
    isCriticalFailure: evaluation.isCriticalFailure,
    componentMatch: evaluation.componentMatch,
    precisionRecallF1: evaluation.precisionRecallF1,
    macros: evaluation.macros,
    provenance: evaluation.provenance,
    latencyMs: evaluation.latencyMs,
    warnings: raw.mealResult.warnings,
    errors: raw.mealResult.errors,
  };
}

export function buildMachineReportC(input: {
  cases: readonly BenchmarkCase[];
  rawByCaseId: ReadonlyMap<string, VariantCRawCaseResult>;
  evaluationsByCaseId: ReadonlyMap<string, CaseEvaluationC>;
  metrics: AggregatedVariantCMetrics;
  providerUsage?: {
    records: LiveProviderUsageRecord[];
    actual: ReturnType<typeof aggregateLiveProviderUsage>;
    reserved: ReservedUsageSummary | null;
  };
  meta: HarnessRunMetadataC;
  notEvaluableCases: { caseId: string; reason: string }[];
  warnings: string[];
  errors: string[];
}): MachineReportC {
  const sortedCases = [...input.cases].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const caseResults = sortedCases.map((benchmarkCase) => {
    const raw = input.rawByCaseId.get(benchmarkCase.caseId);
    const evaluation = input.evaluationsByCaseId.get(benchmarkCase.caseId);
    if (!raw || !evaluation) {
      throw new Error(`Missing raw result/evaluation for case "${benchmarkCase.caseId}"`);
    }
    return toMachineCaseResult(benchmarkCase, raw, evaluation);
  });

  return {
    meta: input.meta,
    cases: caseResults,
    metrics: input.metrics,
    providerUsage: input.providerUsage ?? {
      records: [],
      actual: aggregateLiveProviderUsage([]),
      reserved: null,
    },
    notEvaluableCases: input.notEvaluableCases,
    warnings: input.warnings,
    errors: input.errors,
  };
}

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function formatMs(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(2)} ms`;
}

export function buildHumanReportC(report: MachineReportC): string {
  const { meta, cases, metrics, warnings, errors } = report;
  const lines: string[] = [];

  lines.push(
    `# RESOLVER-V3-005 — Variant C (AI-first, Source-Grounded Hybrid Spike) Benchmark Report`,
  );
  lines.push('');
  lines.push(
    '> **Technical spike, not a production integration.** Isolated benchmark harness, not wired ' +
      'into `container.ts`/the production resolver. Fixture-mode runs use recorded/synthetic AI ' +
      'interpretations and are NOT evidence of real AI-model quality.',
  );
  lines.push('');
  lines.push(
    `**Smoke/baseline result** — ${cases.length} cases, corpus v${meta.corpusVersion}, harness v${meta.harnessVersion}, run mode **${meta.runMode}**. ` +
      'This sample size is not statistically representative; do not derive a production decision from it.',
  );
  lines.push('');
  lines.push(`- Run: ${meta.startedAt} → ${meta.endedAt}`);
  lines.push(`- Git commit: ${meta.gitCommit ?? 'unknown'}`);
  lines.push(
    `- Prompt version: ${meta.promptVersion} / Schema version: ${meta.schemaVersion} / Interpreter version: ${meta.interpreterVersion}`,
  );
  lines.push(
    `- Provider: ${meta.provider ? `${meta.provider.providerId}/${meta.provider.modelId}` : 'n/a (fast path only or no AI call made)'}`,
  );
  lines.push(`- Fast-path rule: ${meta.fastPathConfiguration.description}`);
  lines.push('');

  lines.push(`## Hybrid flow summary`);
  lines.push('');
  lines.push(
    'BenchmarkCase → Variant A resolver fast-path attempt → (if not accepted) ' +
      'AiInterpretationProvider.interpret() → per-component ComponentSearchPlan execution against ' +
      'only the planned source types → ScoreCalculator/ResolverDecisionPolicy (reused) → ' +
      'deterministic portion scaling (resolvePortionGrams/computeTotals) → deterministic meal-level ' +
      'summation → normalized VariantCMealResult.',
  );
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Fast-path used | ${metrics.fastPath.usedCount}/${metrics.caseCount} |`);
  lines.push(
    `| AI interpretation calls made | ${metrics.fastPath.aiCalledCount}/${metrics.caseCount} |`,
  );
  lines.push(`| AI calls avoided by fast path | ${metrics.fastPath.avoidedAiCalls} |`);
  lines.push('');

  lines.push(`## Key metrics`);
  lines.push('');
  lines.push(`| Metric | Value | Absolute |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(
    `| Identification accuracy (correct + acceptable-equivalent) | ${formatPct(metrics.identification.accuracy)} | ${
      metrics.identification.correct + metrics.identification.acceptableEquivalent
    }/${metrics.identification.correct + metrics.identification.acceptableEquivalent + metrics.identification.wrong + metrics.identification.noResolution} |`,
  );
  lines.push(
    `| Expected-behavior match | ${formatPct(metrics.expectedBehavior.match / metrics.caseCount)} | ${metrics.expectedBehavior.match}/${metrics.caseCount} |`,
  );
  lines.push(
    `| **Critical failures (false-confident + partial-as-complete)** | — | **${metrics.criticalFailures}/${metrics.caseCount}** |`,
  );
  lines.push(
    `| Component decomposition P/R/F1 | ${JSON.stringify(metrics.componentDecomposition.aggregate)} | — |`,
  );
  lines.push(
    `| Provenance: sourceId present | ${formatPct(metrics.provenance.sourceIdPresentRate)} | — |`,
  );
  lines.push(
    `| Unbacked numeric results | — | ${metrics.provenance.unbackedNumericResultCount} (must be 0) |`,
  );
  lines.push(
    `| Macro tolerance | within: ${metrics.macros.withinToleranceCount}, outside: ${metrics.macros.outsideToleranceCount}, not evaluable: ${metrics.macros.notEvaluableCount} | — |`,
  );
  lines.push(
    `| p50 / p95 latency | ${formatMs(metrics.latency.p50Ms)} / ${formatMs(metrics.latency.p95Ms)} | — |`,
  );
  lines.push(
    `| Cost (known/estimated total) | ${metrics.cost.totalKnownOrEstimatedUsd === null ? 'n/a' : `$${metrics.cost.totalKnownOrEstimatedUsd.toFixed(4)}`} | AI calls: ${metrics.cost.totalAiCalls}, external requests: ${metrics.cost.totalExternalRequests} |`,
  );
  lines.push('');

  lines.push(`## Outcome distribution`);
  lines.push('');
  lines.push(`| Outcome | Count |`);
  lines.push(`| --- | --- |`);
  Object.entries(metrics.outcomes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([outcome, count]) => lines.push(`| ${outcome} | ${count} |`));
  lines.push('');

  if (metrics.criticalFailures > 0) {
    lines.push(`## Critical failures`);
    lines.push('');
    const criticalCaseIds = [
      ...new Set([...metrics.falseConfidentCases, ...metrics.partialMisreportedAsCompleteCases]),
    ];
    for (const caseId of criticalCaseIds) {
      const caseResult = cases.find((c) => c.caseId === caseId);
      lines.push(
        `- **${caseId}** ("${caseResult?.rawInput}"): outcome=${caseResult?.outcome}, ` +
          `fastPathUsed=${caseResult?.fastPathUsed} — ` +
          `${metrics.falseConfidentCases.includes(caseId) ? 'false-confident. ' : ''}` +
          `${metrics.partialMisreportedAsCompleteCases.includes(caseId) ? 'partial meal misreported as complete.' : ''}`,
      );
    }
    lines.push('');
  }

  lines.push(`## Repeat-consistency groups`);
  lines.push('');
  for (const group of metrics.repeatGroups) {
    lines.push(
      `- \`${group.repeatGroupId}\` (${group.caseIds.join(', ')}): ${group.consistent ? 'consistent ✅' : 'INCONSISTENT ❌'}`,
    );
  }
  lines.push('');

  lines.push(`## Per-case results`);
  lines.push('');
  lines.push(
    `| Case | Category | Expected behavior | Outcome | Fast path | Identification | Critical |`,
  );
  lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const c of cases) {
    lines.push(
      `| ${c.caseId} | ${c.category} | ${c.expectedBehavior} | ${c.outcome} | ${c.fastPathUsed ? 'yes' : 'no'} | ${c.identification} | ${c.isCriticalFailure ? '🔴' : ''} |`,
    );
  }
  lines.push('');

  if (report.notEvaluableCases.length > 0) {
    lines.push(`## Not-evaluable cases`);
    lines.push('');
    report.notEvaluableCases.forEach((c) => lines.push(`- **${c.caseId}**: ${c.reason}`));
    lines.push('');
  }

  lines.push(`## Known limitations of this spike`);
  lines.push('');
  lines.push(
    '- Sample size (14 cases, the same shared corpus as Variant A/B) is a smoke/baseline subset, ' +
      'not the full RESOLVER-V3-001-planned 150-200 case comparison corpus.',
  );
  lines.push(
    '- The shared corpus is single-component (SIMPLE/HOUSEHOLD/DACH only) and BLS-only -- OFF/USDA ' +
      'search-plan execution and true multi-component decomposition are implemented and unit-' +
      'tested, but not exercised by this specific corpus run (see the dedicated multi-component ' +
      'test for that capability).',
  );
  lines.push(
    '- Fast-path components report only per-100g macros (no quantity parsing at that boundary), ' +
      "mirroring Variant A's own documented harness scope -- deterministic quantity scaling is " +
      'fully implemented and exercised only on the AI-routed branch/dedicated tests.',
  );
  lines.push(
    '- Cache-hit rate is structurally 0%/not applicable before RESOLVER-V3-008, consistent with ' +
      'the benchmark specification.',
  );
  lines.push(
    '- Fixture-mode AI interpretations are hand-authored, clearly-labeled synthetic responses -- ' +
      "this run demonstrates the hybrid harness's functional correctness, NOT the real quality of " +
      'any AI model.',
  );
  lines.push('');

  if (warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push('');
    warnings.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push(`## Errors`);
    lines.push('');
    errors.forEach((e) => lines.push(`- ${e}`));
    lines.push('');
  }

  return lines.join('\n');
}
