import { ParsedInput } from "../domain/ParsedInput"
import { FoodMatch } from "../domain/FoodMatch"
import { getCanonicalFoodName } from "../infrastructure/foodAliasMap"

export function matchFood(parsedInput: ParsedInput): FoodMatch[] {
  return parsedInput.items.map(item => {
    const canonicalName = getCanonicalFoodName(item.name)
    
    return {
      rawName: item.name,
      canonicalName,
      status: canonicalName ? "matched" : "unmatched"
    }
  })
}
