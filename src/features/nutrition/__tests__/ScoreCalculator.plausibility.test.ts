import { ScoreCalculator } from '../application/services/ScoreCalculator';
import { CanonicalFood } from '../domain/catalog/FoodCatalogSource';
import { RESOLVER_SOURCE_LABELS } from '../application/services/ResolverSourceLabel';

describe('ScoreCalculator - Generic Food Plausibility', () => {
  const calculator = new ScoreCalculator();

  it('should penalize implausible high-calorie egg candidates', () => {
    // Simulate an OFF candidate with implausibly high calories (like the 513 kcal problem)
    const implausibleEgg: CanonicalFood = {
      id: 'off-egg-processed',
      name: 'EGG POWDER PRODUCT',
      normalizedName: 'egg',
      macrosPer100g: { kcal: 513, protein: 6.41, carbs: 57.7, fat: 28.8 },
      source: 'off',
    };

    // Simulate a plausible USDA egg candidate
    const plausibleEgg: CanonicalFood = {
      id: 'usda-egg-raw',
      name: 'Egg, whole, raw',
      normalizedName: 'egg',
      macrosPer100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
      source: 'usda',
    };

    const implausibleResult = calculator.calculate({
      normalizedQuery: 'egg',
      candidateFood: implausibleEgg,
      candidateSource: RESOLVER_SOURCE_LABELS.OFF,
      metadata: { similarity: 0.98, exact: true },
    });

    const plausibleResult = calculator.calculate({
      normalizedQuery: 'egg',
      candidateFood: plausibleEgg,
      candidateSource: RESOLVER_SOURCE_LABELS.USDA,
      metadata: { similarity: 0.95, exact: true },
    });

    // The implausible candidate should have a significantly lower final score
    expect(implausibleResult.finalScore).toBeLessThan(plausibleResult.finalScore);
    
    // The implausible candidate should have a plausibility penalty note
    expect(implausibleResult.notes.some(note => note.includes('generic_food_implausible'))).toBe(true);
    
    // The plausible candidate should not have a plausibility penalty
    expect(plausibleResult.notes.some(note => note.includes('generic_food_implausible'))).toBe(false);
  });

  it('should not penalize unknown foods', () => {
    const unknownFood: CanonicalFood = {
      id: 'off-mystery-food',
      name: 'Mystery Food Product',
      normalizedName: 'mystery food',
      macrosPer100g: { kcal: 500, protein: 10, carbs: 50, fat: 20 },
      source: 'off',
    };

    const result = calculator.calculate({
      normalizedQuery: 'mystery food',
      candidateFood: unknownFood,
      candidateSource: RESOLVER_SOURCE_LABELS.OFF,
      metadata: { similarity: 0.9, exact: true },
    });

    // Unknown foods should not get plausibility penalties
    expect(result.notes.some(note => note.includes('generic_food_implausible'))).toBe(false);
  });

  it('should handle German egg queries (eier)', () => {
    const implausibleEgg: CanonicalFood = {
      id: 'off-egg-processed',
      name: 'EGG POWDER',
      normalizedName: 'eier',
      macrosPer100g: { kcal: 615, protein: 8, carbs: 60, fat: 30 },
      source: 'off',
    };

    const result = calculator.calculate({
      normalizedQuery: 'eier',
      candidateFood: implausibleEgg,
      candidateSource: RESOLVER_SOURCE_LABELS.OFF,
      metadata: { similarity: 0.98, exact: true },
    });

    // Should penalize implausible German egg queries too
    expect(result.notes.some(note => note.includes('generic_food_implausible'))).toBe(true);
    expect(result.finalScore).toBeLessThan(0.5); // Should be significantly penalized
  });
});