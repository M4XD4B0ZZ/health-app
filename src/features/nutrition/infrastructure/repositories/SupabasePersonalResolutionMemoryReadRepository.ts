import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersonalResolutionMemoryLevel } from '../../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryReadRepository,
  PersonalResolutionMemoryReadRow,
} from '../../application/ports/PersonalResolutionMemoryReadRepository';

/**
 * Owner-scoped production adapter for RESOLVER-V3-019's read-only port. Read-only single
 * `select` on `personal_resolution_memories`, filtered to `status = 'active'` and the exact
 * requested scope keys — no other table is touched, and no new migration is required: the
 * RESOLVER-V3-017 migration already grants `authenticated` `select` on this table under the
 * existing owner-only RLS policy, so `owner_id` is both filtered here and enforced again by RLS
 * (defense in depth). Any query error or empty/absent input fails closed to an empty result
 * rather than throwing, so a lookup problem can never turn into a resolution failure.
 */
export class SupabasePersonalResolutionMemoryReadRepository implements PersonalResolutionMemoryReadRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findActiveByScopeKeys(
    ownerId: string,
    scopeKeys: string[],
  ): Promise<PersonalResolutionMemoryReadRow[]> {
    if (!ownerId || scopeKeys.length === 0) return [];

    const { data, error } = await this.supabase
      .from('personal_resolution_memories')
      .select('memory_id, scope_key, level')
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .in('scope_key', scopeKeys);

    if (error) {
      warn('select failed', error.code);
      return [];
    }

    return (data ?? []).map((row: { memory_id: string; scope_key: string; level: string }) => ({
      memoryId: row.memory_id,
      scopeKey: row.scope_key,
      level: row.level as PersonalResolutionMemoryLevel,
    }));
  }
}

function warn(message: string, code: string | undefined): void {
  console.warn(`[SupabasePersonalResolutionMemoryReadRepository] ${message}`, code ?? 'unknown');
}
