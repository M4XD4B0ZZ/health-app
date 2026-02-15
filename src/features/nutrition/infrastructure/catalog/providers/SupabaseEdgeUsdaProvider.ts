import type { FoodSourceProvider } from './FoodSourceProvider'

export class SupabaseEdgeUsdaProvider implements FoodSourceProvider {
  constructor(private readonly supabase: any) {}

  async search(params: {
    query: string
    locale: 'de' | 'en'
  }): Promise<any> {
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
      throw error
    }

    return data
  }
}
