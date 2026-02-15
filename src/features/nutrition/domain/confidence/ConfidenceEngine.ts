import { FoodSourceType } from '../catalog/FoodCatalogSource'

export interface ConfidenceEngine {
  score(input: {
    source: FoodSourceType
    similarity: number
    exact: boolean
    usedHeuristic?: string
  }): {
    confidence: number
    reasons: string[]
  }
}
