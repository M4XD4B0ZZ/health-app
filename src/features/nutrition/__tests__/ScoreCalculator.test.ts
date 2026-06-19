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

  it('ranks generic carrot plain raw candidates above composite carrot products', () => {
    const rawCarrots = calculator.calculate({
      normalizedQuery: 'carrot',
      candidateFood: food({
        name: 'Carrots, raw',
        normalizedName: 'carrots raw',
        macrosPer100g: { kcal: 44, protein: 0.9, carbs: 10, fat: 0.2 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 1, exact: false },
    });

    const compositeCandidates = [
      food({
        name: 'Cake or cupcake, carrot',
        normalizedName: 'cake or cupcake carrot',
        macrosPer100g: { kcal: 374, protein: 4, carbs: 55, fat: 16 },
      }),
      food({
        name: 'Muffin, carrot',
        normalizedName: 'muffin carrot',
        macrosPer100g: { kcal: 340, protein: 5, carbs: 50, fat: 13 },
      }),
      food({
        name: 'Carrot, dehydrated',
        normalizedName: 'carrot dehydrated',
        macrosPer100g: { kcal: 341, protein: 8, carbs: 79, fat: 1.5 },
      }),
      food({
        name: 'Carrot bread',
        normalizedName: 'carrot bread',
        macrosPer100g: { kcal: 293, protein: 9, carbs: 40, fat: 10 },
      }),
    ];

    const compositeScores = compositeCandidates.map((candidateFood) =>
      calculator.calculate({
        normalizedQuery: 'carrot',
        candidateFood,
        candidateSource: 'USDA',
        metadata: { similarity: 1, exact: false },
      }),
    );

    expect(rawCarrots.notes).toContain('generic_carrot_plain_boost');
    for (const composite of compositeScores) {
      expect(rawCarrots.finalScore).toBeGreaterThan(composite.finalScore);
      expect(
        composite.notes.some((note) => note.startsWith('generic_carrot_product_penalty_')),
      ).toBe(true);
    }
  });

  it('does not penalize carrot product candidates when the query contains the product term', () => {
    const carrotCake = calculator.calculate({
      normalizedQuery: 'carrot cake',
      candidateFood: food({
        name: 'Cake or cupcake, carrot',
        normalizedName: 'cake or cupcake carrot',
        macrosPer100g: { kcal: 374, protein: 4, carbs: 55, fat: 16 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 1, exact: false },
    });

    expect(
      carrotCake.notes.some((note) => note.startsWith('generic_carrot_product_penalty_')),
    ).toBe(false);
    expect(carrotCake.finalScore).toBeGreaterThan(0.7);
  });
});
