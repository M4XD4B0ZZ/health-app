import { SupabasePersonalResolutionMemoryRepository } from '../infrastructure/repositories/SupabasePersonalResolutionMemoryRepository';
import type { PersonalResolutionMemory } from '../domain/models/PersonalResolutionMemory';

const at = '2026-07-21T12:00:00.000Z';
const memory = (): PersonalResolutionMemory => ({
  contractVersion: 'personal-resolution-memory-v1',
  memoryId: 'action-1',
  locale: 'de',
  scopeKey: 'bls:egg-raw',
  target: { sourceType: 'bls', sourceId: 'egg-raw', kind: 'source_grounded' },
  level: 'P0_observed',
  status: 'active',
  createdAt: at,
  updatedAt: at,
  observedAt: at,
});
const evidence = () => ({
  evidenceId: 'action-1:evidence',
  memoryId: 'action-1',
  type: 'logged_without_explicit_confirmation' as const,
  occurredAt: at,
  actionId: 'action-1',
});
const transition = () => ({
  transitionId: 'action-1:transition',
  memoryId: 'action-1',
  nextLevel: 'P0_observed' as const,
  nextStatus: 'active' as const,
  evidenceId: 'action-1:evidence',
  occurredAt: at,
});

/** Table-aware fake: each `.from(table)` call returns its own independently-scripted insert mock. */
function client(responses: Record<string, { error: { code: string } | null }[]>) {
  const cursors: Record<string, number> = {};
  const from = jest.fn((table: string) => ({
    insert: jest.fn(async () => {
      const queue = responses[table] ?? [{ error: null }];
      const i = cursors[table] ?? 0;
      cursors[table] = Math.min(i + 1, queue.length - 1);
      return queue[i];
    }),
  }));
  return { from } as any;
}

describe('RESOLVER-V3-026 SupabasePersonalResolutionMemoryRepository', () => {
  it('writes the memory row and every event row under the given owner', async () => {
    const supabase = client({
      personal_resolution_memories: [{ error: null }],
      personal_resolution_memory_events: [{ error: null }],
    });
    const repo = new SupabasePersonalResolutionMemoryRepository(supabase);

    const outcome = await repo.record('owner-a', memory(), evidence(), transition());

    expect(outcome).toBe('written');
    expect(supabase.from).toHaveBeenCalledWith('personal_resolution_memories');
    expect(supabase.from).toHaveBeenCalledWith('personal_resolution_memory_events');
    const memoriesInsert = supabase.from.mock.results.find(
      (r: any, i: number) => supabase.from.mock.calls[i][0] === 'personal_resolution_memories',
    ).value.insert;
    expect(memoriesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'owner-a',
        memory_id: 'action-1',
        contract_version: 'personal-resolution-memory-v1',
        scope_key: 'bls:egg-raw',
        status: 'active',
        level: 'P0_observed',
        payload: memory(),
      }),
    );
  });

  it('writes an evidence, a transition, and a negative-evidence event row when a correction supplies one', async () => {
    const supabase = client({
      personal_resolution_memories: [{ error: null }],
      personal_resolution_memory_events: [{ error: null }],
    });
    const repo = new SupabasePersonalResolutionMemoryRepository(supabase);
    const negativeEvidence = {
      negativeEvidenceId: 'action-1:negative',
      priorMemoryId: 'prior-1',
      correctedMemoryId: 'action-1',
      reason: 'user_correction' as const,
      correctionReference: 'prior-1',
      occurredAt: at,
    };

    await repo.record('owner-a', memory(), evidence(), transition(), negativeEvidence);

    const eventInserts = supabase.from.mock.results
      .filter(
        (_: any, i: number) =>
          supabase.from.mock.calls[i][0] === 'personal_resolution_memory_events',
      )
      .map((r: any) => r.value.insert.mock.calls[0][0]);
    expect(eventInserts).toHaveLength(3);
    expect(eventInserts.map((e: any) => e.event_type)).toEqual([
      'evidence',
      'transition',
      'negative_evidence',
    ]);
    expect(eventInserts[2]).toMatchObject({ owner_id: 'owner-a', event_id: 'action-1:negative' });
  });

  it('maps a unique-violation on the memory row to duplicate, still writing any missing events', async () => {
    const supabase = client({
      personal_resolution_memories: [{ error: { code: '23505' } }],
      personal_resolution_memory_events: [{ error: null }],
    });
    const repo = new SupabasePersonalResolutionMemoryRepository(supabase);

    const outcome = await repo.record('owner-a', memory(), evidence(), transition());

    expect(outcome).toBe('duplicate');
  });

  it('maps a non-duplicate memory insert failure to failed and does not attempt event writes', async () => {
    const supabase = client({
      personal_resolution_memories: [{ error: { code: '42501' } }],
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const repo = new SupabasePersonalResolutionMemoryRepository(supabase);

    const outcome = await repo.record('owner-a', memory(), evidence(), transition());

    expect(outcome).toBe('failed');
    expect(supabase.from).not.toHaveBeenCalledWith('personal_resolution_memory_events');
    expect(warn).toHaveBeenCalledWith(
      '[SupabasePersonalResolutionMemoryRepository] memory insert failed',
      '42501',
    );
    warn.mockRestore();
  });

  it('reports failed if an event insert fails for a reason other than duplicate, even after the memory row wrote', async () => {
    const supabase = client({
      personal_resolution_memories: [{ error: null }],
      personal_resolution_memory_events: [{ error: { code: '42501' } }],
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const repo = new SupabasePersonalResolutionMemoryRepository(supabase);

    const outcome = await repo.record('owner-a', memory(), evidence(), transition());

    expect(outcome).toBe('failed');
    warn.mockRestore();
  });

  it('fails closed without an owner and never issues a write', async () => {
    const supabase = client({});
    const repo = new SupabasePersonalResolutionMemoryRepository(supabase);

    const outcome = await repo.record('', memory(), evidence(), transition());

    expect(outcome).toBe('failed');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
