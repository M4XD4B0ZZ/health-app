import { templateTotalCalories } from '../savedMealsDisplay';
import { SavedMealTemplate } from '../../../../features/nutrition/domain/models/SavedMealTypes';

describe('templateTotalCalories', () => {
  const baseTemplate = (): SavedMealTemplate => ({
    id: 't1',
    name: 'Lunch',
    items: [],
    createdAt: new Date('2024-01-10T10:00:00Z'),
    updatedAt: new Date('2024-01-10T10:00:00Z'),
  });

  it('returns null when no item has a per100g snapshot', () => {
    const template: SavedMealTemplate = {
      ...baseTemplate(),
      items: [{ parsedName: 'banana', quantityGrams: 100 }],
    };

    expect(templateTotalCalories(template)).toBeNull();
  });

  it('sums calories from items that have a per100g snapshot', () => {
    const template: SavedMealTemplate = {
      ...baseTemplate(),
      items: [
        {
          parsedName: 'chicken',
          quantityGrams: 200,
          per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        },
        {
          parsedName: 'rice',
          quantityGrams: 150,
          per100g: { calories: 130, protein: 2.8, carbs: 28, fat: 0.3 },
        },
      ],
    };

    // 200g * 165/100 = 330, 150g * 130/100 = 195 -> 525
    expect(templateTotalCalories(template)).toBe(525);
  });

  it('skips items without a per100g snapshot when summing', () => {
    const template: SavedMealTemplate = {
      ...baseTemplate(),
      items: [
        {
          parsedName: 'chicken',
          quantityGrams: 200,
          per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        },
        { parsedName: 'legacy-item', quantityGrams: 100 },
      ],
    };

    expect(templateTotalCalories(template)).toBe(330);
  });

  it('returns null for a template with no items', () => {
    expect(templateTotalCalories(baseTemplate())).toBeNull();
  });
});
