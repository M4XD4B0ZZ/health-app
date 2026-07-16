import { createClient } from '@supabase/supabase-js';

export interface SupabaseEnvConfig {
  url?: string;
  anonKey?: string;
}

/**
 * P2-001: the required Supabase env vars are strictly verified at boot.
 *
 * NATIVE-001: this validation used to `throw` at module scope, which on a native release
 * build (no dev overlay) kills the process during bundle evaluation — before the first
 * frame — whenever a build was produced without the EXPO_PUBLIC_* vars present at bundle
 * time (e.g. an EAS build without configured environment variables; `.env` is gitignored
 * and never part of a remote build). The verification itself stays mandatory, but the
 * failure is now surfaced as a blocking, visible error screen (see `App.tsx`) instead of
 * an undiagnosable native crash.
 */
export function validateSupabaseConfig(config: SupabaseEnvConfig): string | null {
  const url = config.url?.trim();
  const anonKey = config.anonKey?.trim();

  if (!url) return 'Missing EXPO_PUBLIC_SUPABASE_URL';
  if (!anonKey) return 'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY';

  try {
    new URL(url);
  } catch {
    return 'EXPO_PUBLIC_SUPABASE_URL is not a valid URL';
  }

  return null;
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/**
 * Non-null exactly when the build is missing a valid Supabase configuration. `App.tsx`
 * checks this before rendering the navigator and shows a blocking configuration-error
 * screen instead — the app is never usable in this state (P2-001's fail-fast intent),
 * but the failure is visible and names the offending variable.
 */
export const supabaseConfigError = validateSupabaseConfig({ url, anonKey });

// When configuration is missing, a syntactically valid placeholder keeps module
// evaluation (and the DI container construction that imports this) crash-free. The
// client is never reachable in that state: App.tsx blocks on supabaseConfigError before
// any screen that could touch it is mounted.
export const supabase = createClient(
  supabaseConfigError ? 'https://supabase-config-missing.invalid' : (url as string),
  supabaseConfigError ? 'supabase-config-missing' : (anonKey as string),
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // wichtig für React Native / Expo
    },
  },
);
