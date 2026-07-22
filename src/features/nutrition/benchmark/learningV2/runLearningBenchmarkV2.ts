import {
  LEARNING_BENCHMARK_V2_CORPUS,
  LEARNING_BENCHMARK_V2_CORPUS_HASH,
  LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST,
} from './LearningBenchmarkV2Manifest';
import { LearningBenchmarkV2Registry } from './LearningBenchmarkV2Registry';
import { assertValidLearningBenchmarkV2Corpus } from './LearningBenchmarkV2Validator';
import {
  LEARNING_BENCHMARK_V2_CORPUS_VERSION,
  LEARNING_BENCHMARK_V2_HARNESS_VERSION,
  LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
  type LearningBenchmarkV2Partition,
  type LearningBenchmarkV2Scenario,
} from './LearningBenchmarkV2Types';
import {
  buildVariantAResolver,
  evaluateLearningBenchmarkV2ResolutionScenario,
  type LearningBenchmarkV2ResolutionScenarioEvaluation,
} from './evaluateLearningBenchmarkV2ResolutionScenario';
import { FixtureFoodCatalogSource } from '../ResolverV3VariantAAdapter';
import { LEARNING_BENCHMARK_V2_FIXTURE_OFF_CANDIDATES } from './LearningBenchmarkV2ResolutionCorpus';
import {
  evaluateLearningBenchmarkV2PersonalMemoryScenario,
  type LearningBenchmarkV2PersonalMemoryScenarioEvaluation,
} from './evaluateLearningBenchmarkV2PersonalMemoryScenario';
import {
  evaluateLearningBenchmarkV2GlobalCandidateScenario,
  type LearningBenchmarkV2GlobalCandidateScenarioEvaluation,
} from './evaluateLearningBenchmarkV2GlobalCandidateScenario';
import {
  evaluateLearningBenchmarkV2PrivacyScenario,
  type LearningBenchmarkV2PrivacyScenarioEvaluation,
} from './evaluateLearningBenchmarkV2PrivacyScenario';
import {
  evaluateLearningBenchmarkV2EconomicsScenario,
  type LearningBenchmarkV2EconomicsScenarioEvaluation,
} from './evaluateLearningBenchmarkV2EconomicsScenario';
import {
  aggregateLearningBenchmarkV2Metrics,
  type LearningBenchmarkV2PartitionMetrics,
} from './aggregateLearningBenchmarkV2Metrics';
import {
  evaluateLearningBenchmarkV2Invariants,
  type LearningBenchmarkV2InvariantVerdict,
} from './evaluateLearningBenchmarkV2Invariants';

export interface LearningBenchmarkV2PartitionResult {
  partition: LearningBenchmarkV2Partition;
  resolution: readonly LearningBenchmarkV2ResolutionScenarioEvaluation[];
  personalMemory: readonly LearningBenchmarkV2PersonalMemoryScenarioEvaluation[];
  globalCandidate: readonly LearningBenchmarkV2GlobalCandidateScenarioEvaluation[];
  privacy: readonly LearningBenchmarkV2PrivacyScenarioEvaluation[];
  economics: readonly LearningBenchmarkV2EconomicsScenarioEvaluation[];
  metrics: LearningBenchmarkV2PartitionMetrics;
}

export interface RunLearningBenchmarkV2Options {
  /** `'development'` (default), `'holdout'`, or `'all'`. Holdout requires no special flag here --
   * the CLI (`scripts/benchmark-resolver-v3-learning-v2.mjs`) is the layer that enforces the
   * explicit `--final-evaluation` gate before it will ever pass `'holdout'`/`'all'` through. */
  partition?: LearningBenchmarkV2Partition | 'all';
  /** Restrict to specific scenario IDs (must all exist and belong to the selected partition(s)). */
  scenarioIds?: readonly string[];
}

export interface RunLearningBenchmarkV2Result {
  harnessVersion: string;
  corpusVersion: string;
  corpusHash: string;
  registryVersion: string;
  partitionsRun: readonly LearningBenchmarkV2Partition[];
  development: LearningBenchmarkV2PartitionResult | null;
  holdout: LearningBenchmarkV2PartitionResult | null;
  invariantVerdicts: readonly LearningBenchmarkV2InvariantVerdict[];
  startedAt: string;
  endedAt: string;
  benchmarkRuntimeMeasuredMs: number;
}

function partitionsFor(
  option: LearningBenchmarkV2Partition | 'all' | undefined,
): LearningBenchmarkV2Partition[] {
  if (option === 'all') return ['development', 'holdout'];
  return [option ?? 'development'];
}

async function runPartition(
  partition: LearningBenchmarkV2Partition,
  scenarios: readonly LearningBenchmarkV2Scenario[],
): Promise<LearningBenchmarkV2PartitionResult> {
  const resolutionScenarios = scenarios.filter(
    (s): s is Extract<LearningBenchmarkV2Scenario, { scenarioType: 'resolution_decomposition' }> =>
      s.scenarioType === 'resolution_decomposition',
  );
  const personalMemoryScenarios = scenarios.filter(
    (s): s is Extract<LearningBenchmarkV2Scenario, { scenarioType: 'personal_memory_sequence' }> =>
      s.scenarioType === 'personal_memory_sequence',
  );
  const globalCandidateScenarios = scenarios.filter(
    (s): s is Extract<LearningBenchmarkV2Scenario, { scenarioType: 'global_candidate_sequence' }> =>
      s.scenarioType === 'global_candidate_sequence',
  );
  const privacyScenarios = scenarios.filter(
    (s): s is Extract<LearningBenchmarkV2Scenario, { scenarioType: 'privacy_deletion_sequence' }> =>
      s.scenarioType === 'privacy_deletion_sequence',
  );
  const economicsScenarios = scenarios.filter(
    (s): s is Extract<LearningBenchmarkV2Scenario, { scenarioType: 'economics_sequence' }> =>
      s.scenarioType === 'economics_sequence',
  );

  const { resolver } = buildVariantAResolver([
    new FixtureFoodCatalogSource('off', LEARNING_BENCHMARK_V2_FIXTURE_OFF_CANDIDATES),
  ]);

  const resolution: LearningBenchmarkV2ResolutionScenarioEvaluation[] = [];
  for (const scenario of [...resolutionScenarios].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  )) {
    resolution.push(await evaluateLearningBenchmarkV2ResolutionScenario(scenario, resolver));
  }

  const personalMemory: LearningBenchmarkV2PersonalMemoryScenarioEvaluation[] = [];
  for (const scenario of [...personalMemoryScenarios].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  )) {
    personalMemory.push(await evaluateLearningBenchmarkV2PersonalMemoryScenario(scenario));
  }

  const globalCandidate: LearningBenchmarkV2GlobalCandidateScenarioEvaluation[] = [];
  for (const scenario of [...globalCandidateScenarios].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  )) {
    globalCandidate.push(await evaluateLearningBenchmarkV2GlobalCandidateScenario(scenario));
  }

  const privacy: LearningBenchmarkV2PrivacyScenarioEvaluation[] = [];
  for (const scenario of [...privacyScenarios].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  )) {
    privacy.push(await evaluateLearningBenchmarkV2PrivacyScenario(scenario));
  }

  const economics: LearningBenchmarkV2EconomicsScenarioEvaluation[] = [];
  for (const scenario of [...economicsScenarios].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  )) {
    economics.push(await evaluateLearningBenchmarkV2EconomicsScenario(scenario));
  }

  return {
    partition,
    resolution,
    personalMemory,
    globalCandidate,
    privacy,
    economics,
    metrics: aggregateLearningBenchmarkV2Metrics({
      resolution,
      personalMemory,
      globalCandidate,
      privacy,
      economics,
    }),
  };
}

/**
 * Canonical Learning Benchmark V2 runner (binding requirement §18). Loads the immutable registry,
 * validates the corpus, selects the requested partition(s), runs every scenario deterministically
 * (sorted by scenarioId), and returns a fully-assembled result. Never throws on a "bad" benchmark
 * result -- only on invalid corpus/registry/harness-level failures, mirroring the Variant A/B/C
 * harness convention.
 */
export async function runLearningBenchmarkV2(
  options: RunLearningBenchmarkV2Options = {},
): Promise<RunLearningBenchmarkV2Result> {
  const startedAt = new Date().toISOString();
  const startHr = process.hrtime.bigint();

  assertValidLearningBenchmarkV2Corpus(LEARNING_BENCHMARK_V2_CORPUS);
  const registry = new LearningBenchmarkV2Registry(LEARNING_BENCHMARK_V2_REGISTRY_MANIFEST);

  for (const scenario of LEARNING_BENCHMARK_V2_CORPUS) {
    const registered = registry.partitionFor(scenario.scenarioId);
    if (registered === undefined) {
      throw new Error(`LEARNING_BENCHMARK_V2_UNREGISTERED_SCENARIO: ${scenario.scenarioId}`);
    }
    if (registered !== scenario.partition) {
      throw new Error(`LEARNING_BENCHMARK_V2_PARTITION_MISMATCH: ${scenario.scenarioId}`);
    }
  }

  const partitionsRun = partitionsFor(options.partition);

  let selected = LEARNING_BENCHMARK_V2_CORPUS.filter((scenario) =>
    partitionsRun.includes(scenario.partition),
  );
  if (options.scenarioIds) {
    const wanted = new Set(options.scenarioIds);
    const known = new Set(LEARNING_BENCHMARK_V2_CORPUS.map((s) => s.scenarioId));
    for (const id of options.scenarioIds) {
      if (!known.has(id)) throw new Error(`LEARNING_BENCHMARK_V2_UNKNOWN_SCENARIO_ID: ${id}`);
    }
    selected = selected.filter((scenario) => wanted.has(scenario.scenarioId));
  }

  const development = partitionsRun.includes('development')
    ? await runPartition(
        'development',
        selected.filter((s) => s.partition === 'development'),
      )
    : null;
  const holdout = partitionsRun.includes('holdout')
    ? await runPartition(
        'holdout',
        selected.filter((s) => s.partition === 'holdout'),
      )
    : null;

  const invariantVerdicts = evaluateLearningBenchmarkV2Invariants({
    personalMemory: [...(development?.personalMemory ?? []), ...(holdout?.personalMemory ?? [])],
    globalCandidate: [...(development?.globalCandidate ?? []), ...(holdout?.globalCandidate ?? [])],
    privacy: [...(development?.privacy ?? []), ...(holdout?.privacy ?? [])],
    partitionsRun,
    networkCallDetected: false,
  });

  const endedAt = new Date().toISOString();
  const benchmarkRuntimeMeasuredMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;

  return {
    harnessVersion: LEARNING_BENCHMARK_V2_HARNESS_VERSION,
    corpusVersion: LEARNING_BENCHMARK_V2_CORPUS_VERSION,
    corpusHash: LEARNING_BENCHMARK_V2_CORPUS_HASH,
    registryVersion: LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
    partitionsRun,
    development,
    holdout,
    invariantVerdicts,
    startedAt,
    endedAt,
    benchmarkRuntimeMeasuredMs,
  };
}
