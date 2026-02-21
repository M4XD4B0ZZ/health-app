import type { SupabaseClient } from '@supabase/supabase-js';
import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError';
import type {
  FoodCatalogSource,
  FoodSearchQuery,
  FoodCandidate,
} from '../../../domain/catalog/FoodCatalogSource';
import type { FoodCatalogConfig } from '../../../domain/models/FoodCatalogConfig';

/**
 * Reads per-user alias mappings from `public.user_food_aliases` using RLS.
 *
 * IMPORTANT:
 * - Requires the user to be authenticated (auth session must exist).
 * - Only returns a hit if `target_item_id` is present (i.e., alias points to a catalog item).
 *   If you haven't built `food_catalog_items` yet, you can still store aliases,
 *   but they won't resolve to a canonical item until target_item_id is set.
 */
export class SupabaseUserAliasSource implements FoodCatalogSource {
  type = 'user' as const;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: FoodCatalogConfig,
  ) {}

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    const startedAt = Date.now();

    // If debug logs disabled, still keep the logic deterministic.
    const log = (...args: any[]) => {
      if (!this.config.enableDebugLogs) return;
      // keep it consistent with your existing resolver logs
      console.log('[SupabaseUserAliasSource]', ...args);
    };

    try {
      // Use cached session (no extra network call in the happy path)
      const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();

      if (sessionError) {
        // Treat as network/auth boundary error
        throw FoodCatalogError.network(
          'Failed to read auth session for alias lookup',
          sessionError,
        );
      }

      const session = sessionData.session;
      if (!session?.user?.id) {
        log('no session → skip', { traceId: query.traceId });
        return [];
      }

      const userId = session.user.id;

      // Query user aliases (RLS enforces user ownership, but we also filter by user_id explicitly)
      const { data, error } = await this.supabase
        .from('user_food_aliases')
        .select('id,user_id,alias_text,normalized_alias,locale,target_item_id')
        .eq('user_id', userId)
        .eq('normalized_alias', query.normalized)
        .eq('locale', query.locale)
        .limit(1);

      if (error) {
        // This is most commonly RLS/permissions or network edge cases
        throw FoodCatalogError.edge('Failed to query user_food_aliases', error);
      }

      const row = data?.[0];
      const elapsedMs = Date.now() - startedAt;

      if (!row) {
        log('miss', {
          traceId: query.traceId,
          elapsedMs,
          normalized: query.normalized,
          locale: query.locale,
        });
        return [];
      }

      // If alias exists but doesn't point anywhere yet, treat as "not resolvable"
      // (useful while `food_catalog_items` isn't implemented)
      if (!row.target_item_id) {
        log('hit but no target_item_id → skip', {
          traceId: query.traceId,
          elapsedMs,
          aliasId: row.id,
          normalized: query.normalized,
          locale: query.locale,
        });
        return [];
      }

      // Return a high-confidence alias resolution result
      // Note: This is a placeholder until food_catalog_items is implemented
      const candidate: FoodCandidate = {
        food: {
          id: `user-alias-${row.id}`,
          name: row.alias_text,
          normalizedName: row.normalized_alias,
          macrosPer100g: {
            kcal: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: 'user',
          sourceId: row.target_item_id,
        },
        match: {
          exact: true,
          similarity: 1.0,
          usedHeuristic: 'alias',
        },
        confidence: 1.0,
        reasons: ['User-defined alias', `Points to catalog item: ${row.target_item_id}`],
      };

      log('hit', {
        traceId: query.traceId,
        elapsedMs,
        itemId: row.target_item_id,
        confidence: 1.0,
      });

      return [candidate];
    } catch (e: any) {
      // If it's already a FoodCatalogError, bubble up.
      if (e instanceof FoodCatalogError) throw e;

      // Otherwise wrap as network (safe default)
      throw FoodCatalogError.network('Alias source failed unexpectedly', e);
    }
  }
}
