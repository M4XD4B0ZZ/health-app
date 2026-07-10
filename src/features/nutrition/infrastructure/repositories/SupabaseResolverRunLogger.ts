import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ResolverRunLogger,
  ResolverRunRecord,
} from '../../application/ports/ResolverRunLogger';

/**
 * Writes one row per resolver decision to `public.food_resolver_runs` (RESOLVER-V2-006).
 *
 * IMPORTANT:
 * - Requires the user to be authenticated (auth session must exist); silently skips
 *   otherwise, matching SupabaseUserAliasSource's pattern -- this is best-effort telemetry,
 *   not a feature the user directly depends on.
 * - Never throws: callers use this fire-and-forget from the resolver's hot path, so a
 *   logging failure must never affect food resolution.
 * - `winner_item_id` is intentionally left unset. Not every winning candidate (e.g. BLS
 *   static-source or user-alias fast-path winners) has a corresponding row in
 *   food_catalog_items, and that table's FK constraint would reject the insert for those
 *   cases. Mapping winners to a real food_catalog_items.id is left for a follow-up task;
 *   for now the winner is still fully captured via winner_source/winner_confidence/metadata.
 */
export class SupabaseResolverRunLogger implements ResolverRunLogger {
  constructor(private readonly supabase: SupabaseClient) {}

  async log(record: ResolverRunRecord): Promise<void> {
    try {
      const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user?.id) {
        return;
      }

      const { error } = await this.supabase.from('food_resolver_runs').insert({
        normalized_query: record.normalizedQuery,
        locale: record.locale,
        user_id: sessionData.session.user.id,
        winner_source: record.winnerSource,
        winner_confidence: record.winnerConfidence,
        cache_hit: record.cacheHit,
        resolver_version: 'v2',
        metadata: {
          status: record.status,
          reasonCodes: record.reasonCodes,
          candidateCount: record.candidateCount,
          winnerName: record.winnerName ?? null,
        },
      });

      if (error) {
        console.warn('[SupabaseResolverRunLogger] insert failed', error.message);
      }
    } catch (e) {
      console.warn('[SupabaseResolverRunLogger] unexpected error', e);
    }
  }
}
