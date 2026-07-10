import { SignInWithOAuthUseCase } from '../application/usecases/SignInWithOAuthUseCase';
import type { AuthRepository } from '../application/ports/AuthRepository';

describe('SignInWithOAuthUseCase', () => {
  it('delegates to the repository with the given provider', async () => {
    const repository: AuthRepository = {
      getAccessToken: jest.fn(),
      getCurrentSession: jest.fn(),
      signInWithOAuth: jest.fn().mockResolvedValue({ url: 'https://example.com/oauth' }),
      signOut: jest.fn(),
    };

    const useCase = new SignInWithOAuthUseCase(repository);
    const result = await useCase.execute('google');

    expect(repository.signInWithOAuth).toHaveBeenCalledWith('google');
    expect(result).toEqual({ url: 'https://example.com/oauth' });
  });
});
