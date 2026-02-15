export type GoalsMode = "suggested" | "manual"

export interface DailyGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface GoalsSuggestion {
  goals: DailyGoals
  rationale: string
  macroStrategy: string
  createdAt: string // ISO
}

export interface EffectiveGoals {
  mode: GoalsMode
  goals: DailyGoals
  // Snapshot must be stored so suggested goals do not change when MetabolismProfile changes later
  suggestionSnapshot?: GoalsSuggestion
}
