import {
  REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_BENCHMARK_PARTITIONS,
  REPRESENTATIVE_HYBRID_BENCHMARK_REQUIRED_CATEGORIES,
  REPRESENTATIVE_HYBRID_BENCHMARK_SCENARIO_TYPES,
  type RepresentativeHybridBenchmarkScenario,
} from './RepresentativeHybridBenchmarkTypes';

const GROUND_TRUTH_CLASSES = ['measured', 'fixture-derived', 'unknown', 'not_evaluable'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'adversarial'];

const BASE_KEYS = [
  'scenarioId',
  'corpusVersion',
  'partition',
  'scenarioType',
  'difficulty',
  'groundTruthClass',
  'personalDataFree',
  'expectedInvariantOutcomes',
  'reproducibilityNotes',
  'tags',
  'fixtureVersionsUsed',
];

const TYPE_EXTRA_KEYS: Record<string, string[]> = {
  resolution_decomposition_hybrid_c: ['executionEngine', 'case'],
  contradiction_gate_sequence: ['steps'],
  rollback_sequence: ['steps'],
};

/** Actions that must never appear in a `contradiction_gate_sequence` scenario -- this is the
 * structural half of the RESOLVER-V3-024 §24 frozen-fixture-coupling fix (the other half is the
 * `rollback_sequence` check below). */
const ROLLBACK_ACTIONS = ['rollback', 'revoke_approval'];

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

function validateStepKinds(steps: unknown, fieldName: string): string[] {
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
    if (typeof step.kind !== 'string' || !GLOBAL_CANDIDATE_STEP_KINDS.includes(step.kind)) {
      issues.push(`${fieldName}[${index}] has unknown kind: ${String(step.kind)}`);
    }
  }
  return issues;
}

/** Structural half of the RESOLVER-V3-024 §24 fix: a `contradiction_gate_sequence` scenario may
 * never contain a `rollback`/`revoke_approval` `review_decision` step. This is checked on the raw
 * steps array (not only via the TS discriminated union) so a malformed/adversarial fixture cannot
 * silently bypass it. */
function validateNoRollbackInContradictionGate(steps: unknown, fieldName: string): string[] {
  if (!Array.isArray(steps)) return [];
  const issues: string[] = [];
  for (const [index, step] of steps.entries()) {
    if (!isPlainObject(step)) continue;
    if (step.kind === 'review_decision' && ROLLBACK_ACTIONS.includes(step.action as string)) {
      issues.push(
        `${fieldName}[${index}] action "${String(step.action)}" is forbidden in a ` +
          'contradiction_gate_sequence scenario (RESOLVER-V3-024 §24 frozen-fixture-coupling fix); ' +
          'use a rollback_sequence scenario instead',
      );
    }
  }
  return issues;
}

/** Other half of the RESOLVER-V3-024 §24 fix: a `rollback_sequence` scenario may never contain a
 * `forceContradiction: true` step -- it must exercise rollback against a contradiction-free
 * candidate only, so a rollback outcome can never again be entangled with a contradiction-gate
 * outcome in the same fixture. */
function validateNoForcedContradictionInRollback(steps: unknown, fieldName: string): string[] {
  if (!Array.isArray(steps)) return [];
  const issues: string[] = [];
  for (const [index, step] of steps.entries()) {
    if (!isPlainObject(step)) continue;
    if (step.kind === 'review_decision' && step.forceContradiction === true) {
      issues.push(
        `${fieldName}[${index}] forceContradiction: true is forbidden in a rollback_sequence ` +
          'scenario (RESOLVER-V3-024 §24 frozen-fixture-coupling fix); use a ' +
          'contradiction_gate_sequence scenario instead',
      );
    }
  }
  return issues;
}

/** Validates one scenario object. Returns an empty array when valid -- never throws on bad data,
 * only bad *corpus fixtures* fail loudly via `assertValidRepresentativeHybridBenchmarkScenario`
 * below (mirrors `LearningBenchmarkV2Validator.ts`'s split). */
export function validateRepresentativeHybridBenchmarkScenario(input: unknown): string[] {
  if (!isPlainObject(input)) return ['scenario must be an object'];
  const issues: string[] = [];

  if (
    typeof input.scenarioType !== 'string' ||
    !REPRESENTATIVE_HYBRID_BENCHMARK_SCENARIO_TYPES.includes(input.scenarioType as never)
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
  if (input.corpusVersion !== REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION) {
    issues.push(`unexpected corpusVersion: ${String(input.corpusVersion)}`);
  }
  if (
    typeof input.partition !== 'string' ||
    !REPRESENTATIVE_HYBRID_BENCHMARK_PARTITIONS.includes(input.partition as never)
  ) {
    issues.push(`unknown partition: ${String(input.partition)}`);
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
    case 'resolution_decomposition_hybrid_c':
      if (input.executionEngine !== 'hybrid_c') {
        issues.push(`executionEngine must be "hybrid_c", got: ${String(input.executionEngine)}`);
      }
      if (!isPlainObject(input.case)) issues.push('resolution scenario missing case');
      break;
    case 'contradiction_gate_sequence':
      issues.push(...validateStepKinds(input.steps, 'steps'));
      issues.push(...validateNoRollbackInContradictionGate(input.steps, 'steps'));
      break;
    case 'rollback_sequence':
      issues.push(...validateStepKinds(input.steps, 'steps'));
      issues.push(...validateNoForcedContradictionInRollback(input.steps, 'steps'));
      break;
    default:
      issues.push(`unhandled scenarioType: ${scenarioType}`);
  }

  return issues;
}

export class RepresentativeHybridBenchmarkScenarioValidationError extends Error {
  constructor(
    public readonly scenarioId: string | undefined,
    public readonly issues: readonly string[],
  ) {
    super(
      `Invalid Representative Hybrid Benchmark scenario${scenarioId ? ` (${scenarioId})` : ''}: ${issues.join('; ')}`,
    );
  }
}

export function assertValidRepresentativeHybridBenchmarkScenario(input: unknown): void {
  const issues = validateRepresentativeHybridBenchmarkScenario(input);
  if (issues.length > 0) {
    const scenarioId = isPlainObject(input) ? (input.scenarioId as string | undefined) : undefined;
    throw new RepresentativeHybridBenchmarkScenarioValidationError(scenarioId, issues);
  }
}

export interface RepresentativeHybridBenchmarkCorpusValidationResult {
  valid: boolean;
  issuesByScenarioId: Readonly<Record<string, readonly string[]>>;
  duplicateScenarioIds: readonly string[];
  missingRequiredCategories: readonly string[];
}

/** Corpus-level checks beyond per-scenario validity: duplicate scenario IDs, and the RESOLVER-V3-024
 * §26.1 / ROADMAP RESOLVER-V3-038 required category-coverage list (checked across the whole corpus,
 * not per-partition -- the scope item requires the categories to exist, not to be duplicated in both
 * partitions). */
export function validateRepresentativeHybridBenchmarkCorpus(
  scenarios: readonly RepresentativeHybridBenchmarkScenario[],
): RepresentativeHybridBenchmarkCorpusValidationResult {
  const issuesByScenarioId: Record<string, readonly string[]> = {};
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const presentCategories = new Set<string>();

  for (const scenario of scenarios) {
    const issues = validateRepresentativeHybridBenchmarkScenario(scenario);
    if (issues.length > 0) issuesByScenarioId[scenario.scenarioId] = issues;
    if (seen.has(scenario.scenarioId)) duplicates.add(scenario.scenarioId);
    seen.add(scenario.scenarioId);
    if (scenario.scenarioType === 'resolution_decomposition_hybrid_c') {
      presentCategories.add(scenario.case.category);
    }
  }

  const missingRequiredCategories = REPRESENTATIVE_HYBRID_BENCHMARK_REQUIRED_CATEGORIES.filter(
    (category) => !presentCategories.has(category),
  );

  return {
    valid:
      Object.keys(issuesByScenarioId).length === 0 &&
      duplicates.size === 0 &&
      missingRequiredCategories.length === 0,
    issuesByScenarioId,
    duplicateScenarioIds: [...duplicates].sort(),
    missingRequiredCategories,
  };
}

export function assertValidRepresentativeHybridBenchmarkCorpus(
  scenarios: readonly RepresentativeHybridBenchmarkScenario[],
): void {
  const result = validateRepresentativeHybridBenchmarkCorpus(scenarios);
  if (!result.valid) {
    const messages = [
      ...Object.entries(result.issuesByScenarioId).map(
        ([id, issues]) => `${id}: ${issues.join('; ')}`,
      ),
      ...result.duplicateScenarioIds.map((id) => `duplicate scenarioId: ${id}`),
      ...result.missingRequiredCategories.map(
        (category) => `missing required category: ${category}`,
      ),
    ];
    throw new Error(`Invalid Representative Hybrid Benchmark corpus:\n${messages.join('\n')}`);
  }
}
