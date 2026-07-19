import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { BenchmarkCase } from './BenchmarkCaseTypes';
import { assertValidCorpus } from './validateBenchmarkCase';
import {
  RESOLVER_V3_VARIANT_A_CORPUS_MANIFEST,
  RESOLVER_V3_VARIANT_A_SMOKE_CORPUS,
} from './resolverV3VariantASmokeCorpus';
import { buildVariantAResolver } from './ResolverV3VariantAAdapter';
import {
  FixtureCostAiInterpreter,
  runVariantCCase,
  VariantCDependencies,
} from './ResolverV3VariantCAdapter';
import { FixtureAiInterpretationProvider } from './VariantCFixtureInterpretations';
import { createLiveVariantCInterpreter } from './VariantCLiveInterpretationProvider';
import { evaluateVariantCCase, CaseEvaluationC } from './evaluateVariantCCase';
import { aggregateVariantCMetrics } from './aggregateVariantCMetrics';
import { VariantCAiInterpreter, VariantCRawCaseResult } from './VariantCTypes';
import {
  buildMachineReportC,
  buildHumanReportC,
  HARNESS_VERSION,
  MachineReportC,
} from './buildResolverV3VariantCReports';
import { VARIANT_C_PROMPT_VERSION, VARIANT_C_SCHEMA_VERSION } from './variantCPrompt';

/**
 * RESOLVER-V3-005: canonical orchestrator for the Variant C (AI-first, source-grounded hybrid
 * spike) benchmark harness. Mirrors RESOLVER-V3-003/004's orchestration shape exactly: same
 * shared corpus/validator, same deterministic case ordering, same "throw only on harness failure,
 * never on a bad benchmark result" principle. Never registers anything in `container.ts`; the
 * production resolver's default wiring is untouched.
 */

const TECHNICAL_FAILURE_OUTCOMES = new Set(['unavailable', 'invalid_response', 'error']);

function tryGetGitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    return null;
  }
}

export interface RunResolverV3VariantCBenchmarkOptions {
  cases?: readonly BenchmarkCase[];
  /** Default `'fixture'` -- a live run must be requested explicitly, same rule as Variant B. */
  mode?: 'fixture' | 'live';
  /** Override the AI interpreter (mainly for tests). When omitted, `mode` determines it: `fixture`
   * -> `FixtureCostAiInterpreter` over `FixtureAiInterpretationProvider`, `live` ->
   * `createLiveVariantCInterpreter()`. */
  aiInterpreter?: VariantCAiInterpreter;
  outputDir?: string;
  writeReports?: boolean;
}

export interface RunResolverV3VariantCBenchmarkResult {
  report: MachineReportC;
  humanReport: string;
  jsonPath: string | null;
  markdownPath: string | null;
}

export async function runResolverV3VariantCBenchmark(
  options: RunResolverV3VariantCBenchmarkOptions = {},
): Promise<RunResolverV3VariantCBenchmarkResult> {
  const cases = options.cases ?? RESOLVER_V3_VARIANT_A_SMOKE_CORPUS;
  const mode = options.mode ?? 'fixture';
  const outputDir = options.outputDir ?? path.resolve(__dirname, '../../../../logs');
  const writeReports = options.writeReports ?? true;

  // Same corpus, same validator as Variant A/B -- no separate, more convenient case selection.
  assertValidCorpus(cases);

  const aiInterpreter: VariantCAiInterpreter =
    options.aiInterpreter ??
    (mode === 'live'
      ? createLiveVariantCInterpreter()
      : new FixtureCostAiInterpreter(new FixtureAiInterpretationProvider()));

  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Fresh fast-path resolver per run -- the same, real, unmodified Variant A resolver bundle.
  const { resolver: fastPathResolver } = buildVariantAResolver();
  const deps: VariantCDependencies = { aiInterpreter, fastPathResolver };

  const orderedCases = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));

  const rawByCaseId = new Map<string, VariantCRawCaseResult>();
  const evaluationsByCaseId = new Map<string, CaseEvaluationC>();
  const bestSourceIdByCaseId = new Map<string, string | null>();
  const notEvaluableCases: { caseId: string; reason: string }[] = [];

  for (const benchmarkCase of orderedCases) {
    // eslint-disable-next-line no-await-in-loop
    const raw = await runVariantCCase(benchmarkCase, deps);
    rawByCaseId.set(benchmarkCase.caseId, raw);
    const evaluation = evaluateVariantCCase(benchmarkCase, raw);
    evaluationsByCaseId.set(benchmarkCase.caseId, evaluation);
    bestSourceIdByCaseId.set(
      benchmarkCase.caseId,
      raw.mealResult.components[0]?.provenance.sourceId ?? null,
    );

    if (TECHNICAL_FAILURE_OUTCOMES.has(raw.mealResult.outcome)) {
      notEvaluableCases.push({
        caseId: benchmarkCase.caseId,
        reason: `technical outcome: ${raw.mealResult.outcome}`,
      });
    }
    raw.mealResult.errors.forEach((e) => warnings.push(`Case "${benchmarkCase.caseId}": ${e}`));
  }

  const evaluations = orderedCases.map((c) => evaluationsByCaseId.get(c.caseId)!);
  const metrics = aggregateVariantCMetrics(
    orderedCases,
    evaluations,
    rawByCaseId,
    bestSourceIdByCaseId,
  );

  const endedAt = new Date().toISOString();

  const providerMeta = options.aiInterpreter
    ? null
    : mode === 'live'
      ? {
          providerId: 'anthropic',
          modelId: process.env.ANTHROPIC_VARIANT_C_MODEL || 'claude-haiku-4-5',
        }
      : { providerId: 'fixture', modelId: 'fixture-recorded-response' };

  // Reports the interpreter version actually used by AI-called cases in this run, never a
  // hardcoded constant that could misrepresent a fixture run as having used the live interpreter
  // (or vice versa). `n/a` when every case resolved via the fast path (no AI call at all).
  const actualInterpreterVersion =
    [...rawByCaseId.values()].find((r) => r.mealResult.aiInterpretation.called)?.mealResult
      .aiInterpretation.interpreterVersion ?? 'n/a (fast path only, no AI call made)';

  const report = buildMachineReportC({
    cases: orderedCases,
    rawByCaseId,
    evaluationsByCaseId,
    metrics,
    meta: {
      harnessVersion: HARNESS_VERSION,
      corpusVersion: RESOLVER_V3_VARIANT_A_CORPUS_MANIFEST.corpusVersion,
      variant: 'C',
      runMode: mode,
      startedAt,
      endedAt,
      gitCommit: tryGetGitCommit(),
      promptVersion: VARIANT_C_PROMPT_VERSION,
      schemaVersion: VARIANT_C_SCHEMA_VERSION,
      interpreterVersion: actualInterpreterVersion,
      provider: providerMeta,
      fastPathConfiguration: {
        description:
          'Variant A resolver (SequentialFoodCatalogResolver + BlsStaticSource) is run first; ' +
          'ResolverDecision.status === "accepted" (existing ResolverDecisionPolicy threshold) ' +
          'counts as a validated fast path and skips the AI interpretation call entirely.',
      },
    },
    notEvaluableCases,
    warnings,
    errors,
  });

  const humanReport = buildHumanReportC(report);

  let jsonPath: string | null = null;
  let markdownPath: string | null = null;
  if (writeReports) {
    fs.mkdirSync(outputDir, { recursive: true });
    jsonPath = path.join(outputDir, 'resolver-v3-variant-c-benchmark.json');
    markdownPath = path.join(outputDir, 'resolver-v3-variant-c-benchmark.md');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(markdownPath, humanReport);
  }

  return { report, humanReport, jsonPath, markdownPath };
}
