import { resolveAppIdentity, resolveAppVariant } from '../appIdentity';

// ACC-021 — deterministic assertions on the variant resolver so later drift in the
// approved dev/prod native identities (or in the fail-safe behavior) is caught by CI.

describe('resolveAppVariant', () => {
  it('falls back to development when APP_VARIANT is missing (undefined)', () => {
    expect(resolveAppVariant(undefined)).toBe('development');
  });

  it('falls back to development when APP_VARIANT is empty', () => {
    expect(resolveAppVariant('')).toBe('development');
  });

  it('resolves an explicit development value', () => {
    expect(resolveAppVariant('development')).toBe('development');
  });

  it('resolves an explicit production value', () => {
    expect(resolveAppVariant('production')).toBe('production');
  });

  it('throws (never silently produces production) for an unknown value', () => {
    expect(() => resolveAppVariant('staging')).toThrow(/Unknown APP_VARIANT "staging"/);
    expect(() => resolveAppVariant('prod')).toThrow(
      /never silently produce the production package/,
    );
  });
});

describe('resolveAppIdentity', () => {
  it('maps the development variant to the dogfooding package and dev-suffixed identity', () => {
    expect(resolveAppIdentity('development')).toEqual({
      variant: 'development',
      androidPackage: 'com.nutritiondev.local',
      iosBundleIdentifier: 'de.zerahealth.zera.dev',
      scheme: 'de.zerahealth.zera.dev',
    });
  });

  it('maps the production variant to the permanent Zera identity', () => {
    expect(resolveAppIdentity('production')).toEqual({
      variant: 'production',
      androidPackage: 'de.zerahealth.zera',
      iosBundleIdentifier: 'de.zerahealth.zera',
      scheme: 'de.zerahealth.zera',
    });
  });

  it('defaults (missing APP_VARIANT) to the development/dogfooding identity', () => {
    expect(resolveAppIdentity(undefined).androidPackage).toBe('com.nutritiondev.local');
  });

  it('gives development and production DIFFERENT schemes (no ambiguous callback routing)', () => {
    expect(resolveAppIdentity('development').scheme).not.toBe(
      resolveAppIdentity('production').scheme,
    );
  });
});
