import { FoodCatalogSource, FoodSearchQuery, FoodCandidate } from '../../../domain/catalog/FoodCatalogSource'
import { FoodSourceProvider } from '../providers/FoodSourceProvider'
import { FoodCatalogConfig, DEFAULT_CATALOG_CONFIG } from '../../../domain/models/FoodCatalogConfig'

export class SupabaseEdgeUsdaSource implements FoodCatalogSource {
  type = 'usda' as const

  constructor(
    private readonly provider: FoodSourceProvider,
    private readonly config: FoodCatalogConfig = DEFAULT_CATALOG_CONFIG,
  ) {}

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    const startTime = performance.now()

    try {
      const response = await this.provider.search({
        query: query.normalized,
        locale: query.locale,
      })

      const latencyMs = performance.now() - startTime

      const candidates = response.items.map(item => ({
        food: {
          id: `usda-${item.sourceId}`,
          name: item.name,
          normalizedName: item.normalizedName,
          macrosPer100g: item.macrosPer100g,
          source: 'usda' as const,
          sourceId: item.sourceId,
        },
        match: {
          exact: item.normalizedName === query.normalized,
          similarity: this.calculateSimilarity(item.normalizedName, query.normalized),
        },
        confidence: 0, // Will be set by ConfidenceEngine
        reasons: [],
      }))

      if (this.config.enableDebugLogs) {
        console.debug('[SupabaseEdgeUsdaSource] Search completed', {
          traceId: query.traceId,
          sourceName: 'usda',
          resultCount: candidates.length,
          latencyMs: Math.round(latencyMs),
          query: query.normalized,
          topResults: candidates.slice(0, 3).map(c => ({
            name: c.food.name,
            similarity: c.match.similarity,
            exact: c.match.exact,
          })),
        })
      }

      return candidates
    } catch (error) {
      const latencyMs = performance.now() - startTime

      if (this.config.enableDebugLogs) {
        console.debug('[SupabaseEdgeUsdaSource] Search failed', {
          traceId: query.traceId,
          sourceName: 'usda',
          errorType: error instanceof Error ? error.name : 'unknown',
          errorMessage: error instanceof Error ? error.message : 'unknown',
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
}
