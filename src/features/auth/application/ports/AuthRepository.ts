export type OAuthProvider = 'apple' | 'google';

export interface AuthSession {
  userId: string;
  accessToken: string;
}

export interface OAuthSignInResult {
  /**
   * The provider's authorization URL. The caller (presentation layer) is responsible for
   * opening it (e.g. via expo-web-browser) and for the app being able to receive the OAuth
   * redirect back (deep link scheme in app.json) -- neither exists yet, see P2-008 in
   * ROADMAP.md for what's still needed before this can complete an actual login.
   */
  url: string;
}

export interface AuthRepository {
  getAccessToken(): Promise<string | null>;

  /** Returns the current session's user id + access token, or null if not signed in. */
  getCurrentSession(): Promise<AuthSession | null>;

  /**
   * Starts an OAuth sign-in with the given provider. Returns the provider's authorization
   * URL without opening it (`skipBrowserRedirect: true`) -- see OAuthSignInResult.
   */
  signInWithOAuth(provider: OAuthProvider): Promise<OAuthSignInResult>;

  signOut(): Promise<void>;
}
