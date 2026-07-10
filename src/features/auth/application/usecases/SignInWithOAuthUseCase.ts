import type { AuthRepository, OAuthProvider, OAuthSignInResult } from '../ports/AuthRepository';

export class SignInWithOAuthUseCase {
  constructor(private readonly repository: AuthRepository) {}

  async execute(provider: OAuthProvider): Promise<OAuthSignInResult> {
    return this.repository.signInWithOAuth(provider);
  }
}
