export interface ResolverDebugLog {
  query: {
    raw: string;
    normalized: string;
    canonicalId?: string;
    locale: string;
    traceId?: string;
  };
  sources: SourceDebugInfo[];
  evaluation: CandidateEvaluation[];
  decision: DecisionInfo;
  timing: {
    totalMs: number;
    sourceTimings: Record<string, number>;
  };
}

export interface SourceDebugInfo {
  source: 'off' | 'bls' | 'usda' | 'user';
  status: 'success' | 'error' | 'skipped' | 'timeout';
  durationMs: number;
  candidates: SourceCandidate[];
  error?: string;
  skippedReason?: 'circuit_open' | 'budget_exceeded';
}

export interface SourceCandidate {
  name: string;
  normalizedName: string;
  similarity: number;
  exact: boolean;
  macrosPer100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  source: string;
  id: string;
}

export interface CandidateEvaluation {
  name: string;
  source: string;
  similarity: number;
  exact: boolean;
  macrosPer100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  scores: {
    match: number;
    dataQuality: number;
    kcalConsistency: number;
    sourceTrust: number;
    final: number;
  };
  notes: string[];
}

export interface DecisionInfo {
  winner?: string;
  source?: string;
  confidence?: number;
  reason: 'early_return_user' | 'early_return_bls' | 'best_score' | 'no_candidates' | 'cache_hit';
  status: 'accepted' | 'ambiguous' | 'rejected';
  reasonCodes: string[];
}

export class ResolverDebugCollector {
  private debugLog: Partial<ResolverDebugLog> = {
    sources: [],
    evaluation: [],
    timing: {
      totalMs: 0,
      sourceTimings: {},
    },
  };

  constructor(
    query: string,
    normalizedQuery: string,
    canonicalId: string | undefined,
    locale: string,
    traceId?: string,
  ) {
    this.debugLog.query = {
      raw: query,
      normalized: normalizedQuery,
      canonicalId,
      locale,
      traceId,
    };
  }

  addSourceResult(sourceInfo: SourceDebugInfo): void {
    this.debugLog.sources!.push(sourceInfo);
    this.debugLog.timing!.sourceTimings[sourceInfo.source] = sourceInfo.durationMs;
  }

  addEvaluation(evaluations: CandidateEvaluation[]): void {
    this.debugLog.evaluation!.push(...evaluations);
  }

  setDecision(decision: DecisionInfo): void {
    this.debugLog.decision = decision;
  }

  setTotalTime(totalMs: number): void {
    this.debugLog.timing!.totalMs = totalMs;
  }

  getLog(): ResolverDebugLog {
    return this.debugLog as ResolverDebugLog;
  }

  logToConsole(prefix: string = '[RESOLVER_DEBUG]'): void {
    console.log(`${prefix}`, JSON.stringify(this.debugLog, null, 2));
  }
}
