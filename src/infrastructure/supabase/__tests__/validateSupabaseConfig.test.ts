import { validateSupabaseConfig } from '../supabaseClient';

describe('validateSupabaseConfig (NATIVE-001 / P2-001)', () => {
  it('returns null for a valid configuration', () => {
    expect(
      validateSupabaseConfig({
        url: 'https://example.supabase.co',
        anonKey: 'some-anon-key',
      }),
    ).toBeNull();
  });

  it('names the URL variable when it is missing', () => {
    expect(validateSupabaseConfig({ anonKey: 'some-anon-key' })).toBe(
      'Missing EXPO_PUBLIC_SUPABASE_URL',
    );
  });

  it('treats a whitespace-only URL as missing', () => {
    expect(validateSupabaseConfig({ url: '   ', anonKey: 'some-anon-key' })).toBe(
      'Missing EXPO_PUBLIC_SUPABASE_URL',
    );
  });

  it('names the anon-key variable when it is missing', () => {
    expect(validateSupabaseConfig({ url: 'https://example.supabase.co' })).toBe(
      'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY',
    );
  });

  it('rejects a malformed URL', () => {
    expect(validateSupabaseConfig({ url: 'not a url', anonKey: 'some-anon-key' })).toBe(
      'EXPO_PUBLIC_SUPABASE_URL is not a valid URL',
    );
  });

  it('never returns an error result that could crash rendering (always string or null)', () => {
    const results = [
      validateSupabaseConfig({}),
      validateSupabaseConfig({ url: 'https://example.supabase.co', anonKey: 'k' }),
    ];
    for (const result of results) {
      expect(result === null || typeof result === 'string').toBe(true);
    }
  });
});
