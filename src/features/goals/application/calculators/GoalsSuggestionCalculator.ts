import { DailyGoals } from "../../domain/models/GoalsTypes"

export type MacroStrategy = "balanced" | "high_protein"

/**
 * Suggest daily goals based on TDEE and macro strategy
 * 
 * Balanced: protein 25%, carbs 45%, fat 30%
 * High Protein: protein 30%, carbs 40%, fat 30%
 * 
 * Conversion: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g
 */
export function suggestDailyGoals(
  tdee: number,
  strategy: MacroStrategy
): DailyGoals {
  const calories = Math.round(tdee)

  let proteinPercent: number
  let carbsPercent: number
  let fatPercent: number

  if (strategy === "balanced") {
    proteinPercent = 0.25
    carbsPercent = 0.45
    fatPercent = 0.30
  } else {
    // high_protein
    proteinPercent = 0.30
    carbsPercent = 0.40
    fatPercent = 0.30
  }

  // Calculate calories for each macro
  const proteinCals = calories * proteinPercent
  const carbsCals = calories * carbsPercent
  const fatCals = calories * fatPercent

  // Convert to grams: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g
  const protein = Math.round(proteinCals / 4)
  const carbs = Math.round(carbsCals / 4)
  const fat = Math.round(fatCals / 9)

  return {
    calories,
    protein,
    carbs,
    fat,
  }
}
