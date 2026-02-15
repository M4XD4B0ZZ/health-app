import { FoodCatalogResolver } from './FoodCatalogResolver'
import { FoodSearchQuery, FoodCandidate, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource'
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine'
import { FoodCatalogConfig, DEFAULT_CATALOG_CONFIG } from '../../domain/models/FoodCatalogConfig'

/**
 * Sequential resolver that implements deterministic fallback chain:
 * 1. User aliases (highest priority)
 * 2. OFF (branded products)
 * 3. USDA (generic foods) - only if OFF returns no results
 * 4. AI fallback (lowest priority)
 * 
 * Early returns when high-priority sources provide valid results.
 */
export class SequentialFoodCatalogResolver implements FoodCatalogResolver {

  constructor(
    private readonly sources: FoodCatalogSource[],
    private readonly confidenceEngine: ConfidenceEngine,
    private readonly config: FoodCatalogConfig = DEFAULT_CATALOG_CONFIG,
  ) {}

  private getSourceWeight(source: string): number {
    switch (source) {
      case 'user':
        return 4
      case 'off':
        return 3
      case 'usda':
        return 2
      case 'ai':
        return 1
      default:
        return 0
    }
  }

  async resolve(query: FoodSearchQuery): Promise<FoodCandidate | null> {
    const traceId = this.config.enableTracing ? this.generateTraceId() : undefined
    let allCandidates: FoodCandidate[] = []

    if (this.config.enableDebugLogs && traceId) {
      console.debug('[SequentialFoodCatalogResolver] Starting lookup', {
        traceId,
        query: query.normalized,
        locale: query.locale,
      })
    }

    // Process sources sequentially in order
    for (const source of this.sources) {
      try {
        const candidates = await source.search({ ...query, traceId })

        if (candidates.length === 0) {
          continue
        }

        // Score candidates
        const scored = candidates.map(candidate => {
          const score = this.confidenceEngine.score({
            source: candidate.food.source,
            similarity: candidate.match.similarity,
            exact: candidate.match.exact,
            usedHeuristic: candidate.match.usedHeuristic,
          })

          return {
            ...candidate,
            confidence: score.confidence,
            reasons: score.reasons,
          }
        })

        // Sort by confidence and similarity
        scored.sort((a, b) => {
          if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence
          }

          if (b.match.similarity !== a.match.similarity) {
            return b.match.similarity - a.match.similarity
          }

          if (b.match.exact !== a.match.exact) {
            return Number(b.match.exact) - Number(a.match.exact)
          }

          const weightA = this.getSourceWeight(a.food.source)
          const weightB = this.getSourceWeight(b.food.source)

          return weightB - weightA
        })

        const best = scored[0]

        // Early return for high-quality matches from user
        if (source.type === 'user') {
          return best
        }

        // For OFF: early return only if high confidence (configurable threshold)
        if (source.type === 'off') {
          const threshold = this.config.offEarlyReturnMinConfidence
          const earlyReturn = best.confidence >= threshold

          if (this.config.enableDebugLogs) {
            console.debug('[SequentialFoodCatalogResolver] OFF evaluation', {
              traceId,
              confidence: best.confidence,
              threshold,
              earlyReturn,
              foodName: best.food.name,
            })
          }

          if (earlyReturn) {
            return best
          }
        }

        // Store candidates and continue to next source
        allCandidates.push(...scored)

      } catch (error) {
        // Log error and continue to next source
        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Source error:', {
            traceId,
            sourceType: source.type,
            error: error instanceof Error ? error.message : 'unknown',
            errorName: error instanceof Error ? error.name : 'unknown',
          })
        }
        continue
      }
    }

    // If we have candidates, return the best one
    if (this.config.enableDebugLogs) {
      console.debug('[SequentialFoodCatalogResolver] Lookup completed', {
        traceId,
        totalCandidates: allCandidates.length,
        hasResult: allCandidates.length > 0,
      })
    }

    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence
        }

        if (b.match.similarity !== a.match.similarity) {
          return b.match.similarity - a.match.similarity
        }

        if (b.match.exact !== a.match.exact) {
          return Number(b.match.exact) - Number(a.match.exact)
        }

        const weightA = this.getSourceWeight(a.food.source)
        const weightB = this.getSourceWeight(b.food.source)

        return weightB - weightA
      })

      return allCandidates[0]
    }

    return null
  }

  private generateTraceId(): string {
    return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
