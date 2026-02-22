import { buildLogDecisionMeta } from '../application/services/explainability/buildLogDecisionMeta';
import { buildEditDecisionMeta } from '../application/services/explainability/buildEditDecisionMeta';
import { ResolverDecision } from '../domain/models/ResolverDecision';
import { PortionParseResult } from '../domain/portion/PortionParseResult';
import { computeTotals } from '../domain/portion/computeTotals';

describe('Decision metadata builders', () => {
  it('accepted resolver + grams includes source and grams explanation', () => {
    const resolverDecision: ResolverDecision = {
      normalizedQuery: 'apfel',
      status: 'accepted',
      reasonCodes: ['ACCEPTED_STRONG_MATCH'],
      candidates: [
        {
          id: 'USDA:apple',
          source: 'USDA',
          food: {
            id: 'apple',
            name: 'Apple',
            normalizedName: 'apple',
            macrosPer100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
            source: 'usda',
          },
          score: 0.83,
          breakdown: {
            matchScore: 0.9,
            dataQualityScore: 1,
            kcalConsistencyScore: 0.9,
            sourceTrustScore: 0.95,
            finalScore: 0.83,
            notes: [],
          },
        },
      ],
      best: undefined,
      secondBest: undefined,
      createdAt: new Date('2026-02-22T10:00:00Z').toISOString(),
    };
    resolverDecision.best = resolverDecision.candidates[0];

    const portion: PortionParseResult = {
      status: 'resolved',
      grams: 200,
      notes: ['GRAMS_SET'],
      confidence: 0.99,
    };

    const calcBreakdown = computeTotals(
      { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
      200,
      1,
    );
    const meta = buildLogDecisionMeta({
      resolverDecision,
      portionParseResult: portion,
      calcBreakdown,
    });

    expect(meta.explanation).toContain('200 g');
    expect(meta.details?.join(' ')).toContain('USDA');
  });

  it('ambiguous resolver indicates ambiguity', () => {
    const resolverDecision: ResolverDecision = {
      normalizedQuery: 'reis',
      status: 'ambiguous',
      reasonCodes: ['MULTIPLE_CLOSE_MATCHES'],
      candidates: [],
      createdAt: new Date().toISOString(),
    };

    const meta = buildLogDecisionMeta({ resolverDecision });
    expect(meta.status).toBe('ambiguous');
    expect(meta.explanation).toContain('Mehrere mögliche Treffer');
  });

  it('ml ambiguous mentions missing density', () => {
    const portion: PortionParseResult = {
      status: 'ambiguous',
      notes: ['ML_UNSUPPORTED'],
      confidence: 0.45,
    };

    const meta = buildEditDecisionMeta({
      editText: '250 ml',
      portionParseResult: portion,
    });

    expect(meta.status).toBe('ambiguous');
    expect(meta.explanation).toContain('ohne Dichte');
  });

  it('ingredient edit unsupported mentions unsupported', () => {
    const portion: PortionParseResult = {
      status: 'unresolved',
      notes: ['NO_PORTION_SIGNAL'],
      confidence: 0.2,
    };

    const meta = buildEditDecisionMeta({
      editText: 'ohne öl',
      portionParseResult: portion,
      ingredientEditUnsupported: true,
    });

    expect(meta.reasonCodes).toContain('INGREDIENT_EDIT_UNSUPPORTED');
    expect(meta.explanation).toContain('nicht deterministisch unterstützt');
  });
});
