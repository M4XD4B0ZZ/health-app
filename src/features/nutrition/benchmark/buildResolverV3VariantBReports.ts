import { BenchmarkCase } from './BenchmarkCaseTypes';
import { CaseEvaluationB } from './evaluateVariantBCase';
import { AggregatedVariantBMetrics } from './aggregateVariantBMetrics';
import { VariantBRawCaseResult } from './VariantBTypes';
import { VARIANT_B_ESTIMATOR_VERSION } from './variantBPrompt';
import {
  LiveProviderUsageRecord,
  aggregateLiveProviderUsage,
  ReservedUsageSummary,
} from './LiveProviderUsage';

/**
 * RESOLVER-V3-004: machine-readable + human-readable Variant B report builders. Pure functions
 * over already-computed data (mirrors RESOLVER-V3-003's `buildResolverV3VariantAReports.ts`).
 * Written to separate files from Variant A's reports (`runResolverV3VariantBBenchmark.ts`) --
 * never overwrites Variant A's artifacts.
 */

export const HARNESS_VERSION = '1.0.0';

export interface HarnessRunMetadataB {
  harnessVersion: string;
  corpusVersion: string;
  variant: 'B';
  runMode: 'fixture' | 'live';
  startedAt: string;
  endedAt: string;
  gitCommit: string | null;
  promptVersion: string;
  schemaVersion: string;
  estimatorVersion: string;
  /** Provider/model identity -- infra-layer run metadata only, never part of the food-facing
   * result types (ROADMAP.md). `null` provider/model in fixture mode (no real provider was
   * called). */
  provider: { providerId: string; modelId: string } | null;
  primaryRunsPerCase: number;
  repeatConsistencyRuns: number;
  repeatConsistencyCaseIds: string[];
}

export interface MachineCaseResultB {
  caseId: string;
  category: BenchmarkCase['category'];
  difficulty: BenchmarkCase['difficulty'];
  rawInput: string;
  expectedBehavior: BenchmarkCase['expectedBehavior'];
  outcome: CaseEvaluationB['outcome'];
  identification: CaseEvaluationB['identification'];
  expectedBehaviorEvaluation: CaseEvaluationB['expectedBehavior'];
  falseConfident: boolean;
  hallucinatedBrand: boolean;
  isCriticalFailure: boolean;
  technicalFailure: boolean;
  componentMatch: CaseEvaluationB['componentMatch'];
  precisionRecallF1: CaseEvaluationB['precisionRecallF1'];
  quantities: CaseEvaluationB['quantities'];
  macros: CaseEvaluationB['macros'];
  componentTotalsConsistency: CaseEvaluationB['componentTotalsConsistency'];
  provenance: CaseEvaluationB['provenance'];
  overallConfidence: number | null;
  latencyMs: number;
  runMeta: { providerId: string; modelId: string; costUsd: number | null; pricingStatus: string };
}

export interface MachineReportB {
  meta: HarnessRunMetadataB;
  cases: MachineCaseResultB[];
  metrics: AggregatedVariantBMetrics;
  providerUsage?: {
    records: LiveProviderUsageRecord[];
    actual: ReturnType<typeof aggregateLiveProviderUsage>;
    reserved: ReservedUsageSummary | null;
  };
  warnings: string[];
  errors: string[];
}

function toMachineCaseResult(
  benchmarkCase: BenchmarkCase,
  primaryRaw: VariantBRawCaseResult,
  evaluation: CaseEvaluationB,
): MachineCaseResultB {
  return {
    caseId: benchmarkCase.caseId,
    category: benchmarkCase.category,
    difficulty: benchmarkCase.difficulty,
    rawInput: benchmarkCase.rawInput,
    expectedBehavior: benchmarkCase.expectedBehavior,
    outcome: evaluation.outcome,
    identification: evaluation.identification,
    expectedBehaviorEvaluation: evaluation.expectedBehavior,
    falseConfident: evaluation.falseConfident,
    hallucinatedBrand: evaluation.hallucinatedBrand,
    isCriticalFailure: evaluation.isCriticalFailure,
    technicalFailure: evaluation.technicalFailure,
    componentMatch: evaluation.componentMatch,
    precisionRecallF1: evaluation.precisionRecallF1,
    quantities: evaluation.quantities,
    macros: evaluation.macros,
    componentTotalsConsistency: evaluation.componentTotalsConsistency,
    provenance: evaluation.provenance,
    overallConfidence: evaluation.overallConfidence,
    latencyMs: evaluation.latencyMs,
    runMeta: {
      providerId: primaryRaw.runMeta.providerId,
      modelId: primaryRaw.runMeta.modelId,
      costUsd: primaryRaw.runMeta.costUsd,
      pricingStatus: primaryRaw.runMeta.pricingStatus,
    },
  };
}

/** Builds the machine-readable report. Cases sorted by `caseId` for deterministic, stable
 * ordering (same convention as Variant A's report builder). */
export function buildMachineReportB(input: {
  cases: readonly BenchmarkCase[];
  primaryRawByCaseId: ReadonlyMap<string, VariantBRawCaseResult>;
  primaryEvaluationByCaseId: ReadonlyMap<string, CaseEvaluationB>;
  metrics: AggregatedVariantBMetrics;
  providerUsage?: {
    records: LiveProviderUsageRecord[];
    actual: ReturnType<typeof aggregateLiveProviderUsage>;
    reserved: ReservedUsageSummary | null;
  };
  meta: HarnessRunMetadataB;
  warnings: string[];
  errors: string[];
}): MachineReportB {
  const sortedCases = [...input.cases].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const caseResults = sortedCases.map((benchmarkCase) => {
    const raw = input.primaryRawByCaseId.get(benchmarkCase.caseId);
    const evaluation = input.primaryEvaluationByCaseId.get(benchmarkCase.caseId);
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

function formatUsd(value: number | null): string {
  return value === null ? 'n/a' : `$${value.toFixed(6)}`;
}

/** Builds the human-readable Markdown report. Deterministic given the same machine report. */
export function buildHumanReportB(report: MachineReportB): string {
  const { meta, cases, metrics, warnings, errors } = report;
  const lines: string[] = [];

  lines.push(`# RESOLVER-V3-004 — Variant B Benchmark Report`);
  lines.push('');
  lines.push(
    '> **Variant B is a deliberately simple AI-only control group** -- it estimates nutrients ' +
      'directly, without BLS/OFF/USDA source grounding. It is NOT an accepted production ' +
      'architecture and its results are NOT Zera nutrient truth (ROADMAP.md RESOLVER-V3-004).',
  );
  lines.push('');
  if (meta.runMode === 'fixture') {
    lines.push(
      '> **This is a FIXTURE run.** Every response below came from a deterministic, recorded, ' +
        'synthetic fixture (see `variantBFixtureResponses.ts`) -- NOT a real AI call. This report ' +
        'verifies the harness pipeline (parsing, normalization, evaluation, reporting); it is ' +
        "NOT real evidence about Variant B's actual quality, cost, or latency.",
    );
    lines.push('');
  }

  lines.push(
    `**Result** — ${cases.length} cases, corpus v${meta.corpusVersion}, harness v${meta.harnessVersion}. ` +
      'This sample size is not statistically representative; do not derive a production decision from it.',
  );
  lines.push('');
  lines.push(`- Variant: **B** (direct AI-only estimation, no source grounding)`);
  lines.push(`- Run mode: **${meta.runMode}**`);
  lines.push(`- Run: ${meta.startedAt} → ${meta.endedAt}`);
  lines.push(`- Git commit: ${meta.gitCommit ?? 'unknown'}`);
  lines.push(`- Prompt version: ${meta.promptVersion}`);
  lines.push(`- Schema version: ${meta.schemaVersion}`);
  lines.push(`- Estimator version (provider-neutral): ${meta.estimatorVersion}`);
  lines.push(
    `- Provider/model (infra only): ${meta.provider ? `${meta.provider.providerId} / ${meta.provider.modelId}` : 'n/a (fixture mode)'}`,
  );
  lines.push(`- Primary runs per case: ${meta.primaryRunsPerCase}`);
  lines.push(
    `- Repeat-consistency runs: ${meta.repeatConsistencyRuns} (on cases: ${meta.repeatConsistencyCaseIds.join(', ') || 'none'})`,
  );
  lines.push('');

  lines.push(`## Key metrics`);
  lines.push('');
  lines.push(`| Metric | Value | Absolute |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(
    `| Identification accuracy | ${formatPct(metrics.identification.accuracy)} | ${
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
    `| **Critical failures (false-confident / hallucinated brand)** | — | **${metrics.criticalFailures}/${metrics.caseCount}** |`,
  );
  lines.push(
    `| Component decomposition (P/R/F1) | P=${formatPct(metrics.componentDecomposition.aggregate.precision)}, R=${formatPct(metrics.componentDecomposition.aggregate.recall)}, F1=${metrics.componentDecomposition.aggregate.f1 === null ? 'n/a' : metrics.componentDecomposition.aggregate.f1.toFixed(3)} | TP=${metrics.componentDecomposition.truePositives}, FN=${metrics.componentDecomposition.falseNegatives}, FP=${metrics.componentDecomposition.falsePositives} |`,
  );
  lines.push(
    `| Quantity/unit | correct: ${metrics.quantity.unitCorrectCount}, incorrect: ${metrics.quantity.unitIncorrectCount}, not evaluable: ${metrics.quantity.unitNotEvaluableCount} | median abs. deviation: ${metrics.quantity.medianAbsoluteDeviation?.toFixed(2) ?? 'n/a'} |`,
  );
  lines.push(
    `| Macro tolerance | within: ${metrics.macros.withinToleranceCount}, outside: ${metrics.macros.outsideToleranceCount}, not evaluable: ${metrics.macros.notEvaluableCount}, not normalizable (no gram basis): ${metrics.macros.notNormalizableCount} | component/totals mismatch: ${metrics.macros.componentTotalsMismatchCount} |`,
  );
  lines.push(`| p50 latency | ${formatMs(metrics.latency.p50Ms)} | — |`);
  lines.push(`| p95 latency | ${formatMs(metrics.latency.p95Ms)} | — |`);
  lines.push(
    `| Cost | total: ${formatUsd(metrics.cost.totalKnownOrEstimatedUsd)} (unknown-pricing calls: ${metrics.cost.unknownPricingCallCount}) | per evaluable case: ${formatUsd(metrics.cost.perEvaluableCaseUsd)}, per correct case: ${formatUsd(metrics.cost.perCorrectCaseUsd)}, per correct complex case: ${formatUsd(metrics.cost.perCorrectComplexCaseUsd)} |`,
  );
  lines.push(
    `| AI calls / external requests | ${metrics.cost.totalAiCalls} / ${metrics.cost.totalExternalRequests} | tokens in/out: ${metrics.cost.totalInputTokens ?? 'n/a'}/${metrics.cost.totalOutputTokens ?? 'n/a'} |`,
  );
  lines.push('');

  lines.push(
    `## Macro error (median absolute / mean signed, over normalizable cases with non-null reference)`,
  );
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
    const criticalCaseIds = new Set([
      ...metrics.falseConfidentCases,
      ...metrics.hallucinatedBrandCases,
    ]);
    for (const caseId of criticalCaseIds) {
      const caseResult = cases.find((c) => c.caseId === caseId);
      lines.push(
        `- **${caseId}** ("${caseResult?.rawInput}"): outcome=${caseResult?.outcome}, ` +
          `identification=${caseResult?.identification}` +
          `${caseResult?.falseConfident ? ' — false-confident' : ''}` +
          `${caseResult?.hallucinatedBrand ? ' — hallucinated brand' : ''}.`,
      );
    }
    lines.push('');
  }

  if (metrics.notEvaluableCases.length > 0) {
    lines.push(`## Not evaluable cases`);
    lines.push('');
    metrics.notEvaluableCases.forEach((c) => lines.push(`- **${c.caseId}**: ${c.reason}`));
    lines.push('');
  }

  lines.push(`## Repeat-consistency groups (paraphrase/synonym pairs)`);
  lines.push('');
  for (const group of metrics.repeatGroups) {
    lines.push(
      `- \`${group.repeatGroupId}\` (${group.caseIds.join(', ')}): ${group.consistent ? 'consistent ✅' : 'INCONSISTENT ❌'}`,
    );
  }
  lines.push('');

  if (metrics.sameInputConsistency.length > 0) {
    lines.push(`## Same-input repeat-run consistency`);
    lines.push('');
    lines.push(
      `| Case | Runs | Outcome consistent | Identification consistent | kcal range | Confidence range |`,
    );
    lines.push(`| --- | --- | --- | --- | --- | --- |`);
    metrics.sameInputConsistency.forEach((s) => {
      lines.push(
        `| ${s.caseId} | ${s.runCount} | ${s.outcomeConsistent ? '✅' : '❌'} | ${s.identificationConsistent ? '✅' : '❌'} | ${s.kcalRangeAcrossRuns?.toFixed(2) ?? 'n/a'} | ${s.confidenceRangeAcrossRuns?.toFixed(2) ?? 'n/a'} |`,
      );
    });
    lines.push('');
  }

  lines.push(`## Per-case results`);
  lines.push('');
  lines.push(
    `| Case | Category | Expected behavior | Outcome | Identification | Behavior eval | Critical |`,
  );
  lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const c of cases) {
    lines.push(
      `| ${c.caseId} | ${c.category} | ${c.expectedBehavior} | ${c.outcome} | ${c.identification} | ${c.expectedBehaviorEvaluation.result} (${c.expectedBehaviorEvaluation.note}) | ${c.isCriticalFailure ? '🔴' : ''} |`,
    );
  }
  lines.push('');

  lines.push(`## Known limitations of this run`);
  lines.push('');
  lines.push(
    "- Sample size matches Variant A's 14-case smoke subset, not the full RESOLVER-V3-001-planned " +
      '150-200 case comparison corpus; do not draw production conclusions from it.',
  );
  lines.push(
    '- Macro comparison is only possible when a matched component reports its quantity in grams -- ' +
      `${metrics.macros.notNormalizableCount} case(s) used a non-gram unit (\`piece\`/\`portion\`) with ` +
      'no gram equivalent and are reported as "not normalizable", never guessed.',
  );
  lines.push(
    '- Component decomposition precision/recall/F1 is computed over the whole corpus; this smoke ' +
      'subset has no COMPOSED/HOMEMADE/RESTAURANT cases, so it is trivially 1:1 per case here.',
  );
  lines.push(
    '- Cache-hit rate is structurally not applicable (no persistent cache exists before ' +
      'RESOLVER-V3-008).',
  );
  lines.push(
    "- Confidence values are Variant B's own raw native scale -- not normalized against Variant " +
      'A/C (that normalization is reserved for RESOLVER-V3-006).',
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

// Re-exported so callers only need to import from this module for the run metadata's estimator
// version default, avoiding a second import of `variantBPrompt.ts` in the orchestrator for this
// single constant.
export { VARIANT_B_ESTIMATOR_VERSION };
