export type ConfidenceLevel = "high" | "medium" | "low"

export interface ConfidenceScore {
  level: ConfidenceLevel
  score: number
  reason: string
}
