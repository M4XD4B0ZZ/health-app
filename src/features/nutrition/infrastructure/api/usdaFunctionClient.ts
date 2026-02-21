import type { AuthRepository } from '../../../auth/application/ports/AuthRepository'

export type UsdaFunctionMode = 'health' | 'search'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

function getRequiredEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  if (!SUPABASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL')
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY')
  }

  return {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  }
}

export async function callUsdaFunction<T>(
  mode: UsdaFunctionMode,
  payload: Record<string, unknown> | undefined,
  authRepository: AuthRepository,
): Promise<T | null> {
  const { supabaseUrl, supabaseAnonKey } = getRequiredEnv()
  const usdaFunctionUrl = `${supabaseUrl}/functions/v1/food-usda-search`
  const userAccessToken = await authRepository.getAccessToken()
  const authorizationToken = userAccessToken ?? supabaseAnonKey

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(usdaFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${authorizationToken}`,
      },
      body: JSON.stringify({ mode, ...(payload ?? {}) }),
      signal: controller.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(`USDA Function Error (${response.status}): ${text}`)
    }

    return text ? (JSON.parse(text) as T) : null
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('USDA Function timeout after 5s')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
