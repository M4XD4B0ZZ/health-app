import { FoodCatalogResolver } from './FoodCatalogResolver'
import { FoodSearchQuery, FoodCandidate, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource'
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine'

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
    let allCandidates: FoodCandidate[] = []

    // Process sources sequentially in order
    for (const source of this.sources) {
      try {
        const candidates = await source.search(query)

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

        // For OFF: early return only if high confidence
        if (source.type === 'off' && best.confidence >= 0.7) {
          return best
        }

        // Store candidates and continue to next source
        allCandidates.push(...scored)

      } catch (error) {
        // Log error and continue to next source
        if (this.shouldLog()) {
          console.debug('[SequentialFoodCatalogResolver] Source error:', {
            sourceType: source.type,
            error: error instanceof Error ? error.message : 'unknown',
          })
        }
        continue
      }
    }

    // If we have candidates, return the best one
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

  private shouldLog(): boolean {
    return process.env.NODE_ENV === 'development'
  }
}
