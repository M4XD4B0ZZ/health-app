describe('supabaseClient environment verification (P2-001)', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });

  it('throws a fatal error when EXPO_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;

    await jest.isolateModulesAsync(async () => {
      await expect(import('../supabaseClient')).rejects.toThrow('Missing EXPO_PUBLIC_SUPABASE_URL');
    });
  });

  it('throws a fatal error when EXPO_PUBLIC_SUPABASE_URL is blank/whitespace-only', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '   ';

    await jest.isolateModulesAsync(async () => {
      await expect(import('../supabaseClient')).rejects.toThrow('Missing EXPO_PUBLIC_SUPABASE_URL');
    });
  });

  it('throws a fatal error when EXPO_PUBLIC_SUPABASE_URL is not a valid URL', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'not-a-url';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

    await jest.isolateModulesAsync(async () => {
      await expect(import('../supabaseClient')).rejects.toThrow(
        'EXPO_PUBLIC_SUPABASE_URL is not a valid URL',
      );
    });
  });

  it('throws a fatal error when EXPO_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    await jest.isolateModulesAsync(async () => {
      await expect(import('../supabaseClient')).rejects.toThrow(
        'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY',
      );
    });
  });

  it('throws a fatal error when EXPO_PUBLIC_SUPABASE_ANON_KEY is blank/whitespace-only', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '   ';

    await jest.isolateModulesAsync(async () => {
      await expect(import('../supabaseClient')).rejects.toThrow(
        'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY',
      );
    });
  });

  it('boots successfully with well-formed environment variables', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../supabaseClient');
      expect(mod.supabase).toBeDefined();
    });
  });
});
