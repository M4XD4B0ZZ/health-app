import {
  buildFoodEntryDisplay,
  buildGroupQuantitySubtitle,
  buildCanonicalGroupAccessibilityLabel,
  groupJournalEntries,
} from '../journalEntryDisplay';
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

function catalogRef(
  overrides: Partial<NonNullable<FoodEntry['foodCatalogRef']>> = {},
): NonNullable<FoodEntry['foodCatalogRef']> {
  return {
    source: 'bls',
    sourceId: 'egg-raw',
    displayName: 'Eier',
    confidence: 0.75,
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

  describe('J-010: known count portion takes priority over raw-text parsing', () => {
    it('a bare "Ei" (no count word in the raw input) shows "1 Stück (60 g)" when a known count portion exists', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Ei', parsedName: 'ei', quantityGrams: 60, grams: 60 }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Ei',
        subtitle: '1 Stück (60 g)',
      });
    });

    it('"Drei Eier" shows "5 Stück (300 g)" for 300g against a 60g known portion', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Drei Eier', parsedName: 'eier', quantityGrams: 300, grams: 300 }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Eier',
        subtitle: '5 Stück (300 g)',
      });
    });

    it('a known slice portion renders with the German slice label', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'toast', parsedName: 'toast', quantityGrams: 70, grams: 70 }),
          { unit: 'slice', gramsPerUnit: 35 },
        ),
      ).toEqual({
        title: 'Toast',
        subtitle: '2 Scheiben (70 g)',
      });
    });

    it('never invents a count when grams do not divide cleanly by the known gramsPerUnit', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Ei', parsedName: 'ei', quantityGrams: 65, grams: 65 }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Ei',
        subtitle: '65 g',
      });
    });

    it('a known count portion for a different unit/gramsPerUnit overrides the text-parsed count and unit', () => {
      // Raw text says "3 tomaten" (text-parsed: 3 Stück), but the resolved known portion is a
      // slice-type portion at 35g/Scheibe; 105g / 35g = 3 -> the known portion wins.
      expect(
        buildFoodEntryDisplay(
          foodEntry({
            rawInput: '3 tomaten',
            parsedName: 'tomaten',
            quantityGrams: 105,
            grams: 105,
          }),
          { unit: 'slice', gramsPerUnit: 35 },
        ),
      ).toEqual({
        title: 'Tomaten',
        subtitle: '3 Scheiben (105 g)',
      });
    });

    it('without a known count portion, existing text-parsed/grams-only behavior is unchanged', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Ei', parsedName: 'ei', quantityGrams: 60, grams: 60 }),
        ),
      ).toEqual({
        title: 'Ei',
        subtitle: '60 g',
      });
    });

    it('a zero/negative gramsPerUnit known portion is never used (defensive, falls back)', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Ei', parsedName: 'ei', quantityGrams: 60, grams: 60 }),
          { unit: 'piece', gramsPerUnit: 0 },
        ),
      ).toEqual({
        title: 'Ei',
        subtitle: '60 g',
      });
    });
  });

  describe('J-011: explicit gram intent is never overridden by a known count portion', () => {
    it('"300g Karotten" stays "300 g" even though 300 divides cleanly by a known 60g/Stück portion', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({
            rawInput: '300g karotten',
            parsedName: 'karotten',
            quantityGrams: 300,
            grams: 300,
          }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Karotten',
        subtitle: '300 g',
      });
    });

    it('"120g Ei" stays "120 g", not "2 Stück (120 g)"', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: '120g Ei', parsedName: 'ei', quantityGrams: 120, grams: 120 }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Ei',
        subtitle: '120 g',
      });
    });

    it('a bare "Ei" (no explicit grams in the raw input) still shows "1 Stück (60 g)" — the known-count path is unaffected', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Ei', parsedName: 'ei', quantityGrams: 60, grams: 60 }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Ei',
        subtitle: '1 Stück (60 g)',
      });
    });

    it('"Drei Eier" (count-worded text, no explicit grams) still shows "3 Stück (180 g)"', () => {
      expect(
        buildFoodEntryDisplay(
          foodEntry({ rawInput: 'Drei Eier', parsedName: 'eier', quantityGrams: 180, grams: 180 }),
          { unit: 'piece', gramsPerUnit: 60 },
        ),
      ).toEqual({
        title: 'Eier',
        subtitle: '3 Stück (180 g)',
      });
    });

    it('an explicit-gram entry with no known count portion at all is unaffected (pre-existing behavior)', () => {
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

  describe('J-009: canonical-identity grouping', () => {
    it('groups entries sharing the same canonical food identity, singular/plural raw text included', () => {
      const ei = foodEntry({
        id: 'e1',
        rawInput: 'Ei',
        parsedName: 'ei',
        calories: 82.2,
        protein: 7,
        carbs: 1,
        fat: 6,
        grams: 60,
        quantityGrams: 60,
        foodCatalogRef: catalogRef(),
      });
      const einEi = foodEntry({
        id: 'e2',
        rawInput: 'Ein Ei',
        parsedName: 'ei',
        calories: 82.2,
        protein: 7,
        carbs: 1,
        fat: 6,
        grams: 60,
        quantityGrams: 60,
        foodCatalogRef: catalogRef(),
      });
      const dreiEier = foodEntry({
        id: 'e3',
        rawInput: 'Drei Eier',
        parsedName: 'eier',
        calories: 246.6,
        protein: 21,
        carbs: 3,
        fat: 18,
        grams: 180,
        quantityGrams: 180,
        foodCatalogRef: catalogRef(),
      });

      const result = groupJournalEntries([ei, einEi, dreiEier]);

      expect(result).toHaveLength(1);
      const [group] = result;
      expect(group.kind).toBe('group');
      if (group.kind !== 'group') throw new Error('expected group');
      expect(group.groupKind).toBe('canonical');
      expect(group.label).toBe('Eier');
      // Exact calorie/macro aggregation (requirement 9 / 12): the sum of the three children,
      // no independent recalculation — matches the dogfooding report's 411 kcal exactly.
      expect(group.totalCalories).toBeCloseTo(411);
      expect(group.totalProtein).toBe(35);
      expect(group.totalCarbs).toBe(5);
      expect(group.totalFat).toBe(30);
      // Requirement 10: children stay in original chronological order.
      expect(group.children).toEqual([ei, einEi, dreiEier]);
    });

    it('does not group entries that share a display label but have different canonical identities', () => {
      const eggA = foodEntry({
        id: 'e1',
        rawInput: 'Ei',
        foodCatalogRef: catalogRef({ source: 'bls', sourceId: 'egg-raw', displayName: 'Ei' }),
      });
      const eggB = foodEntry({
        id: 'e2',
        rawInput: 'Ei',
        foodCatalogRef: catalogRef({
          source: 'off',
          sourceId: 'some-other-egg-product',
          displayName: 'Ei',
        }),
      });

      const result = groupJournalEntries([eggA, eggB]);

      expect(result).toEqual([
        { kind: 'entry', entry: eggA },
        { kind: 'entry', entry: eggB },
      ]);
    });

    it('entries without a usable foodCatalogRef never join a canonical group (decision 6 safe default)', () => {
      const unmatchedA = foodEntry({ id: 'e1', rawInput: 'Ei' });
      const unmatchedB = foodEntry({ id: 'e2', rawInput: 'Ei' });

      const result = groupJournalEntries([unmatchedA, unmatchedB]);

      expect(result).toEqual([
        { kind: 'entry', entry: unmatchedA },
        { kind: 'entry', entry: unmatchedB },
      ]);
    });

    it('a single matching identity stays a leaf — a canonical group needs at least two members', () => {
      const soloEi = foodEntry({ id: 'e1', rawInput: 'Ei', foodCatalogRef: catalogRef() });

      const result = groupJournalEntries([soloEi]);

      expect(result).toEqual([{ kind: 'entry', entry: soloEi }]);
    });

    it('the group is positioned at its newest (chronologically last) member, not its first', () => {
      const ei1 = foodEntry({ id: 'e1', rawInput: 'Ei', foodCatalogRef: catalogRef() });
      const banane = foodEntry({ id: 'e2', rawInput: 'Banane' });
      const ei2 = foodEntry({ id: 'e3', rawInput: 'Ei', foodCatalogRef: catalogRef() });
      const quark = foodEntry({ id: 'e4', rawInput: 'Quark' });

      const result = groupJournalEntries([ei1, banane, ei2, quark]);

      // banane (leaf), then the Eier group (at ei2's position), then quark (leaf) — the group
      // does not appear at ei1's earlier position, so a newly logged item is visible where it
      // was just added rather than seeming to vanish into the older slot.
      expect(result.map((item) => item.kind)).toEqual(['entry', 'group', 'entry']);
      const bananeLeaf = result[0];
      if (bananeLeaf.kind !== 'entry') throw new Error('expected leaf');
      expect(bananeLeaf.entry.id).toBe('e2');
      const group = result[1];
      if (group.kind !== 'group') throw new Error('expected group');
      expect(group.children.map((c) => c.id)).toEqual(['e1', 'e3']);
      const quarkLeaf = result[2];
      if (quarkLeaf.kind !== 'entry') throw new Error('expected leaf');
      expect(quarkLeaf.entry.id).toBe('e4');
    });

    it('deleting a child down to one remaining match dissolves the group back into a leaf', () => {
      const ei1 = foodEntry({ id: 'e1', rawInput: 'Ei', foodCatalogRef: catalogRef() });
      const ei2 = foodEntry({ id: 'e2', rawInput: 'Ei', foodCatalogRef: catalogRef() });

      expect(groupJournalEntries([ei1, ei2])[0].kind).toBe('group');

      // Simulates the post-delete reload: groupJournalEntries is pure and re-derives from
      // whatever entries are passed, so removing ei2 from the input is exactly what a reload
      // after deleting it produces — no separate "ungroup" logic needed.
      const afterDeletingOne = groupJournalEntries([ei1]);
      expect(afterDeletingOne).toEqual([{ kind: 'entry', entry: ei1 }]);
    });

    it('an identity-changing edit regroups correctly on the next pass', () => {
      const eiA1 = foodEntry({
        id: 'e1',
        rawInput: 'Ei',
        foodCatalogRef: catalogRef({ source: 'bls', sourceId: 'egg-a' }),
      });
      const eiA2 = foodEntry({
        id: 'e2',
        rawInput: 'Ei',
        foodCatalogRef: catalogRef({ source: 'bls', sourceId: 'egg-a' }),
      });

      const beforeEdit = groupJournalEntries([eiA1, eiA2]);
      expect(beforeEdit).toHaveLength(1);
      expect(beforeEdit[0].kind).toBe('group');

      // Simulates the post-edit reload: e2's identity changed to a different canonical food.
      const eiA1Unchanged = eiA1;
      const editedEntry = foodEntry({
        id: 'e2',
        rawInput: 'Karotte',
        foodCatalogRef: catalogRef({ source: 'bls', sourceId: 'carrot', displayName: 'Karotten' }),
      });

      const afterEdit = groupJournalEntries([eiA1Unchanged, editedEntry]);
      expect(afterEdit).toEqual([
        { kind: 'entry', entry: eiA1Unchanged },
        { kind: 'entry', entry: editedEntry },
      ]);
    });

    it('composite-dish groups are unaffected by the canonical-identity pass', () => {
      const bananen = foodEntry({
        id: 'e1',
        rawInput: 'bananen',
        groupId: 'g1',
        groupLabel: 'fruchtsalat',
      });
      const kirschen = foodEntry({
        id: 'e2',
        rawInput: 'kirschen',
        groupId: 'g1',
        groupLabel: 'fruchtsalat',
      });

      const result = groupJournalEntries([bananen, kirschen]);

      expect(result).toHaveLength(1);
      const [group] = result;
      if (group.kind !== 'group') throw new Error('expected group');
      expect(group.groupKind).toBe('composite');
    });

    it('canonical group totals are exact, clean decimals — no binary floating-point summation noise', () => {
      // 82.2 + 164.4 sums to 246.60000000000002 in raw JS float arithmetic; the group total
      // must render as the exact 246.6, not that noise (live-verified against expo web too).
      const first = foodEntry({
        id: 'e1',
        rawInput: '1 Ei',
        calories: 82.2,
        foodCatalogRef: catalogRef(),
      });
      const second = foodEntry({
        id: 'e2',
        rawInput: '120g Ei',
        calories: 164.4,
        foodCatalogRef: catalogRef(),
      });

      const result = groupJournalEntries([first, second]);

      expect(result).toHaveLength(1);
      const [group] = result;
      if (group.kind !== 'group') throw new Error('expected group');
      expect(group.totalCalories).toBe(246.6);
    });
  });

  describe('J-012: user-friendly canonical group title', () => {
    function eggChild(id: string, parsedName: 'ei' | 'eier', overrides: Partial<FoodEntry> = {}) {
      return foodEntry({
        id,
        rawInput: parsedName,
        parsedName,
        foodCatalogRef: catalogRef({ displayName: 'Huehnerei ganz roh' }),
        ...overrides,
      });
    }

    function groupLabel(entries: FoodEntry[]): string {
      const result = groupJournalEntries(entries);
      const group = result.find((item) => item.kind === 'group');
      if (!group || group.kind !== 'group') throw new Error('expected a group');
      return group.label;
    }

    it('prefers the friendly existing German name over the raw catalog display string', () => {
      const label = groupLabel([
        eggChild('e1', 'ei'),
        eggChild('e2', 'ei'),
        eggChild('e3', 'eier'),
      ]);

      expect(label).toBe('Eier');
      expect(label).not.toBe('Huehnerei ganz roh');
    });

    it('falls back to the raw catalog display name when a member has no friendly name in the existing dictionary', () => {
      const unresolved = foodEntry({
        id: 'e2',
        rawInput: 'zorbfrucht',
        parsedName: 'zorbfrucht',
        foodCatalogRef: catalogRef({ displayName: 'Huehnerei ganz roh' }),
      });

      const label = groupLabel([eggChild('e1', 'ei'), unresolved]);

      expect(label).toBe('Huehnerei ganz roh');
    });

    it('is not egg-specific: the same data-driven rule prefers a longer existing alias for another food', () => {
      const banane = (id: string, parsedName: 'banane' | 'bananen') =>
        foodEntry({
          id,
          rawInput: parsedName,
          parsedName,
          foodCatalogRef: catalogRef({
            source: 'bls',
            sourceId: 'banana-raw',
            displayName: 'Banane roh',
          }),
        });

      const label = groupLabel([banane('e1', 'banane'), banane('e2', 'bananen')]);

      expect(label).toBe('Bananen');
    });

    it('does not introduce a hard-coded food-specific branch — an unmapped food still falls back safely', () => {
      const first = foodEntry({
        id: 'e1',
        rawInput: 'zorbfrucht',
        parsedName: 'zorbfrucht',
        foodCatalogRef: catalogRef({
          source: 'bls',
          sourceId: 'zorbfrucht',
          displayName: 'Zorbfrucht Katalogeintrag',
        }),
      });
      const second = foodEntry({
        id: 'e2',
        rawInput: 'zorbfrucht',
        parsedName: 'zorbfrucht',
        foodCatalogRef: catalogRef({
          source: 'bls',
          sourceId: 'zorbfrucht',
          displayName: 'Zorbfrucht Katalogeintrag',
        }),
      });

      expect(groupLabel([first, second])).toBe('Zorbfrucht Katalogeintrag');
    });

    it('remains stable when the child order changes', () => {
      const a = eggChild('e1', 'ei');
      const b = eggChild('e2', 'ei');
      const c = eggChild('e3', 'eier');

      expect(groupLabel([a, b, c])).toBe(groupLabel([c, a, b]));
    });

    it('remains stable when the newest child (the one carrying the plural raw text) is deleted', () => {
      const a = eggChild('e1', 'ei');
      const b = eggChild('e2', 'ei');
      const c = eggChild('e3', 'eier');

      const beforeDelete = groupLabel([a, b, c]);
      // Simulates the post-delete reload: only the two singular-labelled children remain, yet
      // the title must stay "Eier" — it is a property of the shared canonical identity, never
      // of which individual child happened to type the plural.
      const afterDeletingNewest = groupLabel([a, b]);

      expect(beforeDelete).toBe('Eier');
      expect(afterDeletingNewest).toBe('Eier');
    });

    it('remains stable after a child quantity edit', () => {
      const a = eggChild('e1', 'ei', { grams: 60, quantityGrams: 60 });
      const b = eggChild('e2', 'ei', { grams: 60, quantityGrams: 60 });

      const before = groupLabel([a, b]);
      const editedA = { ...a, grams: 120, quantityGrams: 120 };
      const after = groupLabel([editedA, b]);

      expect(before).toBe(after);
    });
  });
});

describe('buildGroupQuantitySubtitle', () => {
  it('aggregates a homogeneous known count into one combined "Stück" figure', () => {
    // "Ei" + "Ein Ei" + "Drei Eier" -> 5 Stück (300 g), the plan's canonical example.
    const ei = foodEntry({ id: 'e1', rawInput: 'Ei', grams: 60, quantityGrams: 60 });
    const einEi = foodEntry({ id: 'e2', rawInput: 'Ein Ei', grams: 60, quantityGrams: 60 });
    const dreiEier = foodEntry({ id: 'e3', rawInput: 'Drei Eier', grams: 180, quantityGrams: 180 });

    const resolvePortion = () => ({ unit: 'piece' as const, gramsPerUnit: 60 });

    expect(buildGroupQuantitySubtitle([ei, einEi, dreiEier], resolvePortion)).toBe(
      '5 Stück (300 g)',
    );
  });

  it('falls back to grams-only when one child is an explicit-gram entry (never inferring a count backwards)', () => {
    // "1 Ei" + "120g Ei" -> 180 g, not 3 Stück (requirement 13's named example).
    const oneEi = foodEntry({ id: 'e1', rawInput: '1 Ei', grams: 60, quantityGrams: 60 });
    const explicitGramsEi = foodEntry({
      id: 'e2',
      rawInput: '120g Ei',
      grams: 120,
      quantityGrams: 120,
    });

    const resolvePortion = () => ({ unit: 'piece' as const, gramsPerUnit: 60 });

    expect(buildGroupQuantitySubtitle([oneEi, explicitGramsEi], resolvePortion)).toBe('180 g');
  });

  it('falls back to grams-only when children resolve to incompatible units (never a misleading combined count)', () => {
    const eiPiece = foodEntry({ id: 'e1', rawInput: 'Ei', grams: 60, quantityGrams: 60 });
    const toastSlice = foodEntry({ id: 'e2', rawInput: 'Toast', grams: 35, quantityGrams: 35 });

    const resolvePortion = (entry: FoodEntry) =>
      entry.id === 'e1'
        ? { unit: 'piece' as const, gramsPerUnit: 60 }
        : { unit: 'slice' as const, gramsPerUnit: 35 };

    expect(buildGroupQuantitySubtitle([eiPiece, toastSlice], resolvePortion)).toBe('95 g');
  });

  it('aggregates compatible slice entries as "Scheiben"', () => {
    const slice1 = foodEntry({ id: 'e1', rawInput: 'Toast', grams: 35, quantityGrams: 35 });
    const slice2 = foodEntry({ id: 'e2', rawInput: 'Toast', grams: 35, quantityGrams: 35 });

    const resolvePortion = () => ({ unit: 'slice' as const, gramsPerUnit: 35 });

    expect(buildGroupQuantitySubtitle([slice1, slice2], resolvePortion)).toBe('2 Scheiben (70 g)');
  });

  it('sums grams for gram-only entries with no known count portion at all', () => {
    const g1 = foodEntry({ id: 'e1', rawInput: '150g Karotten', grams: 150, quantityGrams: 150 });
    const g2 = foodEntry({ id: 'e2', rawInput: '150g Karotten', grams: 150, quantityGrams: 150 });

    expect(buildGroupQuantitySubtitle([g1, g2], () => undefined)).toBe('300 g');
  });
});

describe('J-012: buildCanonicalGroupAccessibilityLabel', () => {
  it('includes title, aggregate quantity, rounded calories, collapsed state and the open action', () => {
    expect(buildCanonicalGroupAccessibilityLabel('Eier', '5 Stück (300 g)', 411, false)).toBe(
      'Eier, 5 Stück (300 g), 411 Kilokalorien, eingeklappt. Zum Öffnen doppeltippen.',
    );
  });

  it('reflects the expanded state and the close action', () => {
    expect(buildCanonicalGroupAccessibilityLabel('Eier', '5 Stück (300 g)', 411, true)).toBe(
      'Eier, 5 Stück (300 g), 411 Kilokalorien, aufgeklappt. Zum Schließen doppeltippen.',
    );
  });

  it('omits the quantity clause when no quantity subtitle is available', () => {
    expect(buildCanonicalGroupAccessibilityLabel('Eier', undefined, 411, false)).toBe(
      'Eier, 411 Kilokalorien, eingeklappt. Zum Öffnen doppeltippen.',
    );
  });

  it('rounds a fractional calorie total for the spoken value', () => {
    expect(buildCanonicalGroupAccessibilityLabel('Eier', '2 Stück (120 g)', 246.6, false)).toBe(
      'Eier, 2 Stück (120 g), 247 Kilokalorien, eingeklappt. Zum Öffnen doppeltippen.',
    );
  });
});
