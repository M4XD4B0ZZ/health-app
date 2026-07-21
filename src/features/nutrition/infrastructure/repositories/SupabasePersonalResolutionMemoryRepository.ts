import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PersonalResolutionMemory,
  PersonalResolutionMemoryEvidence,
  PersonalResolutionMemoryTransition,
  PersonalResolutionNegativeEvidence,
} from '../../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryRecordOutcome,
  PersonalResolutionMemoryRepository,
} from '../../application/ports/PersonalResolutionMemoryRepository';

const DUPLICATE_KEY_ERROR = '23505';

type MemoryEvent =
  | { kind: 'evidence'; event: PersonalResolutionMemoryEvidence }
  | { kind: 'transition'; event: PersonalResolutionMemoryTransition }
  | { kind: 'negative_evidence'; event: PersonalResolutionNegativeEvidence };

/**
 * Owner-scoped production adapter for RESOLVER-V3-017's write-only port. Mirrors the sequencing
 * used by `SupabaseResolverObservationWriter`: plain client-side inserts, duplicates detected via
 * Postgres unique-violation code `23505` rather than a pre-check read (there is no read API on
 * this port). Every ID written here (`memory.memoryId`, and each event's own event ID) is derived
 * deterministically from the caller's action ID, so a literal retry re-sends byte-identical rows
 * and every insert past the first is naturally absorbed by the unique constraints — this adapter
 * does not attempt a single cross-table transaction (no RPC/stored-function precedent exists
 * anywhere in this codebase; see the invalidation contract doc for the same documented boundary).
 * A non-duplicate failure on any insert is reported as `'failed'`, even if the memory row itself
 * was written, so a caller never mistakes a partially-written action for a complete one.
 */
export class SupabasePersonalResolutionMemoryRepository implements PersonalResolutionMemoryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async record(
    ownerId: string,
    memory: PersonalResolutionMemory,
    evidence: PersonalResolutionMemoryEvidence,
    transition: PersonalResolutionMemoryTransition,
    negativeEvidence?: PersonalResolutionNegativeEvidence,
  ): Promise<PersonalResolutionMemoryRecordOutcome> {
    if (!ownerId) return 'failed';

    const { error: memoryError } = await this.supabase.from('personal_resolution_memories').insert({
      owner_id: ownerId,
      memory_id: memory.memoryId,
      contract_version: memory.contractVersion,
      scope_key: memory.scopeKey,
      status: memory.status,
      level: memory.level,
      payload: memory,
      created_at: memory.createdAt,
      updated_at: memory.updatedAt,
    });

    if (memoryError && memoryError.code !== DUPLICATE_KEY_ERROR) {
      warn('memory insert failed', memoryError.code);
      return 'failed';
    }
    const memoryIsDuplicate = Boolean(memoryError);

    const events: MemoryEvent[] = [
      { kind: 'evidence', event: evidence },
      { kind: 'transition', event: transition },
      ...(negativeEvidence
        ? [{ kind: 'negative_evidence' as const, event: negativeEvidence }]
        : []),
    ];

    for (const { kind, event } of events) {
      const eventId =
        kind === 'evidence'
          ? (event as PersonalResolutionMemoryEvidence).evidenceId
          : kind === 'transition'
            ? (event as PersonalResolutionMemoryTransition).transitionId
            : (event as PersonalResolutionNegativeEvidence).negativeEvidenceId;

      const { error } = await this.supabase.from('personal_resolution_memory_events').insert({
        owner_id: ownerId,
        event_id: eventId,
        memory_id: memory.memoryId,
        event_type: kind,
        payload: event,
        occurred_at: event.occurredAt,
      });
      if (error && error.code !== DUPLICATE_KEY_ERROR) {
        warn(`${kind} event insert failed`, error.code);
        return 'failed';
      }
    }

    return memoryIsDuplicate ? 'duplicate' : 'written';
  }
}

function warn(message: string, code: string | undefined): void {
  console.warn(`[SupabasePersonalResolutionMemoryRepository] ${message}`, code ?? 'unknown');
}
