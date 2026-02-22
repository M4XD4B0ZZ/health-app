import { ScoreCalculator } from '../application/services/ScoreCalculator';
import { CanonicalFood } from '../domain/catalog/FoodCatalogSource';

function food(input: Partial<CanonicalFood>): CanonicalFood {
  return {
    id: 'f1',
    name: input.name ?? 'Apple',
    normalizedName: input.normalizedName ?? 'apple',
    source: input.source ?? 'usda',
    macrosPer100g: {
      kcal: input.macrosPer100g?.kcal ?? 52,
      protein: input.macrosPer100g?.protein ?? 0.3,
      carbs: input.macrosPer100g?.carbs ?? 14,
      fat: input.macrosPer100g?.fat ?? 0.2,
    },
    sourceId: input.sourceId,
  };
}

describe('ScoreCalculator', () => {
  const calculator = new ScoreCalculator();

  it('penalizes missing macro fields in data quality', () => {
    const good = calculator.calculate({
      normalizedQuery: 'oats',
      candidateFood: food({
        normalizedName: 'oats',
        macrosPer100g: { kcal: 389, protein: 17, carbs: 66, fat: 7 },
      }),
      candidateSource: 'USDA',
      metadata: { exact: true, similarity: 1 },
    });

    const bad = calculator.calculate({
      normalizedQuery: 'oats',
      candidateFood: food({
        normalizedName: 'oats',
        macrosPer100g: { kcal: NaN, protein: 17, carbs: 66, fat: NaN },
      }),
      candidateSource: 'USDA',
      metadata: { exact: true, similarity: 1 },
    });

    expect(good.dataQualityScore).toBe(1);
    expect(bad.dataQualityScore).toBeLessThan(1);
    expect(bad.notes).toContain('missing_kcal');
  });

  it('penalizes kcal inconsistency using relative error', () => {
    const consistent = calculator.calculate({
      normalizedQuery: 'bar',
      candidateFood: food({
        normalizedName: 'protein bar',
        macrosPer100g: { kcal: 200, protein: 20, carbs: 15, fat: 6 },
      }),
      candidateSource: 'OFF',
      metadata: { similarity: 1, exact: true },
    });

    const inconsistent = calculator.calculate({
      normalizedQuery: 'bar',
      candidateFood: food({
        normalizedName: 'protein bar',
        macrosPer100g: { kcal: 200, protein: 40, carbs: 40, fat: 20 },
      }),
      candidateSource: 'OFF',
      metadata: { similarity: 1, exact: true },
    });

    expect(consistent.kcalConsistencyScore).toBeGreaterThan(inconsistent.kcalConsistencyScore);
  });
});
