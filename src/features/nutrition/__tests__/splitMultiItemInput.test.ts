import { splitMultiItemInput } from '../application/utils/splitMultiItemInput';

describe('splitMultiItemInput', () => {
  it('splits German connector "und"', () => {
    const result = splitMultiItemInput('2 Eier und 200g Quark');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['2 Eier', '200g Quark']);
  });

  it('splits English connector "and"', () => {
    const result = splitMultiItemInput('2 eggs and 200g quark');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['2 eggs', '200g quark']);
  });

  it('splits comma-separated items', () => {
    const result = splitMultiItemInput('apple, banana, skyr');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['apple', 'banana', 'skyr']);
  });

  it('splits mixed comma and English connector items', () => {
    const result = splitMultiItemInput('apple, banana and skyr');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['apple', 'banana', 'skyr']);
  });

  it('ignores empty fragments safely', () => {
    const result = splitMultiItemInput('apple, , banana and  skyr');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['apple', 'banana', 'skyr']);
  });

  it('does not split single-item input', () => {
    const result = splitMultiItemInput('20er nuggets');

    expect(result.wasSplit).toBe(false);
    expect(result.items.map((item) => item.rawText)).toEqual(['20er nuggets']);
  });

  describe('P1-003B: Clause-Aware Comma Splitting (Nested "mit"-Lists)', () => {
    it('groups a "mit"-clause with a comma list under a label instead of flat entries', () => {
      const result = splitMultiItemInput('Fruchtsalat mit Bananen, Kirschen');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Bananen', 'Kirschen']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe('Fruchtsalat');
      expect(result.groups[0].children.map((item) => item.rawText)).toEqual([
        'Bananen',
        'Kirschen',
      ]);
    });

    it('keeps flat top-level splitting for comma lists without a "mit"-clause', () => {
      const result = splitMultiItemInput('Apfel, Banane, Joghurt');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Apfel', 'Banane', 'Joghurt']);
      expect(result.groups).toEqual([]);
    });

    it('keeps flat top-level splitting for "und" outside mit-clauses', () => {
      const result = splitMultiItemInput('Ei und Quark');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Ei', 'Quark']);
      expect(result.groups).toEqual([]);
    });

    it('groups a "mit"-clause with a three-item comma list under a label', () => {
      const result = splitMultiItemInput('Wurstsalat mit Zwiebeln, Essig, Öl');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Zwiebeln', 'Essig', 'Öl']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe('Wurstsalat');
      expect(result.groups[0].children).toHaveLength(3);
    });

    it('does not form a group for a "mit"-clause without a comma list (unchanged legacy behavior)', () => {
      const result = splitMultiItemInput('burger mit cola');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['burger', 'cola']);
      expect(result.groups).toEqual([]);
    });

    it('handles a flat top-level item combined with a "mit"-clause group', () => {
      const result = splitMultiItemInput('Ei und Fruchtsalat mit Bananen, Kirschen');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Ei', 'Bananen', 'Kirschen']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe('Fruchtsalat');
    });
  });

  describe('P1-005: Curated Composite-Dish Pattern List', () => {
    it('does not group a "mit"-clause comma list when the head is an ordinary food, not a curated dish', () => {
      const result = splitMultiItemInput('Haehnchen mit Reis, Brokkoli');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Haehnchen', 'Reis', 'Brokkoli']);
      expect(result.groups).toEqual([]);
    });

    it('groups a bare "Auflauf" head (curated pattern used standalone, not just as a compound)', () => {
      const result = splitMultiItemInput('Auflauf mit Quark, Ei');

      expect(result.wasSplit).toBe(true);
      expect(result.items.map((item) => item.rawText)).toEqual(['Quark', 'Ei']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe('Auflauf');
    });

    it('matches a curated head-word case-insensitively', () => {
      const result = splitMultiItemInput('fruchtsalat mit Bananen, Kirschen');

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe('fruchtsalat');
    });

    it('matches a curated head-word with an adjective prefix (last-token match)', () => {
      const result = splitMultiItemInput('Gemischter Fruchtsalat mit Bananen, Kirschen');

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe('Gemischter Fruchtsalat');
      expect(result.items.map((item) => item.rawText)).toEqual(['Bananen', 'Kirschen']);
    });
  });
});
