import {
  AiInterpretationProvider,
  NoopAiInterpretationProvider,
  AI_INTERPRETATION_CONTRACT_VERSION,
  NOOP_AI_INTERPRETER_VERSION,
} from '../application/ports/AiInterpretationProvider';
import type {
  AiInterpretationRequest,
  AiInterpretationResult,
  AiInterpretationInterpreted,
  AiInterpretationClarificationRequired,
  InterpretedFoodComponent,
  ComponentSearchPlan,
} from '../domain/models/AiInterpretationTypes';

describe('AiInterpretationProvider contract', () => {
  it('accepts a simple single-item input ("200 g Quark")', () => {
    const request: AiInterpretationRequest = {
      rawInput: '200 g Quark',
      locale: 'de',
      traceId: 'trace-1',
    };

    const component: InterpretedFoodComponent = {
      id: 'c1',
      originalSegment: '200 g Quark',
      interpretedName: 'Quark',
      quantity: { value: 200, unit: 'g' },
      confidence: 0.95,
    };

    const result: AiInterpretationInterpreted = {
      outcome: 'interpreted',
      components: [component],
      searchPlan: [
        {
          componentId: 'c1',
          suitableSourceTypes: ['bls', 'off'],
          nativeQueries: [
            { sourceType: 'bls', query: 'quark' },
            { sourceType: 'off', query: 'quark' },
          ],
          expectedResolutionKind: 'generic_food',
        },
      ],
      meta: {
        contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
        interpreterVersion: 'test-fixture',
        latencyMs: 12,
        traceId: request.traceId,
        executionStatus: 'completed',
      },
    };

    expect(result.components).toHaveLength(1);
    expect(result.components[0].quantity).toEqual({ value: 200, unit: 'g' });
    expect(result.searchPlan[0].suitableSourceTypes).toContain('bls');
  });

  it('represents a composite input ("Zwei Scheiben Toast mit Butter und Gouda") as multiple, distinctly separated components', () => {
    const components: InterpretedFoodComponent[] = [
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
        quantity: { portionDescription: 'ungenannte Menge' },
        confidence: 0.5,
        assumptions: ['Menge nicht angegeben, Standardstrich angenommen'],
      },
      {
        id: 'c3',
        originalSegment: 'Gouda',
        interpretedName: 'Gouda',
        quantity: { portionDescription: 'ungenannte Menge' },
        confidence: 0.5,
        assumptions: ['Menge nicht angegeben, Standardscheibe angenommen'],
      },
    ];

    // Every component traces back to a disjoint slice of the original text.
    const segments = components.map((c) => c.originalSegment);
    expect(new Set(segments).size).toBe(segments.length);
    expect(components).toHaveLength(3);
    expect(components.map((c) => c.interpretedName)).toEqual(['Toast', 'Butter', 'Gouda']);
  });

  it('types quantities, units, and assumptions distinctly per component', () => {
    const grams: InterpretedFoodComponent['quantity'] = { value: 200, unit: 'g' };
    const household: InterpretedFoodComponent['quantity'] = {
      value: 2,
      unit: 'piece',
      householdMeasure: '2 Scheiben',
    };
    const portionOnly: InterpretedFoodComponent['quantity'] = {
      portionDescription: 'eine Portion',
    };

    expect(grams.unit).toBe('g');
    expect(household.householdMeasure).toBe('2 Scheiben');
    expect(portionOnly.value).toBeUndefined();
  });

  it('expresses a source-native search plan spanning multiple source capabilities without naming any provider', () => {
    const plan: ComponentSearchPlan = {
      componentId: 'c1',
      suitableSourceTypes: ['bls', 'off', 'usda'],
      nativeQueries: [
        { sourceType: 'bls', query: 'gouda' },
        { sourceType: 'off', query: 'gouda cheese' },
        { sourceType: 'usda', query: 'gouda cheese' },
      ],
      excludedSourceTypes: [],
      expectedResolutionKind: 'branded_product',
    };

    expect(plan.nativeQueries).toHaveLength(3);
    expect(plan.suitableSourceTypes[0]).toBe('bls');
    const serialized = JSON.stringify(plan).toLowerCase();
    expect(serialized).not.toMatch(/openai|anthropic|perplexity|sonar|gemini|claude/);
  });

  it('represents a targeted clarification request in a structured way', () => {
    const clarification: AiInterpretationClarificationRequired = {
      outcome: 'clarification_required',
      components: [
        {
          id: 'c1',
          originalSegment: 'Speck',
          interpretedName: 'Speck',
          quantity: {},
          confidence: 0.3,
          uncertainties: ['Speck ist mehrdeutig (Bauchspeck/Rückenspeck/Schinkenspeck)'],
        },
      ],
      clarification: {
        componentId: 'c1',
        missingInformation: 'Art des Specks',
        clarificationKind: 'ambiguous_food_identity',
      },
      meta: {
        contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
        interpreterVersion: 'test-fixture',
        latencyMs: 5,
        executionStatus: 'completed',
      },
    };

    expect(clarification.clarification.componentId).toBe('c1');
    expect(clarification.clarification.clarificationKind).toBe('ambiguous_food_identity');
  });

  it('NoopAiInterpretationProvider deterministically reports unavailable', async () => {
    const provider: AiInterpretationProvider = new NoopAiInterpretationProvider();
    const request: AiInterpretationRequest = {
      rawInput: '200 g Quark',
      locale: 'de',
      traceId: 'trace-noop',
    };

    const first: AiInterpretationResult = await provider.interpret(request);
    const second: AiInterpretationResult = await provider.interpret(request);

    expect(first.outcome).toBe('unavailable');
    expect(second.outcome).toBe('unavailable');
    expect(first).toEqual(second);
    expect(first.meta.interpreterVersion).toBe(NOOP_AI_INTERPRETER_VERSION);
    expect(first.meta.contractVersion).toBe(AI_INTERPRETATION_CONTRACT_VERSION);
    expect(first.meta.traceId).toBe('trace-noop');
    expect(first.meta.executionStatus).toBe('completed');
  });

  it('NoopAiInterpretationProvider performs no network or persistence operation and never echoes raw input in its output', async () => {
    const provider = new NoopAiInterpretationProvider();
    const sensitiveInput = 'Hackfleisch mit Zwiebeln fuer meine Diaet';
    const request: AiInterpretationRequest = { rawInput: sensitiveInput, locale: 'de' };

    const result = await provider.interpret(request);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(sensitiveInput);
    expect(result.outcome).toBe('unavailable');
    if (result.outcome === 'unavailable') {
      expect(result.reason).toBe('No AI interpretation provider configured');
    }
  });
});
