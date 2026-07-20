import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { BenchmarkCase } from './BenchmarkCaseTypes';
import { assertValidCorpus } from './validateBenchmarkCase';
import {
  RESOLVER_V3_VARIANT_A_CORPUS_MANIFEST,
  RESOLVER_V3_VARIANT_A_SMOKE_CORPUS,
} from './resolverV3VariantASmokeCorpus';
import {
  FixtureVariantBProvider,
  runVariantBCase,
  VariantBProvider,
} from './ResolverV3VariantBAdapter';
import { createLiveVariantBProvider } from './VariantBLiveProvider';
import { evaluateVariantBCase, CaseEvaluationB } from './evaluateVariantBCase';
import { aggregateVariantBMetrics } from './aggregateVariantBMetrics';
import { VariantBRawCaseResult } from './VariantBTypes';
import {
  buildMachineReportB,
  buildHumanReportB,
  HARNESS_VERSION,
  MachineReportB,
} from './buildResolverV3VariantBReports';
import {
  VARIANT_B_PROMPT_VERSION,
  VARIANT_B_SCHEMA_VERSION,
  VARIANT_B_ESTIMATOR_VERSION,
} from './variantBPrompt';
import { VARIANT_B_FIXTURE_RESPONSES } from './variantBFixtureResponses';
import { LiveProviderBudgetGate } from './LiveProviderBudgetGate';
import { LiveProviderUsageRecord, aggregateLiveProviderUsage } from './LiveProviderUsage';

/**
 * RESOLVER-V3-004: canonical orchestrator for the Variant B (direct AI-only estimation) benchmark
 * harness. Mirrors RESOLVER-V3-003's `runResolverV3VariantABenchmark.ts` orchestration shape
 * (same corpus loader/validator, same deterministic case ordering, same "throw only on harness
 * failure, never on a bad benchmark result" principle) but drives a Variant B provider instead of
 * the real resolver -- reads the *same* committed corpus (`resolverV3VariantASmokeCorpus.ts`),
 * per ROADMAP.md's explicit "keine separate, bequemere Fallauswahl fuer B" requirement.
 *
 * Live mode never silently falls back to fixture: `createLiveVariantBProvider()` throws a precise,
 * secret-free `VariantBLiveProviderConfigError` when credentials are missing, and that error is
 * deliberately left to propagate out of this function uncaught.
 */

function tryGetGitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    return null;
  }
}

export interface RunResolverV3VariantBBenchmarkOptions {
  cases?: readonly BenchmarkCase[];
  /** Default `'fixture'` -- a live run must be requested explicitly (ROADMAP.md: "kein stiller
   * Fallback von Live auf Fixture", "Live-Aufruf nur explizit"). */
  mode?: 'fixture' | 'live';
  /** Override the provider (mainly for tests). When omitted, `mode` determines the provider:
   * `fixture` -> `FixtureVariantBProvider` over the committed fixture table, `live` ->
   * `createLiveVariantBProvider()`. */
  provider?: VariantBProvider;
  /** Shared experiment gate; callers running B and C together must pass the same instance. */
  budgetGate?: LiveProviderBudgetGate;
  /** Number of runs for cases in the `REPEAT_CONSISTENCY` overlay sample (cases with a
   * `repeatGroupId`) -- spec §6.7/§8: "mindestens 3 Durchlaeufe pro Fall in der
   * REPEAT_CONSISTENCY-Stichprobe", not the whole corpus (cost control). All other cases get
   * exactly 1 primary run (spec §8: "1 Primaerlauf pro Fall"). Defaults to 3. */
  repeatConsistencyRuns?: number;
  outputDir?: string;
  writeReports?: boolean;
}

export interface RunResolverV3VariantBBenchmarkResult {
  report: MachineReportB;
  humanReport: string;
  jsonPath: string | null;
  markdownPath: string | null;
}

export async function runResolverV3VariantBBenchmark(
  options: RunResolverV3VariantBBenchmarkOptions = {},
): Promise<RunResolverV3VariantBBenchmarkResult> {
  const cases = options.cases ?? RESOLVER_V3_VARIANT_A_SMOKE_CORPUS;
  const mode = options.mode ?? 'fixture';
  const repeatConsistencyRuns = Math.max(1, options.repeatConsistencyRuns ?? 3);
  const outputDir = options.outputDir ?? path.resolve(__dirname, '../../../../logs');
  const writeReports = options.writeReports ?? true;

  // Same corpus, same validator as Variant A -- no separate, more convenient case selection for B
  // (ROADMAP.md RESOLVER-V3-004 requirement).
  assertValidCorpus(cases);

  const provider =
    options.provider ??
    (mode === 'live'
      ? createLiveVariantBProvider(process.env, options.budgetGate)
      : new FixtureVariantBProvider(VARIANT_B_FIXTURE_RESPONSES));

  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  const orderedCases = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));

  const rawByCaseId = new Map<string, VariantBRawCaseResult[]>();
  const evaluationsByCaseId = new Map<string, CaseEvaluationB[]>();
  const repeatConsistencyCaseIds: string[] = [];

  for (const benchmarkCase of orderedCases) {
    const runsForCase = benchmarkCase.repeatGroupId ? repeatConsistencyRuns : 1;
    if (benchmarkCase.repeatGroupId) repeatConsistencyCaseIds.push(benchmarkCase.caseId);

    const rawResults: VariantBRawCaseResult[] = [];
    for (let runIndex = 0; runIndex < runsForCase; runIndex += 1) {
      // eslint-disable-next-line no-await-in-loop
      rawResults.push(await runVariantBCase(benchmarkCase, provider, runIndex));
    }
    rawByCaseId.set(benchmarkCase.caseId, rawResults);
    evaluationsByCaseId.set(
      benchmarkCase.caseId,
      rawResults.map((raw) => evaluateVariantBCase(benchmarkCase, raw)),
    );

    rawResults.forEach((raw) => {
      if (raw.runMeta.httpError) {
        warnings.push(
          `Case "${benchmarkCase.caseId}" run ${raw.request.runIndex}: ${raw.runMeta.httpError}`,
        );
      }
    });
  }

  const primaryRawByCaseId = new Map<string, VariantBRawCaseResult>();
  const primaryEvaluationByCaseId = new Map<string, CaseEvaluationB>();
  for (const benchmarkCase of orderedCases) {
    const raw = rawByCaseId.get(benchmarkCase.caseId)?.[0];
    const evaluation = evaluationsByCaseId.get(benchmarkCase.caseId)?.[0];
    if (raw) primaryRawByCaseId.set(benchmarkCase.caseId, raw);
    if (evaluation) primaryEvaluationByCaseId.set(benchmarkCase.caseId, evaluation);
  }

  const metrics = aggregateVariantBMetrics(orderedCases, evaluationsByCaseId, rawByCaseId);
  const usageRecords: LiveProviderUsageRecord[] = [...rawByCaseId.values()].flat().map((raw) => ({
    variant: 'B',
    caseId: raw.request.caseId,
    attempt: raw.request.runIndex + 1,
    httpStatus: raw.runMeta.httpStatus ?? null,
    providerStatus: raw.runMeta.httpError
      ? raw.runMeta.httpStatus
        ? 'http_error'
        : 'network_error'
      : 'success',
    inputTokens: raw.runMeta.inputTokens,
    outputTokens: raw.runMeta.outputTokens,
    cacheCreationTokens: raw.runMeta.cacheCreationTokens ?? null,
    cacheReadTokens: raw.runMeta.cacheReadTokens ?? null,
    providerLatencyMs: raw.runMeta.latencyMs,
    endToEndLatencyMs: raw.runMeta.latencyMs,
    retried: raw.request.runIndex > 0,
    actualCostUsd: raw.runMeta.costUsd,
    usageStatus:
      raw.runMeta.inputTokens === null || raw.runMeta.outputTokens === null
        ? 'unknown'
        : 'reported',
  }));
  const gateSnapshot = options.budgetGate?.snapshot();
  const providerUsage = {
    records: usageRecords,
    actual: aggregateLiveProviderUsage(usageRecords),
    reserved: gateSnapshot
      ? {
          calls: gateSnapshot.calls,
          inputTokens: gateSnapshot.inputTokens,
          outputTokens: gateSnapshot.outputTokens,
          costUsd: gateSnapshot.reservedCost,
        }
      : null,
  };

  const endedAt = new Date().toISOString();

  const report = buildMachineReportB({
    cases: orderedCases,
    primaryRawByCaseId,
    primaryEvaluationByCaseId,
    metrics,
    providerUsage,
    meta: {
      harnessVersion: HARNESS_VERSION,
      corpusVersion: RESOLVER_V3_VARIANT_A_CORPUS_MANIFEST.corpusVersion,
      variant: 'B',
      runMode: mode,
      startedAt,
      endedAt,
      gitCommit: tryGetGitCommit(),
      promptVersion: VARIANT_B_PROMPT_VERSION,
      schemaVersion: VARIANT_B_SCHEMA_VERSION,
      estimatorVersion: VARIANT_B_ESTIMATOR_VERSION,
      provider: { providerId: provider.providerId, modelId: provider.modelId },
      primaryRunsPerCase: 1,
      repeatConsistencyRuns,
      repeatConsistencyCaseIds,
    },
    warnings,
    errors,
  });

  const humanReport = buildHumanReportB(report);

  let jsonPath: string | null = null;
  let markdownPath: string | null = null;
  if (writeReports) {
    fs.mkdirSync(outputDir, { recursive: true });
    jsonPath = path.join(outputDir, 'resolver-v3-variant-b-benchmark.json');
    markdownPath = path.join(outputDir, 'resolver-v3-variant-b-benchmark.md');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(markdownPath, humanReport);
  }

  return { report, humanReport, jsonPath, markdownPath };
}
