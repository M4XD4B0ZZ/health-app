import { buildFoodEntryDisplay } from '../journalEntryDisplay';
import type { FoodEntry } from '../../../../features/nutrition';

function foodEntry(overrides: Partial<FoodEntry>): FoodEntry {
  return {
    id: 'entry-1',
    rawInput: 'toast',
    parsedName: 'toast',
    quantityGrams: 0,
    grams: null,
    servingMultiplier: 1,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    confidenceScore: 0.6,
    sourceType: 'generic',
    createdAt: new Date('2026-06-25T12:00:00Z'),
    ...overrides,
  };
}

describe('buildFoodEntryDisplay', () => {
  it('displays count-based tomato entries with German piece label and grams', () => {
    expect(
      buildFoodEntryDisplay(
        foodEntry({ rawInput: '8 tomaten', parsedName: 'tomaten', quantityGrams: 480, grams: 480 }),
      ),
    ).toEqual({
      title: 'Tomaten',
      subtitle: '8 Stück (480 g)',
    });
  });

  it('displays explicit slice entries with German slice label and grams', () => {
    expect(
      buildFoodEntryDisplay(
        foodEntry({
          rawInput: '2 scheiben toast',
          parsedName: 'toast',
          quantityGrams: 70,
          grams: 70,
        }),
      ),
    ).toEqual({
      title: 'Toast',
      subtitle: '2 Scheiben (70 g)',
    });
  });

  it('displays explicit gram entries as grams only', () => {
    expect(
      buildFoodEntryDisplay(
        foodEntry({
          rawInput: '300g karotten',
          parsedName: 'karotten',
          quantityGrams: 300,
          grams: 300,
        }),
      ),
    ).toEqual({
      title: 'Karotten',
      subtitle: '300 g',
    });
  });

  it('displays gram fallback when no count is present', () => {
    expect(
      buildFoodEntryDisplay(
        foodEntry({ rawInput: 'toast', parsedName: 'toast', quantityGrams: 35, grams: 35 }),
      ),
    ).toEqual({
      title: 'Toast',
      subtitle: '35 g',
    });
  });
});
