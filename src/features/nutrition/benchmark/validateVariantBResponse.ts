import {
  VariantBClarification,
  VariantBComponentEstimate,
  VariantBEstimationResult,
  VariantBMealTotals,
  VariantBQuantity,
  VariantBRequest,
  VariantBResultMetadata,
} from './VariantBTypes';
import { VARIANT_B_CONTRACT_VERSION } from './VariantBTypes';
import { VARIANT_B_ESTIMATOR_VERSION } from './variantBPrompt';

/**
 * RESOLVER-V3-004: hand-written, schema-near validation + normalization of a raw Variant-B
 * provider response, mirroring RESOLVER-V3-003's `validateBenchmarkCase.ts` precedent (no new
 * validation dependency, per AGENTS.md "no unnecessary dependencies" / this task's explicit "kein
 * neues Schema-Framework ohne ausdrueckliche Genehmigung").
 *
 * Two-stage: `parseAndValidateVariantBRawResponse` only checks structural validity (JSON parses,
 * required fields present, correct types, no negative/non-finite numbers, no unknown enum
 * values) and returns the *raw* parsed shape unchanged -- it never repairs or reinterprets it.
 * `normalizeVariantBResponse` then maps a valid raw response onto the typed
 * `VariantBEstimationResult` discriminated union; an invalid one is normalized to
 * `outcome: 'invalid_response'` carrying every validation issue found.
 */

const RAW_OUTCOMES = [
  'estimated',
  'clarification_required',
  'abstained',
  'not_interpretable',
] as const;
type RawOutcome = (typeof RAW_OUTCOMES)[number];

const QUANTITY_UNITS = ['g', 'ml', 'piece', 'portion'] as const;
const CLARIFICATION_KINDS = [
  'missing_quantity',
  'ambiguous_food_identity',
  'ambiguous_preparation',
  'missing_brand',
  'other',
] as const;

export interface RawVariantBQuantity {
  value?: number | null;
  unit?: string | null;
  householdMeasure?: string | null;
  portionDescription?: string | null;
}

export interface RawVariantBComponent {
  componentId: string;
  name: string;
  brand?: string | null;
  preparation?: string | null;
  quantity: RawVariantBQuantity;
  kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  salt_g?: number | null;
  assumptions?: string[];
  uncertainties?: string[];
  confidence: number;
}

export interface RawVariantBTotals {
  kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
}

export interface RawVariantBClarification {
  componentId?: string | null;
  missingInformation: string;
  clarificationKind: string;
}

export interface RawVariantBResponse {
  outcome: RawOutcome;
  components: RawVariantBComponent[];
  totals?: RawVariantBTotals | null;
  overallConfidence?: number | null;
  assumptions: string[];
  uncertainties: string[];
  clarification?: RawVariantBClarification | null;
  reason?: string | null;
}

export interface VariantBValidationResult {
  valid: boolean;
  parsed: RawVariantBResponse | null;
  issues: string[];
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return (
    value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
}

function isNonNegativeOrNull(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'number' && value >= 0);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateQuantity(quantity: unknown, issues: string[], prefix: string): void {
  if (!quantity || typeof quantity !== 'object') {
    issues.push(`${prefix}.quantity is required and must be an object`);
    return;
  }
  const q = quantity as RawVariantBQuantity;
  if (q.value !== undefined && q.value !== null) {
    if (typeof q.value !== 'number' || !Number.isFinite(q.value)) {
      issues.push(`${prefix}.quantity.value must be a finite number or null`);
    } else if (q.value < 0) {
      issues.push(`${prefix}.quantity.value must not be negative`);
    }
  }
  if (
    q.unit !== undefined &&
    q.unit !== null &&
    !QUANTITY_UNITS.includes(q.unit as (typeof QUANTITY_UNITS)[number])
  ) {
    issues.push(
      `${prefix}.quantity.unit must be one of ${QUANTITY_UNITS.join(', ')} or null, got "${q.unit}"`,
    );
  }
}

function validateComponent(component: unknown, issues: string[], index: number): void {
  const prefix = `components[${index}]`;
  if (!component || typeof component !== 'object') {
    issues.push(`${prefix} must be an object`);
    return;
  }
  const c = component as RawVariantBComponent;
  if (!isNonEmptyString(c.componentId)) {
    issues.push(`${prefix}.componentId is required and must be a non-empty string`);
  }
  if (!isNonEmptyString(c.name)) {
    issues.push(`${prefix}.name is required and must be a non-empty string`);
  }
  validateQuantity(c.quantity, issues, prefix);

  (['kcal', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'sugar_g', 'salt_g'] as const).forEach(
    (field) => {
      const value = c[field];
      if (value === undefined) return; // absent entirely is fine -- means "not provided"
      if (!isFiniteNumberOrNull(value)) {
        issues.push(`${prefix}.${field} must be a finite number or null, got ${typeof value}`);
        return;
      }
      if (!isNonNegativeOrNull(value)) {
        issues.push(`${prefix}.${field} must not be negative`);
      }
    },
  );

  if (typeof c.confidence !== 'number' || !Number.isFinite(c.confidence)) {
    issues.push(`${prefix}.confidence is required and must be a finite number`);
  } else if (c.confidence < 0 || c.confidence > 1) {
    issues.push(`${prefix}.confidence must be within 0..1, got ${c.confidence}`);
  }

  if (c.assumptions !== undefined && !Array.isArray(c.assumptions)) {
    issues.push(`${prefix}.assumptions must be an array when present`);
  }
  if (c.uncertainties !== undefined && !Array.isArray(c.uncertainties)) {
    issues.push(`${prefix}.uncertainties must be an array when present`);
  }
}

function validateTotals(totals: unknown, issues: string[]): void {
  if (totals === null || totals === undefined) return;
  if (typeof totals !== 'object') {
    issues.push('totals must be an object or null');
    return;
  }
  const t = totals as RawVariantBTotals;
  (['kcal', 'protein_g', 'fat_g', 'carbs_g'] as const).forEach((field) => {
    const value = t[field];
    if (value === undefined) return;
    if (!isFiniteNumberOrNull(value)) {
      issues.push(`totals.${field} must be a finite number or null, got ${typeof value}`);
      return;
    }
    if (!isNonNegativeOrNull(value)) {
      issues.push(`totals.${field} must not be negative`);
    }
  });
}

function validateClarification(clarification: unknown, outcome: unknown, issues: string[]): void {
  if (outcome !== 'clarification_required') return;
  if (!clarification || typeof clarification !== 'object') {
    issues.push('clarification is required when outcome is "clarification_required"');
    return;
  }
  const c = clarification as RawVariantBClarification;
  if (!isNonEmptyString(c.missingInformation)) {
    issues.push('clarification.missingInformation is required and must be a non-empty string');
  }
  if (!CLARIFICATION_KINDS.includes(c.clarificationKind as (typeof CLARIFICATION_KINDS)[number])) {
    issues.push(
      `clarification.clarificationKind must be one of ${CLARIFICATION_KINDS.join(', ')}, got "${c.clarificationKind}"`,
    );
  }
}

/**
 * Structural validation only -- parses `rawText` as JSON, then checks the fixed field list
 * (required fields, types, no negative/non-finite numbers, no unknown enum values, no missing
 * component ids). Never coerces a missing/absent numeric field to `0`; `undefined`/`null` both
 * pass through unchanged as "not provided" (never rejected on that basis alone).
 */
export function parseAndValidateVariantBRawResponse(
  rawText: string | null,
): VariantBValidationResult {
  if (rawText === null) {
    return { valid: false, parsed: null, issues: ['no response text received from provider'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { valid: false, parsed: null, issues: [`invalid JSON: ${(e as Error).message}`] };
  }

  const issues: string[] = [];
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, parsed: null, issues: ['response must be a JSON object'] };
  }
  const candidate = parsed as Record<string, unknown>;

  if (!RAW_OUTCOMES.includes(candidate.outcome as RawOutcome)) {
    issues.push(
      `outcome must be one of ${RAW_OUTCOMES.join(', ')}, got "${String(candidate.outcome)}"`,
    );
  }
  if (!Array.isArray(candidate.components)) {
    issues.push('components must be an array (may be empty)');
  } else {
    candidate.components.forEach((component, index) => validateComponent(component, issues, index));
  }
  if (candidate.assumptions !== undefined && !Array.isArray(candidate.assumptions)) {
    issues.push('assumptions must be an array when present');
  }
  if (candidate.uncertainties !== undefined && !Array.isArray(candidate.uncertainties)) {
    issues.push('uncertainties must be an array when present');
  }
  validateTotals(candidate.totals, issues);
  validateClarification(candidate.clarification, candidate.outcome, issues);

  if (
    candidate.overallConfidence !== undefined &&
    candidate.overallConfidence !== null &&
    (typeof candidate.overallConfidence !== 'number' ||
      !Number.isFinite(candidate.overallConfidence) ||
      candidate.overallConfidence < 0 ||
      candidate.overallConfidence > 1)
  ) {
    issues.push('overallConfidence must be a finite number within 0..1, or null');
  }

  if (
    (candidate.outcome === 'abstained' || candidate.outcome === 'not_interpretable') &&
    !isNonEmptyString(candidate.reason)
  ) {
    issues.push(
      `reason is required and must be a non-empty string when outcome is "${String(candidate.outcome)}"`,
    );
  }

  if (issues.length > 0) {
    return { valid: false, parsed: null, issues };
  }

  return {
    valid: true,
    parsed: {
      outcome: candidate.outcome as RawOutcome,
      components: (candidate.components as RawVariantBComponent[]) ?? [],
      totals: (candidate.totals as RawVariantBTotals | null | undefined) ?? null,
      overallConfidence: (candidate.overallConfidence as number | null | undefined) ?? null,
      assumptions: (candidate.assumptions as string[] | undefined) ?? [],
      uncertainties: (candidate.uncertainties as string[] | undefined) ?? [],
      clarification:
        (candidate.clarification as RawVariantBClarification | null | undefined) ?? null,
      reason: (candidate.reason as string | null | undefined) ?? null,
    },
    issues: [],
  };
}

function toQuantity(raw: RawVariantBQuantity): VariantBQuantity {
  const quantity: VariantBQuantity = {};
  if (raw.value !== null && raw.value !== undefined) quantity.value = raw.value;
  if (raw.unit !== null && raw.unit !== undefined) {
    quantity.unit = raw.unit as VariantBQuantity['unit'];
  }
  if (raw.householdMeasure !== null && raw.householdMeasure !== undefined) {
    quantity.householdMeasure = raw.householdMeasure;
  }
  if (raw.portionDescription !== null && raw.portionDescription !== undefined) {
    quantity.portionDescription = raw.portionDescription;
  }
  return quantity;
}

function toComponent(raw: RawVariantBComponent): VariantBComponentEstimate {
  const component: VariantBComponentEstimate = {
    componentId: raw.componentId,
    name: raw.name,
    quantity: toQuantity(raw.quantity),
    kcal: raw.kcal ?? null,
    protein_g: raw.protein_g ?? null,
    fat_g: raw.fat_g ?? null,
    carbs_g: raw.carbs_g ?? null,
    assumptions: raw.assumptions ?? [],
    uncertainties: raw.uncertainties ?? [],
    confidence: raw.confidence,
  };
  if (raw.brand !== null && raw.brand !== undefined) component.brand = raw.brand;
  if (raw.preparation !== null && raw.preparation !== undefined)
    component.preparation = raw.preparation;
  if (raw.fiber_g !== undefined) component.fiber_g = raw.fiber_g;
  if (raw.sugar_g !== undefined) component.sugar_g = raw.sugar_g;
  if (raw.salt_g !== undefined) component.salt_g = raw.salt_g;
  return component;
}

function toTotals(raw: RawVariantBTotals | null): VariantBMealTotals | null {
  if (!raw) return null;
  return {
    kcal: raw.kcal ?? null,
    protein_g: raw.protein_g ?? null,
    fat_g: raw.fat_g ?? null,
    carbs_g: raw.carbs_g ?? null,
  };
}

/** Relative deviation threshold above which a component-sum vs. asserted-totals mismatch is
 * flagged as a quality warning (ROADMAP.md: "grosse Inkonsistenzen als Qualitaetsfehler oder
 * Warnung behandeln"). A provisional, documented Variant-B-internal threshold -- not a value
 * imported from Variant A or the benchmark spec, which does not define one for this exact check. */
export const COMPONENT_TOTALS_MISMATCH_THRESHOLD = 0.15;

export interface ComponentTotalsConsistency {
  checked: boolean;
  /** `true` when the component-kcal sum and the asserted `totals.kcal` diverge by more than
   * `COMPONENT_TOTALS_MISMATCH_THRESHOLD` -- `false` when consistent or when not checkable
   * (missing totals or missing component values). */
  mismatched: boolean;
  componentSumKcal: number | null;
  assertedTotalKcal: number | null;
}

/** Compares the sum of component `kcal` values against the AI's own asserted `totals.kcal`.
 * Never overwrites either value -- both remain available on the normalized result; this function
 * only *flags* a large discrepancy. Not checkable (returns `checked: false`) when either side is
 * incomplete, since a partial sum is not a meaningful comparison. */
export function checkComponentTotalsConsistency(
  components: readonly VariantBComponentEstimate[],
  totals: VariantBMealTotals | null,
): ComponentTotalsConsistency {
  if (!totals || totals.kcal === null) {
    return { checked: false, mismatched: false, componentSumKcal: null, assertedTotalKcal: null };
  }
  if (components.length === 0 || components.some((c) => c.kcal === null)) {
    return {
      checked: false,
      mismatched: false,
      componentSumKcal: null,
      assertedTotalKcal: totals.kcal,
    };
  }
  const componentSumKcal = components.reduce((sum, c) => sum + (c.kcal as number), 0);
  const denominator = Math.max(Math.abs(totals.kcal), 1);
  const relativeDelta = Math.abs(componentSumKcal - totals.kcal) / denominator;
  return {
    checked: true,
    mismatched: relativeDelta > COMPONENT_TOTALS_MISMATCH_THRESHOLD,
    componentSumKcal,
    assertedTotalKcal: totals.kcal,
  };
}

function buildMeta(
  request: VariantBRequest,
  latencyMs: number,
  executionStatus: 'completed' | 'failed',
): VariantBResultMetadata {
  return {
    contractVersion: VARIANT_B_CONTRACT_VERSION,
    promptVersion: request.promptVersion,
    schemaVersion: request.schemaVersion,
    estimatorVersion: VARIANT_B_ESTIMATOR_VERSION,
    latencyMs,
    traceId: request.traceId,
    executionStatus,
  };
}

/**
 * Maps a raw provider call outcome onto the typed `VariantBEstimationResult` union.
 * - `httpError` present -> `outcome: 'error'`.
 * - Structural validation failed -> `outcome: 'invalid_response'` with every issue attached.
 * - Otherwise maps the raw `outcome` 1:1 onto the typed union.
 */
export function normalizeVariantBResponse(
  request: VariantBRequest,
  rawText: string | null,
  httpError: string | null,
  latencyMs: number,
): VariantBEstimationResult {
  if (httpError !== null) {
    return { outcome: 'error', message: httpError, meta: buildMeta(request, latencyMs, 'failed') };
  }

  const validation = parseAndValidateVariantBRawResponse(rawText);
  if (!validation.valid || !validation.parsed) {
    return {
      outcome: 'invalid_response',
      validationIssues: validation.issues,
      rawResponseExcerpt: rawText === null ? null : rawText.slice(0, 500),
      meta: buildMeta(request, latencyMs, 'failed'),
    };
  }

  const raw = validation.parsed;
  const meta = buildMeta(request, latencyMs, 'completed');
  const components = raw.components.map(toComponent);

  switch (raw.outcome) {
    case 'estimated':
      return {
        outcome: 'estimated',
        meal: {
          components,
          totals: toTotals(raw.totals ?? null),
          overallConfidence: raw.overallConfidence ?? null,
          assumptions: raw.assumptions,
          uncertainties: raw.uncertainties,
        },
        meta,
      };
    case 'clarification_required': {
      const clarification = raw.clarification as RawVariantBClarification;
      const result: VariantBClarification = {
        missingInformation: clarification.missingInformation,
        clarificationKind:
          clarification.clarificationKind as VariantBClarification['clarificationKind'],
      };
      if (clarification.componentId !== null && clarification.componentId !== undefined) {
        result.componentId = clarification.componentId;
      }
      return { outcome: 'clarification_required', components, clarification: result, meta };
    }
    case 'abstained':
      return { outcome: 'abstained', components, reason: raw.reason ?? '', meta };
    case 'not_interpretable':
      return { outcome: 'not_interpretable', reason: raw.reason ?? '', meta };
  }
}
