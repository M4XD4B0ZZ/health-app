import { FoodCatalogSource, FoodSearchQuery, FoodCandidate } from '../../../domain/catalog/FoodCatalogSource'
import { FoodSourceProvider } from '../providers/FoodSourceProvider'

export class SupabaseEdgeUsdaSource implements FoodCatalogSource {
  type = 'usda' as const

  constructor(private readonly provider: FoodSourceProvider) {}

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    const startTime = performance.now()

    try {
      const response = await this.provider.search({
        query: query.normalized,
        locale: query.locale,
      })

      const latencyMs = performance.now() - startTime

      if (this.shouldLog()) {
        console.debug('[SupabaseEdgeUsdaSource]', {
          sourceName: 'usda',
          resultCount: response.items.length,
          latencyMs: Math.round(latencyMs),
          query: query.normalized,
        })
      }

      return response.items.map(item => ({
        food: {
          id: `usda-${item.sourceId}`,
          name: item.name,
          normalizedName: item.normalizedName,
          macrosPer100g: item.macrosPer100g,
          source: 'usda',
          sourceId: item.sourceId,
        },
        match: {
          exact: item.normalizedName === query.normalized,
          similarity: this.calculateSimilarity(item.normalizedName, query.normalized),
        },
        confidence: 0,
        reasons: [],
      }))
    } catch (error) {
      const latencyMs = performance.now() - startTime

      if (this.shouldLog()) {
        console.debug('[SupabaseEdgeUsdaSource]', {
          sourceName: 'usda',
          errorType: error instanceof Error ? error.name : 'unknown',
          latencyMs: Math.round(latencyMs),
          query: query.normalized,
        })
      }

      throw error
    }
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.includes(b) || b.includes(a)) return 0.8
    return 0.5
  }

  private shouldLog(): boolean {
    return process.env.NODE_ENV === 'development'
  }
}
