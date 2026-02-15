import { FoodCatalogResolver } from './FoodCatalogResolver'
import { FoodSearchQuery, FoodCandidate, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource'
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine'

export class DefaultFoodCatalogResolver implements FoodCatalogResolver {

  constructor(
    private readonly sources: FoodCatalogSource[],
    private readonly confidenceEngine: ConfidenceEngine,
  ) {}

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

    scored.sort((a, b) => b.confidence - a.confidence)

    return scored[0]
  }
}
