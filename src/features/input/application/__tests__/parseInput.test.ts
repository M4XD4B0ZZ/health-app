import { parseInput } from '../parseInput';

describe('parseInput', () => {
  it("should parse '2 Eier und Toast' correctly", () => {
    const result = parseInput('2 Eier und Toast');

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('eier');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[1].name).toBe('toast');
  });

  it.each([
    ['300g toast', 300, 'g'],
    ['300 gramm toast', 300, 'g'],
    ['1 scheibe toast', 1, 'slice'],
    ['eine scheibe toast', 1, 'slice'],
    ['2 scheiben toast', 2, 'slice'],
    ['zwei scheiben toast', 2, 'slice'],
    ['1 stück toast', 1, 'piece'],
    ['2 pieces toast', 2, 'piece'],
  ])('should parse portion unit input %s', (input, quantity, unit) => {
    const result = parseInput(input);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      name: 'toast',
      quantity,
      unit,
      rawText: input,
    });
  });

  it.each([
    ['ei und quark'],
    ['ei mit quark'],
    ['ei, quark'],
    ['egg and quark'],
    ['egg with quark'],
  ])('should parse P1-003 connector input %s as two items', (input) => {
    const result = parseInput(input);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe(input.startsWith('egg') ? 'egg' : 'ei');
    expect(result.items[1].name).toBe('quark');
  });

  describe('P1-003: number-word normalization across split items', () => {
    it('normalizes a German number word per item after "und"-splitting', () => {
      const result = parseInput('zwei eier und drei bananen');

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        name: 'eier',
        quantity: 2,
        unit: null,
        rawText: 'zwei eier',
      });
      expect(result.items[1]).toEqual({
        name: 'bananen',
        quantity: 3,
        unit: null,
        rawText: 'drei bananen',
      });
    });

    it('normalizes a German number word with unit per item after comma-splitting', () => {
      const result = parseInput('eine scheibe toast, zwei scheiben käse');

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        name: 'toast',
        quantity: 1,
        unit: 'slice',
        rawText: 'eine scheibe toast',
      });
      expect(result.items[1]).toEqual({
        name: 'käse',
        quantity: 2,
        unit: 'slice',
        rawText: 'zwei scheiben käse',
      });
    });
  });

  describe('P1-003C: composite-dish label grouping', () => {
    it('groups children under a shared groupId/groupLabel and excludes the label itself', () => {
      const result = parseInput('Fruchtsalat mit Bananen, Kirschen');

      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.name)).toEqual(['bananen', 'kirschen']);
      expect(result.items.every((item) => item.name !== 'fruchtsalat')).toBe(true);

      const [bananen, kirschen] = result.items;
      expect(bananen.groupId).toBeDefined();
      expect(bananen.groupId).toBe(kirschen.groupId);
      expect(bananen.groupLabel).toBe('Fruchtsalat');
      expect(kirschen.groupLabel).toBe('Fruchtsalat');
    });

    it('does not attach group metadata to flat items outside a mit-clause', () => {
      const result = parseInput('Apfel, Banane, Joghurt');

      expect(result.items).toHaveLength(3);
      result.items.forEach((item) => {
        expect(item.groupId).toBeUndefined();
        expect(item.groupLabel).toBeUndefined();
      });
    });

    it('does not group a single "mit"-object without a comma list', () => {
      const result = parseInput('burger mit cola');

      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.name)).toEqual(['burger', 'cola']);
      result.items.forEach((item) => {
        expect(item.groupId).toBeUndefined();
      });
    });

    it('assigns different groupIds to two separate mit-clause groups', () => {
      const result = parseInput(
        'Fruchtsalat mit Bananen, Kirschen und Wurstsalat mit Zwiebeln, Essig',
      );

      expect(result.items).toHaveLength(4);
      const groupIds = new Set(result.items.map((item) => item.groupId));
      expect(groupIds.size).toBe(2);
    });
  });
});
