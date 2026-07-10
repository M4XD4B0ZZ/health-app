import { originLabel } from '../goalsDisplay';

describe('goalsDisplay (GE-008)', () => {
  it('maps preset origin to the §4b "vorgeschlagenes Ziel" product-surface label', () => {
    expect(originLabel('preset')).toBe('Vorgeschlagenes Ziel');
  });

  it('maps user origin to the §4b "eigenes/individuelles Ziel" product-surface label', () => {
    expect(originLabel('user')).toBe('Eigenes Ziel');
  });

  it('never returns internal architecture vocabulary ("Profil", "Preset", "Origin")', () => {
    const origins: Parameters<typeof originLabel>[0][] = [
      'preset',
      'user',
      'professional',
      'community',
      'ai',
    ];

    for (const origin of origins) {
      const label = originLabel(origin);
      expect(label).not.toMatch(/profil/i);
      expect(label).not.toMatch(/preset/i);
      expect(label).not.toMatch(/\borigin\b/i);
    }
  });

  it('falls back to a generic label for an unrecognized origin', () => {
    expect(originLabel('unknown' as never)).toBe('Ziel');
  });
});
