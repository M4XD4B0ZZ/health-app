import {
  templateTotalCalories,
  buildSavedMealComposition,
  formatSavedMealSummary,
  formatSavedMealPreview,
} from '../savedMealsDisplay';
import {
  SavedMealTemplate,
  SavedMealItem,
} from '../../../../features/nutrition/domain/models/SavedMealTypes';
import type { KnownCountPortion } from '../../journal/journalEntryDisplay';

const baseTemplate = (items: SavedMealItem[] = []): SavedMealTemplate => ({
  id: 't1',
  name: 'Lunch',
  items,
  createdAt: new Date('2024-01-10T10:00:00Z'),
  updatedAt: new Date('2024-01-10T10:00:00Z'),
});

describe('templateTotalCalories', () => {
  it('returns null when no item has a per100g snapshot', () => {
    expect(
      templateTotalCalories(baseTemplate([{ parsedName: 'banana', quantityGrams: 100 }])),
    ).toBeNull();
  });

  it('sums calories from items that have a per100g snapshot', () => {
    const template = baseTemplate([
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
    ]);
    expect(templateTotalCalories(template)).toBe(525);
  });

  it('returns null for a template with no items', () => {
    expect(templateTotalCalories(baseTemplate())).toBeNull();
  });
});

describe('SM-008 buildSavedMealComposition', () => {
  const eggPer100g = { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 };
  const eggRef = {
    source: 'bls' as const,
    sourceId: 'egg',
    displayName: 'Huehnerei ganz roh',
    confidence: 0.9,
  };
  const eggItem = (grams: number): SavedMealItem => ({
    parsedName: 'ei',
    quantityGrams: grams,
    foodCatalogRef: eggRef,
    per100g: eggPer100g,
  });
  const quarkRef = {
    source: 'bls' as const,
    sourceId: 'quark',
    displayName: 'Magerquark',
    confidence: 0.8,
  };
  const quarkItem = (grams: number): SavedMealItem => ({
    parsedName: 'magerquark',
    quantityGrams: grams,
    foodCatalogRef: quarkRef,
    per100g: { calories: 66, protein: 12, carbs: 4, fat: 0.2 },
  });

  // Only eggs have a known piece portion (60 g); everything else has none.
  const resolvePortion = (item: SavedMealItem): KnownCountPortion | undefined =>
    item.foodCatalogRef?.sourceId === 'egg' ? { unit: 'piece', gramsPerUnit: 60 } : undefined;

  it('three egg events, one canonical food → 1 Lebensmittel, aggregated 7 Stück (420 g)', () => {
    const template = baseTemplate([eggItem(60), eggItem(60), eggItem(300)]);
    const c = buildSavedMealComposition(template, resolvePortion);

    expect(c.uniqueFoodCount).toBe(1);
    expect(c.groups).toHaveLength(1);
    expect(c.groups[0].name).toBe('Ei');
    expect(c.groups[0].grams).toBe(420);
    expect(c.groups[0].quantityLabel).toBe('7 Stück (420 g)');
    // calories == underlying sum: 143 * 420 / 100 = 600.6 → 601
    expect(c.groups[0].calories).toBe(601);
    expect(c.totalCalories).toBeCloseTo((143 * 420) / 100, 5);
    expect(formatSavedMealSummary(c)).toBe('1 Lebensmittel · ~601 kcal');
    expect(formatSavedMealPreview(c)).toBe('Ei · 7 Stück (420 g)');
  });

  it('never says „3 Zutaten" for three stored events of one food', () => {
    const c = buildSavedMealComposition(
      baseTemplate([eggItem(60), eggItem(60), eggItem(300)]),
      resolvePortion,
    );
    expect(formatSavedMealSummary(c).startsWith('1 Lebensmittel')).toBe(true);
    expect(formatSavedMealSummary(c)).not.toContain('Zutat');
  });

  it('gram-only food with no known portion stays grams-only (no reverse count inference)', () => {
    const c = buildSavedMealComposition(
      baseTemplate([quarkItem(200), quarkItem(100)]),
      resolvePortion,
    );
    expect(c.groups).toHaveLength(1);
    expect(c.groups[0].quantityLabel).toBe('300 g');
  });

  it('mixed clean/unclean grams for the same canonical food → grams-only (no invented count)', () => {
    // 60 g divides cleanly by 60, 50 g does not → the group must not claim a count.
    const c = buildSavedMealComposition(baseTemplate([eggItem(60), eggItem(50)]), resolvePortion);
    expect(c.groups[0].quantityLabel).toBe('110 g');
  });

  it('multiple distinct foods → correct unique count, first-member ordering, total calories', () => {
    const template = baseTemplate([eggItem(120), quarkItem(200), eggItem(60)]);
    const c = buildSavedMealComposition(template, resolvePortion);

    expect(c.uniqueFoodCount).toBe(2);
    expect(c.groups.map((g) => g.name)).toEqual(['Ei', 'Magerquark']); // egg first (index 0)
    expect(c.groups[0].quantityLabel).toBe('3 Stück (180 g)'); // 120 + 60
    expect(c.groups[1].quantityLabel).toBe('200 g');
    // total = eggs (143*180/100=257.4) + quark (66*200/100=132) = 389.4
    expect(c.totalCalories).toBeCloseTo(143 * 1.8 + 66 * 2, 5);
  });

  it('same visible label but different foodCatalogRef stays separate', () => {
    const a: SavedMealItem = {
      parsedName: 'ei',
      quantityGrams: 60,
      foodCatalogRef: { ...eggRef, sourceId: 'egg-a' },
    };
    const b: SavedMealItem = {
      parsedName: 'ei',
      quantityGrams: 60,
      foodCatalogRef: { ...eggRef, sourceId: 'egg-b' },
    };
    const c = buildSavedMealComposition(baseTemplate([a, b]), resolvePortion);
    expect(c.uniqueFoodCount).toBe(2);
  });

  it('items without a foodCatalogRef are never name-merged', () => {
    const a: SavedMealItem = { parsedName: 'mystery', quantityGrams: 100 };
    const b: SavedMealItem = { parsedName: 'mystery', quantityGrams: 100 };
    const c = buildSavedMealComposition(baseTemplate([a, b]), resolvePortion);
    expect(c.uniqueFoodCount).toBe(2);
  });

  it('is deterministic across runs', () => {
    const template = baseTemplate([eggItem(60), quarkItem(200), eggItem(60)]);
    expect(buildSavedMealComposition(template, resolvePortion)).toEqual(
      buildSavedMealComposition(template, resolvePortion),
    );
  });

  it('produces no floating-point display artifacts in the grams label', () => {
    // 0.1 + 0.2 style sums are rounded by formatNumber to one decimal.
    const c = buildSavedMealComposition(
      baseTemplate([quarkItem(0.1), quarkItem(0.2)]),
      resolvePortion,
    );
    expect(c.groups[0].quantityLabel).toBe('0,3 g');
  });

  it('empty template → 0 Lebensmittel, no groups', () => {
    const c = buildSavedMealComposition(baseTemplate([]), resolvePortion);
    expect(c.uniqueFoodCount).toBe(0);
    expect(c.groups).toEqual([]);
    expect(formatSavedMealSummary(c)).toBe('0 Lebensmittel');
  });
});
