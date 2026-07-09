import { buildFoodEntryDisplay, groupJournalEntries } from '../journalEntryDisplay';
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

describe('groupJournalEntries', () => {
  it('groups children sharing a groupId under one JournalEntryGroup with summed macros', () => {
    const bananen = foodEntry({
      id: 'e1',
      rawInput: 'bananen',
      parsedName: 'bananen',
      calories: 100,
      protein: 1,
      carbs: 20,
      fat: 0.5,
      groupId: 'g1',
      groupLabel: 'fruchtsalat',
    });
    const kirschen = foodEntry({
      id: 'e2',
      rawInput: 'kirschen',
      parsedName: 'kirschen',
      calories: 50,
      protein: 1,
      carbs: 12,
      fat: 0.2,
      groupId: 'g1',
      groupLabel: 'fruchtsalat',
    });

    const result = groupJournalEntries([bananen, kirschen]);

    expect(result).toHaveLength(1);
    const group = result[0];
    expect(group.kind).toBe('group');
    if (group.kind !== 'group') throw new Error('expected group');
    expect(group.groupId).toBe('g1');
    expect(group.label).toBe('Fruchtsalat');
    expect(group.children).toEqual([bananen, kirschen]);
    expect(group.totalCalories).toBe(150);
    expect(group.totalProtein).toBe(2);
    expect(group.totalCarbs).toBe(32);
    expect(group.totalFat).toBeCloseTo(0.7);
  });

  it('passes through ungrouped entries as leaves in original order', () => {
    const apfel = foodEntry({ id: 'e1', rawInput: 'apfel' });
    const banane = foodEntry({ id: 'e2', rawInput: 'banane' });

    const result = groupJournalEntries([apfel, banane]);

    expect(result).toEqual([
      { kind: 'entry', entry: apfel },
      { kind: 'entry', entry: banane },
    ]);
  });

  it('interleaves a group with flat entries at the position of the first child', () => {
    const ei = foodEntry({ id: 'e1', rawInput: 'ei' });
    const bananen = foodEntry({
      id: 'e2',
      rawInput: 'bananen',
      groupId: 'g1',
      groupLabel: 'fruchtsalat',
    });
    const kirschen = foodEntry({
      id: 'e3',
      rawInput: 'kirschen',
      groupId: 'g1',
      groupLabel: 'fruchtsalat',
    });
    const quark = foodEntry({ id: 'e4', rawInput: 'quark' });

    const result = groupJournalEntries([ei, bananen, kirschen, quark]);

    expect(result.map((item) => item.kind)).toEqual(['entry', 'group', 'entry']);
  });

  it('the group disappears once its last child is removed (nothing left to group)', () => {
    const bananen = foodEntry({
      id: 'e1',
      rawInput: 'bananen',
      groupId: 'g1',
      groupLabel: 'fruchtsalat',
    });

    const withChild = groupJournalEntries([bananen]);
    expect(withChild).toHaveLength(1);

    const afterDeletingLastChild = groupJournalEntries([]);
    expect(afterDeletingLastChild).toHaveLength(0);
  });
});
