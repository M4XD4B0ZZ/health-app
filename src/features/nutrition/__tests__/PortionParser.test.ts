import { PortionParser } from '../domain/portion/PortionParser';

describe('PortionParser', () => {
  const parser = new PortionParser();

  it('parses grams: "200g"', () => {
    const result = parser.parse('200g', { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.grams).toBe(200);
  });

  it('parses kg: "0,5 kg"', () => {
    const result = parser.parse('0,5 kg', { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.grams).toBe(500);
  });

  it('parses multiplier: "doppelte portion"', () => {
    const result = parser.parse('doppelte portion', { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.multiplier).toBe(2);
  });

  it('parses halves: "halbe portion"', () => {
    const result = parser.parse('halbe portion', { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.multiplier).toBe(0.5);
  });

  it.each(['halb', 'halbe', 'hälfte'])('parses half synonym: "%s"', (input) => {
    const result = parser.parse(input, { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.multiplier).toBe(0.5);
  });

  it('parses counts: "2x" as multiplier only with base grams', () => {
    const withBase = parser.parse('2x', { hasBaseGrams: true });
    expect(withBase.status).toBe('resolved');
    expect(withBase.multiplier).toBe(2);

    const withoutBase = parser.parse('2x', { hasBaseGrams: false });
    expect(withoutBase.status).toBe('ambiguous');
  });

  it('returns ambiguous for ml without density', () => {
    const result = parser.parse('250 ml', { hasBaseGrams: true });
    expect(result.status).toBe('ambiguous');
    expect(result.notes).toContain('ML_UNSUPPORTED');
  });

  // J-013: absolute count intent — a target quantity, never a relative multiplier.
  it.each([
    ['2 Stück', 2, 'piece'],
    ['2 stück', 2, 'piece'],
    ['3 stk', 3, 'piece'],
    ['zwei stück', 2, 'piece'],
    ['2 Scheiben', 2, 'slice'],
    ['eine scheibe', 1, 'slice'],
  ])('parses absolute count "%s" -> %s %s', (input, count, unit) => {
    const result = parser.parse(input as string, { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.count).toBe(count);
    expect(result.countUnit).toBe(unit);
    expect(result.multiplier).toBeUndefined();
    expect(result.notes).toContain('COUNT_SET');
  });

  // J-013: a bare number/number word has no trustworthy unit — never guessed as a multiplier.
  it.each(['2', '3', 'zwei', '0,5'])('rejects bare number "%s" as needing a unit', (input) => {
    const result = parser.parse(input, { hasBaseGrams: true });
    expect(result.status).toBe('ambiguous');
    expect(result.notes).toContain('BARE_NUMBER_NEEDS_UNIT');
    expect(result.multiplier).toBeUndefined();
    expect(result.count).toBeUndefined();
    expect(result.grams).toBeUndefined();
  });

  it('still treats explicit "2x" as a multiplier (unchanged)', () => {
    const result = parser.parse('2x', { hasBaseGrams: true });
    expect(result.status).toBe('resolved');
    expect(result.multiplier).toBe(2);
    expect(result.count).toBeUndefined();
  });
});
