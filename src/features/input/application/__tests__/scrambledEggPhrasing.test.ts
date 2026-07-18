import { parseInput } from '../parseInput';
import { resolvePortionGrams } from '../../../nutrition/domain/portion/resolvePortionGrams';

/**
 * P1-006: common German scrambled-egg phrasing must resolve to exactly the stated number of
 * eggs — no invented butter/oil/milk — by rewriting to the same tuple a plain „N Eier" produces.
 */
const items = (raw: string) => parseInput(raw).items;

describe('P1-006 scrambled-egg phrasing', () => {
  it.each([
    ['Rührei aus 2 Eiern', 2, 'eier'],
    ['Rührei aus zwei Eiern', 2, 'eier'],
    ['Rührei von zwei Eiern', 2, 'eier'],
    ['2 Rühreier', 2, 'eier'],
    ['Rührei aus 3 Eiern', 3, 'eier'],
    ['Rührei aus drei Eiern', 3, 'eier'],
    ['Rührei aus 1 Ei', 1, 'ei'],
    ['Rührei von einem Ei', 1, 'ei'],
  ])('"%s" → exactly %i eggs (%s), nothing else invented', (raw, count, name) => {
    const parsed = items(raw as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ name, quantity: count, unit: null });
    const joined = parsed.map((p) => p.name).join(' ');
    for (const fat of ['butter', 'öl', 'oel', 'milch', 'sahne', 'creme']) {
      expect(joined).not.toContain(fat);
    }
  });

  it('is nutritionally identical to a plain „N Eier" (same tuple → same downstream path)', () => {
    expect(items('Rührei aus 2 Eiern')[0]).toMatchObject({ name: 'eier', quantity: 2, unit: null });
    expect(items('2 Eier')[0]).toMatchObject({ name: 'eier', quantity: 2, unit: null });
  });

  it('two eggs resolve to exactly 2× the known egg portion (120 g)', async () => {
    const p = items('Rührei aus 2 Eiern')[0];
    const grams = await resolvePortionGrams(p.name, 0, p.quantity ?? undefined, {
      unit: p.unit ?? undefined,
    });
    expect(grams).toMatchObject({ status: 'resolved', grams: 120 });
  });

  it('one egg resolves to exactly one egg portion (60 g)', async () => {
    const p = items('Rührei aus 1 Ei')[0];
    const grams = await resolvePortionGrams(p.name, 0, p.quantity ?? undefined, {
      unit: p.unit ?? undefined,
    });
    expect(grams).toMatchObject({ status: 'resolved', grams: 60 });
  });

  it('„Rührei aus 2 Eiern mit 10 g Butter" → 2 eggs + 10 g butter, each exactly once', () => {
    const parsed = items('Rührei aus 2 Eiern mit 10 g Butter');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ name: 'eier', quantity: 2, unit: null });
    expect(parsed[1]).toMatchObject({ name: 'butter', quantity: 10, unit: 'g' });
  });

  it('bare „Rührei" is left unchanged (no egg-count rewrite → existing default behavior)', () => {
    expect(items('Rührei')[0]).toMatchObject({ name: 'rührei', quantity: null });
  });

  it('is deterministic across repeated parses', () => {
    expect(items('Rührei von zwei Eiern')).toEqual(items('Rührei von zwei Eiern'));
  });

  describe('regressions (unchanged behavior)', () => {
    it('„2 Eier"', () => {
      expect(items('2 Eier')[0]).toMatchObject({ name: 'eier', quantity: 2 });
    });
    it('„ein Ei"', () => {
      expect(items('ein Ei')[0]).toMatchObject({ name: 'ei', quantity: 1 });
    });
    it('„Toast mit Butter" still splits into two flat items', () => {
      expect(items('Toast mit Butter').map((p) => p.name)).toEqual(['toast', 'butter']);
    });
    it('„2 Scheiben Toast mit Butter" keeps slice unit + butter', () => {
      const parsed = items('2 Scheiben Toast mit Butter');
      expect(parsed[0]).toMatchObject({ name: 'toast', quantity: 2, unit: 'slice' });
      expect(parsed[1]).toMatchObject({ name: 'butter' });
    });
  });
});
