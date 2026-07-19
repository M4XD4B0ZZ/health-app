import { describe, it, expect, jest } from '@jest/globals';
import {
  buildVariantAResolver,
  runVariantACase,
  FixtureFoodCatalogSource,
} from '../ResolverV3VariantAAdapter';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { SequentialFoodCatalogResolver } from '../../application/services/SequentialFoodCatalogResolver';
import { BlsStaticSource } from '../../infrastructure/catalog/sources/BlsStaticSource';

function caseFor(rawInput: string): BenchmarkCase {
  return {
    caseId: 'RV3-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput,
    locale: 'de',
    expectedComponents: [{ componentId: 'c1', expectedName: rawInput, required: true }],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 1, protein_g: 1, fat_g: 1, carbs_g: 1 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
  };
}

describe('ResolverV3VariantAAdapter', () => {
  it('buildVariantAResolver wires the real production SequentialFoodCatalogResolver + BlsStaticSource', () => {
    const { resolver, registeredSourceTypes } = buildVariantAResolver();
    expect(resolver).toBeInstanceOf(SequentialFoodCatalogResolver);
    expect(registeredSourceTypes).toEqual(['bls']);
  });

  it('never registers an "ai" source by default (no-AI baseline)', () => {
    const { registeredSourceTypes } = buildVariantAResolver();
    expect(registeredSourceTypes).not.toContain('ai');
  });

  it('runVariantACase actually invokes the real resolver boundary (spy proves the call happens)', async () => {
    const { resolver } = buildVariantAResolver();
    const resolveSpy = jest.spyOn(resolver, 'resolve');

    await runVariantACase(caseFor('Magerquark'), resolver);

    expect(resolveSpy).toHaveBeenCalledTimes(1);
    const [query] = resolveSpy.mock.calls[0];
    expect(query.raw).toBe('Magerquark');
    expect(query.normalized).toBe('magerquark');
    expect(query.locale).toBe('de');
  });

  it('normalizes the raw resolver disposition without reinterpreting it: real BLS-generic hit is accepted with the real BLS sourceId', async () => {
    const { resolver } = buildVariantAResolver();
    const result = await runVariantACase(caseFor('Magerquark'), resolver);

    expect(result.decision.status).toBe('accepted');
    expect(result.decision.best?.food.sourceId).toBe('M713100');
    expect(result.decision.best?.food.macrosPer100g.kcal).toBe(66);
  });

  it('normalizes an unresolvable input as a rejected/no-candidates decision, not an error', async () => {
    const { resolver } = buildVariantAResolver();
    const result = await runVariantACase(caseFor('Zwiebelrostbraten'), resolver);

    expect(result.decision.status).toBe('rejected');
    expect(result.decision.best).toBeUndefined();
    expect(result.decision.reasonCodes).toEqual(['NO_CANDIDATES']);
  });

  it('measures a non-negative latency for the resolver call', async () => {
    const { resolver } = buildVariantAResolver();
    const result = await runVariantACase(caseFor('Ei'), resolver);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('FixtureFoodCatalogSource returns exactly the injected candidates for a normalized query, and nothing for others', async () => {
    const source = new FixtureFoodCatalogSource('off', {
      testquery: [
        {
          food: {
            id: 'off-1',
            name: 'Fixture Food',
            normalizedName: 'testquery',
            macrosPer100g: { kcal: 10, protein: 1, carbs: 1, fat: 1 },
            source: 'off',
            sourceId: 'off-1',
          },
          match: { exact: true, similarity: 1 },
          confidence: 1,
          reasons: ['fixture'],
        },
      ],
    });

    await expect(source.search({ normalized: 'testquery' } as never)).resolves.toHaveLength(1);
    await expect(source.search({ normalized: 'unknown' } as never)).resolves.toEqual([]);
  });

  it('an injected fixture source can be combined with the real BLS source', async () => {
    const fixtureOff = new FixtureFoodCatalogSource('off', {});
    const { registeredSourceTypes } = buildVariantAResolver([fixtureOff]);
    expect(registeredSourceTypes).toEqual(['bls', 'off']);
  });

  it('BlsStaticSource used by the adapter reads the real committed artifact deterministically', async () => {
    const bls = new BlsStaticSource();
    const first = await bls.search({
      raw: 'ei',
      normalized: 'ei',
      locale: 'de',
      inputType: 'generic',
    });
    const second = await bls.search({
      raw: 'ei',
      normalized: 'ei',
      locale: 'de',
      inputType: 'generic',
    });
    expect(first).toEqual(second);
  });
});
