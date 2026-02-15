import { FoodCatalogResolver } from './FoodCatalogResolver'
import { FoodSearchQuery, FoodCandidate, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource'
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine'
import { FoodCatalogConfig, DEFAULT_CATALOG_CONFIG } from '../../domain/models/FoodCatalogConfig'
import { CircuitBreakerManager } from './CircuitBreakerManager'
import { FoodCatalogError } from '../../domain/errors/FoodCatalogError'

/**
 * Sequential resolver that implements deterministic fallback chain:
 * 1. User aliases (highest priority)
 * 2. OFF (branded products)
 * 3. USDA (generic foods) - only if OFF returns no results
 * 4. AI fallback (lowest priority)
 * 
 * Early returns when high-priority sources provide valid results.
 */
export class SequentialFoodCatalogResolver implements FoodCatalogResolver {
  private readonly circuitBreaker: CircuitBreakerManager

  constructor(
    private readonly sources: FoodCatalogSource[],
    private readonly confidenceEngine: ConfidenceEngine,
    private readonly config: FoodCatalogConfig = DEFAULT_CATALOG_CONFIG,
  ) {
    this.circuitBreaker = new CircuitBreakerManager(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.cooldownMs,
      config.circuitBreaker.enabled,
    )
  }

  private getSourceWeight(source: string): number {
    switch (source) {
      case 'user':
        return 4
      case 'off':
        return 3
      case 'usda':
        return 2
      case 'ai':
        return 1
      default:
        return 0
    }
  }

  async resolve(query: FoodSearchQuery): Promise<FoodCandidate | null> {
    const traceId = this.config.enableTracing ? this.generateTraceId() : undefined
    const resolverStartTime = Date.now()
    let allCandidates: FoodCandidate[] = []

    if (this.config.enableDebugLogs && traceId) {
      console.debug('[SequentialFoodCatalogResolver] Starting lookup', {
        traceId,
        query: query.normalized,
        locale: query.locale,
        resolverBudgetMs: this.config.resolverBudgetMs,
      })
    }

    // Process sources sequentially in order
    for (const source of this.sources) {
      // Check global resolver budget
      const elapsedMs = Date.now() - resolverStartTime
      if (elapsedMs >= this.config.resolverBudgetMs) {
        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Resolver budget exceeded', {
            traceId,
            elapsedMs,
            budgetMs: this.config.resolverBudgetMs,
          })
        }
        break
      }

      // Check circuit breaker
      const circuitState = this.circuitBreaker.getState(source.type)
      if (circuitState.circuitOpen) {
        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Circuit open, skipping source', {
            traceId,
            sourceName: source.type,
            circuitOpen: true,
            openUntil: circuitState.openUntil,
            failureCount: circuitState.failureCount,
          })
        }
        continue
      }

      // Execute source with timeout budget
      try {
        const sourceStartTime = Date.now()
        const sourceBudgetMs = this.config.sourceBudgets[source.type] || 1000

        const candidates = await this.executeWithTimeout(
          source.search({ ...query, traceId }),
          sourceBudgetMs,
          source.type,
        )

        const sourceElapsedMs = Date.now() - sourceStartTime

        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Source completed', {
            traceId,
            sourceName: source.type,
            elapsedMs: sourceElapsedMs,
            budgetMs: sourceBudgetMs,
            timedOut: false,
            candidatesCount: candidates.length,
            circuitOpen: false,
          })
        }

        // Success: Reset circuit breaker
        this.circuitBreaker.recordSuccess(source.type)

        if (candidates.length === 0) {
          continue
        }

        // Score candidates
        const scored = candidates.map(candidate => {
          const score = this.confidenceEngine.score({
            source: candidate.food.source,
            similarity: candidate.match.similarity,
            exact: candidate.match.exact,
            usedHeuristic: candidate.match.usedHeuristic,
          })

          return {
            ...candidate,
            confidence: score.confidence,
            reasons: score.reasons,
          }
        })

        // Sort by confidence and similarity
        scored.sort((a, b) => {
          if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence
          }

          if (b.match.similarity !== a.match.similarity) {
            return b.match.similarity - a.match.similarity
          }

          if (b.match.exact !== a.match.exact) {
            return Number(b.match.exact) - Number(a.match.exact)
          }

          const weightA = this.getSourceWeight(a.food.source)
          const weightB = this.getSourceWeight(b.food.source)

          return weightB - weightA
        })

        const best = scored[0]

        // Early return for high-quality matches from user
        if (source.type === 'user') {
          return best
        }

        // For OFF: early return only if high confidence (configurable threshold)
        if (source.type === 'off') {
          const threshold = this.config.offEarlyReturnMinConfidence
          const earlyReturn = best.confidence >= threshold

          if (this.config.enableDebugLogs) {
            console.debug('[SequentialFoodCatalogResolver] OFF evaluation', {
              traceId,
              confidence: best.confidence,
              threshold,
              earlyReturn,
              foodName: best.food.name,
            })
          }

          if (earlyReturn) {
            return best
          }
        }

        // Store candidates and continue to next source
        allCandidates.push(...scored)

      } catch (error) {
        const sourceElapsedMs = Date.now() - resolverStartTime

        // Record failure in circuit breaker
        const circuitOpened = this.circuitBreaker.recordFailure(source.type, error)
        const circuitState = this.circuitBreaker.getState(source.type)

        // Log error and continue to next source
        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Source error:', {
            traceId,
            sourceName: source.type,
            error: error instanceof Error ? error.message : 'unknown',
            errorName: error instanceof Error ? error.name : 'unknown',
            errorKind: error instanceof FoodCatalogError ? error.kind : 'unknown',
            elapsedMs: sourceElapsedMs,
            timedOut: error instanceof FoodCatalogError && error.kind === 'timeout',
            circuitOpen: circuitOpened,
            failureCount: circuitState.failureCount,
            openUntil: circuitState.openUntil,
          })
        }
        continue
      }
    }

    // If we have candidates, return the best one
    const totalElapsedMs = Date.now() - resolverStartTime
    if (this.config.enableDebugLogs) {
      console.debug('[SequentialFoodCatalogResolver] Lookup completed', {
        traceId,
        totalCandidates: allCandidates.length,
        hasResult: allCandidates.length > 0,
        totalElapsedMs,
        budgetMs: this.config.resolverBudgetMs,
      })
    }

    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence
        }

        if (b.match.similarity !== a.match.similarity) {
          return b.match.similarity - a.match.similarity
        }

        if (b.match.exact !== a.match.exact) {
          return Number(b.match.exact) - Number(a.match.exact)
        }

        const weightA = this.getSourceWeight(a.food.source)
        const weightB = this.getSourceWeight(b.food.source)

        return weightB - weightA
      })

      return allCandidates[0]
    }

    return null
  }

  /**
   * Führt Promise mit Timeout aus
   *
   * @throws FoodCatalogError mit kind='timeout' wenn Budget überschritten
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    sourceType: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(FoodCatalogError.timeout(
            `Source ${sourceType} exceeded budget of ${timeoutMs}ms`
          ))
        }, timeoutMs)
      }),
    ])
  }

  private generateTraceId(): string {
    return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
