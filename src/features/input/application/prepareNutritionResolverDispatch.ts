import { parseInput } from "./parseInput"
import { matchFood } from "./matchFood"
import { evaluateConfidence } from "./evaluateConfidence"
import { buildInputInterpretation } from "./buildInputInterpretation"
import { buildResolverFoodRequests } from "./buildResolverFoodRequests"
import { buildNutritionResolverInputs, FoodSearchQuery } from "./buildNutritionResolverInputs"
import { ParsedInput } from "../domain/ParsedInput"
import { FoodMatch } from "../domain/FoodMatch"
import { ConfidenceScore } from "../domain/ConfidenceScore"
import { InputInterpretation } from "../domain/InputInterpretation"
import { ResolverFoodRequest } from "../domain/ResolverFoodRequest"

export interface PreparedNutritionResolverDispatch {
  parsed: ParsedInput
  matches: FoodMatch[]
  confidence: ConfidenceScore
  interpretation: InputInterpretation
  resolverRequests: ResolverFoodRequest[]
  readyRequests: ResolverFoodRequest[]
  unresolvedRequests: ResolverFoodRequest[]
  nutritionResolverInputs: FoodSearchQuery[]
}

export function prepareNutritionResolverDispatch(
  rawInput: string,
  locale: 'de' | 'en' = 'de',
  traceId?: string
): PreparedNutritionResolverDispatch {
  // Execute the full input pipeline
  const parsed = parseInput(rawInput)
  const matches = matchFood(parsed)
  const confidence = evaluateConfidence(matches)
  const interpretation = buildInputInterpretation(parsed, matches, confidence)
  const resolverRequests = buildResolverFoodRequests(parsed, matches)
  
  // Separate ready and unresolved requests
  const readyRequests = resolverRequests.filter(req => req.status === "ready")
  const unresolvedRequests = resolverRequests.filter(req => req.status === "unresolved")
  
  // Build nutrition resolver inputs for ready requests only
  const nutritionResolverInputs = buildNutritionResolverInputs(resolverRequests, locale, traceId)
  
  return {
    parsed,
    matches,
    confidence,
    interpretation,
    resolverRequests,
    readyRequests,
    unresolvedRequests,
    nutritionResolverInputs
  }
}