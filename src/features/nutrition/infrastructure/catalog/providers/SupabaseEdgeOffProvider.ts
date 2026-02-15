import type { FoodSourceProvider } from './FoodSourceProvider'
import { EdgeSearchResponse, isEdgeSearchResponse } from './EdgeSearchTypes'
import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError'
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig } from './RetryHelper'

export interface SupabaseClient {
  functions: {
    invoke(functionName: string, options?: { body?: unknown }): Promise<{
      data: unknown
      error: Error | null
    }>
  }
}

export class SupabaseEdgeOffProvider implements FoodSourceProvider {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  ) {}

  async search(params: {
    query: string
    locale: 'de' | 'en'
    traceId?: string
  }): Promise<EdgeSearchResponse> {
    return withRetry(
      async () => {
        const { data, error } = await this.supabase.functions.invoke(
          'food-off-search',
          {
            body: {
              query: params.query,
              locale: params.locale,
            },
          }
        )

        if (error) {
          throw FoodCatalogError.edge(`OFF search failed: ${error.message}`, error)
        }

        if (!data) {
          throw FoodCatalogError.invalidPayload('OFF search returned no data')
        }

        if (!isEdgeSearchResponse(data)) {
          throw FoodCatalogError.invalidPayload('OFF search returned invalid response structure')
        }

        return data
      },
      this.retryConfig,
      { name: 'SupabaseEdgeOffProvider', traceId: params.traceId }
    )
  }
}
