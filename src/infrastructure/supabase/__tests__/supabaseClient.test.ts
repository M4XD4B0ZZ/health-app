describe('supabaseClient environment verification (P2-001 / NATIVE-001)', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });

  // NATIVE-001: this suite used to assert that importing the module *throws* on missing
  // config — that module-scope throw is exactly what killed the native release build during
  // bundle evaluation, before the first frame. P2-001's strict boot verification is kept,
  // but its mechanism changed: importing never throws; the failure is reported via
  // `supabaseConfigError`, which App.tsx turns into a blocking configuration-error screen.

  it('never throws on import, and reports a missing EXPO_PUBLIC_SUPABASE_URL', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabaseConfigError).toBe('Missing EXPO_PUBLIC_SUPABASE_URL');
      expect(mod.supabase).toBeDefined();
    });
  });

  it('treats a blank/whitespace-only EXPO_PUBLIC_SUPABASE_URL as missing', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '   ';

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabaseConfigError).toBe('Missing EXPO_PUBLIC_SUPABASE_URL');
    });
  });

  it('reports a malformed EXPO_PUBLIC_SUPABASE_URL', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'not-a-url';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabaseConfigError).toBe('EXPO_PUBLIC_SUPABASE_URL is not a valid URL');
    });
  });

  it('reports a missing EXPO_PUBLIC_SUPABASE_ANON_KEY', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabaseConfigError).toBe('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
    });
  });

  it('treats a blank/whitespace-only EXPO_PUBLIC_SUPABASE_ANON_KEY as missing', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '   ';

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabaseConfigError).toBe('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
    });
  });

  it('boots cleanly with well-formed environment variables (no config error)', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabaseConfigError).toBeNull();
      expect(mod.supabase).toBeDefined();
    });
  });
});
