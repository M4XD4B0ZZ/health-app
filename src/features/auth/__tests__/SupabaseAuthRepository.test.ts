import { SupabaseAuthRepository } from '../infrastructure/SupabaseAuthRepository';
import { supabase } from '../../../infrastructure/supabase/supabaseClient';

jest.mock('../../../infrastructure/supabase/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

describe('SupabaseAuthRepository', () => {
  const repo = new SupabaseAuthRepository();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('returns the access token when a session exists', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'token-123' } },
      });

      await expect(repo.getAccessToken()).resolves.toBe('token-123');
    });

    it('returns null when there is no session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });

      await expect(repo.getAccessToken()).resolves.toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    it('returns userId + accessToken when a session exists', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'token-123', user: { id: 'user-1' } } },
      });

      await expect(repo.getCurrentSession()).resolves.toEqual({
        userId: 'user-1',
        accessToken: 'token-123',
      });
    });

    it('returns null when there is no session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });

      await expect(repo.getCurrentSession()).resolves.toBeNull();
    });
  });

  describe('signInWithOAuth', () => {
    it('returns the authorization URL without opening it', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });

      const result = await repo.signInWithOAuth('google');

      expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/auth?...' });
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { skipBrowserRedirect: true },
      });
    });

    it('throws when Supabase returns an error', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: { url: null },
        error: { message: 'provider not configured' },
      });

      await expect(repo.signInWithOAuth('apple')).rejects.toThrow(
        'Failed to start apple OAuth sign-in: provider not configured',
      );
    });

    it('throws when no URL is returned', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: { url: null },
        error: null,
      });

      await expect(repo.signInWithOAuth('apple')).rejects.toThrow(
        'Failed to start apple OAuth sign-in: no authorization URL returned',
      );
    });
  });

  describe('signOut', () => {
    it('resolves when sign-out succeeds', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

      await expect(repo.signOut()).resolves.toBeUndefined();
    });

    it('throws when sign-out fails', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: { message: 'network error' },
      });

      await expect(repo.signOut()).rejects.toThrow('Failed to sign out: network error');
    });
  });
});
