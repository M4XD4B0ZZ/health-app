import { describe, it, expect } from '@jest/globals';
import { resolveComponentGrams } from '../VariantCQuantity';
import { InterpretedFoodComponent } from '../../domain/models/AiInterpretationTypes';

function componentWith(overrides: Partial<InterpretedFoodComponent>): InterpretedFoodComponent {
  return {
    id: 'c1',
    originalSegment: 'x',
    interpretedName: 'Ei',
    quantity: {},
    confidence: 0.9,
    ...overrides,
  };
}

describe('resolveComponentGrams', () => {
  it('uses an explicit gram quantity directly', async () => {
    const result = await resolveComponentGrams(
      componentWith({ interpretedName: 'Quark', quantity: { value: 200, unit: 'g' } }),
    );
    expect(result).toEqual({ status: 'resolved', grams: 200, assumptions: [], warnings: [] });
  });

  it('resolves a piece-unit quantity via the existing seed portion hint (egg = 60g/piece)', async () => {
    const result = await resolveComponentGrams(
      componentWith({ interpretedName: 'Ei', quantity: { value: 2, unit: 'piece' } }),
    );
    expect(result.status).toBe('resolved');
    expect(result.grams).toBe(120);
    expect(result.assumptions).toHaveLength(1);
    expect(result.assumptions[0].gramsPerUnit).toBe(60);
  });

  it('derives the "slice" portion unit from a household-measure phrase (toast = 35g/slice)', async () => {
    const result = await resolveComponentGrams(
      componentWith({
        interpretedName: 'Toast',
        quantity: { value: 2, unit: 'piece', householdMeasure: '2 Scheiben' },
      }),
    );
    expect(result.status).toBe('resolved');
    expect(result.grams).toBe(70);
  });

  it('reports not_convertible for a piece-unit food with no known portion hint (never invents a weight)', async () => {
    const result = await resolveComponentGrams(
      componentWith({
        interpretedName: 'Voellig Unbekanntes Ding',
        quantity: { value: 1, unit: 'piece' },
      }),
    );
    expect(result.status).toBe('not_convertible');
    expect(result.grams).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports not_convertible for "ml" units (no invented density assumption)', async () => {
    const result = await resolveComponentGrams(
      componentWith({ interpretedName: 'Milch', quantity: { value: 200, unit: 'ml' } }),
    );
    expect(result.status).toBe('not_convertible');
    expect(result.grams).toBeNull();
  });

  it('reports not_convertible for a bare portion description with no number', async () => {
    const result = await resolveComponentGrams(
      componentWith({
        interpretedName: 'Butter',
        quantity: { portionDescription: 'ungenannte Menge' },
      }),
    );
    expect(result.status).toBe('not_convertible');
    expect(result.grams).toBeNull();
  });
});
