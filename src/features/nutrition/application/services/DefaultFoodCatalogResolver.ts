import { FoodCatalogResolver } from './FoodCatalogResolver'
import { FoodSearchQuery, FoodCandidate, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource'
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine'

export class DefaultFoodCatalogResolver implements FoodCatalogResolver {

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

    const results = await Promise.all(
      this.sources.map(source => source.search(query))
    )

    const candidates = results.flat()

    if (candidates.length === 0) {
      return null
    }

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

    return scored[0]
  }
}
