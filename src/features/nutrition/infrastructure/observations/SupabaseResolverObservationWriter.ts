import type { SupabaseClient } from '@supabase/supabase-js';
import { validateResolverObservation } from '../../application/observations/ResolverObservationValidator';
import type {
  ResolverObservationWriter,
  ResolverObservationWriteRequest,
  ResolverObservationWriteResult,
} from '../../application/ports/ResolverObservationWriter';

/** Dedicated private V1 observation persistence adapter; it has no read API. */
export class SupabaseResolverObservationWriter implements ResolverObservationWriter {
  constructor(private readonly supabase: SupabaseClient) {}

  async write({
    ownerId,
    observation,
  }: ResolverObservationWriteRequest): Promise<ResolverObservationWriteResult> {
    try {
      validateResolverObservation(observation);
    } catch {
      return { status: 'failed', code: 'validation_failed' };
    }
    if (!ownerId) return { status: 'failed', code: 'write_failed' };

    try {
      const { error } = await this.supabase.from('resolver_observations').insert({
        owner_id: ownerId,
        observation_id: observation.observationId,
        resolver_run_id: observation.resolverRunId,
        contract_version: observation.contractVersion,
        occurred_at: observation.occurredAt,
        observation_payload: observation,
      });
      if (!error) return { status: 'written' };
      if (error.code === '23505') return { status: 'duplicate' };
      console.warn('[SupabaseResolverObservationWriter] insert failed', error.code ?? 'unknown');
      return { status: 'failed', code: 'write_failed' };
    } catch {
      console.warn('[SupabaseResolverObservationWriter] unexpected insert failure');
      return { status: 'failed', code: 'write_failed' };
    }
  }
}
