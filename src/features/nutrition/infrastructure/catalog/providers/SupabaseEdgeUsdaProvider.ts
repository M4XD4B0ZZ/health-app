import type { FoodSourceProvider } from './FoodSourceProvider'
import { EdgeSearchResponse, isEdgeSearchResponse } from './EdgeSearchTypes'
import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError'
import type { SupabaseClient } from './SupabaseEdgeOffProvider'

export class SupabaseEdgeUsdaProvider implements FoodSourceProvider {
  constructor(private readonly supabase: SupabaseClient) {}

  async search(params: {
    query: string
    locale: 'de' | 'en'
  }): Promise<EdgeSearchResponse> {
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
  }
}
