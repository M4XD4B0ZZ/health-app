import { callUsdaFunction } from './usdaFunctionClient'
import { SupabaseAuthRepository } from '../../../auth/infrastructure/SupabaseAuthRepository'

const authRepository = new SupabaseAuthRepository()

export async function exampleUsdaHealthCheck(): Promise<void> {
  await callUsdaFunction('health', undefined, authRepository)
}

export async function exampleUsdaSearchApple(): Promise<void> {
  await callUsdaFunction('search', { query: 'apple' }, authRepository)
}
