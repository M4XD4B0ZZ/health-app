import { describe, expect, it } from '@jest/globals';
import type { AiInterpretationInterpreted } from '../../domain/models/AiInterpretationTypes';
import {
  decideVariantCInterpretationConfidence,
  selectVariantCUnresolvedClarification,
} from '../VariantCConfidencePolicy';

const meta = {
  contractVersion: '1',
  interpreterVersion: 'fixture',
  latencyMs: 0,
  executionStatus: 'completed' as const,
};

function interpreted(
  component: AiInterpretationInterpreted['components'][number],
  outcome: AiInterpretationInterpreted['outcome'] = 'interpreted_with_assumptions',
): AiInterpretationInterpreted {
  return {
    outcome,
    components: [component],
    searchPlan: [
      {
        componentId: component.id,
        suitableSourceTypes: ['bls'],
        nativeQueries: [{ sourceType: 'bls', query: component.interpretedName }],
        expectedResolutionKind: 'generic_food',
      },
    ],
    meta,
  };
}

describe('Variant C confidence, abstention, and clarification policy', () => {
  it('clarifies an assumption-only interpreted cup quantity', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted({
        id: 'c1',
        originalSegment: 'Ein Becher Magerquark',
        interpretedName: 'Magerquark',
        quantity: { value: 150, unit: 'g', householdMeasure: '1 Becher' },
        confidence: 0.8,
        assumptions: ['Bechergröße als 150 g angenommen'],
      }),
    );

    expect(decision.action).toBe('clarify');
    expect(decision.clarification).toMatchObject({
      componentId: 'c1',
      clarificationKind: 'missing_quantity',
    });
  });

  it('clarifies an assumption-only material preparation', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted({
        id: 'c1',
        originalSegment: 'Reis',
        interpretedName: 'Reis',
        quantity: { value: 100, unit: 'g' },
        confidence: 0.8,
        assumptions: ['Zubereitung als gekocht angenommen'],
      }),
    );

    expect(decision.action).toBe('clarify');
    expect(decision.clarification?.clarificationKind).toBe('ambiguous_preparation');
  });

  it('clarifies an assumption-only material brand', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted({
        id: 'c1',
        originalSegment: 'Proteinriegel',
        interpretedName: 'Proteinriegel',
        quantity: { value: 1, unit: 'piece' },
        confidence: 0.8,
        assumptions: ['Marke als Standardprodukt angenommen'],
      }),
    );

    expect(decision.action).toBe('clarify');
    expect(decision.clarification?.clarificationKind).toBe('missing_brand');
  });

  it('does not turn a benign non-material assumption into a global clarification rule', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted({
        id: 'c1',
        originalSegment: 'Tomate',
        interpretedName: 'Tomate',
        quantity: { value: 100, unit: 'g' },
        confidence: 0.8,
        assumptions: ['Deutsche Bezeichnung angenommen'],
      }),
    );

    expect(decision.action).toBe('continue');
  });

  it('RH-RES-HOUSEHOLD-DEV-005 asks the smallest quantity clarification for uncertain cup size', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted({
        id: 'c1',
        originalSegment: 'Ein Becher Magerquark',
        interpretedName: 'Magerquark',
        quantity: { value: 150, unit: 'g', householdMeasure: '1 Becher' },
        confidence: 0.8,
        uncertainties: ['Die exakte Bechergroesse ist unbekannt und kann variieren'],
      }),
    );

    expect(decision.action).toBe('clarify');
    expect(decision.clarification).toMatchObject({
      componentId: 'c1',
      clarificationKind: 'missing_quantity',
    });
  });

  it('RH-RES-UNRELIABLE-DEV-006 does not convert repeated noisy text into a confident quantity', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted({
        id: 'comp_1',
        originalSegment: 'ApfelApfelApfel!!!123',
        interpretedName: 'Apfel',
        quantity: { value: 3, unit: 'piece' },
        confidence: 0.72,
        assumptions: ['Die Wiederholung wurde als Anzahl interpretiert'],
        uncertainties: [
          'Unklar, ob die Wiederholung und die Zahl eine spezifische Bedeutung haben',
        ],
      }),
    );

    expect(decision.action).toBe('clarify');
    expect(decision.clarification?.clarificationKind).toBe('missing_quantity');
  });

  it('continues when identity and quantity are supported without unresolved evidence', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted(
        {
          id: 'c1',
          originalSegment: '100g Tomate',
          interpretedName: 'Tomate',
          quantity: { value: 100, unit: 'g' },
          confidence: 0.9,
        },
        'interpreted',
      ),
    );
    expect(decision.action).toBe('continue');
  });

  it('does not invent a global confidence cutoff without categorical uncertainty evidence', () => {
    const decision = decideVariantCInterpretationConfidence(
      interpreted(
        {
          id: 'c1',
          originalSegment: 'etwas',
          interpretedName: 'Käse',
          quantity: {},
          confidence: 0.3,
        },
        'interpreted',
      ),
    );
    expect(decision.action).toBe('continue');
  });

  it('turns a recognized but retrieval-unresolved component into clarification, not abstention', () => {
    expect(
      selectVariantCUnresolvedClarification([
        {
          id: 'c1',
          originalSegment: 'unbekannter Käse',
          interpretedName: 'Käse',
          quantity: {},
          confidence: 0.8,
        },
      ]),
    ).toMatchObject({ clarificationKind: 'ambiguous_food_identity' });
  });
});
