import { FoodCatalogResolver } from './FoodCatalogResolver';
import {
  FoodSearchQuery,
  FoodCandidate,
  FoodCatalogSource,
} from '../../domain/catalog/FoodCatalogSource';
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine';
import { FoodCatalogConfig, DEFAULT_CATALOG_CONFIG } from '../../domain/models/FoodCatalogConfig';
import { CircuitBreakerManager } from './CircuitBreakerManager';
import { FoodCatalogError } from '../../domain/errors/FoodCatalogError';
import { NegativeCacheHelper } from './NegativeCacheHelper';
import { ResolverDecision, ResolvedFoodCandidate } from '../../domain/models/ResolverDecision';
import { normalizeText } from '../utils/normalizeText';
import { ScoreCalculator } from './ScoreCalculator';
import { buildResolverDecision } from './ResolverDecisionPolicy';
import {
  RESOLVER_SOURCE_LABELS,
  ResolverSourceLabel,
  toResolverSourceLabel,
} from './ResolverSourceLabel';
import { filterMockCandidatesIfRealExist } from './resolver/filterMockCandidatesIfRealExist';
import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';
import { detectCanonicalEntity, getSourceQuery } from '../../domain/catalog/CanonicalFood';
import { ResolverDebugCollector, SourceCandidate, CandidateEvaluation } from './ResolverDebugTypes';
import { InputConfidenceClassifier } from '../../domain/confidence/InputConfidenceClassifier';
import { DefaultInputConfidenceClassifier } from './DefaultInputConfidenceClassifier';

interface LookupMetrics {
  traceId?: string;
  totalElapsedMs: number;
  sourcesTried: string[];
  skippedByCircuit: string[];
  timedOutSources: string[];
  errorsBySource: Record<string, string>;
  winnerSource: string | null;
  winnerConfidence: number | null;
  cacheHit: boolean;
  cacheSet: boolean;
}

interface RawResolverCandidate {
  id: string;
  source: ResolverSourceLabel;
  food: FoodCandidate['food'];
  match: FoodCandidate['match'];
}

interface SourceRoutingStrategy {
  name: string;
  offEarlyReturnDisabled: boolean;
  blsEarlyReturnDisabled: boolean;
  userEarlyReturnDisabled: boolean;
  sourcePriority: FoodCatalogSource['type'][];
}

export class SequentialFoodCatalogResolver implements FoodCatalogResolver {
  private readonly circuitBreaker: CircuitBreakerManager;
  private readonly negativeCache: NegativeCacheHelper;
  private readonly scoreCalculator: ScoreCalculator;
  private readonly inputConfidenceClassifier: InputConfidenceClassifier;

  constructor(
    private readonly sources: FoodCatalogSource[],
    private readonly _confidenceEngine: ConfidenceEngine,
    private readonly config: FoodCatalogConfig = DEFAULT_CATALOG_CONFIG,
    inputConfidenceClassifier?: InputConfidenceClassifier,
  ) {
    this.circuitBreaker = new CircuitBreakerManager(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.cooldownMs,
      config.circuitBreaker.enabled,
    );
    this.negativeCache = new NegativeCacheHelper();
    this.scoreCalculator = new ScoreCalculator();
    this.inputConfidenceClassifier =
      inputConfidenceClassifier || new DefaultInputConfidenceClassifier();
  }

  async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
    const traceId =
      ctx?.traceId ||
      query.traceId ||
      (this.config.enableTracing ? this.generateTraceId() : undefined);
    console.log(
      `[${traceId}] PROOF RESOLVER_CALLED query="${query.normalized || query.raw}" sourceCount=${this.sources.length}`,
    );
    const resolverStartTime = Date.now();
    const normalizedQuery = normalizeText(query.normalized || query.raw);
    const { canonicalId } = detectCanonicalEntity(normalizedQuery, query.locale);

    // DACH Data Strategy: Input Classification-based Source Routing
    const routingStrategy = this.determineSourceRoutingStrategy(query);
    const orderedSources = this.getOrderedSources(routingStrategy);
    const sources = orderedSources.map((s) => s.type);
    console.log(`[DEBUG] ROUTING sources=${sources.join(',')}`);
    console.log(
      `[${traceId}] PROOF_SOURCE_ROUTING_DECISION rawInput="${query.raw}" classification="${query.inputType || 'unknown'}" locale="${query.locale}" chosenPriority="${routingStrategy.name}"`,
    );

    // Initialize debug collector if tracing is enabled
    const debugCollector =
      isDebugLoggingEnabled() && traceId
        ? new ResolverDebugCollector(
            query.raw,
            normalizedQuery,
            canonicalId || undefined,
            query.locale || 'en',
            traceId,
          )
        : null;

    if (isDebugLoggingEnabled() && traceId) {
      const offQuery = getSourceQuery({
        sourceName: 'off',
        locale: query.locale,
        normalizedQuery,
        canonicalId,
        traceId,
      });
      const usdaQuery = getSourceQuery({
        sourceName: 'usda',
        locale: query.locale,
        normalizedQuery,
        canonicalId,
        traceId,
      });
      console.log(
        `[${traceId}] QUERY_MAP original="${normalizedQuery}" canonicalId="${canonicalId ?? 'none'}" offQuery="${offQuery}" usdaQuery="${usdaQuery}"`,
      );
    }

    let allRawCandidates: RawResolverCandidate[] = [];

    const metrics: LookupMetrics = {
      traceId,
      totalElapsedMs: 0,
      sourcesTried: [],
      skippedByCircuit: [],
      timedOutSources: [],
      errorsBySource: {},
      winnerSource: null,
      winnerConfidence: null,
      cacheHit: false,
      cacheSet: false,
    };

    if (this.negativeCache.has(normalizedQuery, query.locale)) {
      metrics.cacheHit = true;
      metrics.totalElapsedMs = Date.now() - resolverStartTime;

      if (this.config.enableDebugLogs && traceId) {
        console.debug('[SequentialFoodCatalogResolver] Negative cache hit', {
          traceId,
          query: normalizedQuery,
          locale: query.locale,
          cacheHit: true,
          ttlMs: this.config.negativeCacheTtlMs,
        });
      }

      // Debug logging for cache hit
      if (debugCollector) {
        debugCollector.setDecision({
          reason: 'cache_hit',
          status: 'rejected',
          reasonCodes: ['NEGATIVE_CACHE_HIT'],
        });
        debugCollector.setTotalTime(metrics.totalElapsedMs);
        debugCollector.logToConsole();
      }

      this.logSummary(metrics);
      return this.buildDecision(normalizedQuery, []);
    }

    if (this.config.enableDebugLogs && traceId) {
      console.debug('[SequentialFoodCatalogResolver] Starting lookup', {
        traceId,
        query: normalizedQuery,
        locale: query.locale,
        resolverBudgetMs: this.config.resolverBudgetMs,
      });
    }

    let hadCountableError = false;

    for (const source of orderedSources) {
      const elapsedMs = Date.now() - resolverStartTime;
      if (elapsedMs >= this.config.resolverBudgetMs) {
        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Resolver budget exceeded', {
            traceId,
            elapsedMs,
            budgetMs: this.config.resolverBudgetMs,
          });
        }
        break;
      }

      const circuitState = this.circuitBreaker.getState(source.type);
      if (circuitState.circuitOpen) {
        metrics.skippedByCircuit.push(source.type);

        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Circuit open, skipping source', {
            traceId,
            sourceName: source.type,
            circuitOpen: true,
            openUntil: circuitState.openUntil,
            failureCount: circuitState.failureCount,
          });
        }

        // Debug logging for skipped source
        if (debugCollector) {
          debugCollector.addSourceResult({
            source: source.type as 'off' | 'bls' | 'usda' | 'user',
            status: 'skipped',
            durationMs: 0,
            candidates: [],
            skippedReason: 'circuit_open',
          });
        }

        continue;
      }

      try {
        console.log(`[${traceId}] PROOF CALLING_SOURCE ${source.constructor.name}`);
        const sourceStartTime = Date.now();
        const sourceBudgetMs = this.config.sourceBudgets[source.type] || 1000;
        metrics.sourcesTried.push(source.type);

        const mappedQuery = getSourceQuery({
          sourceName: source.type,
          locale: query.locale,
          normalizedQuery,
          canonicalId,
          traceId,
        });

        const rawCandidates = await this.executeWithTimeout(
          source.search({ ...query, normalized: mappedQuery, traceId }),
          sourceBudgetMs,
          source.type,
        );

        const sourceElapsedMs = Date.now() - sourceStartTime;

        if (isDebugLoggingEnabled() && traceId) {
          console.log(
            `[${traceId}] SOURCE ${source.type} durationMs=${sourceElapsedMs} candidates=${rawCandidates.length}`,
          );
        }

        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Source completed', {
            traceId,
            sourceName: source.type,
            elapsedMs: sourceElapsedMs,
            budgetMs: sourceBudgetMs,
            timedOut: false,
            candidatesCount: rawCandidates.length,
            circuitOpen: false,
          });
        }

        this.circuitBreaker.recordSuccess(source.type);

        // Debug logging for successful source result
        if (debugCollector) {
          debugCollector.addSourceResult({
            source: source.type as 'off' | 'bls' | 'usda' | 'user',
            status: 'success',
            durationMs: sourceElapsedMs,
            candidates: this.convertToSourceCandidates(rawCandidates),
          });
        }

        if (rawCandidates.length === 0) {
          continue;
        }

        const mappedCandidates = this.mapCandidates(source, rawCandidates);
        const scored = this.scoreCandidates(
          normalizedQuery,
          filterMockCandidatesIfRealExist(mappedCandidates),
        );
        const best = scored[0];

        if (source.type === 'user') {
          metrics.totalElapsedMs = Date.now() - resolverStartTime;
          metrics.winnerSource = best.source;
          metrics.winnerConfidence = best.score;

          // Debug logging for user source early return
          if (debugCollector) {
            debugCollector.addEvaluation(this.convertToEvaluations(scored));
            debugCollector.setDecision({
              winner: best.food.name,
              source: best.source,
              confidence: best.score,
              reason: 'early_return_user',
              status: 'accepted',
              reasonCodes: ['USER_SOURCE_PRIORITY'],
            });
            debugCollector.setTotalTime(metrics.totalElapsedMs);
            debugCollector.logToConsole();
          }

          this.logSummary(metrics, best);
          return this.buildDecision(normalizedQuery, scored);
        }

        if (
          source.type === 'bls' &&
          query.locale === 'de' &&
          (query.inputType === 'generic' || query.inputType === 'ambiguous') &&
          best.score >= (query.inputType === 'generic' ? 0.75 : 0.85) // Higher threshold for ambiguous
        ) {
          metrics.totalElapsedMs = Date.now() - resolverStartTime;
          metrics.winnerSource = best.source;
          metrics.winnerConfidence = best.score;

          if (debugCollector) {
            debugCollector.addEvaluation(this.convertToEvaluations(scored));
            debugCollector.setDecision({
              winner: best.food.name,
              source: best.source,
              confidence: best.score,
              reason: 'early_return_bls',
              status: 'accepted',
              reasonCodes: ['BLS_GENERIC_TRUTH'],
            });
            debugCollector.setTotalTime(metrics.totalElapsedMs);
            debugCollector.logToConsole();
          }

          this.logSummary(metrics, best);
          return this.buildDecision(normalizedQuery, scored);
        }

        if (source.type === 'off' && mappedCandidates[0]?.source === RESOLVER_SOURCE_LABELS.OFF) {
          const threshold = this.config.offEarlyReturnMinConfidence;
          const confidenceCheck = best.score >= threshold;

          // Block OFF early return for generic canonical foods to allow USDA comparison
          const canonicalResult = detectCanonicalEntity(normalizedQuery, 'de');
          const isGenericCanonical = canonicalResult.canonicalId !== null;

          // DACH Data Strategy: Apply routing strategy to early return decision
          const routingDisablesEarlyReturn = routingStrategy.offEarlyReturnDisabled;
          const requiresExactOffEarlyReturn =
            query.locale === 'de' && query.inputType !== 'branded';
          const isExactOffMatch = best.food.normalizedName === normalizedQuery;
          const earlyReturn =
            confidenceCheck &&
            !isGenericCanonical &&
            !routingDisablesEarlyReturn &&
            (!requiresExactOffEarlyReturn || isExactOffMatch);

          if (this.config.enableDebugLogs) {
            console.debug('[SequentialFoodCatalogResolver] OFF evaluation', {
              traceId,
              confidence: best.score,
              threshold,
              confidenceCheck,
              isGenericCanonical,
              canonicalId: canonicalResult.canonicalId,
              routingDisablesEarlyReturn,
              routingStrategy: routingStrategy.name,
              requiresExactOffEarlyReturn,
              isExactOffMatch,
              earlyReturn,
              foodName: best.food.name,
            });
          }

          if (earlyReturn) {
            metrics.totalElapsedMs = Date.now() - resolverStartTime;
            metrics.winnerSource = best.source;
            metrics.winnerConfidence = best.score;

            // Debug logging for OFF early return
            if (debugCollector) {
              debugCollector.addEvaluation(this.convertToEvaluations(scored));
              debugCollector.setDecision({
                winner: best.food.name,
                source: best.source,
                confidence: best.score,
                reason: 'early_return_off',
                status: 'accepted',
                reasonCodes: ['OFF_EARLY_RETURN'],
              });
              debugCollector.setTotalTime(metrics.totalElapsedMs);
              debugCollector.logToConsole();
            }

            this.logSummary(metrics, best);
            return this.buildDecision(normalizedQuery, scored);
          } else {
            // Debug logging for OFF early return blocked
            if (debugCollector) {
              debugCollector.addEvaluation(this.convertToEvaluations(scored));
            }
          }
        }

        allRawCandidates.push(...mappedCandidates);
      } catch (error) {
        const sourceElapsedMs = Date.now() - resolverStartTime;
        const errorKind = error instanceof FoodCatalogError ? error.kind : 'unknown';
        metrics.errorsBySource[source.type] = errorKind;

        if (isDebugLoggingEnabled() && traceId) {
          console.log(
            `[${traceId}] SOURCE ${source.type} ERROR ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }

        // Debug logging for source error
        if (debugCollector) {
          const status = errorKind === 'timeout' ? 'timeout' : 'error';
          debugCollector.addSourceResult({
            source: source.type as 'off' | 'bls' | 'usda' | 'user',
            status,
            durationMs: sourceElapsedMs,
            candidates: [],
            error: error instanceof Error ? error.message : 'unknown error',
          });
        }

        if (error instanceof FoodCatalogError) {
          if (this.circuitBreaker.isCountableError(error)) {
            hadCountableError = true;
          }

          if (error.kind === 'timeout') {
            metrics.timedOutSources.push(source.type);
          }
        } else {
          hadCountableError = true;
        }

        const circuitOpened = this.circuitBreaker.recordFailure(source.type, error);
        const state = this.circuitBreaker.getState(source.type);

        if (this.config.enableDebugLogs) {
          console.debug('[SequentialFoodCatalogResolver] Source error:', {
            traceId,
            sourceName: source.type,
            error: error instanceof Error ? error.message : 'unknown',
            errorName: error instanceof Error ? error.name : 'unknown',
            errorKind,
            elapsedMs: sourceElapsedMs,
            timedOut: error instanceof FoodCatalogError && error.kind === 'timeout',
            circuitOpen: circuitOpened,
            failureCount: state.failureCount,
            openUntil: state.openUntil,
          });
        }
      }
    }

    metrics.totalElapsedMs = Date.now() - resolverStartTime;

    if (allRawCandidates.length > 0) {
      const filteredCandidates = filterMockCandidatesIfRealExist(allRawCandidates);
      const scoredCandidates = this.scoreCandidates(normalizedQuery, filteredCandidates);
      const decision = this.buildDecision(normalizedQuery, scoredCandidates);
      metrics.winnerSource = decision.best?.source ?? null;
      metrics.winnerConfidence = decision.best?.score ?? null;

      // Debug logging for final decision
      if (debugCollector) {
        debugCollector.addEvaluation(this.convertToEvaluations(scoredCandidates));
        debugCollector.setDecision({
          winner: decision.best?.food.name,
          source: decision.best?.source,
          confidence: decision.best?.score,
          reason: 'best_score',
          status: decision.status,
          reasonCodes: decision.reasonCodes,
        });
        debugCollector.setTotalTime(Date.now() - resolverStartTime);
        debugCollector.logToConsole();
      }

      this.logSummary(metrics, decision.best);
      return this.addInputConfidence(decision, query, normalizedQuery);
    }

    if (!hadCountableError) {
      this.negativeCache.set(normalizedQuery, query.locale, this.config.negativeCacheTtlMs);
      metrics.cacheSet = true;

      if (this.config.enableDebugLogs && traceId) {
        console.debug('[SequentialFoodCatalogResolver] Negative cache set', {
          traceId,
          query: normalizedQuery,
          locale: query.locale,
          cacheSet: true,
          ttlMs: this.config.negativeCacheTtlMs,
        });
      }
    }

    // Debug logging for no candidates
    if (debugCollector) {
      debugCollector.setDecision({
        reason: 'no_candidates',
        status: 'rejected',
        reasonCodes: ['NO_CANDIDATES'],
      });
      debugCollector.setTotalTime(Date.now() - resolverStartTime);
      debugCollector.logToConsole();
    }

    this.logSummary(metrics);
    const emptyDecision = this.buildDecision(normalizedQuery, []);
    return this.addInputConfidence(emptyDecision, query, normalizedQuery);
  }

  private mapCandidates(
    source: FoodCatalogSource,
    candidates: FoodCandidate[],
  ): RawResolverCandidate[] {
    const sourceLabel = toResolverSourceLabel(source.type, source.constructor.name);
    return candidates.map((candidate) => ({
      id: `${sourceLabel}:${candidate.food.id}`,
      source: sourceLabel,
      food: candidate.food,
      match: candidate.match,
    }));
  }

  private convertToSourceCandidates(candidates: FoodCandidate[]): SourceCandidate[] {
    return candidates.map((candidate) => ({
      name: candidate.food.name,
      normalizedName: candidate.food.normalizedName,
      similarity: candidate.match.similarity,
      exact: candidate.match.exact,
      macrosPer100g: {
        kcal: candidate.food.macrosPer100g.kcal,
        protein: candidate.food.macrosPer100g.protein,
        carbs: candidate.food.macrosPer100g.carbs,
        fat: candidate.food.macrosPer100g.fat,
      },
      source: candidate.food.source,
      id: candidate.food.id,
    }));
  }

  private convertToEvaluations(candidates: ResolvedFoodCandidate[]): CandidateEvaluation[] {
    return candidates.map((candidate) => ({
      name: candidate.food.name,
      source: candidate.source,
      similarity: candidate.breakdown.matchScore, // Use matchScore as similarity proxy
      exact: candidate.food.normalizedName === candidate.food.name.toLowerCase(),
      macrosPer100g: {
        kcal: candidate.food.macrosPer100g.kcal,
        protein: candidate.food.macrosPer100g.protein,
        carbs: candidate.food.macrosPer100g.carbs,
        fat: candidate.food.macrosPer100g.fat,
      },
      scores: {
        match: candidate.breakdown.matchScore,
        dataQuality: candidate.breakdown.dataQualityScore,
        kcalConsistency: candidate.breakdown.kcalConsistencyScore,
        sourceTrust: candidate.breakdown.sourceTrustScore,
        final: candidate.breakdown.finalScore,
      },
      notes: candidate.breakdown.notes,
    }));
  }

  private scoreCandidates(
    normalizedQuery: string,
    candidates: RawResolverCandidate[],
  ): ResolvedFoodCandidate[] {
    return candidates
      .map((candidate) => {
        const breakdown = this.scoreCalculator.calculate({
          normalizedQuery,
          candidateFood: candidate.food,
          candidateSource: candidate.source,
          metadata: {
            similarity: candidate.match.similarity,
            exact: candidate.match.exact,
            usedHeuristic: candidate.match.usedHeuristic,
          },
        });

        return {
          id: candidate.id,
          source: candidate.source,
          food: candidate.food,
          score: breakdown.finalScore,
          breakdown,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private buildDecision(
    normalizedQuery: string,
    candidates: ResolvedFoodCandidate[],
  ): ResolverDecision {
    return buildResolverDecision({
      normalizedQuery,
      candidates,
      topN: 5,
    });
  }

  private addInputConfidence(
    decision: ResolverDecision,
    query: FoodSearchQuery,
    normalizedQuery: string,
  ): ResolverDecision {
    const matchMetadata = this.extractMatchMetadata(decision.best);
    const inputConfidence = this.inputConfidenceClassifier.classify(
      query.raw,
      normalizedQuery,
      matchMetadata,
    );

    decision.inputConfidence = inputConfidence;

    // Log input confidence
    console.log(
      `PROOF_INPUT_CONFIDENCE input="${query.raw}" level="${inputConfidence.level}" reason="${inputConfidence.reason}"`,
    );

    return decision;
  }

  private extractMatchMetadata(best?: ResolvedFoodCandidate) {
    if (!best) return undefined;

    // Extract metadata from the best candidate
    const metadata: any = {};

    // Check for alias usage in breakdown notes
    if (best.breakdown.notes.some((note) => note.includes('alias'))) {
      metadata.fromAlias = true;
      metadata.usedHeuristic = 'alias';
    }

    // Check for fuzzy matching indicators
    if (best.breakdown.notes.some((note) => note.includes('fuzzy'))) {
      metadata.usedHeuristic = 'fuzzy';
      metadata.exact = false;
    }

    // Check for exact match indicators
    if (best.breakdown.matchScore >= 0.95) {
      metadata.exact = true;
    }

    return metadata;
  }

  private logSummary(metrics: LookupMetrics, decisionBest?: ResolvedFoodCandidate): void {
    if (decisionBest?.source === RESOLVER_SOURCE_LABELS.BLS && metrics.traceId) {
      console.log(
        `[${metrics.traceId}] PROOF_BLS_SOURCE_USED candidate="${decisionBest.food.name}"`,
      );

      if (decisionBest.food.sourceId?.startsWith('shortcut:')) {
        console.log(
          `[${metrics.traceId}] PROOF_CANONICAL_SHORTCUT_USED shortcut="${decisionBest.food.normalizedName}"`,
        );
      }
    }

    if (isDebugLoggingEnabled() && metrics.traceId) {
      if (decisionBest) {
        console.log(
          `[${metrics.traceId}] RESULT bestMatch="${decisionBest.food.name}" source="${decisionBest.source}" confidence=${decisionBest.score}`,
        );
        console.log(
          `[${metrics.traceId}] MACROS kcal=${decisionBest.food.macrosPer100g.kcal} p=${decisionBest.food.macrosPer100g.protein} c=${decisionBest.food.macrosPer100g.carbs} f=${decisionBest.food.macrosPer100g.fat}`,
        );
      } else {
        console.log(`[${metrics.traceId}] BLOCKED reason="NO_MATCH_OR_ZERO_MACROS"`);
      }
    }

    if (!this.config.enableDebugLogs) {
      return;
    }

    console.debug('[SequentialFoodCatalogResolver] Lookup Summary', {
      traceId: metrics.traceId,
      totalElapsedMs: metrics.totalElapsedMs,
      sourcesTried: metrics.sourcesTried,
      skippedByCircuit: metrics.skippedByCircuit,
      timedOutSources: metrics.timedOutSources,
      errorsBySource: metrics.errorsBySource,
      winnerSource: metrics.winnerSource,
      winnerConfidence: metrics.winnerConfidence,
      cacheHit: metrics.cacheHit,
      cacheSet: metrics.cacheSet,
    });
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    sourceType: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(
            FoodCatalogError.timeout(`Source ${sourceType} exceeded budget of ${timeoutMs}ms`),
          );
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * DACH Data Strategy: Determine source routing strategy based on input classification
   */
  private determineSourceRoutingStrategy(query: FoodSearchQuery): SourceRoutingStrategy {
    const inputType = query.inputType || 'ambiguous';
    const locale = query.locale || 'en';

    // For German locale with generic classification: prioritize DACH-compatible sources
    if (locale === 'de' && inputType === 'generic') {
      return {
        name: 'DACH_GENERIC_FIRST',
        offEarlyReturnDisabled: true, // Allow USDA to compete with OFF for better DACH matches
        blsEarlyReturnDisabled: false, // Allow BLS early return for high confidence
        userEarlyReturnDisabled: false, // Allow user early return
        sourcePriority: ['user', 'bls', 'off', 'usda', 'ai'],
      };
    }

    // For branded products: prioritize OFF (branded database)
    if (inputType === 'branded') {
      return {
        name: 'BRANDED_OFF_FIRST',
        offEarlyReturnDisabled: false, // Standard early return behavior
        blsEarlyReturnDisabled: false, // Standard early return behavior
        userEarlyReturnDisabled: false, // Standard early return behavior
        sourcePriority: ['user', 'off', 'bls', 'usda', 'ai'],
      };
    }

    // Default/ambiguous: standard behavior
    return {
      name: 'STANDARD_SEQUENTIAL',
      offEarlyReturnDisabled: false,
      blsEarlyReturnDisabled: false,
      userEarlyReturnDisabled: false,
      sourcePriority: ['user', 'off', 'bls', 'usda', 'ai'],
    };
  }

  private getOrderedSources(strategy: SourceRoutingStrategy): FoodCatalogSource[] {
    const rank = new Map(strategy.sourcePriority.map((type, index) => [type, index]));

    return [...this.sources].sort((left, right) => {
      const leftRank = rank.get(left.type) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rank.get(right.type) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank;
    });
  }

  private generateTraceId(): string {
    return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
