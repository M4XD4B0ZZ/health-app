import { describe, it, expect } from '@jest/globals';
import {
  buildVariantBRequest,
  runVariantBCase,
  FixtureVariantBProvider,
  NoopVariantBProvider,
} from '../ResolverV3VariantBAdapter';
import { BenchmarkCase } from '../BenchmarkCaseTypes';

function baseCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Testfall',
    locale: 'de',
    expectedComponents: [{ componentId: 'c1', expectedName: 'Testfall', required: true }],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 10 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

describe('buildVariantBRequest', () => {
  it('builds a stable, deterministic request from a benchmark case', () => {
    const request = buildVariantBRequest(baseCase(), 0);
    expect(request.caseId).toBe('RV3-TEST');
    expect(request.rawInput).toBe('Testfall');
    expect(request.locale).toBe('de');
    expect(request.runIndex).toBe(0);
    expect(request.traceId).toBe('resolver-v3-variant-b:RV3-TEST:0');
    expect(request.promptVersion).toBeTruthy();
    expect(request.schemaVersion).toBeTruthy();
  });

  it('includes regionalContext only when the case has it', () => {
    const withContext = buildVariantBRequest(baseCase({ regionalContext: 'DE' }), 0);
    expect(withContext.regionalContext).toBe('DE');
    const without = buildVariantBRequest(baseCase(), 0);
    expect(without.regionalContext).toBeUndefined();
  });

  it('increments runIndex and trace id for repeated runs of the same case', () => {
    const first = buildVariantBRequest(baseCase(), 0);
    const second = buildVariantBRequest(baseCase(), 1);
    expect(first.traceId).not.toBe(second.traceId);
    expect(second.runIndex).toBe(1);
  });
});

describe('FixtureVariantBProvider', () => {
  it('is deterministic and performs no network I/O', async () => {
    const provider = new FixtureVariantBProvider({
      'RV3-TEST': JSON.stringify({
        outcome: 'not_interpretable',
        components: [],
        assumptions: [],
        uncertainties: [],
        reason: 'x',
      }),
    });
    const request = buildVariantBRequest(baseCase(), 0);
    const first = await provider.call(request);
    const second = await provider.call(request);
    expect(first.rawText).toBe(second.rawText);
    expect(first.httpError).toBeNull();
    expect(provider.runMode).toBe('fixture');
  });

  it('returns null rawText with no httpError for an unfixtured case id', async () => {
    const provider = new FixtureVariantBProvider({});
    const request = buildVariantBRequest(baseCase(), 0);
    const result = await provider.call(request);
    expect(result.rawText).toBeNull();
  });

  it('always reports a known, zero cost (no real call happened)', () => {
    const provider = new FixtureVariantBProvider({});
    expect(provider.computeCostUsd(null)).toEqual({ costUsd: 0, pricingStatus: 'known' });
  });
});

describe('NoopVariantBProvider', () => {
  it('deterministically reports an httpError, never silently succeeding', async () => {
    const provider = new NoopVariantBProvider();
    const result = await provider.call(buildVariantBRequest(baseCase(), 0));
    expect(result.rawText).toBeNull();
    expect(result.httpError).toMatch(/No Variant B provider configured/);
  });
});

describe('runVariantBCase', () => {
  it('runs a case through a fixture provider and returns a fully normalized result', async () => {
    const rawText = JSON.stringify({
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
    const provider = new FixtureVariantBProvider({ 'RV3-TEST': rawText });
    const raw = await runVariantBCase(baseCase(), provider, 0);

    expect(raw.result.outcome).toBe('estimated');
    expect(raw.runMeta.providerId).toBe('fixture');
    expect(raw.runMeta.runMode).toBe('fixture');
    expect(raw.runMeta.costUsd).toBe(0);
    expect(raw.request.caseId).toBe('RV3-TEST');
  });

  it('propagates a provider httpError into an "error" outcome, never falling back to fixture data', async () => {
    const provider = new NoopVariantBProvider();
    const raw = await runVariantBCase(baseCase(), provider, 0);
    expect(raw.result.outcome).toBe('error');
    expect(raw.runMeta.httpError).toBeTruthy();
  });
});
