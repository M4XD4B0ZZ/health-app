import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver'
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine'
import { FoodCatalogSource, FoodSearchQuery, FoodCandidate } from '../domain/catalog/FoodCatalogSource'

describe('SequentialFoodCatalogResolver', () => {

  const confidenceEngine = new DefaultConfidenceEngine()

  const createMockOffSource = (results: FoodCandidate[]): FoodCatalogSource => ({
    type: 'off',
    search: jest.fn().mockResolvedValue(results),
  })

  const createMockUsdaSource = (results: FoodCandidate[]): FoodCatalogSource => ({
    type: 'usda',
    search: jest.fn().mockResolvedValue(results),
  })

  const createMockUserSource = (results: FoodCandidate[]): FoodCatalogSource => ({
    type: 'user',
    search: jest.fn().mockResolvedValue(results),
  })

  const createCandidate = (source: 'off' | 'usda' | 'user', similarity: number): FoodCandidate => ({
    food: {
      id: `${source}-test`,
      name: `Test ${source}`,
      normalizedName: 'test',
      macrosPer100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
      source,
    },
    match: {
      exact: similarity === 1,
      similarity,
    },
    confidence: 0,
    reasons: [],
  })

  it('returns user alias immediately without checking other sources', async () => {
    const userCandidate = createCandidate('user', 1)
    const userSource = createMockUserSource([userCandidate])
    const offSource = createMockOffSource([createCandidate('off', 1)])
    const usdaSource = createMockUsdaSource([createCandidate('usda', 1)])

    const resolver = new SequentialFoodCatalogResolver(
      [userSource, offSource, usdaSource],
      confidenceEngine
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('user')
    expect(userSource.search).toHaveBeenCalledWith(query)
    expect(offSource.search).not.toHaveBeenCalled()
    expect(usdaSource.search).not.toHaveBeenCalled()
  })

  it('returns OFF result with high confidence without checking USDA', async () => {
    const offCandidate = createCandidate('off', 1)
    const offSource = createMockOffSource([offCandidate])
    const usdaSource = createMockUsdaSource([createCandidate('usda', 1)])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('off')
    expect(result?.confidence).toBeGreaterThanOrEqual(0.7)
    expect(offSource.search).toHaveBeenCalledWith(query)
    expect(usdaSource.search).not.toHaveBeenCalled()
  })

  it('continues to USDA when OFF confidence is low', async () => {
    // Mock engine to return specific confidence scores
    const mockEngine = {
      score: jest.fn((params) => {
        if (params.source === 'off') {
          return { confidence: 0.5, reasons: ['low match'] }
        }
        return { confidence: 0.8, reasons: ['good match'] }
      }),
    }

    const lowConfOffCandidate = createCandidate('off', 0.3)
    const offSource = createMockOffSource([lowConfOffCandidate])
    const usdaSource = createMockUsdaSource([createCandidate('usda', 0.9)])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      mockEngine as any
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    // Both sources should be called since OFF confidence < 0.7
    expect(offSource.search).toHaveBeenCalledWith(query)
    expect(usdaSource.search).toHaveBeenCalledWith(query)
    
    // Should return USDA since it has better confidence (0.8 > 0.5)
    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('usda')
  })

  it('returns USDA if better confidence than OFF', async () => {
    // Mock engine to ensure USDA has higher confidence
    const mockEngine = {
      score: jest.fn((params) => {
        if (params.source === 'off') {
          return { confidence: 0.4, reasons: ['weak match'] }
        }
        return { confidence: 0.9, reasons: ['strong match'] }
      }),
    }

    const lowConfOffCandidate = createCandidate('off', 0.3)
    const highConfUsdaCandidate = createCandidate('usda', 0.9)
    
    const offSource = createMockOffSource([lowConfOffCandidate])
    const usdaSource = createMockUsdaSource([highConfUsdaCandidate])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      mockEngine as any
    )

    const query: FoodSearchQuery = { raw: 'generic', normalized: 'generic', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('usda')
    expect(offSource.search).toHaveBeenCalledWith(query)
    expect(usdaSource.search).toHaveBeenCalledWith(query)
  })

  it('returns OFF even when confidence is low if USDA fails', async () => {
    const lowConfOffCandidate = createCandidate('off', 0.3)
    const offSource = createMockOffSource([lowConfOffCandidate])
    const usdaSource: FoodCatalogSource = {
      type: 'usda',
      search: jest.fn().mockRejectedValue(new Error('USDA error')),
    }

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('off')
  })

  it('returns null when OFF is empty and USDA is empty', async () => {
    const offSource = createMockOffSource([])
    const usdaSource = createMockUsdaSource([])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine
    )

    const query: FoodSearchQuery = { raw: 'unknown', normalized: 'unknown', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).toBeNull()
    expect(offSource.search).toHaveBeenCalledWith(query)
    expect(usdaSource.search).toHaveBeenCalledWith(query)
  })

  it('continues to next source when a source throws error', async () => {
    const offSource: FoodCatalogSource = {
      type: 'off',
      search: jest.fn().mockRejectedValue(new Error('OFF error')),
    }
    const usdaSource = createMockUsdaSource([createCandidate('usda', 1)])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('usda')
  })

  it('sorts candidates by confidence, then similarity, then source weight', async () => {
    const candidates = [
      createCandidate('off', 0.5),
      createCandidate('usda', 0.8),
      createCandidate('off', 0.8),
    ]
    const offSource = createMockOffSource(candidates)

    const resolver = new SequentialFoodCatalogResolver(
      [offSource],
      confidenceEngine
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    // Should pick the one with highest confidence
    expect(result?.match.similarity).toBe(0.8)
  })

  it('returns OFF when confidence is equal but source weight is higher', async () => {
    const offCandidate = createCandidate('off', 0.5)
    const usdaCandidate = createCandidate('usda', 0.5)
    
    // Force same confidence by mocking engine
    const mockEngine = {
      score: jest.fn().mockReturnValue({ confidence: 0.5, reasons: [] }),
    }

    const offSource = createMockOffSource([offCandidate])
    const usdaSource = createMockUsdaSource([usdaCandidate])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      mockEngine as any
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('off')
  })
})
