import { createAppConfig } from '../../../app.config';

// ACC-021 — exercise the real dynamic Expo config (app.config.ts) end to end for each
// APP_VARIANT and prove: (1) the exact native identity per variant, (2) that every value
// carried over from the former static app.json is preserved and identical across variants,
// (3) the fail-safe default, and (4) the hard failure on an unknown variant.

const ORIGINAL_APP_VARIANT = process.env.APP_VARIANT;

afterEach(() => {
  if (ORIGINAL_APP_VARIANT === undefined) {
    delete process.env.APP_VARIANT;
  } else {
    process.env.APP_VARIANT = ORIGINAL_APP_VARIANT;
  }
});

function configFor(variant: string | undefined) {
  if (variant === undefined) {
    delete process.env.APP_VARIANT;
  } else {
    process.env.APP_VARIANT = variant;
  }
  return createAppConfig();
}

describe('app.config.ts native identity per variant', () => {
  it('default environment (no APP_VARIANT) resolves to the development identity', () => {
    const c = configFor(undefined);
    expect(c.android?.package).toBe('com.nutritiondev.local');
    expect(c.ios?.bundleIdentifier).toBe('de.zerahealth.zera.dev');
    expect(c.scheme).toBe('de.zerahealth.zera.dev');
  });

  it('APP_VARIANT=development resolves to the development identity', () => {
    const c = configFor('development');
    expect(c.android?.package).toBe('com.nutritiondev.local');
    expect(c.ios?.bundleIdentifier).toBe('de.zerahealth.zera.dev');
    expect(c.scheme).toBe('de.zerahealth.zera.dev');
  });

  it('APP_VARIANT=production resolves to the permanent Zera identity', () => {
    const c = configFor('production');
    expect(c.android?.package).toBe('de.zerahealth.zera');
    expect(c.ios?.bundleIdentifier).toBe('de.zerahealth.zera');
    expect(c.scheme).toBe('de.zerahealth.zera');
  });

  it('unknown APP_VARIANT throws instead of emitting a package', () => {
    expect(() => configFor('staging')).toThrow(/Unknown APP_VARIANT/);
  });

  it('development and production never share a URL scheme', () => {
    expect(configFor('development').scheme).not.toBe(configFor('production').scheme);
  });
});

describe('app.config.ts preserves all non-variant configuration', () => {
  it('carries over every former app.json value verbatim', () => {
    const c = configFor('production');
    expect(c.name).toBe('Zera');
    expect(c.slug).toBe('health-dashboard');
    expect(c.version).toBe('1.0.0');
    expect(c.orientation).toBe('portrait');
    expect(c.icon).toBe('./assets/icon.png');
    expect(c.userInterfaceStyle).toBe('light');
    expect(c.newArchEnabled).toBe(true);
    expect(c.owner).toBe('m4xxx');
    expect(c.splash).toEqual({
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#13113B',
    });
    expect(c.ios?.supportsTablet).toBe(true);
    expect(c.android?.adaptiveIcon).toEqual({
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#13113B',
    });
    expect(c.android?.edgeToEdgeEnabled).toBe(true);
    expect(c.android?.predictiveBackGestureEnabled).toBe(false);
    expect(c.web?.favicon).toBe('./assets/favicon.png');
    expect(c.plugins).toEqual(['expo-font', 'expo-web-browser']);
    expect((c.extra as { eas?: { projectId?: string } })?.eas?.projectId).toBe(
      '3e6cd267-1b2c-4bb6-97e9-68fa150952ea',
    );
  });

  it('keeps non-variant configuration identical between development and production', () => {
    const stripIdentity = (c: ReturnType<typeof createAppConfig>) => {
      const { scheme, ios, android, ...rest } = c;
      const { bundleIdentifier: _iosId, ...iosRest } = ios ?? {};
      const { package: _pkg, ...androidRest } = android ?? {};
      return { ...rest, ios: iosRest, android: androidRest };
    };
    expect(stripIdentity(configFor('development'))).toEqual(stripIdentity(configFor('production')));
  });
});
