import { validateBenchmarkCase } from '../validateBenchmarkCase';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_V1_DIFFICULTIES,
  REPRESENTATIVE_HYBRID_V1_GROUND_TRUTH_CLASSES,
  REPRESENTATIVE_HYBRID_V1_PARTITIONS,
  REPRESENTATIVE_HYBRID_V1_REPEAT_OVERLAY_KINDS,
  REPRESENTATIVE_HYBRID_V1_SCENARIO_TYPES,
  type RepresentativeHybridV1Scenario,
} from './RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 exact-key runtime validation (requirement 4). Types alone are insufficient per
 * the task instruction -- this module rejects unknown root/nested fields, unknown versions, and
 * structurally invalid data, failing closed rather than silently accepting drift. Mirrors
 * `learningV2/LearningBenchmarkV2Validator.ts`'s pattern.
 */

const LOCALES = ['de', 'en'];

const BASE_KEYS = [
  'scenarioId',
  'corpusVersion',
  'partition',
  'scenarioType',
  'difficulty',
  'groundTruthClass',
  'personalDataFree',
  'predecessorScenarioId',
  'reproducibilityNotes',
  'tags',
  'fixtureVersionsUsed',
];

const TYPE_EXTRA_KEYS: Record<string, string[]> = {
  resolution_decomposition: ['locale', 'case', 'sourceSnapshotRefs', 'repeatOverlay'],
  personal_memory_sequence: ['sequenceKind', 'steps'],
  global_candidate_sequence: ['steps'],
  privacy_deletion_sequence: [
    'personalMemorySteps',
    'assertNoCrossUserLeak',
    'assertDeletionRemovesEffect',
  ],
  economics_sequence: ['personalMemorySteps', 'expectedAvoidedCallsAtLeast'],
};

/** Exact allowed keys of the reused `BenchmarkCase` shape (`../BenchmarkCaseTypes.ts`) -- that
 * module's own `validateBenchmarkCase` checks required-field presence/type but not exhaustive key
 * closure, so this validator adds the nested-key check requirement 4/12 needs on top of it. */
const BENCHMARK_CASE_KEYS = [
  'caseId',
  'corpusVersion',
  'category',
  'subcategory',
  'difficulty',
  'rawInput',
  'locale',
  'regionalContext',
  'expectedComponents',
  'groundTruthSource',
  'groundTruthProvenance',
  'referenceNutrients',
  'tolerances',
  'expectedBehavior',
  'expectedClarificationKind',
  'criticalFailureConditions',
  'reproducibilityNotes',
  'personalDataFree',
  'repeatGroupId',
  'tags',
  'notes',
];

const PERSONAL_MEMORY_STEP_KINDS = ['read', 'record', 'invalidate'];
const GLOBAL_CANDIDATE_STEP_KINDS = [
  'record_contribution',
  'review_decision',
  'retract_contributions',
  'assert_replay_summary',
  'shadow_evaluate',
];
const REPEAT_OVERLAY_KEYS = ['baseScenarioId', 'overlayKind'];

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

function validateRepeatOverlay(value: unknown, issues: string[]): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    issues.push('repeatOverlay must be an object when present');
    return;
  }
  issues.push(
    ...unknownRootKeys(value, REPEAT_OVERLAY_KEYS).map(
      (key) => `unknown repeatOverlay field: ${key}`,
    ),
  );
  if (typeof value.baseScenarioId !== 'string' || value.baseScenarioId.length === 0) {
    issues.push('repeatOverlay.baseScenarioId is required');
  }
  if (
    typeof value.overlayKind !== 'string' ||
    !REPRESENTATIVE_HYBRID_V1_REPEAT_OVERLAY_KINDS.includes(value.overlayKind as never)
  ) {
    issues.push(`repeatOverlay.overlayKind invalid: ${String(value.overlayKind)}`);
  }
}

/** Validates one scenario object. Returns an empty array when valid. */
export function validateRepresentativeHybridV1Scenario(input: unknown): string[] {
  if (!isPlainObject(input)) return ['scenario must be an object'];
  const issues: string[] = [];

  if (
    typeof input.scenarioType !== 'string' ||
    !REPRESENTATIVE_HYBRID_V1_SCENARIO_TYPES.includes(input.scenarioType as never)
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
  if (input.corpusVersion !== REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION) {
    issues.push(`unexpected corpusVersion: ${String(input.corpusVersion)}`);
  }
  if (
    typeof input.partition !== 'string' ||
    !REPRESENTATIVE_HYBRID_V1_PARTITIONS.includes(input.partition as never)
  ) {
    issues.push(`unknown partition: ${String(input.partition)}`);
  }
  if (
    typeof input.difficulty !== 'string' ||
    !REPRESENTATIVE_HYBRID_V1_DIFFICULTIES.includes(input.difficulty as never)
  ) {
    issues.push(`invalid difficulty: ${String(input.difficulty)}`);
  }
  if (
    typeof input.groundTruthClass !== 'string' ||
    !REPRESENTATIVE_HYBRID_V1_GROUND_TRUTH_CLASSES.includes(input.groundTruthClass as never)
  ) {
    issues.push(`invalid groundTruthClass: ${String(input.groundTruthClass)}`);
  }
  if (input.personalDataFree !== true) {
    issues.push('personalDataFree must be true');
  }
  if (
    input.predecessorScenarioId !== undefined &&
    typeof input.predecessorScenarioId !== 'string'
  ) {
    issues.push('predecessorScenarioId must be a string when present');
  }
  if (typeof input.reproducibilityNotes !== 'string' || input.reproducibilityNotes.length === 0) {
    issues.push('missing reproducibilityNotes');
  }
  if (!Array.isArray(input.tags)) issues.push('tags must be an array');
  if (!Array.isArray(input.fixtureVersionsUsed)) {
    issues.push('fixtureVersionsUsed must be an array');
  }

  switch (scenarioType) {
    case 'resolution_decomposition': {
      if (input.locale !== undefined && !LOCALES.includes(input.locale as string)) {
        issues.push(`invalid locale: ${String(input.locale)}`);
      }
      if (!isPlainObject(input.case)) {
        issues.push('resolution scenario missing case');
      } else {
        issues.push(
          ...unknownRootKeys(input.case, BENCHMARK_CASE_KEYS).map(
            (key) => `unknown nested field: case.${key}`,
          ),
        );
        const caseIssues = validateBenchmarkCase(input.case as never);
        issues.push(...caseIssues.map((issue) => `case.${issue}`));
      }
      if (!Array.isArray(input.sourceSnapshotRefs)) {
        issues.push('sourceSnapshotRefs must be an array (may be empty)');
      }
      validateRepeatOverlay(input.repeatOverlay, issues);
      break;
    }
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

export class RepresentativeHybridV1ScenarioValidationError extends Error {
  constructor(
    public readonly scenarioId: string | undefined,
    public readonly issues: readonly string[],
  ) {
    super(
      `Invalid Representative Hybrid V1 scenario${scenarioId ? ` (${scenarioId})` : ''}: ${issues.join('; ')}`,
    );
    this.name = 'RepresentativeHybridV1ScenarioValidationError';
  }
}

export function assertValidRepresentativeHybridV1Scenario(input: unknown): void {
  const issues = validateRepresentativeHybridV1Scenario(input);
  if (issues.length > 0) {
    const scenarioId = isPlainObject(input) ? (input.scenarioId as string | undefined) : undefined;
    throw new RepresentativeHybridV1ScenarioValidationError(scenarioId, issues);
  }
}

export interface RepresentativeHybridV1CorpusValidationResult {
  valid: boolean;
  issuesByScenarioId: Readonly<Record<string, readonly string[]>>;
  duplicateScenarioIds: readonly string[];
}

export function validateRepresentativeHybridV1Corpus(
  scenarios: readonly RepresentativeHybridV1Scenario[],
): RepresentativeHybridV1CorpusValidationResult {
  const issuesByScenarioId: Record<string, readonly string[]> = {};
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const scenario of scenarios) {
    const issues = validateRepresentativeHybridV1Scenario(scenario);
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

export function assertValidRepresentativeHybridV1Corpus(
  scenarios: readonly RepresentativeHybridV1Scenario[],
): void {
  const result = validateRepresentativeHybridV1Corpus(scenarios);
  if (!result.valid) {
    const messages = [
      ...Object.entries(result.issuesByScenarioId).map(
        ([id, issues]) => `${id}: ${issues.join('; ')}`,
      ),
      ...result.duplicateScenarioIds.map((id) => `duplicate scenarioId: ${id}`),
    ];
    throw new Error(`Invalid Representative Hybrid V1 corpus:\n${messages.join('\n')}`);
  }
}
