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
    expect(raw.mealResult.warnings).toContain('gibberish');
  });

  it('unavailable normalizes to the matching meal outcome', async () => {
    const deps = depsWithResult({ outcome: 'unavailable', reason: 'no provider', meta: baseMeta });
    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.outcome).toBe('unavailable');
  });

  it('error normalizes to the matching meal outcome', async () => {
    const deps = depsWithResult({
      outcome: 'error',
      message: 'boom',
      meta: { ...baseMeta, executionStatus: 'failed' },
    });
    const raw = await runVariantCCase(caseFor(), deps);
    expect(raw.mealResult.outcome).toBe('error');
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
            assumptions: ['Menge nicht angegeben, Standardmenge angenommen'],
          },
          {
            id: 'c3',
            originalSegment: 'Gouda',
            interpretedName: 'Gouda',
            quantity: { value: 20, unit: 'g' },
            confidence: 0.5,
            assumptions: ['Menge nicht angegeben, Standardscheibe angenommen'],
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
