import type { ExpoConfig } from 'expo/config';

import { resolveAppIdentity } from './src/config/appIdentity';

/**
 * ACC-021 — Development/production Expo app-identity variants.
 *
 * Single dynamic source of truth for the Expo config (the previous static `app.json`
 * was removed so the two never compete). Every non-variant value below is copied
 * verbatim from the former `app.json`; only the native identity fields
 * (`android.package`, `ios.bundleIdentifier`, `scheme`) vary by `APP_VARIANT`,
 * resolved through `resolveAppIdentity` (see `src/config/appIdentity.ts`).
 *
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
