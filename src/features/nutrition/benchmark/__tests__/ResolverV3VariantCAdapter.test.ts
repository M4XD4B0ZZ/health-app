import { describe, it, expect, jest } from '@jest/globals';
import {
  FixtureCostAiInterpreter,
  runVariantCCase,
  VariantCDependencies,
} from '../ResolverV3VariantCAdapter';
import { FixtureFoodCatalogSource, buildVariantAResolver } from '../ResolverV3VariantAAdapter';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import { ResolverDecision } from '../../domain/models/ResolverDecision';
import {
  AiInterpretationProvider,
  AI_INTERPRETATION_CONTRACT_VERSION,
} from '../../application/ports/AiInterpretationProvider';
import {
  AiInterpretationRequest,
  AiInterpretationResult,
} from '../../domain/models/AiInterpretationTypes';
import { FoodCatalogSource, FoodSourceType } from '../../domain/catalog/FoodCatalogSource';

function caseFor(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
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
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

function rejectingResolver(): FoodCatalogResolver {
  return {
    resolve: async (query): Promise<ResolverDecision> => ({
      normalizedQuery: query.normalized,
      status: 'rejected',
      reasonCodes: ['NO_CANDIDATES'],
      candidates: [],
      createdAt: new Date().toISOString(),
    }),
  };
}

const baseMeta = {
  contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
  interpreterVersion: 'test',
  latencyMs: 0,
  executionStatus: 'completed' as const,
};

class StaticAiProvider implements AiInterpretationProvider {
  constructor(private readonly result: AiInterpretationResult) {}
  async interpret(_request: AiInterpretationRequest): Promise<AiInterpretationResult> {
    return this.result;
  }
}

function depsWithResult(
  result: AiInterpretationResult,
  extra: Partial<VariantCDependencies> = {},
): VariantCDependencies {
  return {
    aiInterpreter: new FixtureCostAiInterpreter(new StaticAiProvider(result)),
    fastPathResolver: rejectingResolver(),
    ...extra,
  };
}

describe('ResolverV3VariantCAdapter — fast path', () => {
  it('RESOLVER-V3-045: the real BLS fast path has no candidate for a vague multi-token quantity input', async () => {
    const { resolver } = buildVariantAResolver();
    const decision = await resolver.resolve({
      raw: 'Reis, ein bisschen',
      normalized: 'reis ein bisschen',
      locale: 'de',
    });
    expect(decision.candidates).toHaveLength(0);
    expect(decision.status).not.toBe('accepted');
  });
  it('uses the real Variant A resolver fast path and never calls the AI interpreter when it accepts', async () => {
    const { resolver } = buildVariantAResolver();
    const neverCalled: AiInterpretationProvider = {
      interpret: jest.fn(async () => {
        throw new Error('AI must not be called when the fast path accepts');
      }) as never,
    };
    const deps: VariantCDependencies = {
      aiInterpreter: new FixtureCostAiInterpreter(neverCalled),
      fastPathResolver: resolver,
    };

    const raw = await runVariantCCase(caseFor({ rawInput: 'Magerquark' }), deps);

    expect(raw.mealResult.fastPath.used).toBe(true);
    expect(raw.mealResult.aiInterpretation.called).toBe(false);
    expect(raw.mealResult.outcome).toBe('resolved');
    expect(raw.mealResult.components[0].provenance.sourceId).toBe('M713100');
    expect(raw.mealResult.components[0].macrosPer100g?.kcal).toBe(66);
    expect(neverCalled.interpret).not.toHaveBeenCalled();
  });

  it('falls through to AI interpretation when the fast path does not accept', async () => {
    const provider = new StaticAiProvider({
      outcome: 'not_interpretable',
      reason: 'test reason',
      meta: baseMeta,
    });
    const interpretSpy = jest.spyOn(provider, 'interpret');
    const deps = depsWithResult(
      { outcome: 'not_interpretable', reason: 'x', meta: baseMeta },
      { aiInterpreter: new FixtureCostAiInterpreter(provider) },
    );

    await runVariantCCase(caseFor(), deps);
    expect(interpretSpy).toHaveBeenCalledTimes(1);
  });

  it('does not invent normalizedInput when BenchmarkCase has no authoritative normalized input', async () => {
    const provider = new StaticAiProvider({
      outcome: 'not_interpretable',
      reason: 'test reason',
      meta: baseMeta,
    });
    const interpretSpy = jest.spyOn(provider, 'interpret');

    await runVariantCCase(caseFor({ rawInput: '  Marke, nicht Banane  ' }), {
      aiInterpreter: new FixtureCostAiInterpreter(provider),
      fastPathResolver: rejectingResolver(),
    });

    expect(interpretSpy).toHaveBeenCalledWith({
      rawInput: '  Marke, nicht Banane  ',
      locale: 'de',
      traceId: 'resolver-v3-variant-c:RV3-TEST',
    });
    expect(interpretSpy.mock.calls[0][0].normalizedInput).toBeUndefined();
  });
});

describe('ResolverV3VariantCAdapter — AI outcome normalization', () => {
  it('clarification_required is handled without any retrieval', async () => {
    const bareBls = new FixtureFoodCatalogSource('bls', {});
    const searchSpy = jest.spyOn(bareBls, 'search');
    const deps = depsWithResult(
      {
        outcome: 'clarification_required',
        components: [
          {
            id: 'c1',
            originalSegment: 'Speck',
            interpretedName: 'Speck',
            quantity: {},
            confidence: 0.3,
          },
        ],
        clarification: {
          componentId: 'c1',
          missingInformation: 'Art',
          clarificationKind: 'ambiguous_food_identity',
        },
        meta: baseMeta,
      },
      { sourcesByType: new Map([['bls', bareBls]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);

    expect(raw.mealResult.outcome).toBe('clarification_required');
    expect(raw.mealResult.clarificationRequests).toHaveLength(1);
    expect(raw.mealResult.components).toEqual([]);
    expect(raw.mealResult.totals).toBeNull();
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('not_interpretable normalizes to the matching meal outcome', async () => {
    const deps = depsWithResult({
      outcome: 'not_interpretable',
      reason: 'gibberish',
      meta: baseMeta,
    });
    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.outcome).toBe('not_interpretable');
    expect(raw.mealResult.components).toEqual([]);
    expect(raw.mealResult.totals).toBeNull();
    expect(raw.mealResult.warnings).toContain('gibberish');
  });

  it('unavailable normalizes to the matching meal outcome', async () => {
    const deps = depsWithResult({ outcome: 'unavailable', reason: 'no provider', meta: baseMeta });
    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.outcome).toBe('unavailable');
    expect(raw.mealResult.components).toEqual([]);
    expect(raw.mealResult.totals).toBeNull();
  });

  it('error normalizes to the matching meal outcome', async () => {
    const deps = depsWithResult({
      outcome: 'error',
      message: 'boom',
      meta: { ...baseMeta, executionStatus: 'failed' },
    });
    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.outcome).toBe('error');
    expect(raw.mealResult.components).toEqual([]);
    expect(raw.mealResult.totals).toBeNull();
    expect(raw.mealResult.errors).toContain('boom');
  });
});

describe('ResolverV3VariantCAdapter — search-plan-constrained retrieval', () => {
  function bareBlsFixture(candidatesByQuery: Record<string, any>) {
    return new FixtureFoodCatalogSource('bls', candidatesByQuery);
  }

  it('queries only the planned source types with the source-native query, not the bare interpreted name', async () => {
    const candidate = {
      food: {
        id: 'bls-1',
        name: 'Tomate roh',
        normalizedName: 'tomate roh',
        macrosPer100g: { kcal: 22, protein: 0.95, carbs: 3.25, fat: 0.11 },
        source: 'bls' as const,
        sourceId: 'G561100',
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    };
    const blsSource = bareBlsFixture({ 'tomate roh': [candidate] });
    const searchSpy = jest.spyOn(blsSource, 'search');

    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Tomate',
            interpretedName: 'Tomate',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.8,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'tomate roh' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor({ rawInput: 'Tomate' }), deps);

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy.mock.calls[0][0].normalized).toBe('tomate roh');
    expect(raw.mealResult.components[0].provenance.sourceId).toBe('G561100');
    expect(raw.mealResult.outcome).toBe('resolved');
  });

  it('never queries an excluded source type even if it would otherwise be suitable', async () => {
    const blsSource = bareBlsFixture({});
    const offSource = bareBlsFixture({});
    (offSource as unknown as { type: FoodSourceType }).type = 'off';
    const blsSpy = jest.spyOn(blsSource, 'search');
    const offSpy = jest.spyOn(offSource, 'search');

    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Gouda',
            interpretedName: 'Gouda',
            quantity: {},
            confidence: 0.6,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls', 'off'],
            excludedSourceTypes: ['off'],
            nativeQueries: [
              { sourceType: 'bls', query: 'gouda' },
              { sourceType: 'off', query: 'gouda cheese' },
            ],
            expectedResolutionKind: 'branded_product',
          },
        ],
        meta: baseMeta,
      },
      {
        sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([
          ['bls', blsSource],
          ['off', offSource],
        ]),
      },
    );

    await runVariantCCase(caseFor(), deps);

    expect(blsSpy).toHaveBeenCalledTimes(1);
    expect(offSpy).not.toHaveBeenCalled();
  });

  it('reports a warning when a planned source type has no registered adapter, and treats the component as unresolved', async () => {
    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Gouda',
            interpretedName: 'Gouda',
            quantity: {},
            confidence: 0.6,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['off'],
            nativeQueries: [{ sourceType: 'off', query: 'gouda cheese' }],
            expectedResolutionKind: 'branded_product',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map() },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    expect(
      raw.mealResult.components[0].warnings.some((w) =>
        w.includes('is registered in this benchmark run'),
      ),
    ).toBe(true);
    expect(raw.mealResult.unresolvedComponentIds).toContain('c1');
  });
});

describe('ResolverV3VariantCAdapter — provenance and AI-nutrient isolation', () => {
  it('RESOLVER-V3-045: consistently clarifies any material vague-quantity assumption before retrieval', async () => {
    for (const vaguePhrase of ['eine unbestimmte Menge', 'portion size unknown']) {
      const raw = await runVariantCCase(
        caseFor({ rawInput: `Lebensmittel, ${vaguePhrase}` }),
        depsWithResult({
          outcome: 'interpreted_with_assumptions',
          components: [
            {
              id: 'provider-id',
              originalSegment: 'Lebensmittel',
              interpretedName: 'Lebensmittel',
              quantity: { value: 150, unit: 'g' },
              confidence: 0.9,
              assumptions: [`${vaguePhrase}; 150 g assumed`],
            },
          ],
          searchPlan: [
            {
              componentId: 'provider-id',
              suitableSourceTypes: ['bls'],
              nativeQueries: [],
              expectedResolutionKind: 'generic_food',
            },
          ],
          meta: baseMeta,
        }),
      );
      expect(raw.mealResult.outcome).toBe('clarification_required');
      expect(raw.mealResult.clarificationRequests[0]?.clarificationKind).toBe('missing_quantity');
      expect(raw.mealResult.externalRequestCount).toBe(0);
    }
  });
  it('fails closed before retrieval for an assumption-only material quantity', async () => {
    const candidate = {
      food: {
        id: 'bls-1',
        name: 'Magerquark',
        normalizedName: 'magerquark',
        macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
        source: 'bls' as const,
        sourceId: 'M713100',
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    };
    const blsSource = new FixtureFoodCatalogSource('bls', { magerquark: [candidate] });
    const searchSpy = jest.spyOn(blsSource, 'search');
    const raw = await runVariantCCase(
      caseFor({ rawInput: 'Ein Becher Magerquark' }),
      depsWithResult(
        {
          outcome: 'interpreted_with_assumptions',
          components: [
            {
              id: 'c1',
              originalSegment: 'Ein Becher Magerquark',
              interpretedName: 'Magerquark',
              quantity: { value: 150, unit: 'g', householdMeasure: '1 Becher' },
              confidence: 0.8,
              assumptions: ['Bechergröße als 150 g angenommen'],
            },
          ],
          searchPlan: [
            {
              componentId: 'c1',
              suitableSourceTypes: ['bls'],
              nativeQueries: [{ sourceType: 'bls', query: 'magerquark' }],
              expectedResolutionKind: 'generic_food',
            },
          ],
          meta: baseMeta,
        },
        { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
      ),
    );

    expect(raw.mealResult.outcome).toBe('clarification_required');
    expect(raw.mealResult.clarificationRequests).toEqual([
      expect.objectContaining({ componentId: 'c1', clarificationKind: 'missing_quantity' }),
    ]);
    expect(searchSpy).not.toHaveBeenCalled();
    expect(raw.mealResult.components).toEqual([]);
    expect(raw.mealResult.totals).toBeNull();
  });

  it('fails closed when post-retrieval quantity failure requires clarification', async () => {
    const candidate = {
      food: {
        id: 'bls-1',
        name: 'Quark',
        normalizedName: 'quark',
        macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
        source: 'bls' as const,
        sourceId: 'M713100',
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    };
    const blsSource = new FixtureFoodCatalogSource('bls', { quark: [candidate] });
    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Quark',
            interpretedName: 'Quark',
            quantity: {},
            confidence: 0.9,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'quark' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    const component = raw.mealResult.components[0];

    expect(raw.mealResult.outcome).toBe('clarification_required');
    expect(component).toMatchObject({
      chosenCandidateName: null,
      resolverStatus: 'rejected',
      nativeScore: null,
      provenance: {
        sourceType: null,
        sourceId: null,
        sourceName: null,
        sourceGrounded: false,
      },
      macrosPer100g: null,
      scaledNutrients: null,
      gramsUsed: null,
    });
  });

  it('fails closed when retrieval abstains after an empty interpreted identity', async () => {
    const raw = await runVariantCCase(
      caseFor(),
      depsWithResult({
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: '???',
            interpretedName: '',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.1,
          },
        ],
        searchPlan: [],
        meta: baseMeta,
      }),
    );

    expect(raw.mealResult.outcome).toBe('abstained');
    expect(raw.mealResult.components[0]).toMatchObject({
      chosenCandidateName: null,
      nativeScore: null,
      macrosPer100g: null,
      scaledNutrients: null,
      gramsUsed: null,
    });
    expect(raw.mealResult.totals).toBeNull();
  });

  it('does not expose one selected candidate for a multiple-candidate outcome', async () => {
    const candidate = (sourceId: string, name: string) => ({
      food: {
        id: sourceId,
        name,
        normalizedName: 'quark',
        macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
        source: 'bls' as const,
        sourceId,
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    });
    const blsSource = new FixtureFoodCatalogSource('bls', {
      quark: [candidate('M713100', 'Quark A'), candidate('M714100', 'Quark B')],
    });
    const raw = await runVariantCCase(
      caseFor(),
      depsWithResult(
        {
          outcome: 'interpreted',
          components: [
            {
              id: 'c1',
              originalSegment: 'Quark',
              interpretedName: 'Quark',
              quantity: { value: 100, unit: 'g' },
              confidence: 0.9,
            },
          ],
          searchPlan: [
            {
              componentId: 'c1',
              suitableSourceTypes: ['bls'],
              nativeQueries: [{ sourceType: 'bls', query: 'quark' }],
              expectedResolutionKind: 'generic_food',
            },
          ],
          meta: baseMeta,
        },
        { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
      ),
    );

    expect(raw.mealResult.outcome).toBe('multiple_candidates');
    expect(raw.mealResult.unresolvedComponentIds).toEqual(['c1']);
    expect(raw.mealResult.components[0]).toMatchObject({
      chosenCandidateName: null,
      nativeScore: null,
      provenance: { sourceId: null, sourceGrounded: false },
      macrosPer100g: null,
      scaledNutrients: null,
      gramsUsed: null,
    });
  });

  it('flags a missing sourceId as not source-grounded even when a candidate name is chosen', async () => {
    const candidateNoSourceId = {
      food: {
        id: 'bls-x',
        name: 'Mystery Food',
        normalizedName: 'mystery food',
        macrosPer100g: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
        source: 'bls' as const,
        sourceId: undefined,
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    };
    const blsSource = new FixtureFoodCatalogSource('bls', {
      'mystery food': [candidateNoSourceId],
    });

    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'X',
            interpretedName: 'X',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.9,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'mystery food' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.components[0].provenance.sourceGrounded).toBe(false);
    expect(raw.mealResult.components[0].provenance.sourceId).toBeNull();
  });

  it('never lets an AI-authored numeric-looking field leak into macrosPer100g/scaledNutrients', async () => {
    const candidate = {
      food: {
        id: 'bls-1',
        name: 'Quark',
        normalizedName: 'quark',
        macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
        source: 'bls' as const,
        sourceId: 'M713100',
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    };
    const blsSource = new FixtureFoodCatalogSource('bls', { quark: [candidate] });

    // Simulates a careless/malicious AI response smuggling a numeric-looking extra field onto the
    // component -- the contract type has no such field, but we defend against it structurally by
    // never reading anything except `interpretedName`/`quantity` off the AI component.
    const suspiciousComponent = {
      id: 'c1',
      originalSegment: 'Quark',
      interpretedName: 'Quark',
      quantity: { value: 200, unit: 'g' as const },
      confidence: 0.9,
      kcal: 999999, // not part of InterpretedFoodComponent -- must never be read
    };

    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [suspiciousComponent as never],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'quark' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    const component = raw.mealResult.components[0];
    expect(component.macrosPer100g?.kcal).toBe(66);
    expect(component.scaledNutrients?.kcal).toBe(132);
    expect(component.macrosPer100g?.kcal).not.toBe(999999);
  });
});

describe('ResolverV3VariantCAdapter — deterministic quantity scaling and meal summation', () => {
  function fixtureCandidate(
    sourceId: string,
    name: string,
    macros: { kcal: number; protein: number; carbs: number; fat: number },
  ) {
    return {
      food: {
        id: sourceId,
        name,
        normalizedName: name.toLowerCase(),
        macrosPer100g: macros,
        source: 'bls' as const,
        sourceId,
      },
      match: { exact: true, similarity: 1 },
      confidence: 1,
      reasons: [],
    };
  }

  it('scales a single component deterministically by explicit grams', async () => {
    const blsSource = new FixtureFoodCatalogSource('bls', {
      quark: [
        fixtureCandidate('M713100', 'Quark', { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 }),
      ],
    });
    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Quark',
            interpretedName: 'Quark',
            quantity: { value: 200, unit: 'g' },
            confidence: 0.9,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'quark' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.components[0].gramsUsed).toBe(200);
    expect(raw.mealResult.components[0].scaledNutrients).toEqual({
      kcal: 132,
      protein_g: 23.7,
      fat_g: 0.36,
      carbs_g: 7.36,
    });
    expect(raw.mealResult.totals).toEqual({
      kcal: 132,
      protein_g: 23.7,
      fat_g: 0.36,
      carbs_g: 7.36,
    });
    expect(raw.mealResult.outcome).toBe('resolved');
  });

  it('sums two fully-resolved components deterministically into the meal totals', async () => {
    const blsSource = new FixtureFoodCatalogSource('bls', {
      quark: [
        fixtureCandidate('M713100', 'Quark', { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 }),
      ],
      ei: [
        fixtureCandidate('Y720100', 'Huehnerei ganz roh', {
          kcal: 137,
          protein: 11.9,
          carbs: 1.5,
          fat: 9.3,
        }),
      ],
    });
    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Quark',
            interpretedName: 'Quark',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.9,
          },
          {
            id: 'c2',
            originalSegment: 'Ei',
            interpretedName: 'Ei',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.9,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'quark' }],
            expectedResolutionKind: 'generic_food',
          },
          {
            componentId: 'c2',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'ei' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.totals).toEqual({
      kcal: 203,
      protein_g: 23.75,
      fat_g: 9.48,
      carbs_g: 5.18,
    });
  });

  it('a component that cannot be resolved produces a partial meal, never a falsely-complete "resolved" outcome', async () => {
    const blsSource = new FixtureFoodCatalogSource('bls', {
      quark: [
        fixtureCandidate('M713100', 'Quark', { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 }),
      ],
    });
    const deps = depsWithResult(
      {
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Quark',
            interpretedName: 'Quark',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.9,
          },
          {
            id: 'c2',
            originalSegment: 'Unbekanntes Zeug',
            interpretedName: 'Unbekanntes Zeug',
            quantity: {},
            confidence: 0.2,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'quark' }],
            expectedResolutionKind: 'generic_food',
          },
          {
            componentId: 'c2',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'unbekanntes zeug' }],
            expectedResolutionKind: 'unknown',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.outcome).toBe('partially_resolved');
    expect(raw.mealResult.totals).toBeNull();
    expect(raw.mealResult.unresolvedComponentIds).toContain('c2');
    expect(raw.mealResult.components[0].provenance.sourceId).toBe('M713100');
    expect(raw.mealResult.components[0].scaledNutrients).not.toBeNull();
    expect(raw.mealResult.components[1]).toMatchObject({
      chosenCandidateName: null,
      nativeScore: null,
      provenance: { sourceId: null, sourceGrounded: false },
      macrosPer100g: null,
      scaledNutrients: null,
      gramsUsed: null,
    });
  });
});

describe('ResolverV3VariantCAdapter — multi-component composed input', () => {
  it('processes "Zwei Scheiben Toast mit Butter und Gouda" as three separately-resolved components', async () => {
    const blsSource = new FixtureFoodCatalogSource('bls', {
      toast: [
        {
          food: {
            id: 'bls-toast',
            name: 'Weizentoastbrot',
            normalizedName: 'toast',
            macrosPer100g: { kcal: 261, protein: 8.29, carbs: 46.8, fat: 3.59 },
            source: 'bls' as const,
            sourceId: 'B314000',
          },
          match: { exact: true, similarity: 1 },
          confidence: 1,
          reasons: [],
        },
      ],
      butter: [
        {
          food: {
            id: 'bls-butter',
            name: 'Butter',
            normalizedName: 'butter',
            macrosPer100g: { kcal: 741, protein: 0.7, carbs: 0.6, fat: 83 },
            source: 'bls' as const,
            sourceId: 'K101000',
          },
          match: { exact: true, similarity: 1 },
          confidence: 1,
          reasons: [],
        },
      ],
      gouda: [
        {
          food: {
            id: 'bls-gouda',
            name: 'Gouda',
            normalizedName: 'gouda',
            macrosPer100g: { kcal: 356, protein: 24.9, carbs: 2.2, fat: 27.4 },
            source: 'bls' as const,
            sourceId: 'M403000',
          },
          match: { exact: true, similarity: 1 },
          confidence: 1,
          reasons: [],
        },
      ],
    });

    const deps = depsWithResult(
      {
        outcome: 'interpreted_with_assumptions',
        components: [
          {
            id: 'c1',
            originalSegment: 'Zwei Scheiben Toast',
            interpretedName: 'Toast',
            quantity: { value: 2, unit: 'piece', householdMeasure: '2 Scheiben' },
            confidence: 0.85,
          },
          {
            id: 'c2',
            originalSegment: 'Butter',
            interpretedName: 'Butter',
            quantity: { value: 10, unit: 'g' },
            confidence: 0.5,
            assumptions: ['Deutsche Bezeichnung angenommen'],
          },
          {
            id: 'c3',
            originalSegment: 'Gouda',
            interpretedName: 'Gouda',
            quantity: { value: 20, unit: 'g' },
            confidence: 0.5,
            assumptions: ['Deutsche Bezeichnung angenommen'],
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'toast' }],
            expectedResolutionKind: 'generic_food',
          },
          {
            componentId: 'c2',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'butter' }],
            expectedResolutionKind: 'generic_food',
          },
          {
            componentId: 'c3',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'gouda' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
        meta: baseMeta,
      },
      { sourcesByType: new Map<FoodSourceType, FoodCatalogSource>([['bls', blsSource]]) },
    );

    const raw = await runVariantCCase(
      caseFor({ rawInput: 'Zwei Scheiben Toast mit Butter und Gouda', category: 'COMPOSED' }),
      deps,
    );

    expect(raw.mealResult.components).toHaveLength(3);
    expect(raw.mealResult.components.map((c) => c.interpretedName)).toEqual([
      'Toast',
      'Butter',
      'Gouda',
    ]);
    expect(raw.mealResult.components.every((c) => c.provenance.sourceGrounded)).toBe(true);
    // Toast: 2 slices * 35g/slice (seed portion hint) = 70g -> kcal = 261 * 0.70 = 182.7
    expect(raw.mealResult.components[0].gramsUsed).toBe(70);
    expect(raw.mealResult.outcome).toBe('resolved_with_assumptions');
    expect(raw.mealResult.totals).not.toBeNull();
  });
});
