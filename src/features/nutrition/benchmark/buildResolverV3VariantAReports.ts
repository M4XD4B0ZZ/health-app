import { BenchmarkCase } from './BenchmarkCaseTypes';
import { CaseEvaluation } from './evaluateVariantACase';
import { AggregatedVariantAMetrics } from './aggregateVariantAMetrics';
import { VariantARawResult } from './ResolverV3VariantAAdapter';

/**
 * RESOLVER-V3-003: machine-readable + human-readable report builders. Pure functions over
 * already-computed data -- no I/O here, so both are directly unit-testable; the orchestrator
 * (`runResolverV3VariantABenchmark.ts`) is the only place that writes files.
 */

export const HARNESS_VERSION = '1.0.0';

export interface HarnessRunMetadata {
  harnessVersion: string;
  corpusVersion: string;
  variant: 'A';
  startedAt: string;
  endedAt: string;
  gitCommit: string | null;
  configuration: {
    aiProviderUsed: false;
    aiCallCount: 0;
    sourcesRegistered: string[];
  };
}

export interface MachineCaseResult {
  caseId: string;
  category: BenchmarkCase['category'];
  difficulty: BenchmarkCase['difficulty'];
  rawInput: string;
  expectedBehavior: BenchmarkCase['expectedBehavior'];
  resolverStatus: string;
  resolverReasonCodes: string[];
  best: {
    sourceId: string | null;
    name: string;
    source: string;
    score: number;
  } | null;
  identification: CaseEvaluation['identification'];
  expectedBehaviorEvaluation: CaseEvaluation['expectedBehavior'];
  falseConfident: boolean;
  isCriticalFailure: boolean;
  macros: CaseEvaluation['macros'];
  provenance: CaseEvaluation['provenance'];
  latencyMs: number;
}

export interface MachineReport {
  meta: HarnessRunMetadata;
  cases: MachineCaseResult[];
  metrics: AggregatedVariantAMetrics;
  warnings: string[];
  errors: string[];
}

function toMachineCaseResult(
  benchmarkCase: BenchmarkCase,
  raw: VariantARawResult,
  evaluation: CaseEvaluation,
): MachineCaseResult {
  return {
    caseId: benchmarkCase.caseId,
    category: benchmarkCase.category,
    difficulty: benchmarkCase.difficulty,
    rawInput: benchmarkCase.rawInput,
    expectedBehavior: benchmarkCase.expectedBehavior,
    resolverStatus: raw.decision.status,
    resolverReasonCodes: raw.decision.reasonCodes,
    best: raw.decision.best
      ? {
          sourceId: raw.decision.best.food.sourceId ?? null,
          name: raw.decision.best.food.name,
          source: raw.decision.best.source,
          score: raw.decision.best.score,
        }
      : null,
    identification: evaluation.identification,
    expectedBehaviorEvaluation: evaluation.expectedBehavior,
    falseConfident: evaluation.falseConfident,
    isCriticalFailure: evaluation.isCriticalFailure,
    macros: evaluation.macros,
    provenance: evaluation.provenance,
    latencyMs: evaluation.latencyMs,
  };
}

/** Builds the machine-readable report. Cases are sorted by `caseId` for a deterministic,
 * stable field/array ordering regardless of corpus iteration order (task instruction:
 * "deterministische Sortierung"). */
export function buildMachineReport(input: {
  cases: readonly BenchmarkCase[];
  rawResultsByCaseId: ReadonlyMap<string, VariantARawResult>;
  evaluationsByCaseId: ReadonlyMap<string, CaseEvaluation>;
  metrics: AggregatedVariantAMetrics;
  meta: HarnessRunMetadata;
  warnings: string[];
  errors: string[];
}): MachineReport {
  const sortedCases = [...input.cases].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const caseResults = sortedCases.map((benchmarkCase) => {
    const raw = input.rawResultsByCaseId.get(benchmarkCase.caseId);
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

/** Builds the human-readable Markdown report. Deterministic given the same machine report. */
export function buildHumanReport(report: MachineReport): string {
  const { meta, cases, metrics, warnings, errors } = report;
  const lines: string[] = [];

  lines.push(`# RESOLVER-V3-003 — Variant A Benchmark Report`);
  lines.push('');
  lines.push(
    `**Smoke/baseline result** — ${cases.length} cases, corpus v${meta.corpusVersion}, harness v${meta.harnessVersion}. ` +
      'This sample size is not statistically representative; do not derive a production decision from it (task scope).',
  );
  lines.push('');
  lines.push(`- Variant: **${meta.variant}** (current, merged \`SequentialFoodCatalogResolver\`)`);
  lines.push(`- Run: ${meta.startedAt} → ${meta.endedAt}`);
  lines.push(`- Git commit: ${meta.gitCommit ?? 'unknown'}`);
  lines.push(
    `- AI provider used: ${meta.configuration.aiProviderUsed} (AI calls: ${meta.configuration.aiCallCount})`,
  );
  lines.push(`- Sources registered: ${meta.configuration.sourcesRegistered.join(', ')}`);
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
    `| Expected-behavior partial | ${formatPct(metrics.expectedBehavior.partial / metrics.caseCount)} | ${metrics.expectedBehavior.partial}/${metrics.caseCount} |`,
  );
  lines.push(
    `| Expected-behavior mismatch | ${formatPct(metrics.expectedBehavior.mismatch / metrics.caseCount)} | ${metrics.expectedBehavior.mismatch}/${metrics.caseCount} |`,
  );
  lines.push(
    `| **Critical failures (false-confident)** | — | **${metrics.criticalFailures}/${metrics.caseCount}** |`,
  );
  lines.push(
    `| Provenance: sourceId present | ${formatPct(metrics.provenance.sourceIdPresentRate)} | — |`,
  );
  lines.push(`| AI used as source | — | ${metrics.provenance.aiUsedAsSourceCount} (must be 0) |`);
  lines.push(
    `| Macro tolerance | within: ${metrics.macros.withinToleranceCount}, outside: ${metrics.macros.outsideToleranceCount}, not evaluable: ${metrics.macros.notEvaluableCount} | — |`,
  );
  lines.push(`| p50 latency | ${formatMs(metrics.latency.p50Ms)} | — |`);
  lines.push(`| p95 latency | ${formatMs(metrics.latency.p95Ms)} | — |`);
  lines.push('');

  lines.push(`## Macro error (median absolute / mean signed, over cases with non-null reference)`);
  lines.push('');
  lines.push(`| Nutrient | n | Median abs. error | Mean signed error |`);
  lines.push(`| --- | --- | --- | --- |`);
  (['kcal', 'protein_g', 'fat_g', 'carbs_g'] as const).forEach((nutrient) => {
    const stats = metrics.macros.perNutrient[nutrient];
    lines.push(
      `| ${nutrient} | ${stats.sampleCount} | ${stats.medianAbsoluteError?.toFixed(2) ?? 'n/a'} | ${stats.meanSignedError?.toFixed(2) ?? 'n/a'} |`,
    );
  });
  lines.push('');

  if (metrics.criticalFailures > 0) {
    lines.push(`## Critical failures`);
    lines.push('');
    for (const caseId of metrics.falseConfidentCases) {
      const caseResult = cases.find((c) => c.caseId === caseId);
      lines.push(
        `- **${caseId}** ("${caseResult?.rawInput}"): status=${caseResult?.resolverStatus}, ` +
          `best=${caseResult?.best?.name ?? 'none'} — confidently resolved when the ground truth ` +
          'says otherwise (see case notes in the corpus file for the specific reason).',
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
    `| Case | Category | Expected behavior | Status | Identification | Behavior eval | Critical |`,
  );
  lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const c of cases) {
    lines.push(
      `| ${c.caseId} | ${c.category} | ${c.expectedBehavior} | ${c.resolverStatus} | ${c.identification} | ${c.expectedBehaviorEvaluation.result} (${c.expectedBehaviorEvaluation.note}) | ${c.isCriticalFailure ? '🔴' : ''} |`,
    );
  }
  lines.push('');

  lines.push(`## Known limitations of this smoke run`);
  lines.push('');
  lines.push(
    '- Sample size (14 cases) is a smoke/baseline subset, not the full RESOLVER-V3-001-planned ' +
      '150-200 case comparison corpus; do not draw production conclusions from it.',
  );
  lines.push(
    '- Quantity/unit accuracy is not evaluated: this harness calls `SequentialFoodCatalogResolver` ' +
      "directly (per RESOLVER-V3-003's scope), which resolves food identity only -- quantity " +
      'parsing lives in a separate layer (PortionParser/DeterministicFoodParser) not exercised here.',
  );
  lines.push(
    '- Component-level precision/recall (COMPOSED/HOMEMADE/RESTAURANT multi-item decomposition) ' +
      'is not evaluated for the same reason: the resolver resolves one food-name query at a time.',
  );
  lines.push(
    '- Cache-hit rate is structurally 0%/not applicable (no persistent cache exists before ' +
      'RESOLVER-V3-008), consistent with the benchmark specification.',
  );
  lines.push(
    '- "clarification_required" is evaluated against the resolver\'s own `ambiguous` status as a ' +
      'proxy, since a literal clarification question (e.g. the Speck disambiguation UX) is ' +
      'implemented one layer above the resolver boundary this harness calls.',
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
