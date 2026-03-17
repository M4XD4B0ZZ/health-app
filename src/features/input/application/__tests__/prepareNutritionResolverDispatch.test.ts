import { prepareNutritionResolverDispatch } from "../prepareNutritionResolverDispatch"

describe("prepareNutritionResolverDispatch", () => {
  it("should handle matched multi-item input", () => {
    const result = prepareNutritionResolverDispatch("2 Eier und Toast", 'de', 'test-trace')
    
    // Check parsed input
    expect(result.parsed.items).toHaveLength(2)
    expect(result.parsed.items[0].name).toBe("eier")
    expect(result.parsed.items[0].quantity).toBe(2)
    expect(result.parsed.items[1].name).toBe("toast")
    
    // Check matches
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].canonicalName).toBe("egg")
    expect(result.matches[1].canonicalName).toBe("toast")
    
    // Check confidence
    expect(result.confidence.level).toBe("high")
    expect(result.confidence.score).toBe(1)
    
    // Check interpretation
    expect(result.interpretation.type).toBe("multi_item")
    expect(result.interpretation.itemCount).toBe(2)
    
    // Check resolver requests
    expect(result.resolverRequests).toHaveLength(2)
    expect(result.readyRequests).toHaveLength(2)
    expect(result.unresolvedRequests).toHaveLength(0)
    
    // Check nutrition resolver inputs
    expect(result.nutritionResolverInputs).toHaveLength(2)
    expect(result.nutritionResolverInputs[0]).toEqual({
      raw: "eier",
      normalized: "egg",
      locale: "de",
      traceId: "test-trace"
    })
    expect(result.nutritionResolverInputs[1]).toEqual({
      raw: "toast",
      normalized: "toast",
      locale: "de",
      traceId: "test-trace"
    })
  })

  it("should handle mixed known/unknown items", () => {
    const result = prepareNutritionResolverDispatch("Eier und mysteryfood", 'de')
    
    expect(result.resolverRequests).toHaveLength(2)
    expect(result.readyRequests).toHaveLength(1)
    expect(result.unresolvedRequests).toHaveLength(1)
    
    expect(result.readyRequests[0].rawName).toBe("eier")
    expect(result.unresolvedRequests[0].rawName).toBe("mysteryfood")
    
    // Only ready requests should be converted to nutrition resolver inputs
    expect(result.nutritionResolverInputs).toHaveLength(1)
    expect(result.nutritionResolverInputs[0].raw).toBe("eier")
    expect(result.nutritionResolverInputs[0].normalized).toBe("egg")
    
    expect(result.confidence.level).toBe("medium")
    expect(result.confidence.score).toBe(0.5)
  })

  it("should handle fully unresolved input", () => {
    const result = prepareNutritionResolverDispatch("mysteryfood", 'en')
    
    expect(result.resolverRequests).toHaveLength(1)
    expect(result.readyRequests).toHaveLength(0)
    expect(result.unresolvedRequests).toHaveLength(1)
    
    // No nutrition resolver inputs should be created
    expect(result.nutritionResolverInputs).toHaveLength(0)
    
    expect(result.confidence.level).toBe("low")
    expect(result.confidence.score).toBe(0)
    expect(result.interpretation.type).toBe("single_item")
  })

  it("should use default locale when not specified", () => {
    const result = prepareNutritionResolverDispatch("Toast")
    
    expect(result.nutritionResolverInputs[0].locale).toBe("de")
    expect(result.nutritionResolverInputs[0].traceId).toBeUndefined()
  })
})