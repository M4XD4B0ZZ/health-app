import { ConfidenceEngine } from './ConfidenceEngine'
import { FoodSourceType } from '../catalog/FoodCatalogSource'

export class DefaultConfidenceEngine implements ConfidenceEngine {

  private readonly baseWeights: Record<FoodSourceType, number> = {
    user: 0.98,
    off: 0.92,
    usda: 0.88,
    ai: 0.75,
  }

  score(input: {
    source: FoodSourceType
    similarity: number
    exact: boolean
    usedHeuristic?: string
  }): {
    confidence: number
    reasons: string[]
  } {

    let confidence = this.baseWeights[input.source]
    const reasons: string[] = []

    reasons.push(`base:${input.source}`)

    // similarity influence (scaled small to keep source dominant)
    confidence += (input.similarity - 1) * 0.1
    reasons.push(`similarity:${input.similarity.toFixed(2)}`)

    if (input.exact) {
      confidence += 0.02
      reasons.push('exact_match_bonus')
    }

    if (input.usedHeuristic === 'plural') {
      confidence -= 0.03
      reasons.push('plural_penalty')
    }

    if (input.usedHeuristic === 'fuzzy') {
      confidence -= 0.05
      reasons.push('fuzzy_penalty')
    }

    // clamp 0..1
    confidence = Math.max(0, Math.min(1, confidence))

    return {
      confidence,
      reasons,
    }
  }
}
