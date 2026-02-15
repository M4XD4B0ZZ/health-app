export interface EdgeSearchResponse {
  items: EdgeFoodItem[]
}

export interface EdgeFoodItem {
  source: 'off' | 'usda'
  sourceId: string
  name: string
  normalizedName: string
  macrosPer100g: {
    kcal: number
    protein: number
    carbs: number
    fat: number
  }
}

export function isEdgeSearchResponse(data: unknown): data is EdgeSearchResponse {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const response = data as EdgeSearchResponse

  if (!Array.isArray(response.items)) {
    return false
  }

  return response.items.every(isEdgeFoodItem)
}

function isEdgeFoodItem(item: unknown): item is EdgeFoodItem {
  if (typeof item !== 'object' || item === null) {
    return false
  }

  const food = item as EdgeFoodItem

  return (
    (food.source === 'off' || food.source === 'usda') &&
    typeof food.sourceId === 'string' &&
    typeof food.name === 'string' &&
    typeof food.normalizedName === 'string' &&
    typeof food.macrosPer100g === 'object' &&
    food.macrosPer100g !== null &&
    typeof food.macrosPer100g.kcal === 'number' &&
    typeof food.macrosPer100g.protein === 'number' &&
    typeof food.macrosPer100g.carbs === 'number' &&
    typeof food.macrosPer100g.fat === 'number'
  )
}
