import {
  LEARNING_BENCHMARK_V2_CORPUS_VERSION,
  LEARNING_BENCHMARK_V2_PARTITIONS,
  LEARNING_BENCHMARK_V2_SCENARIO_TYPES,
  type LearningBenchmarkV2Scenario,
} from './LearningBenchmarkV2Types';

const GROUND_TRUTH_CLASSES = ['measured', 'fixture-derived', 'unknown', 'not_evaluable'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'adversarial'];
const LOCALES = ['de', 'en'];

const BASE_KEYS = [
  'scenarioId',
  'corpusVersion',
  'partition',
  'scenarioType',
  'locale',
  'difficulty',
  'groundTruthClass',
  'personalDataFree',
  'expectedInvariantOutcomes',
  'reproducibilityNotes',
  'tags',
  'fixtureVersionsUsed',
];

const TYPE_EXTRA_KEYS: Record<string, string[]> = {
  resolution_decomposition: ['case'],
  personal_memory_sequence: ['sequenceKind', 'steps'],
  global_candidate_sequence: ['steps'],
  privacy_deletion_sequence: [
    'personalMemorySteps',
    'globalCandidateSteps',
    'assertNoCrossUserLeak',
    'assertDeletionRemovesEffect',
  ],
  economics_sequence: ['personalMemorySteps', 'expectedAvoidedCallsAtLeast'],
};

const PERSONAL_MEMORY_STEP_KINDS = ['read', 'record', 'invalidate'];
const GLOBAL_CANDIDATE_STEP_KINDS = [
  'record_contribution',
  'review_decision',
  'retract_contributions',
  'assert_replay_summary',
  'shadow_evaluate',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownRootKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function validateStepKinds(
  steps: unknown,
  fieldName: string,
  allowedKinds: readonly string[],
): string[] {
  if (!Array.isArray(steps)) return [`${fieldName} must be an array`];
  const issues: string[] = [];
  for (const [index, step] of steps.entries()) {
    if (!isPlainObject(step)) {
      issues.push(`${fieldName}[${index}] must be an object`);
      continue;
    }
    if (typeof step.stepId !== 'string' || step.stepId.length === 0) {
      issues.push(`${fieldName}[${index}] missing stepId`);
    }
    if (typeof step.kind !== 'string' || !allowedKinds.includes(step.kind)) {
      issues.push(`${fieldName}[${index}] has unknown kind: ${String(step.kind)}`);
    }
  }
  return issues;
}

/** Validates one scenario object. Returns an empty array when valid -- never throws on bad data,
 * only bad *corpus fixtures* fail loudly via `assertValidLearningBenchmarkV2Scenario` below. */
export function validateLearningBenchmarkV2Scenario(input: unknown): string[] {
  if (!isPlainObject(input)) return ['scenario must be an object'];
  const issues: string[] = [];

  if (
    typeof input.scenarioType !== 'string' ||
    !LEARNING_BENCHMARK_V2_SCENARIO_TYPES.includes(input.scenarioType as never)
  ) {
    issues.push(`unknown scenarioType: ${String(input.scenarioType)}`);
    return issues;
  }
  const scenarioType = input.scenarioType as string;

  const allowedKeys = [...BASE_KEYS, ...(TYPE_EXTRA_KEYS[scenarioType] ?? [])];
  issues.push(...unknownRootKeys(input, allowedKeys).map((key) => `unknown root field: ${key}`));

  if (typeof input.scenarioId !== 'string' || input.scenarioId.length === 0) {
    issues.push('missing or empty scenarioId');
  }
  if (input.corpusVersion !== LEARNING_BENCHMARK_V2_CORPUS_VERSION) {
    issues.push(`unexpected corpusVersion: ${String(input.corpusVersion)}`);
  }
  if (
    typeof input.partition !== 'string' ||
    !LEARNING_BENCHMARK_V2_PARTITIONS.includes(input.partition as never)
  ) {
    issues.push(`unknown partition: ${String(input.partition)}`);
  }
  if (input.locale !== undefined && !LOCALES.includes(input.locale as string)) {
    issues.push(`invalid locale: ${String(input.locale)}`);
  }
  if (typeof input.difficulty !== 'string' || !DIFFICULTIES.includes(input.difficulty)) {
    issues.push(`invalid difficulty: ${String(input.difficulty)}`);
  }
  if (
    typeof input.groundTruthClass !== 'string' ||
    !GROUND_TRUTH_CLASSES.includes(input.groundTruthClass)
  ) {
    issues.push(`invalid evidence class: ${String(input.groundTruthClass)}`);
  }
  if (input.personalDataFree !== true) {
    issues.push('personalDataFree must be true');
  }
  if (!Array.isArray(input.expectedInvariantOutcomes)) {
    issues.push('expectedInvariantOutcomes must be an array');
  }
  if (typeof input.reproducibilityNotes !== 'string' || input.reproducibilityNotes.length === 0) {
    issues.push('missing reproducibilityNotes');
  }
  if (!Array.isArray(input.tags)) issues.push('tags must be an array');
  if (!Array.isArray(input.fixtureVersionsUsed)) {
    issues.push('fixtureVersionsUsed must be an array');
  }

  switch (scenarioType) {
    case 'resolution_decomposition':
      if (!isPlainObject(input.case)) issues.push('resolution scenario missing case');
      break;
    case 'personal_memory_sequence':
      if (typeof input.sequenceKind !== 'string') issues.push('missing sequenceKind');
      issues.push(...validateStepKinds(input.steps, 'steps', PERSONAL_MEMORY_STEP_KINDS));
      break;
    case 'global_candidate_sequence':
      issues.push(...validateStepKinds(input.steps, 'steps', GLOBAL_CANDIDATE_STEP_KINDS));
      break;
    case 'privacy_deletion_sequence':
      if (input.personalMemorySteps !== undefined) {
        issues.push(
          ...validateStepKinds(
            input.personalMemorySteps,
            'personalMemorySteps',
            PERSONAL_MEMORY_STEP_KINDS,
          ),
        );
      }
      if (input.globalCandidateSteps !== undefined) {
        issues.push(
          ...validateStepKinds(
            input.globalCandidateSteps,
            'globalCandidateSteps',
            GLOBAL_CANDIDATE_STEP_KINDS,
          ),
        );
      }
      if (typeof input.assertNoCrossUserLeak !== 'boolean') {
        issues.push('assertNoCrossUserLeak must be boolean');
      }
      if (typeof input.assertDeletionRemovesEffect !== 'boolean') {
        issues.push('assertDeletionRemovesEffect must be boolean');
      }
      break;
    case 'economics_sequence':
      issues.push(
        ...validateStepKinds(
          input.personalMemorySteps,
          'personalMemorySteps',
          PERSONAL_MEMORY_STEP_KINDS,
        ),
      );
      if (
        typeof input.expectedAvoidedCallsAtLeast !== 'number' ||
        input.expectedAvoidedCallsAtLeast < 0
      ) {
        issues.push('expectedAvoidedCallsAtLeast must be a non-negative number');
      }
      break;
    default:
      issues.push(`unhandled scenarioType: ${scenarioType}`);
  }

  return issues;
}

export class LearningBenchmarkV2ScenarioValidationError extends Error {
  constructor(
    public readonly scenarioId: string | undefined,
    public readonly issues: readonly string[],
  ) {
    super(
      `Invalid Learning Benchmark V2 scenario${scenarioId ? ` (${scenarioId})` : ''}: ${issues.join('; ')}`,
    );
  }
}

export function assertValidLearningBenchmarkV2Scenario(input: unknown): void {
  const issues = validateLearningBenchmarkV2Scenario(input);
  if (issues.length > 0) {
    const scenarioId = isPlainObject(input) ? (input.scenarioId as string | undefined) : undefined;
    throw new LearningBenchmarkV2ScenarioValidationError(scenarioId, issues);
  }
}

export interface LearningBenchmarkV2CorpusValidationResult {
  valid: boolean;
  issuesByScenarioId: Readonly<Record<string, readonly string[]>>;
  duplicateScenarioIds: readonly string[];
}

export function validateLearningBenchmarkV2Corpus(
  scenarios: readonly LearningBenchmarkV2Scenario[],
): LearningBenchmarkV2CorpusValidationResult {
  const issuesByScenarioId: Record<string, readonly string[]> = {};
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const scenario of scenarios) {
    const issues = validateLearningBenchmarkV2Scenario(scenario);
    if (issues.length > 0) issuesByScenarioId[scenario.scenarioId] = issues;
    if (seen.has(scenario.scenarioId)) duplicates.add(scenario.scenarioId);
    seen.add(scenario.scenarioId);
  }

  return {
    valid: Object.keys(issuesByScenarioId).length === 0 && duplicates.size === 0,
    issuesByScenarioId,
    duplicateScenarioIds: [...duplicates].sort(),
  };
}

export function assertValidLearningBenchmarkV2Corpus(
  scenarios: readonly LearningBenchmarkV2Scenario[],
): void {
  const result = validateLearningBenchmarkV2Corpus(scenarios);
  if (!result.valid) {
    const messages = [
      ...Object.entries(result.issuesByScenarioId).map(
        ([id, issues]) => `${id}: ${issues.join('; ')}`,
      ),
      ...result.duplicateScenarioIds.map((id) => `duplicate scenarioId: ${id}`),
    ];
    throw new Error(`Invalid Learning Benchmark V2 corpus:\n${messages.join('\n')}`);
  }
}
