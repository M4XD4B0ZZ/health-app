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
});
