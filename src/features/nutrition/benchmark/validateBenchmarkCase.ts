import {
  BenchmarkCase,
  ExpectedComponent,
  GroundTruthSource,
  ExpectedBehavior,
  BenchmarkCategory,
  BenchmarkDifficulty,
  ReferenceNutrients,
} from './BenchmarkCaseTypes';

/**
 * RESOLVER-V3-003: schema-near validation for the executable benchmark case format (spec §2).
 * Deliberately hand-written against the fixed field list rather than a new schema/validation
 * dependency (task scope: "kein neues Validierungsframework ohne ausdrückliche Genehmigung").
 */

const GROUND_TRUTH_SOURCES: readonly GroundTruthSource[] = [
  'manufacturer_label',
  'official_restaurant_data',
  'bls_generic',
  'documented_recipe',
  'other_verified_database',
  'curated_reference_range',
  'no_numeric_ground_truth',
];

const EXPECTED_BEHAVIORS: readonly ExpectedBehavior[] = [
  'direct_resolution',
  'resolution_with_assumption',
  'clarification_required',
  'multiple_candidates_acceptable',
  'abstention_expected',
];

const CATEGORIES: readonly BenchmarkCategory[] = [
  'SIMPLE',
  'HOUSEHOLD',
  'DACH',
  'BRANDED',
  'COMPOSED',
  'HOMEMADE',
  'RESTAURANT',
  'VAGUE',
  'PREPARATION',
  'NEGATION_MODIFIER',
  'UNRELIABLE',
];

const DIFFICULTIES: readonly BenchmarkDifficulty[] = ['easy', 'medium', 'hard', 'adversarial'];

export class BenchmarkCaseValidationError extends Error {
  constructor(
    public readonly caseId: string | undefined,
    public readonly issues: string[],
  ) {
    super(`Invalid benchmark case${caseId ? ` "${caseId}"` : ''}: ${issues.join('; ')}`);
    this.name = 'BenchmarkCaseValidationError';
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateReferenceNutrients(value: ReferenceNutrients, issues: string[], prefix: string) {
  const numericOrNullFields: (keyof ReferenceNutrients)[] = [
    'kcal',
    'protein_g',
    'fat_g',
    'carbs_g',
    'fiber_g',
    'sugar_g',
    'salt_g',
  ];
  for (const field of numericOrNullFields) {
    const fieldValue = value[field];
    if (fieldValue === undefined) continue; // optional fields may be absent entirely
    if (fieldValue !== null && typeof fieldValue !== 'number') {
      issues.push(`${prefix}.${field} must be a number or null, got ${typeof fieldValue}`);
    }
    if (typeof fieldValue === 'number' && !Number.isFinite(fieldValue)) {
      issues.push(`${prefix}.${field} must be finite`);
    }
  }
}

function validateExpectedComponent(component: ExpectedComponent, issues: string[], index: number) {
  const prefix = `expectedComponents[${index}]`;
  if (!isNonEmptyString(component.componentId)) {
    issues.push(`${prefix}.componentId is required`);
  }
  if (!isNonEmptyString(component.expectedName)) {
    issues.push(`${prefix}.expectedName is required`);
  }
  if (typeof component.required !== 'boolean') {
    issues.push(`${prefix}.required must be a boolean`);
  }
}

/**
 * Validates one benchmark case against the fixed schema (spec §2). Returns the list of issues
 * (empty = valid) rather than throwing, so callers can decide whether to collect all errors
 * across a corpus before failing.
 */
export function validateBenchmarkCase(input: BenchmarkCase): string[] {
  const issues: string[] = [];

  if (!isNonEmptyString(input.caseId)) {
    issues.push('caseId is required and must be a non-empty string');
  }
  if (!isNonEmptyString(input.corpusVersion)) {
    issues.push('corpusVersion is required and must be a non-empty string');
  } else if (!/^\d+\.\d+\.\d+$/.test(input.corpusVersion)) {
    issues.push(`corpusVersion must be SemVer (x.y.z), got "${input.corpusVersion}"`);
  }
  if (!CATEGORIES.includes(input.category)) {
    issues.push(`category must be one of ${CATEGORIES.join(', ')}, got "${input.category}"`);
  }
  if (!DIFFICULTIES.includes(input.difficulty)) {
    issues.push(`difficulty must be one of ${DIFFICULTIES.join(', ')}, got "${input.difficulty}"`);
  }
  if (!isNonEmptyString(input.rawInput)) {
    issues.push('rawInput is required and must be a non-empty string');
  }
  if (input.locale !== 'de' && input.locale !== 'en') {
    issues.push(`locale must be 'de' or 'en', got "${input.locale}"`);
  }
  if (!Array.isArray(input.expectedComponents)) {
    issues.push('expectedComponents must be an array');
  } else {
    if (input.expectedComponents.length === 0 && input.expectedBehavior !== 'abstention_expected') {
      issues.push(
        'expectedComponents must be non-empty unless expectedBehavior is "abstention_expected"',
      );
    }
    input.expectedComponents.forEach((component, index) =>
      validateExpectedComponent(component, issues, index),
    );
  }
  if (!GROUND_TRUTH_SOURCES.includes(input.groundTruthSource)) {
    issues.push(
      `groundTruthSource must be one of ${GROUND_TRUTH_SOURCES.join(', ')}, got "${input.groundTruthSource}"`,
    );
  }
  if (
    input.groundTruthSource !== 'no_numeric_ground_truth' &&
    !isNonEmptyString(input.groundTruthProvenance)
  ) {
    issues.push(
      'groundTruthProvenance is required unless groundTruthSource is "no_numeric_ground_truth"',
    );
  }
  if (input.referenceNutrients === null) {
    if (input.groundTruthSource !== 'no_numeric_ground_truth') {
      issues.push(
        'referenceNutrients may only be null when groundTruthSource is "no_numeric_ground_truth"',
      );
    }
  } else if (input.referenceNutrients === undefined) {
    issues.push('referenceNutrients is required (use null only for no_numeric_ground_truth cases)');
  } else {
    validateReferenceNutrients(input.referenceNutrients, issues, 'referenceNutrients');
  }
  if (!EXPECTED_BEHAVIORS.includes(input.expectedBehavior)) {
    issues.push(
      `expectedBehavior must be one of ${EXPECTED_BEHAVIORS.join(', ')}, got "${input.expectedBehavior}"`,
    );
  }
  if (input.expectedBehavior === 'clarification_required' && !input.expectedClarificationKind) {
    issues.push(
      'expectedClarificationKind is required when expectedBehavior is "clarification_required"',
    );
  }
  if (!Array.isArray(input.criticalFailureConditions)) {
    issues.push('criticalFailureConditions must be an array (may be empty)');
  }
  if (!isNonEmptyString(input.reproducibilityNotes)) {
    issues.push('reproducibilityNotes is required and must be a non-empty string');
  }
  if (input.personalDataFree !== true) {
    issues.push('personalDataFree must be true');
  }

  return issues;
}

/** Throws `BenchmarkCaseValidationError` if the case is invalid; used by the corpus loader so
 * an invalid fixture aborts the harness with a precise, case-attributed error (task DoD #9). */
export function assertValidBenchmarkCase(input: BenchmarkCase): void {
  const issues = validateBenchmarkCase(input);
  if (issues.length > 0) {
    throw new BenchmarkCaseValidationError(input?.caseId, issues);
  }
}

export interface CorpusValidationResult {
  valid: boolean;
  issuesByCaseId: Record<string, string[]>;
  duplicateCaseIds: string[];
}

/** Validates an entire corpus: per-case schema issues plus corpus-wide invariants (unique,
 * stable `caseId`s -- spec §9 "unveränderliche Case-IDs"). */
export function validateCorpus(cases: readonly BenchmarkCase[]): CorpusValidationResult {
  const issuesByCaseId: Record<string, string[]> = {};
  const seen = new Map<string, number>();
  const duplicateCaseIds: string[] = [];

  cases.forEach((benchmarkCase) => {
    const key = benchmarkCase?.caseId ?? `<index ${cases.indexOf(benchmarkCase)}>`;
    const issues = validateBenchmarkCase(benchmarkCase);
    if (issues.length > 0) {
      issuesByCaseId[key] = issues;
    }
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 1) {
      duplicateCaseIds.push(key);
    }
  });

  return {
    valid: Object.keys(issuesByCaseId).length === 0 && duplicateCaseIds.length === 0,
    issuesByCaseId,
    duplicateCaseIds,
  };
}

/** Throws on the first corpus-level problem, aggregating all issues into one message so a CI
 * failure shows the full picture instead of one case at a time. */
export function assertValidCorpus(cases: readonly BenchmarkCase[]): void {
  const result = validateCorpus(cases);
  if (result.valid) return;

  const lines: string[] = [];
  if (result.duplicateCaseIds.length > 0) {
    lines.push(`Duplicate caseId(s): ${result.duplicateCaseIds.join(', ')}`);
  }
  for (const [caseId, issues] of Object.entries(result.issuesByCaseId)) {
    lines.push(`"${caseId}": ${issues.join('; ')}`);
  }
  throw new BenchmarkCaseValidationError(undefined, lines);
}
