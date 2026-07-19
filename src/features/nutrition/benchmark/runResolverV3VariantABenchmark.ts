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
  buildVariantAResolver,
  runVariantACase,
  VariantARawResult,
} from './ResolverV3VariantAAdapter';
import { evaluateVariantACase, CaseEvaluation } from './evaluateVariantACase';
import { aggregateVariantAMetrics } from './aggregateVariantAMetrics';
import {
  buildMachineReport,
  buildHumanReport,
  HARNESS_VERSION,
  MachineReport,
} from './buildResolverV3VariantAReports';

/**
 * RESOLVER-V3-003: canonical orchestrator for the Variant-A benchmark harness. Read-only against
 * the real resolver -- no product code changed by running this. Throws (harness failure) only on
 * invalid fixtures or an unexpected internal error; a benchmark case resolving "incorrectly" is
 * captured in the report, never as a thrown error (architecture principle: harness success vs.
 * benchmark quality are different things).
 */

function tryGetGitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    return null;
  }
}

export interface RunResolverV3VariantABenchmarkOptions {
  cases?: readonly BenchmarkCase[];
  /** Re-runs per case to detect non-determinism (spec §6.7). Defaults to 2 (1 primary + 1 repeat). */
  runsPerCase?: number;
  /** Directory reports are written to. Defaults to the repo-root `logs/` dir (gitignored, same
   * convention as `FusionCalibrationMatrix.test.ts`'s `logs/fusion_calibration.log`). */
  outputDir?: string;
  writeReports?: boolean;
}

export interface RunResolverV3VariantABenchmarkResult {
  report: MachineReport;
  humanReport: string;
  jsonPath: string | null;
  markdownPath: string | null;
}

export async function runResolverV3VariantABenchmark(
  options: RunResolverV3VariantABenchmarkOptions = {},
): Promise<RunResolverV3VariantABenchmarkResult> {
  const cases = options.cases ?? RESOLVER_V3_VARIANT_A_SMOKE_CORPUS;
  const runsPerCase = options.runsPerCase ?? 2;
  const outputDir = options.outputDir ?? path.resolve(__dirname, '../../../../logs');
  const writeReports = options.writeReports ?? true;

  // DoD #9: invalid fixtures abort the harness with a precise, case-attributed error rather than
  // silently skipping or scoring them.
  assertValidCorpus(cases);

  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  const { resolver, registeredSourceTypes } = buildVariantAResolver();

  // Deterministic case order regardless of corpus authoring order (task instruction).
  const orderedCases = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));

  const rawResultsByCaseId = new Map<string, VariantARawResult>();
  const evaluationsByCaseId = new Map<string, CaseEvaluation>();
  const bestSourceIdByCaseId = new Map<string, string | null>();

  for (const benchmarkCase of orderedCases) {
    const runs: VariantARawResult[] = [];
    for (let run = 0; run < Math.max(1, runsPerCase); run += 1) {
      // eslint-disable-next-line no-await-in-loop
      runs.push(await runVariantACase(benchmarkCase, resolver));
    }

    const [primary, ...repeats] = runs;
    for (const repeat of repeats) {
      const samePrimaryIdentity =
        repeat.decision.best?.food.sourceId === primary.decision.best?.food.sourceId;
      const sameStatus = repeat.decision.status === primary.decision.status;
      if (!samePrimaryIdentity || !sameStatus) {
        warnings.push(
          `Case "${benchmarkCase.caseId}" produced a different result across repeated runs within ` +
            'the same harness invocation (non-determinism or flakiness detected).',
        );
      }
    }

    rawResultsByCaseId.set(benchmarkCase.caseId, primary);
    bestSourceIdByCaseId.set(benchmarkCase.caseId, primary.decision.best?.food.sourceId ?? null);
    evaluationsByCaseId.set(benchmarkCase.caseId, evaluateVariantACase(benchmarkCase, primary));
  }

  const evaluations = orderedCases.map((c) => evaluationsByCaseId.get(c.caseId)!);
  const metrics = aggregateVariantAMetrics(orderedCases, evaluations, bestSourceIdByCaseId);

  const endedAt = new Date().toISOString();

  const report = buildMachineReport({
    cases: orderedCases,
    rawResultsByCaseId,
    evaluationsByCaseId,
    metrics,
    meta: {
      harnessVersion: HARNESS_VERSION,
      corpusVersion: RESOLVER_V3_VARIANT_A_CORPUS_MANIFEST.corpusVersion,
      variant: 'A',
      startedAt,
      endedAt,
      gitCommit: tryGetGitCommit(),
      configuration: {
        aiProviderUsed: false,
        aiCallCount: 0,
        sourcesRegistered: registeredSourceTypes,
      },
    },
    warnings,
    errors,
  });

  const humanReport = buildHumanReport(report);

  let jsonPath: string | null = null;
  let markdownPath: string | null = null;
  if (writeReports) {
    fs.mkdirSync(outputDir, { recursive: true });
    jsonPath = path.join(outputDir, 'resolver-v3-variant-a-benchmark.json');
    markdownPath = path.join(outputDir, 'resolver-v3-variant-a-benchmark.md');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(markdownPath, humanReport);
  }

  return { report, humanReport, jsonPath, markdownPath };
}
