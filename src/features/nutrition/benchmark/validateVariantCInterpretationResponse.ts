import {
  AiInterpretationResult,
  ClarificationKind,
  ClarificationRequest,
  ComponentSearchPlan,
  ExpectedResolutionKind,
  InterpretedFoodComponent,
  InterpretedQuantityUnit,
} from '../domain/models/AiInterpretationTypes';
import { FoodSourceType } from '../domain/catalog/FoodCatalogSource';
import { VARIANT_C_INTERPRETER_VERSION, VARIANT_C_PROMPT_VERSION } from './variantCPrompt';
import { AI_INTERPRETATION_CONTRACT_VERSION } from '../application/ports/AiInterpretationProvider';

/**
 * RESOLVER-V3-005: hand-written, schema-near validation for the live Variant C interpretation
 * provider's raw response -- same precedent as `validateBenchmarkCase.ts`/
 * `validateVariantBResponse.ts` (no new validation dependency). Turns an untrusted raw JSON string
 * into the EXACT, unmodified `AiInterpretationResult` type (RESOLVER-V3-002) -- never a superset,
 * never a nutrient field. A structurally invalid response never silently becomes a partial
 * "interpreted" result; it normalizes to `outcome: 'error'` (this contract has no separate
 * `invalid_response` outcome -- that distinction is made at the Variant C meal-outcome level, see
 * `ResolverV3VariantCAdapter.ts`), carrying every validation issue found.
 */

const QUANTITY_UNITS: readonly InterpretedQuantityUnit[] = ['g', 'ml', 'piece', 'portion'];
const SOURCE_TYPES: readonly FoodSourceType[] = ['user', 'off', 'bls', 'usda', 'ai'];
const RESOLUTION_KINDS: readonly ExpectedResolutionKind[] = [
  'generic_food',
  'branded_product',
  'restaurant_product',
  'recipe_or_dish',
  'reusable_personal_meal',
  'unknown',
];
const CLARIFICATION_KINDS: readonly ClarificationKind[] = [
  'missing_quantity',
  'ambiguous_food_identity',
  'ambiguous_preparation',
  'missing_brand',
  'other',
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateOptionalString(value: unknown, issues: string[], path: string): void {
  if (value !== undefined && typeof value !== 'string') issues.push(`${path} must be a string`);
}

function validateOptionalStringArray(value: unknown, issues: string[], path: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    issues.push(`${path} must be an array of strings`);
  }
}

function validateQuantity(value: unknown, issues: string[], prefix: string): boolean {
  if (typeof value !== 'object' || value === null) {
    issues.push(`${prefix}.quantity must be an object`);
    return false;
  }
  const quantity = value as Record<string, unknown>;
  if (quantity.value !== undefined && typeof quantity.value !== 'number') {
    issues.push(`${prefix}.quantity.value must be a number`);
  }
  if (typeof quantity.value === 'number' && !Number.isFinite(quantity.value)) {
    issues.push(`${prefix}.quantity.value must be finite`);
  }
  if (quantity.unit !== undefined && !QUANTITY_UNITS.includes(quantity.unit as never)) {
    issues.push(`${prefix}.quantity.unit must be one of ${QUANTITY_UNITS.join(', ')}`);
  }
  if (quantity.householdMeasure !== undefined && typeof quantity.householdMeasure !== 'string') {
    issues.push(`${prefix}.quantity.householdMeasure must be a string`);
  }
  if (
    quantity.portionDescription !== undefined &&
    typeof quantity.portionDescription !== 'string'
  ) {
    issues.push(`${prefix}.quantity.portionDescription must be a string`);
  }
  return true;
}

function validateComponent(
  value: unknown,
  issues: string[],
  index: number,
): value is InterpretedFoodComponent {
  const prefix = `components[${index}]`;
  if (typeof value !== 'object' || value === null) {
    issues.push(`${prefix} must be an object`);
    return false;
  }
  const component = value as Record<string, unknown>;
  if (!isNonEmptyString(component.id)) issues.push(`${prefix}.id is required`);
  if (!isNonEmptyString(component.originalSegment))
    issues.push(`${prefix}.originalSegment is required`);
  if (!isNonEmptyString(component.interpretedName))
    issues.push(`${prefix}.interpretedName is required`);
  validateOptionalString(component.brand, issues, `${prefix}.brand`);
  validateOptionalString(component.preparation, issues, `${prefix}.preparation`);
  validateOptionalStringArray(component.modifiers, issues, `${prefix}.modifiers`);
  validateOptionalStringArray(component.assumptions, issues, `${prefix}.assumptions`);
  validateOptionalStringArray(component.uncertainties, issues, `${prefix}.uncertainties`);
  if (typeof component.confidence !== 'number' || !Number.isFinite(component.confidence)) {
    issues.push(`${prefix}.confidence must be a finite number`);
  }
  validateQuantity(component.quantity, issues, prefix);
  return issues.length === 0;
}

function validateSearchPlan(
  value: unknown,
  issues: string[],
  index: number,
): value is ComponentSearchPlan {
  const prefix = `searchPlan[${index}]`;
  if (typeof value !== 'object' || value === null) {
    issues.push(`${prefix} must be an object`);
    return false;
  }
  const plan = value as Record<string, unknown>;
  if (!isNonEmptyString(plan.componentId)) issues.push(`${prefix}.componentId is required`);
  if (!Array.isArray(plan.suitableSourceTypes) || plan.suitableSourceTypes.length === 0) {
    issues.push(`${prefix}.suitableSourceTypes must be a non-empty array`);
  } else if (!plan.suitableSourceTypes.every((t) => SOURCE_TYPES.includes(t))) {
    issues.push(`${prefix}.suitableSourceTypes must only contain ${SOURCE_TYPES.join(', ')}`);
  }
  if (!Array.isArray(plan.nativeQueries)) {
    issues.push(`${prefix}.nativeQueries must be an array`);
  } else {
    plan.nativeQueries.forEach((q, qi) => {
      if (typeof q !== 'object' || q === null) {
        issues.push(`${prefix}.nativeQueries[${qi}] must be an object`);
        return;
      }
      const query = q as Record<string, unknown>;
      if (!SOURCE_TYPES.includes(query.sourceType as never)) {
        issues.push(
          `${prefix}.nativeQueries[${qi}].sourceType must be one of ${SOURCE_TYPES.join(', ')}`,
        );
      }
      if (!isNonEmptyString(query.query)) {
        issues.push(`${prefix}.nativeQueries[${qi}].query is required`);
      }
    });
  }
  if (plan.excludedSourceTypes !== undefined) {
    if (!Array.isArray(plan.excludedSourceTypes)) {
      issues.push(`${prefix}.excludedSourceTypes must be an array`);
    } else if (!plan.excludedSourceTypes.every((t) => SOURCE_TYPES.includes(t))) {
      issues.push(`${prefix}.excludedSourceTypes must only contain ${SOURCE_TYPES.join(', ')}`);
    }
  }
  if (!RESOLUTION_KINDS.includes(plan.expectedResolutionKind as never)) {
    issues.push(`${prefix}.expectedResolutionKind must be one of ${RESOLUTION_KINDS.join(', ')}`);
  }
  return issues.length === 0;
}

export interface VariantCResponseValidationResult {
  valid: boolean;
  issues: string[];
}

function deduplicateStrings(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Canonicalizes representation-only provider variance after schema validation. Source priority,
 * component order, and native-query order remain untouched because they carry domain meaning. */
function normalizeInterpretedResponse(
  components: InterpretedFoodComponent[],
  searchPlan: ComponentSearchPlan[],
): { components: InterpretedFoodComponent[]; searchPlan: ComponentSearchPlan[] } {
  const idMap = new Map(components.map((component, index) => [component.id, `c${index + 1}`]));
  return {
    components: components.map((component, index) => ({
      ...component,
      id: `c${index + 1}`,
      originalSegment: component.originalSegment.trim(),
      interpretedName: component.interpretedName.trim(),
      brand: component.brand?.trim() || undefined,
      preparation: component.preparation?.trim() || undefined,
      modifiers: deduplicateStrings(component.modifiers),
      assumptions: deduplicateStrings(component.assumptions),
      uncertainties: deduplicateStrings(component.uncertainties),
      quantity: {
        ...component.quantity,
        householdMeasure: component.quantity.householdMeasure?.trim() || undefined,
        portionDescription: component.quantity.portionDescription?.trim() || undefined,
      },
    })),
    searchPlan: searchPlan.map((plan) => ({
      ...plan,
      componentId: idMap.get(plan.componentId)!,
      nativeQueries: plan.nativeQueries.map((query) => ({ ...query, query: query.query.trim() })),
      excludedSourceTypes: plan.excludedSourceTypes
        ? [...new Set(plan.excludedSourceTypes)]
        : undefined,
    })),
  };
}

export function validateVariantCRawResponse(raw: unknown): VariantCResponseValidationResult {
  const issues: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, issues: ['response must be a JSON object'] };
  }
  const body = raw as Record<string, unknown>;

  const outcome = body.outcome;
  if (
    outcome !== 'interpreted' &&
    outcome !== 'interpreted_with_assumptions' &&
    outcome !== 'clarification_required' &&
    outcome !== 'not_interpretable'
  ) {
    issues.push(
      'outcome must be one of interpreted, interpreted_with_assumptions, clarification_required, not_interpretable',
    );
    return { valid: false, issues };
  }

  if (outcome === 'not_interpretable') {
    if (!isNonEmptyString(body.reason))
      issues.push('reason is required when outcome is not_interpretable');
    return { valid: issues.length === 0, issues };
  }

  const components = Array.isArray(body.components) ? body.components : [];
  if (!Array.isArray(body.components)) issues.push('components must be an array');
  components.forEach((c, i) => validateComponent(c, issues, i));
  const componentIds = components
    .map((component) => (component as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
  if (new Set(componentIds).size !== componentIds.length) {
    issues.push('components ids must be unique');
  }

  if (outcome === 'clarification_required') {
    const clarification = body.clarification;
    if (typeof clarification !== 'object' || clarification === null) {
      issues.push('clarification is required when outcome is clarification_required');
    } else {
      const c = clarification as Record<string, unknown>;
      if (!isNonEmptyString(c.missingInformation))
        issues.push('clarification.missingInformation is required');
      if (!CLARIFICATION_KINDS.includes(c.clarificationKind as never)) {
        issues.push(
          `clarification.clarificationKind must be one of ${CLARIFICATION_KINDS.join(', ')}`,
        );
      }
      if (
        c.componentId !== undefined &&
        (!isNonEmptyString(c.componentId) || !componentIds.includes(c.componentId))
      ) {
        issues.push('clarification.componentId must reference an existing component');
      }
    }
    return { valid: issues.length === 0, issues };
  }

  // interpreted | interpreted_with_assumptions
  if (components.length === 0)
    issues.push('components must be non-empty for an interpreted outcome');
  const searchPlan = Array.isArray(body.searchPlan) ? body.searchPlan : [];
  if (!Array.isArray(body.searchPlan)) issues.push('searchPlan must be an array');
  searchPlan.forEach((p, i) => validateSearchPlan(p, issues, i));
  const planCounts = new Map<string, number>();
  searchPlan.forEach((plan, index) => {
    const componentId = (plan as { componentId?: unknown }).componentId;
    if (typeof componentId === 'string' && !componentIds.includes(componentId)) {
      issues.push(`searchPlan[${index}].componentId must reference an existing component`);
    } else if (typeof componentId === 'string') {
      planCounts.set(componentId, (planCounts.get(componentId) ?? 0) + 1);
    }
  });
  componentIds.forEach((componentId) => {
    if (planCounts.get(componentId) !== 1) {
      issues.push(`component ${componentId} must have exactly one search plan`);
    }
  });

  return { valid: issues.length === 0, issues };
}

/**
 * Parses + validates the live provider's raw text and normalizes it into an `AiInterpretationResult`
 * (RESOLVER-V3-002's own, unmodified type). Never returns anything shaped outside that union. A
 * JSON-parse failure or schema-validation failure both normalize to `outcome: 'error'` -- the
 * message is prefixed `schema_validation_failed:` specifically for validation issues, so
 * callers/reports can distinguish "provider responded but violated the schema" from "provider
 * call itself failed" without adding a new field to the shared contract.
 */
export function parseAndNormalizeVariantCInterpretationResponse(
  rawText: string | null,
  httpError: string | null,
  latencyMs: number,
  traceId: string | undefined,
): AiInterpretationResult {
  const meta = {
    contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
    interpreterVersion: VARIANT_C_INTERPRETER_VERSION,
    latencyMs,
    traceId,
    executionStatus: 'completed' as const,
  };

  if (httpError) {
    return { outcome: 'error', message: httpError, meta: { ...meta, executionStatus: 'failed' } };
  }
  if (!rawText) {
    return {
      outcome: 'error',
      message: 'empty response from provider',
      meta: { ...meta, executionStatus: 'failed' },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return {
      outcome: 'error',
      message: `schema_validation_failed: could not parse response as JSON (${(e as Error).message})`,
      meta: { ...meta, executionStatus: 'failed' },
    };
  }

  let validation: VariantCResponseValidationResult;
  try {
    validation = validateVariantCRawResponse(parsed);
  } catch (e) {
    return {
      outcome: 'error',
      message: `internal_parser_error: validation failed closed (${safeErrorMessage(e)})`,
      meta: { ...meta, executionStatus: 'failed' },
    };
  }
  const { valid, issues } = validation;
  if (!valid) {
    return {
      outcome: 'error',
      message: `schema_validation_failed: ${issues.join('; ')}`,
      meta: { ...meta, executionStatus: 'failed' },
    };
  }

  const body = parsed as {
    outcome:
      | 'interpreted'
      | 'interpreted_with_assumptions'
      | 'clarification_required'
      | 'not_interpretable';
    components?: InterpretedFoodComponent[];
    searchPlan?: ComponentSearchPlan[];
    clarification?: ClarificationRequest;
    reason?: string;
  };

  try {
    if (body.outcome === 'not_interpretable') {
      return { outcome: 'not_interpretable', reason: body.reason ?? 'unspecified', meta };
    }
    if (body.outcome === 'clarification_required') {
      const components = body.components ?? [];
      const idMap = new Map(components.map((component, index) => [component.id, `c${index + 1}`]));
      const normalized = normalizeInterpretedResponse(components, []);
      return {
        outcome: 'clarification_required',
        components: normalized.components,
        clarification: {
          ...(body.clarification as NonNullable<typeof body.clarification>),
          componentId: body.clarification?.componentId
            ? idMap.get(body.clarification.componentId)
            : undefined,
          missingInformation: body.clarification!.missingInformation.trim(),
        },
        meta,
      };
    }
    const normalized = normalizeInterpretedResponse(body.components ?? [], body.searchPlan ?? []);
    return {
      outcome: body.outcome,
      components: normalized.components,
      searchPlan: normalized.searchPlan,
      meta,
    };
  } catch (e) {
    return {
      outcome: 'error',
      message: `internal_parser_error: normalization failed closed (${safeErrorMessage(e)})`,
      meta: { ...meta, executionStatus: 'failed' },
    };
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown parser failure';
}

// Kept for callers that only need the version constant without importing the prompt module.
export { VARIANT_C_PROMPT_VERSION };
