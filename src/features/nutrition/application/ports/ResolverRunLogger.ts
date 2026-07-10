/**
 * Port: ResolverRunLogger
 * Persists a fire-and-forget record of a completed resolver decision
 * (RESOLVER-V2-006). Must never throw or block the resolver's hot path --
 * implementations are expected to swallow their own errors.
 */
export interface ResolverRunRecord {
  normalizedQuery: string;
  locale: string;
  winnerSource: string | null;
  winnerConfidence: number | null;
  cacheHit: boolean;
  status: string;
  reasonCodes: string[];
  candidateCount: number;
  winnerName?: string;
}

export interface ResolverRunLogger {
  log(record: ResolverRunRecord): Promise<void>;
}

export class NoopResolverRunLogger implements ResolverRunLogger {
  async log(): Promise<void> {
    // Intentionally does nothing (default for tests / environments without a configured logger).
  }
}
