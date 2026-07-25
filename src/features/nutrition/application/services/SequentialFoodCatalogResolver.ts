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
import {
  hasBlsGenericPreparationStateConflict,
  hasBlsGenericSubstringOnlyIdentity,
} from '../../infrastructure/catalog/sources/bls/BlsLookupEngine';
import { buildResolverDecision } from './ResolverDecisionPolicy';
import {
  RESOLVER_SOURCE_LABELS,
  ResolverSourceLabel,
  toResolverSourceLabel,
} from './ResolverSourceLabel';
import { filterMockCandidatesIfRealExist } from './resolver/filterMockCandidatesIfRealExist';
import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';
import { detectCanonicalEntity, getSourceQuery } from '../../domain/catalog/FoodAliasDictionary';
import { ResolverDebugCollector, SourceCandidate, CandidateEvaluation } from './ResolverDebugTypes';
import { InputConfidenceClassifier } from '../../domain/confidence/InputConfidenceClassifier';
import { DefaultInputConfidenceClassifier } from './DefaultInputConfidenceClassifier';
import { ResolverRunLogger, NoopResolverRunLogger } from '../ports/ResolverRunLogger';
import {
  NoopResolverObservationWriter,
  ResolverObservationWriter,
} from '../ports/ResolverObservationWriter';
import {
  NoopResolverObservationOwnerProvider,
  ResolverObservationOwnerProvider,
} from '../ports/ResolverObservationOwnerProvider';
import {
  RESOLVER_OBSERVATION_CONTRACT_VERSION,
  toResolverObservationOutcome,
} from '../../domain/models/ResolverObservation';

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
    private readonly resolverRunLogger: ResolverRunLogger = new NoopResolverRunLogger(),
    private readonly resolverObservationWriter: ResolverObservationWriter = new NoopResolverObservationWriter(),
    private readonly resolverObservationOwnerProvider: ResolverObservationOwnerProvider = new NoopResolverObservationOwnerProvider(),
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

  /**
   * RESOLVER-V2-006: persists a fire-and-forget record of the decision after resolving.
   * Logging never blocks or fails the actual resolution (see NoopResolverRunLogger /
   * SupabaseResolverRunLogger's own error handling).
   */
  async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
    const decision = await this.resolveInternal(query, ctx);
    void this.resolverRunLogger
      .log({
        normalizedQuery: decision.normalizedQuery,
        locale: query.locale,
        winnerSource: decision.best?.source ?? null,
        winnerConfidence: decision.best?.score ?? null,
        cacheHit: false,
        status: decision.status,
        reasonCodes: decision.reasonCodes,
        candidateCount: decision.candidates.length,
        winnerName: decision.best?.food.name,
      })
      .catch(() => {});
    void this.writeObservation(query, decision, ctx?.traceId ?? query.traceId).then((result) => {
      if (result.status === 'failed')
        console.warn('[ResolverObservationWriter] write failed', result.code);
    });
    return decision;
  }

  private async writeObservation(
    query: FoodSearchQuery,
    decision: ResolverDecision,
    runId?: string,
  ) {
    const ownerId = await this.resolverObservationOwnerProvider.getOwnerId();
    if (!ownerId) return { status: 'failed', code: 'write_failed' } as const;
    return this.resolverObservationWriter.write({
      ownerId,
      observation: {
        contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
        observationId: `resolver-observation:${runId ?? decision.createdAt}`,
        resolverRunId: runId ?? decision.createdAt,
        occurredAt: decision.createdAt,
        input: {
          rawInput: query.raw,
          normalizedInput: decision.normalizedQuery,
          locale: query.locale,
          inputType: query.inputType ?? 'unknown',
        },
        decision: {
          outcome: toResolverObservationOutcome(decision),
          reasonCodes: decision.reasonCodes,
          candidateCount: decision.candidates.length,
          selectedSource: decision.best
            ? {
                type: decision.best.source,
                id: decision.best.food.sourceId ?? decision.best.food.id,
              }
            : null,
          provenanceStatus: decision.best ? 'source_grounded' : 'not_resolved',
        },
        versions: { resolverVersion: 'v2' },
        operational: { totalLatencyMs: 'unknown' },
      },
    });
  }

  private async resolveInternal(
    query: FoodSearchQuery,
    ctx?: { traceId?: string },
  ): Promise<ResolverDecision> {
    const traceId =
      ctx?.traceId ||
      query.traceId ||
      (this.config.enableTracing ? this.generateTraceId() : undefined);
    if (isDebugLoggingEnabled() && traceId)
      console.log(`[${traceId}] PROOF RESOLVER_CALLED sourceCount=${this.sources.length}`);
    const resolverStartTime = Date.now();
    const normalizedQuery = normalizeText(query.normalized || query.raw);
    const { canonicalId } = detectCanonicalEntity(normalizedQuery, query.locale);

    // DACH Data Strategy: Input Classification-based Source Routing
    const routingStrategy = this.determineSourceRoutingStrategy(query);
    const orderedSources = this.getOrderedSources(routingStrategy);
    const sources = orderedSources.map((s) => s.type);
    if (isDebugLoggingEnabled() && traceId)
      console.log(`[${traceId}] ROUTING sources=${sources.join(',')}`);
    console.log(
      `[${traceId ?? 'unknown'}] PROOF_SOURCE_ROUTING_DECISION classification="${query.inputType || 'unknown'}" locale="${query.locale}" chosenPriority="${routingStrategy.name}"`,
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
      const blsQuery = getSourceQuery({
        sourceName: 'bls',
        locale: query.locale,
        normalizedQuery,
        canonicalId,
        traceId,
      });
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
        `[${traceId}] QUERY_MAP original="${normalizedQuery}" canonicalId="${canonicalId ?? 'none'}" blsQuery="${blsQuery}" offQuery="${offQuery}" usdaQuery="${usdaQuery}"`,
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
          // RESOLVER-V3-049: the BLS generic fast-path must not silently accept a candidate when
          // the unqualified query leaves a material preparation-state identity ambiguity
          // unresolved among the BLS candidates it actually found (e.g. raw vs. "gekocht"
          // Haferflocken, or plain vs. "frittiert"/"gebacken" Pommes). Detected via a categorical,
          // source-grounded check (not a reverse-engineered score-delta threshold) -- see
          // `hasBlsGenericPreparationStateConflict`. `best` is intentionally left unset so no
          // downstream caller (e.g. `LogFoodFromRawInputUseCase`'s own `score >= 0.7` gate) can
          // still treat this as a confidently resolved food.
          // RESOLVER-V3-049 scoping note: `BlsLookupEngine`'s single-long-token branch
          // (`findRankedTokenMatches`, query length > 6, one token, no exact match) is
          // RESOLVER-V2-009's own deliberate, already-reviewed ranked demotion system --
          // purpose-built to pick a confident single winner for exactly this class of query, and
          // relied upon by other approved deterministic behaviors (RESOLVER-V2-010's qualified
          // Speck sub-terms -- "Bauchspeck"/"Schinkenspeck"/"Rückenspeck" -- which must stay
          // deterministic per that task's own explicit product decision). This task's new check
          // therefore does not re-litigate that stage's output: it only applies when Stage 1
          // (exact ties) or Stage 4 (plain, uncapped-ranking token matches) produced the
          // candidates -- the two stages that apply no ambiguity-aware demotion at all today.
          const queryTokenCount = normalizedQuery.trim().split(/\s+/).filter(Boolean).length;
          const isSingleLongTokenQuery = queryTokenCount === 1 && normalizedQuery.length > 6;
          const hasExactMatchCandidate = mappedCandidates.some((c) => c.match.exact);
          const eligibleForPreparationStateCheck = !(
            isSingleLongTokenQuery && !hasExactMatchCandidate
          );

          // RESOLVER-V3-051: the BLS generic fast-path must not confidently accept a candidate
          // whose only real evidence is a substring-only textual containment of the bare query
          // inside a more specific German compound name (e.g. "snack" inside "Kichererbsensnack
          // gebacken") -- a generic/short query being discoverably related to a candidate is not
          // the same as the candidate being the query's actual identity. Checked against `best`
          // only (the winner about to be accepted), stage-agnostic (applies regardless of which
          // BlsLookupEngine stage -- token or includes -- surfaced the winning candidate). See
          // `hasBlsGenericSubstringOnlyIdentity` and
          // `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md`. Applied via the
          // shared `guardAgainstBlsGenericSubstringCollision` helper (also used by the generic
          // multi-source fallback decision below), so the check is not bypassable simply because
          // this fast-path gate's own `best.score >= threshold` condition (0.75/0.85, higher than
          // the fallback decision's own 0.75 accept threshold) was not met for `inputType:
          // 'ambiguous'` queries.
          const substringCollisionDecision = this.guardAgainstBlsGenericSubstringCollision(
            normalizedQuery,
            this.buildDecision(normalizedQuery, scored),
            mappedCandidates,
          );
          if (substringCollisionDecision) {
            metrics.totalElapsedMs = Date.now() - resolverStartTime;
            metrics.winnerSource = null;
            metrics.winnerConfidence = null;

            if (debugCollector) {
              debugCollector.addEvaluation(this.convertToEvaluations(scored));
              debugCollector.setDecision({
                reason: 'bls_generic_substring_collision_risk',
                status: 'ambiguous',
                reasonCodes: substringCollisionDecision.reasonCodes,
              });
              debugCollector.setTotalTime(metrics.totalElapsedMs);
              debugCollector.logToConsole();
            }

            this.logSummary(metrics);
            return substringCollisionDecision;
          }

          const candidatesForConflictCheck = scored.map((c) => ({
            normalizedName: c.food.normalizedName,
            kcalPer100g: c.food.macrosPer100g.kcal,
          }));
          if (
            eligibleForPreparationStateCheck &&
            hasBlsGenericPreparationStateConflict(normalizedQuery, candidatesForConflictCheck)
          ) {
            metrics.totalElapsedMs = Date.now() - resolverStartTime;
            metrics.winnerSource = null;
            metrics.winnerConfidence = null;

            const ambiguousDecision: ResolverDecision = {
              ...this.buildDecision(normalizedQuery, scored),
              status: 'ambiguous',
              reasonCodes: ['BLS_GENERIC_PREPARATION_STATE_AMBIGUITY'],
              best: undefined,
              secondBest: undefined,
            };

            if (debugCollector) {
              debugCollector.addEvaluation(this.convertToEvaluations(scored));
              debugCollector.setDecision({
                reason: 'bls_generic_preparation_state_ambiguity',
                status: 'ambiguous',
                reasonCodes: ambiguousDecision.reasonCodes,
              });
              debugCollector.setTotalTime(metrics.totalElapsedMs);
              debugCollector.logToConsole();
            }

            this.logSummary(metrics);
            return ambiguousDecision;
          }

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

        // RESOLVER-V2-003: OFF no longer short-circuits on its own confidence — every source
        // (besides the deterministic user-alias and DACH/BLS-truth fast paths above) always
        // contributes its candidates so the multi-source comparison below can pick the best
        // match across OFF/USDA/BLS instead of OFF pre-empting USDA on confidence alone.
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
      // RESOLVER-V3-051: a BLS candidate can also reach this generic multi-source fallback
      // decision -- not just the dedicated BLS fast-path gate above -- whenever the fast-path
      // gate's own (higher) score threshold was not met (e.g. `inputType: 'ambiguous'` queries
      // needing >=0.85 there, but only >=0.75 to accept here). The substring-collision guard must
      // therefore also run here, or a query like "Ein Snack" (classified `ambiguous`, BLS score
      // ~0.83) would bypass the gate entirely and still be confidently accepted through this path.
      const rawDecision = this.buildDecision(normalizedQuery, scoredCandidates);
      const decision =
        this.guardAgainstBlsGenericSubstringCollision(
          normalizedQuery,
          rawDecision,
          filteredCandidates,
        ) ?? rawDecision;
      metrics.winnerSource = decision.best?.source ?? null;
      metrics.winnerConfidence = decision.best?.score ?? null;

      // RESOLVER-V2-004: Candidate Fusion Layer ranking rationale, so a cross-source decision
      // (as opposed to an early-return short-circuit above) is traceable without needing the
      // full JSON debug dump (which additionally requires enableDebugLogs+enableTracing).
      if (isDebugLoggingEnabled() && traceId) {
        const rankingSummary = scoredCandidates
          .map(
            (candidate, index) =>
              `#${index + 1} source=${candidate.source} score=${candidate.score.toFixed(3)} name="${candidate.food.name}"`,
          )
          .join(' | ');
        console.log(
          `[${traceId}] RANKING query="${normalizedQuery}" candidateCount=${scoredCandidates.length} ${rankingSummary}`,
        );
      }

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

  /**
   * RESOLVER-V3-051: shared guard applied wherever a BLS candidate could become `decision.best`
   * -- both the dedicated BLS generic fast-path gate and the generic multi-source fallback
   * decision reach a BLS winner through independent threshold logic (the gate's own 0.75/0.85
   * `best.score` check vs. `ResolverDecisionPolicy`'s 0.75 accept threshold), so the check must
   * run at both sites to be genuinely stage/path-agnostic rather than trivially bypassable by
   * whichever path a given query happens to take.
   *
   * Deliberately does NOT require `decision.status === 'accepted'` (post-merge review finding,
   * 2026-07-25): `buildResolverDecision` always sets `best = sorted[0]` whenever any candidate
   * exists, regardless of computed status -- an ordinary `ambiguous` (`MULTIPLE_CLOSE_MATCHES`,
   * a real near-tied second candidate under `DELTA_THRESHOLD`, nothing to do with this task) still
   * carries a populated `best`. `LogFoodFromRawInputUseCase.execute()` reads `decision.best` and
   * persists it whenever `resolved.score >= 0.7`, **never consulting `decision.status` at all** --
   * so a status-gated guard here would leave every substring-collision candidate that happens to
   * have a close second-place score (e.g. "Anis" -> "Japanische Wollmispel/Loquat, roh", score
   * 1.0, resolver status `ambiguous`) fully exploitable through the exact production path this
   * task exists to close. Runs on any populated BLS `best`; returns a downgraded, honest
   * `ambiguous` decision (candidates preserved, `best`/`secondBest` cleared) if it is a substring-
   * only identity for `normalizedQuery` (`hasBlsGenericSubstringOnlyIdentity`); returns `null` (no
   * change needed) otherwise. Scoped to `best.score >= 0.7` -- `LogFoodFromRawInputUseCase`'s own
   * persistence gate -- so a genuinely low-confidence `best` that was already safely `rejected`
   * (and would never have been persisted regardless) is not needlessly relabeled `ambiguous`.
   */
  private guardAgainstBlsGenericSubstringCollision(
    normalizedQuery: string,
    decision: ResolverDecision,
    rawCandidates: RawResolverCandidate[],
  ): ResolverDecision | null {
    if (!decision.best || decision.best.score < 0.7) return null;
    if (decision.best.source !== RESOLVER_SOURCE_LABELS.BLS) return null;

    const rawMatch = rawCandidates.find((c) => c.id === decision.best!.id)?.match;
    if (!rawMatch) return null;

    if (
      !hasBlsGenericSubstringOnlyIdentity(normalizedQuery, {
        normalizedName: decision.best.food.normalizedName,
        exact: rawMatch.exact,
      })
    ) {
      return null;
    }

    return {
      ...decision,
      status: 'ambiguous',
      reasonCodes: ['BLS_GENERIC_SUBSTRING_COLLISION_RISK'],
      best: undefined,
      secondBest: undefined,
    };
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

    if (isDebugLoggingEnabled())
      console.log(
        `PROOF_INPUT_CONFIDENCE level="${inputConfidence.level}" reason="${inputConfidence.reason}"`,
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
    if (decisionBest?.source === RESOLVER_SOURCE_LABELS.BLS) {
      console.log(`[${metrics.traceId ?? 'unknown'}] PROOF_BLS_SOURCE_USED source="bls"`);

      if (isDebugLoggingEnabled() && decisionBest.food.sourceId?.startsWith('shortcut:'))
        console.log(`[${metrics.traceId ?? 'unknown'}] PROOF_CANONICAL_SHORTCUT_USED`);
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
   * DACH Data Strategy: Determine source routing strategy based on input classification.
   *
   * Locale-based source priority lives here in one place so future non-DACH markets can get
   * their own trusted-source ordering (e.g. a "fr"/"it" canonical source) by adding a branch,
   * without touching the dispatch loop itself.
   */
  private determineSourceRoutingStrategy(query: FoodSearchQuery): SourceRoutingStrategy {
    const inputType = query.inputType || 'ambiguous';
    const locale = query.locale || 'en';

    // Branded products: OFF is the branded-product database; BLS has no branded data, so it
    // never leads regardless of locale.
    if (inputType === 'branded') {
      return {
        name: 'BRANDED_OFF_FIRST',
        sourcePriority: ['user', 'off', 'bls', 'usda', 'ai'],
      };
    }

    // DACH-first: for German locale (generic or ambiguous/unclassified), BLS is the trusted
    // local source for the primary launch market and should be queried ahead of OFF/USDA.
    if (locale === 'de') {
      return {
        name: inputType === 'generic' ? 'DACH_GENERIC_FIRST' : 'STANDARD_SEQUENTIAL',
        sourcePriority: ['user', 'bls', 'off', 'usda', 'ai'],
      };
    }

    // Default for non-DACH locales: standard behavior, no locale-specific trusted source yet.
    return {
      name: 'STANDARD_SEQUENTIAL',
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
