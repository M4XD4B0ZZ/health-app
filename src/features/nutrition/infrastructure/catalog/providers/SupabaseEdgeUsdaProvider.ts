import type { FoodSourceProvider } from './FoodSourceProvider'
import { EdgeSearchResponse, isEdgeSearchResponse } from './EdgeSearchTypes'
import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError'
import type { SupabaseClient } from './SupabaseEdgeOffProvider'
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig } from './RetryHelper'

export class SupabaseEdgeUsdaProvider implements FoodSourceProvider {
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
          'food-usda-search',
          {
            body: {
              query: params.query,
              locale: params.locale,
            },
          }
        )

        if (error) {
          throw FoodCatalogError.edge(`USDA search failed: ${error.message}`, error)
        }

        if (!data) {
          throw FoodCatalogError.invalidPayload('USDA search returned no data')
        }

        if (!isEdgeSearchResponse(data)) {
          throw FoodCatalogError.invalidPayload('USDA search returned invalid response structure')
        }

        return data
      },
      this.retryConfig,
      { name: 'SupabaseEdgeUsdaProvider', traceId: params.traceId }
    )
  }
}
