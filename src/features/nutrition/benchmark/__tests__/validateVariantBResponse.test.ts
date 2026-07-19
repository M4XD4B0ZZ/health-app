import { describe, it, expect } from '@jest/globals';
import {
  parseAndValidateVariantBRawResponse,
  normalizeVariantBResponse,
  checkComponentTotalsConsistency,
} from '../validateVariantBResponse';
import { VariantBRequest } from '../VariantBTypes';

function request(overrides: Partial<VariantBRequest> = {}): VariantBRequest {
  return {
    caseId: 'RV3-TEST',
    rawInput: 'Testfall',
    locale: 'de',
    runIndex: 0,
    traceId: 'trace-1',
    promptVersion: 'v1',
    schemaVersion: 's1',
    ...overrides,
  };
}

const VALID_ESTIMATED = JSON.stringify({
  outcome: 'estimated',
  components: [
    {
      componentId: 'c1',
      name: 'Testfall',
      quantity: { value: 100, unit: 'g' },
      kcal: 100,
      protein_g: 10,
      fat_g: 5,
      carbs_g: 10,
      assumptions: [],
      uncertainties: [],
      confidence: 0.8,
    },
  ],
  totals: { kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 10 },
  overallConfidence: 0.8,
  assumptions: [],
  uncertainties: [],
  clarification: null,
  reason: null,
});

describe('parseAndValidateVariantBRawResponse', () => {
  it('accepts a well-formed "estimated" response', () => {
    const result = parseAndValidateVariantBRawResponse(VALID_ESTIMATED);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects null response text', () => {
    const result = parseAndValidateVariantBRawResponse(null);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatch(/no response text/);
  });

  it('rejects invalid JSON', () => {
    const result = parseAndValidateVariantBRawResponse('not json{');
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatch(/invalid JSON/);
  });

  it('rejects an unknown outcome value', () => {
    const raw = JSON.stringify({
      outcome: 'guessing',
      components: [],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('outcome must be one of'))).toBe(true);
  });

  it('rejects a missing componentId (required field)', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        { name: 'x', quantity: {}, confidence: 0.5, assumptions: [], uncertainties: [] },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('componentId'))).toBe(true);
  });

  it('rejects a missing component name (required field)', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        { componentId: 'c1', quantity: {}, confidence: 0.5, assumptions: [], uncertainties: [] },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('.name'))).toBe(true);
  });

  it('rejects a negative macro value', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        {
          componentId: 'c1',
          name: 'x',
          quantity: {},
          kcal: -5,
          confidence: 0.5,
          assumptions: [],
          uncertainties: [],
        },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('kcal') && i.includes('negative'))).toBe(true);
  });

  it('rejects a non-finite macro value (e.g. Infinity is not valid JSON, but a string-typed number is)', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        {
          componentId: 'c1',
          name: 'x',
          quantity: {},
          kcal: '100' as unknown as number,
          confidence: 0.5,
          assumptions: [],
          uncertainties: [],
        },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('kcal') && i.includes('finite'))).toBe(true);
  });

  it('keeps a missing macro field absent (never coerced to 0) on a valid response', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        {
          componentId: 'c1',
          name: 'x',
          quantity: { value: 10, unit: 'g' },
          confidence: 0.5,
          assumptions: [],
          uncertainties: [],
        },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(true);
    expect(result.parsed?.components[0].kcal).toBeUndefined();
  });

  it('rejects an unsupported quantity unit', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        {
          componentId: 'c1',
          name: 'x',
          quantity: { value: 1, unit: 'liters' },
          confidence: 0.5,
          assumptions: [],
          uncertainties: [],
        },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('unit'))).toBe(true);
  });

  it('requires a clarification object when outcome is clarification_required', () => {
    const raw = JSON.stringify({
      outcome: 'clarification_required',
      components: [],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('clarification'))).toBe(true);
  });

  it('requires a non-empty reason when outcome is abstained', () => {
    const raw = JSON.stringify({
      outcome: 'abstained',
      components: [],
      assumptions: [],
      uncertainties: [],
      reason: '',
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('reason'))).toBe(true);
  });

  it('rejects confidence outside 0..1', () => {
    const raw = JSON.stringify({
      outcome: 'estimated',
      components: [
        {
          componentId: 'c1',
          name: 'x',
          quantity: {},
          confidence: 1.5,
          assumptions: [],
          uncertainties: [],
        },
      ],
      assumptions: [],
      uncertainties: [],
    });
    const result = parseAndValidateVariantBRawResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('confidence'))).toBe(true);
  });
});

describe('normalizeVariantBResponse', () => {
  it('normalizes a valid estimated response, preserving components and totals separately', () => {
    const result = normalizeVariantBResponse(request(), VALID_ESTIMATED, null, 42);
    expect(result.outcome).toBe('estimated');
    if (result.outcome === 'estimated') {
      expect(result.meal.components).toHaveLength(1);
      expect(result.meal.totals).toEqual({ kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 10 });
      expect(result.meal.components[0].kcal).toBe(100);
    }
    expect(result.meta.latencyMs).toBe(42);
  });

  it('maps an httpError to outcome "error"', () => {
    const result = normalizeVariantBResponse(request(), null, 'network timeout', 10);
    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') expect(result.message).toBe('network timeout');
  });

  it('maps a structurally invalid response to outcome "invalid_response" with issues attached', () => {
    const result = normalizeVariantBResponse(request(), 'not json{', null, 5);
    expect(result.outcome).toBe('invalid_response');
    if (result.outcome === 'invalid_response') {
      expect(result.validationIssues.length).toBeGreaterThan(0);
      expect(result.rawResponseExcerpt).toBe('not json{');
    }
  });

  it('maps a null response with no httpError to outcome "invalid_response" (not silently accepted)', () => {
    const result = normalizeVariantBResponse(request(), null, null, 5);
    expect(result.outcome).toBe('invalid_response');
  });

  it('normalizes outcome "clarification_required" correctly', () => {
    const raw = JSON.stringify({
      outcome: 'clarification_required',
      components: [],
      assumptions: [],
      uncertainties: [],
      clarification: {
        componentId: null,
        missingInformation: 'Menge?',
        clarificationKind: 'missing_quantity',
      },
    });
    const result = normalizeVariantBResponse(request(), raw, null, 5);
    expect(result.outcome).toBe('clarification_required');
    if (result.outcome === 'clarification_required') {
      expect(result.clarification.clarificationKind).toBe('missing_quantity');
      expect(result.clarification.componentId).toBeUndefined();
    }
  });

  it('normalizes outcome "abstained" correctly', () => {
    const raw = JSON.stringify({
      outcome: 'abstained',
      components: [],
      assumptions: [],
      uncertainties: [],
      reason: 'keine verlaessliche Grundlage',
    });
    const result = normalizeVariantBResponse(request(), raw, null, 5);
    expect(result.outcome).toBe('abstained');
    if (result.outcome === 'abstained') expect(result.reason).toBe('keine verlaessliche Grundlage');
  });

  it('normalizes outcome "not_interpretable" correctly', () => {
    const raw = JSON.stringify({
      outcome: 'not_interpretable',
      components: [],
      assumptions: [],
      uncertainties: [],
      reason: 'kein Lebensmittelbezug erkennbar',
    });
    const result = normalizeVariantBResponse(request(), raw, null, 5);
    expect(result.outcome).toBe('not_interpretable');
    if (result.outcome === 'not_interpretable')
      expect(result.reason).toBe('kein Lebensmittelbezug erkennbar');
  });
});

describe('checkComponentTotalsConsistency', () => {
  it('flags a large component-sum vs. totals mismatch without silently overwriting either value', () => {
    const components = [
      {
        componentId: 'c1',
        name: 'x',
        quantity: {},
        kcal: 100,
        protein_g: null,
        fat_g: null,
        carbs_g: null,
        assumptions: [],
        uncertainties: [],
        confidence: 0.5,
      },
    ];
    const consistency = checkComponentTotalsConsistency(components, {
      kcal: 500,
      protein_g: null,
      fat_g: null,
      carbs_g: null,
    });
    expect(consistency.checked).toBe(true);
    expect(consistency.mismatched).toBe(true);
    expect(consistency.componentSumKcal).toBe(100);
    expect(consistency.assertedTotalKcal).toBe(500);
  });

  it('does not flag a small, within-threshold discrepancy', () => {
    const components = [
      {
        componentId: 'c1',
        name: 'x',
        quantity: {},
        kcal: 100,
        protein_g: null,
        fat_g: null,
        carbs_g: null,
        assumptions: [],
        uncertainties: [],
        confidence: 0.5,
      },
    ];
    const consistency = checkComponentTotalsConsistency(components, {
      kcal: 105,
      protein_g: null,
      fat_g: null,
      carbs_g: null,
    });
    expect(consistency.mismatched).toBe(false);
  });

  it('reports not-checkable when totals is null', () => {
    const consistency = checkComponentTotalsConsistency([], null);
    expect(consistency.checked).toBe(false);
    expect(consistency.mismatched).toBe(false);
  });
});
