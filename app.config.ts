import type { ExpoConfig } from 'expo/config';

/**
 * ACC-021 / NATIVE-001 — Development/production Expo app-identity variants.
 *
 * Single dynamic source of truth for the Expo config (the previous static `app.json`
 * was removed so the two never compete). Every non-variant value below is copied
 * verbatim from the former `app.json`; only the native identity fields
 * (`android.package`, `ios.bundleIdentifier`, `scheme`) vary by `APP_VARIANT`,
 * resolved through `resolveAppIdentity` (defined in this file).
 *
 * The identity resolver is intentionally **inlined here** rather than imported from a
 * separate TypeScript module: EAS evaluates the config by transpiling only this file
 * to `app.config.js`, so a transitive local `.ts` import (e.g. `./src/config/appIdentity`)
 * cannot be resolved on the build server without extra `tsx` loader setup and fails the
 * "Read app config" build step (NATIVE-001). Keeping the resolver self-contained removes
 * that failure entirely with no runtime-behavior or identity-value change. The focused
 * unit tests (`src/config/__tests__/appIdentity.test.ts`,
 * `src/config/__tests__/appConfig.test.ts`) import these exports directly.
 *
 * Fail-safe policy (see ACC-021 in ROADMAP.md):
 *  - a missing/empty APP_VARIANT resolves to `development` (protects the existing
 *    `com.nutritiondev.local` dogfooding installation as the safe default);
 *  - an unknown APP_VARIANT throws clearly — it must NEVER silently fall through to
 *    the production package.
 *
 * Development and production deliberately use DIFFERENT URL schemes so that, when
 * both apps are installed on the same device, the OAuth callback cannot be routed
 * ambiguously.
 */

export type AppVariant = 'development' | 'production';

export interface AppIdentity {
  /** Which variant this identity belongs to. */
  readonly variant: AppVariant;
  /** Android `applicationId` (`android.package`). */
  readonly androidPackage: string;
  /** iOS `bundleIdentifier` (`ios.bundleIdentifier`). */
  readonly iosBundleIdentifier: string;
  /** Custom URL scheme (`expo.scheme`) used for the OAuth deep-link callback. */
  readonly scheme: string;
}

/** Canonical, human-approved identities. Do not derive these dynamically. */
const APP_IDENTITIES: Readonly<Record<AppVariant, AppIdentity>> = {
  development: {
    variant: 'development',
    // Preserves the currently installed dogfooding app and its local data.
    androidPackage: 'com.nutritiondev.local',
    iosBundleIdentifier: 'de.zerahealth.zera.dev',
    scheme: 'de.zerahealth.zera.dev',
  },
  production: {
    variant: 'production',
    androidPackage: 'de.zerahealth.zera',
    iosBundleIdentifier: 'de.zerahealth.zera',
    scheme: 'de.zerahealth.zera',
  },
};

/**
 * Resolve the raw `APP_VARIANT` env value to a supported variant.
 *
 * @throws Error for any non-empty value that is not `development` or `production`.
 */
export function resolveAppVariant(raw: string | undefined): AppVariant {
  if (raw === undefined || raw === '') {
    // Fail-safe: absent variant is the development/dogfooding build.
    return 'development';
  }
  if (raw === 'development' || raw === 'production') {
    return raw;
  }
  throw new Error(
    `Unknown APP_VARIANT "${raw}". Supported values are "development" and "production". ` +
      'Leave APP_VARIANT unset to build the development/dogfooding variant. ' +
      'An unknown value must never silently produce the production package.',
  );
}

/** Resolve the full native identity for the given raw `APP_VARIANT` env value. */
export function resolveAppIdentity(raw: string | undefined): AppIdentity {
  return APP_IDENTITIES[resolveAppVariant(raw)];
}

/**
 * `APP_VARIANT` is read at evaluation time so `expo config` / EAS build profiles can
 * select the variant. A missing value falls back to `development` (the safe default
 * that preserves the existing `com.nutritiondev.local` dogfooding installation); an
 * unknown value throws rather than silently emitting the production package.
 */
export function createAppConfig(): ExpoConfig {
  const identity = resolveAppIdentity(process.env.APP_VARIANT);

  return {
    name: 'Zera',
    slug: 'health-dashboard',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    // Variant-specific: dev and prod deliberately differ so a parallel install cannot
    // route the OAuth callback ambiguously.
    scheme: identity.scheme,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#13113B',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: identity.iosBundleIdentifier,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#13113B',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: identity.androidPackage,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-font', 'expo-web-browser'],
    extra: {
      eas: {
        projectId: '3e6cd267-1b2c-4bb6-97e9-68fa150952ea',
      },
    },
    owner: 'm4xxx',
  };
}

export default createAppConfig;
