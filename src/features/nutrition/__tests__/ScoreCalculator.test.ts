import {
  classifyCandidateSemanticClass,
  ScoreCalculator,
} from '../application/services/ScoreCalculator';
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

  it('classifies candidate names by generic semantic class', () => {
    expect(classifyCandidateSemanticClass('Tomatoes, raw')).toBe('plain_raw');
    expect(classifyCandidateSemanticClass('Tomatoes, scalloped')).toBe('prepared_complex');
    expect(classifyCandidateSemanticClass('Tomato soup')).toBe('composite_dish');
    expect(classifyCandidateSemanticClass('Banana chips')).toBe('prepared_complex');
    expect(classifyCandidateSemanticClass('Apple pie')).toBe('composite_dish');
  });

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

  it('ranks generic tomato raw candidates above prepared complex tomato candidates', () => {
    const rawTomatoes = calculator.calculate({
      normalizedQuery: 'tomaten',
      candidateFood: food({
        name: 'Tomatoes, raw',
        normalizedName: 'tomatoes raw',
        macrosPer100g: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 0.95, exact: false },
    });

    const scallopedTomatoes = calculator.calculate({
      normalizedQuery: 'tomaten',
      candidateFood: food({
        name: 'Tomatoes, scalloped',
        normalizedName: 'tomatoes scalloped',
        macrosPer100g: { kcal: 110, protein: 3, carbs: 12, fat: 6 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 1, exact: false },
    });

    expect(rawTomatoes.notes).toContain('semantic_class_plain_raw');
    expect(rawTomatoes.notes).toContain('semantic_plain_raw_boost');
    expect(scallopedTomatoes.notes).toContain('semantic_class_prepared_complex');
    expect(scallopedTomatoes.notes).toContain('semantic_prepared_complex_penalty');
    expect(rawTomatoes.finalScore).toBeGreaterThan(scallopedTomatoes.finalScore);
  });

  it('ranks generic banana raw candidates above banana chips', () => {
    const rawBananas = calculator.calculate({
      normalizedQuery: 'bananen',
      candidateFood: food({
        name: 'Bananas, raw',
        normalizedName: 'bananas raw',
        macrosPer100g: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 0.95, exact: false },
    });

    const bananaChips = calculator.calculate({
      normalizedQuery: 'bananen',
      candidateFood: food({
        name: 'Banana chips',
        normalizedName: 'banana chips',
        macrosPer100g: { kcal: 519, protein: 2.3, carbs: 58, fat: 34 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 1, exact: false },
    });

    expect(bananaChips.notes).toContain('semantic_prepared_complex_penalty');
    expect(rawBananas.finalScore).toBeGreaterThan(bananaChips.finalScore);
  });

  it('ranks generic apple raw candidates above apple pie', () => {
    const rawApples = calculator.calculate({
      normalizedQuery: 'apfel',
      candidateFood: food({
        name: 'Apples, raw',
        normalizedName: 'apples raw',
        macrosPer100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 0.95, exact: false },
    });

    const applePie = calculator.calculate({
      normalizedQuery: 'apfel',
      candidateFood: food({
        name: 'Apple pie',
        normalizedName: 'apple pie',
        macrosPer100g: { kcal: 237, protein: 1.9, carbs: 34, fat: 11 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 1, exact: false },
    });

    expect(applePie.notes).toContain('semantic_composite_dish_penalty');
    expect(rawApples.finalScore).toBeGreaterThan(applePie.finalScore);
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

    expect(rawCarrots.notes).toContain('semantic_plain_raw_boost');
    for (const composite of compositeScores) {
      expect(rawCarrots.finalScore).toBeGreaterThan(composite.finalScore);
      expect(
        composite.notes.some(
          (note) =>
            note === 'semantic_composite_dish_penalty' ||
            note === 'semantic_prepared_complex_penalty',
        ),
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

    expect(carrotCake.notes).toContain('semantic_class_composite_dish');
    expect(carrotCake.notes).toContain('semantic_product_intent_no_penalty');
    expect(carrotCake.notes).not.toContain('semantic_composite_dish_penalty');
    expect(carrotCake.finalScore).toBeGreaterThan(0.7);
  });

  it('ranks all-zero macro records below usable raw candidates', () => {
    const zeroMacroTomato = calculator.calculate({
      normalizedQuery: 'tomato',
      candidateFood: food({
        name: 'TOMATO',
        normalizedName: 'tomato',
        macrosPer100g: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      }),
      candidateSource: 'OFF',
      metadata: { similarity: 1, exact: true },
    });

    const rawTomatoes = calculator.calculate({
      normalizedQuery: 'tomato',
      candidateFood: food({
        name: 'Tomatoes, raw',
        normalizedName: 'tomatoes raw',
        macrosPer100g: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
      }),
      candidateSource: 'USDA',
      metadata: { similarity: 0.95, exact: false },
    });

    expect(zeroMacroTomato.notes).toContain('zero_macro_record');
    expect(zeroMacroTomato.finalScore).toBeLessThan(rawTomatoes.finalScore);
  });
});
