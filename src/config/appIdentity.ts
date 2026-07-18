/**
 * ACC-021 — Development/production Expo app-identity variants.
 *
 * Single, deterministic source of truth for the variant-specific native identity
 * (Android package, iOS bundle identifier, custom URL scheme). The dynamic Expo
 * config (`app.config.ts`) consumes this so there is exactly one place where the
 * dev/prod identities are defined, and one place tests assert against.
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
