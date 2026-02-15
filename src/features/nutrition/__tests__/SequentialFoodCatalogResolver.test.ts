import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver'
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine'
import { FoodCatalogSource, FoodSearchQuery, FoodCandidate } from '../domain/catalog/FoodCatalogSource'
import { FoodCatalogError } from '../domain/errors/FoodCatalogError'
import { FoodCatalogConfig } from '../domain/models/FoodCatalogConfig'

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

    const config: FoodCatalogConfig = {
      offEarlyReturnMinConfidence: 0.7,
      enableDebugLogs: false,
      enableTracing: false,
      resolverBudgetMs: 1500,
      sourceBudgets: { off: 700, usda: 700 },
      circuitBreaker: {
        failureThreshold: 3,
        cooldownMs: 120000,
        enabled: true,
      },
    }

    const resolver = new SequentialFoodCatalogResolver(
      [userSource, offSource, usdaSource],
      confidenceEngine,
      config
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('user')
    expect(userSource.search).toHaveBeenCalled()
    expect(offSource.search).not.toHaveBeenCalled()
    expect(usdaSource.search).not.toHaveBeenCalled()
  })

  it('returns OFF result with high confidence without checking USDA', async () => {
    const config: FoodCatalogConfig = {
      offEarlyReturnMinConfidence: 0.7,
      enableDebugLogs: false,
      enableTracing: false,
      resolverBudgetMs: 1500,
      sourceBudgets: { off: 700, usda: 700 },
      circuitBreaker: {
        failureThreshold: 3,
        cooldownMs: 120000,
        enabled: true,
      },
    }

    const offCandidate = createCandidate('off', 1)
    const offSource = createMockOffSource([offCandidate])
    const usdaSource = createMockUsdaSource([createCandidate('usda', 1)])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine,
      config
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('off')
    expect(result?.confidence).toBeGreaterThanOrEqual(0.7)
    expect(offSource.search).toHaveBeenCalled()
    expect(usdaSource.search).not.toHaveBeenCalled()
  })

  it('continues to USDA when OFF confidence is low', async () => {
    const config: FoodCatalogConfig = {
      offEarlyReturnMinConfidence: 0.7,
      enableDebugLogs: false,
      enableTracing: false,
      resolverBudgetMs: 1500,
      sourceBudgets: { off: 700, usda: 700 },
      circuitBreaker: {
        failureThreshold: 3,
        cooldownMs: 120000,
        enabled: true,
      },
    }

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
      mockEngine as any,
      config
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    // Both sources should be called since OFF confidence < 0.7
    expect(offSource.search).toHaveBeenCalled()
    expect(usdaSource.search).toHaveBeenCalled()
    
    // Should return USDA since it has better confidence (0.8 > 0.5)
    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('usda')
  })

  it('returns USDA if better confidence than OFF', async () => {
    const config: FoodCatalogConfig = {
      offEarlyReturnMinConfidence: 0.7,
      enableDebugLogs: false,
      enableTracing: false,
      resolverBudgetMs: 1500,
      sourceBudgets: { off: 700, usda: 700 },
      circuitBreaker: {
        failureThreshold: 3,
        cooldownMs: 120000,
        enabled: true,
      },
    }

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
      mockEngine as any,
      config
    )

    const query: FoodSearchQuery = { raw: 'generic', normalized: 'generic', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('usda')
    expect(offSource.search).toHaveBeenCalled()
    expect(usdaSource.search).toHaveBeenCalled()
  })

  it('returns OFF even when confidence is low if USDA fails', async () => {
    const config: FoodCatalogConfig = {
      offEarlyReturnMinConfidence: 0.7,
      enableDebugLogs: false,
      enableTracing: false,
      resolverBudgetMs: 1500,
      sourceBudgets: { off: 700, usda: 700 },
      circuitBreaker: {
        failureThreshold: 3,
        cooldownMs: 120000,
        enabled: true,
      },
    }

    const lowConfOffCandidate = createCandidate('off', 0.3)
    const offSource = createMockOffSource([lowConfOffCandidate])
    const usdaSource: FoodCatalogSource = {
      type: 'usda',
      search: jest.fn().mockRejectedValue(new Error('USDA error')),
    }

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine,
      config
    )

    const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('off')
  })

  it('returns null when OFF is empty and USDA is empty', async () => {
    const config: FoodCatalogConfig = {
      offEarlyReturnMinConfidence: 0.7,
      enableDebugLogs: false,
      enableTracing: false,
      resolverBudgetMs: 1500,
      sourceBudgets: { off: 700, usda: 700 },
      circuitBreaker: {
        failureThreshold: 3,
        cooldownMs: 120000,
        enabled: true,
      },
    }

    const offSource = createMockOffSource([])
    const usdaSource = createMockUsdaSource([])

    const resolver = new SequentialFoodCatalogResolver(
      [offSource, usdaSource],
      confidenceEngine,
      config
    )

    const query: FoodSearchQuery = { raw: 'unknown', normalized: 'unknown', locale: 'de' }
    const result = await resolver.resolve(query)

    expect(result).toBeNull()
    expect(offSource.search).toHaveBeenCalled()
    expect(usdaSource.search).toHaveBeenCalled()
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

  describe('Circuit Breaker', () => {
    it('opens circuit after N failures and skips source', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 1500,
        sourceBudgets: { off: 700, usda: 700 },
        circuitBreaker: {
          failureThreshold: 3,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockRejectedValue(FoodCatalogError.network('Network error')),
      }
      const usdaSource = createMockUsdaSource([createCandidate('usda', 0.9)])

      const resolver = new SequentialFoodCatalogResolver(
        [offSource, usdaSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }

      // First 3 calls: OFF fails, USDA succeeds
      await resolver.resolve(query)
      await resolver.resolve(query)
      await resolver.resolve(query)

      expect(offSource.search).toHaveBeenCalledTimes(3)

      // 4th call: Circuit is open, OFF should be skipped
      await resolver.resolve(query)
      expect(offSource.search).toHaveBeenCalledTimes(3) // Still 3, not called again
      expect(usdaSource.search).toHaveBeenCalledTimes(4)
    })

    it('closes circuit after successful call', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 1500,
        sourceBudgets: { off: 700, usda: 700 },
        circuitBreaker: {
          failureThreshold: 3,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      let callCount = 0
      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockImplementation(() => {
          callCount++
          if (callCount <= 2) {
            return Promise.reject(FoodCatalogError.network('Network error'))
          }
          return Promise.resolve([createCandidate('off', 0.9)])
        }),
      }

      const resolver = new SequentialFoodCatalogResolver(
        [offSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }

      // 2 failures
      await resolver.resolve(query)
      await resolver.resolve(query)

      // 3rd call succeeds, should reset circuit
      const result = await resolver.resolve(query)
      expect(result).not.toBeNull()
      expect(result?.food.source).toBe('off')

      // Circuit should be closed, next call should work
      const result2 = await resolver.resolve(query)
      expect(result2).not.toBeNull()
      expect(offSource.search).toHaveBeenCalledTimes(4)
    })

    it('does not count invalid_payload errors for circuit breaker', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 1500,
        sourceBudgets: { off: 700, usda: 700 },
        circuitBreaker: {
          failureThreshold: 3,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockRejectedValue(
          FoodCatalogError.invalidPayload('Invalid payload')
        ),
      }
      const usdaSource = createMockUsdaSource([createCandidate('usda', 0.9)])

      const resolver = new SequentialFoodCatalogResolver(
        [offSource, usdaSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }

      // Multiple calls with invalid_payload errors
      await resolver.resolve(query)
      await resolver.resolve(query)
      await resolver.resolve(query)
      await resolver.resolve(query)

      // Circuit should NOT be open since invalid_payload doesn't count
      expect(offSource.search).toHaveBeenCalledTimes(4)
    })
  })

  describe('Timeout Budgets', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('times out source that exceeds budget', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 2000,
        sourceBudgets: { off: 500, usda: 700 },
        circuitBreaker: {
          failureThreshold: 10,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve([createCandidate('off', 0.9)]), 1000) // 1 second delay
          })
        }),
      }
      const usdaSource = createMockUsdaSource([createCandidate('usda', 0.9)])

      const resolver = new SequentialFoodCatalogResolver(
        [offSource, usdaSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }

      const resolvePromise = resolver.resolve(query)

      // Advance past source budget (500ms)
      jest.advanceTimersByTime(600)

      const result = await resolvePromise

      // OFF should have timed out, USDA should be returned
      expect(result).not.toBeNull()
      expect(result?.food.source).toBe('usda')
    })

    it('respects global resolver budget', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 800,
        sourceBudgets: { off: 500, usda: 500 },
        circuitBreaker: {
          failureThreshold: 10,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockResolvedValue([]),
      }
      const usdaSource: FoodCatalogSource = {
        type: 'usda',
        search: jest.fn().mockResolvedValue([createCandidate('usda', 0.9)]),
      }

      const resolver = new SequentialFoodCatalogResolver(
        [offSource, usdaSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }
      const result = await resolver.resolve(query)

      // Both sources should be called when within budget
      expect(offSource.search).toHaveBeenCalled()
      expect(usdaSource.search).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result?.food.source).toBe('usda')
    })

    it('skips remaining sources when global budget exceeded', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 600,
        sourceBudgets: { off: 400, usda: 400 },
        circuitBreaker: {
          failureThreshold: 10,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve([]), 500)
          })
        }),
      }
      const usdaSource = createMockUsdaSource([createCandidate('usda', 0.9)])

      const resolver = new SequentialFoodCatalogResolver(
        [offSource, usdaSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }

      const resolvePromise = resolver.resolve(query)

      // Advance past OFF completion (500ms) and global budget (600ms)
      jest.advanceTimersByTime(700)

      const result = await resolvePromise

      expect(offSource.search).toHaveBeenCalled()
      // USDA should be skipped because global budget exceeded
      expect(usdaSource.search).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('Circuit Breaker + Timeout Integration', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('opens circuit after repeated timeouts', async () => {
      const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 2000,
        sourceBudgets: { off: 300, usda: 700 },
        circuitBreaker: {
          failureThreshold: 3,
          cooldownMs: 120000,
          enabled: true,
        },
      }

      const offSource: FoodCatalogSource = {
        type: 'off',
        search: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve([createCandidate('off', 0.9)]), 500) // Always too slow
          })
        }),
      }
      const usdaSource = createMockUsdaSource([createCandidate('usda', 0.9)])

      const resolver = new SequentialFoodCatalogResolver(
        [offSource, usdaSource],
        confidenceEngine,
        config
      )

      const query: FoodSearchQuery = { raw: 'test', normalized: 'test', locale: 'de' }

      // 3 calls that will timeout OFF
      for (let i = 0; i < 3; i++) {
        const promise = resolver.resolve(query)
        jest.advanceTimersByTime(400) // Trigger timeout
        await promise
      }

      expect(offSource.search).toHaveBeenCalledTimes(3)

      // 4th call: Circuit should be open
      const promise = resolver.resolve(query)
      jest.advanceTimersByTime(400)
      await promise

      // OFF should be skipped due to open circuit
      expect(offSource.search).toHaveBeenCalledTimes(3)
      expect(usdaSource.search).toHaveBeenCalledTimes(4)
    })
  })
})
