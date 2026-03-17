import { FoodMatch } from "../domain/FoodMatch"
import { ConfidenceScore } from "../domain/ConfidenceScore"

export function evaluateConfidence(matches: FoodMatch[]): ConfidenceScore {
  if (matches.length === 0) {
    return {
      level: "low",
      score: 0,
      reason: "no_items"
    }
  }

  const matchedCount = matches.filter(match => match.status === "matched").length
  const totalCount = matches.length
  const ratio = matchedCount / totalCount

  if (ratio === 1 && totalCount >= 1) {
    return {
      level: "high",
      score: 1,
      reason: "all_items_matched"
    }
  }

  if (ratio > 0 && ratio < 1) {
    return {
      level: "medium",
      score: ratio,
      reason: "partial_match"
    }
  }

  if (ratio === 0) {
    return {
      level: "low",
      score: 0,
      reason: "no_items_matched"
    }
  }

  // Fallback (should not reach here with current logic)
  return {
    level: "low",
    score: 0,
    reason: "unknown"
  }
}
