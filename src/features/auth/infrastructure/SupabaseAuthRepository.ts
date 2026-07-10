import type {
  AuthRepository,
  AuthSession,
  OAuthProvider,
  OAuthSignInResult,
} from '../application/ports/AuthRepository';
import { supabase } from '../../../infrastructure/supabase/supabaseClient';

export class SupabaseAuthRepository implements AuthRepository {
  async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user?.id || !session.access_token) {
      return null;
    }
    return { userId: session.user.id, accessToken: session.access_token };
  }

  async signInWithOAuth(provider: OAuthProvider): Promise<OAuthSignInResult> {
    // skipBrowserRedirect: this repository only starts the OAuth flow and hands back the
    // authorization URL. Opening it (expo-web-browser) and receiving the redirect back into
    // the app (a deep link scheme in app.json) is presentation-layer + native-config wiring
    // that doesn't exist yet -- see P2-008 in ROADMAP.md.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      throw new Error(
        `Failed to start ${provider} OAuth sign-in: ${error?.message ?? 'no authorization URL returned'}`,
      );
    }

    return { url: data.url };
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Failed to sign out: ${error.message}`);
    }
  }
}
