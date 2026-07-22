import {
  LEARNING_BENCHMARK_V3_CORPUS_VERSION,
  type LearningBenchmarkV3Scenario,
} from './LearningBenchmarkV3Types';

const SCENARIO_TYPES = ['hybrid_resolution', 'review_gate'];
const PARTITIONS = ['development', 'holdout'];
const REVIEW_GATES = ['contradiction_blocks_approval', 'rollback_of_approved_candidate'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateLearningBenchmarkV3Scenario(input: unknown): string[] {
  if (!isRecord(input)) return ['scenario must be an object'];
  const issues: string[] = [];
  if (typeof input.scenarioId !== 'string' || input.scenarioId.length === 0)
    issues.push('missing scenarioId');
  if (input.corpusVersion !== LEARNING_BENCHMARK_V3_CORPUS_VERSION)
    issues.push('unexpected corpusVersion');
  if (typeof input.partition !== 'string' || !PARTITIONS.includes(input.partition))
    issues.push('invalid partition');
  if (typeof input.scenarioType !== 'string' || !SCENARIO_TYPES.includes(input.scenarioType)) {
    return [...issues, 'invalid scenarioType'];
  }
  if (input.personalDataFree !== true) issues.push('personalDataFree must be true');
  if (typeof input.reproducibilityNotes !== 'string' || input.reproducibilityNotes.length === 0)
    issues.push('missing reproducibilityNotes');
  if (!Array.isArray(input.tags)) issues.push('tags must be an array');
  if (input.scenarioType === 'hybrid_resolution') {
    if (!isRecord(input.case)) issues.push('hybrid resolution scenario missing case');
    if (input.requiresLiveHybrid !== true)
      issues.push('hybrid resolution must require live Hybrid C');
  }
  if (input.scenarioType === 'review_gate' && !REVIEW_GATES.includes(input.gate as string)) {
    issues.push('invalid review gate');
  }
  return issues;
}

export function assertValidLearningBenchmarkV3Corpus(
  corpus: readonly LearningBenchmarkV3Scenario[],
): void {
  const ids = new Set<string>();
  for (const scenario of corpus) {
    const issues = validateLearningBenchmarkV3Scenario(scenario);
    if (issues.length > 0)
      throw new Error(
        `LEARNING_BENCHMARK_V3_INVALID_SCENARIO:${scenario.scenarioId}:${issues.join(',')}`,
      );
    if (ids.has(scenario.scenarioId))
      throw new Error(`LEARNING_BENCHMARK_V3_DUPLICATE_SCENARIO:${scenario.scenarioId}`);
    ids.add(scenario.scenarioId);
  }
}
