import { InvalidatePersonalResolutionMemoryUseCase } from '../application/usecases/InvalidatePersonalResolutionMemoryUseCase';
import { InMemoryPersonalResolutionMemoryInvalidationRepository } from '../infrastructure/repositories/InMemoryPersonalResolutionMemoryInvalidationRepository';
import type { PersonalResolutionMemory } from '../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryInvalidationEvent,
  PersonalResolutionMemoryInvalidationPlan,
  PersonalResolutionMemoryInvalidationResult,
} from '../domain/models/PersonalResolutionMemoryInvalidation';
import type {
  PersonalResolutionMemoryInvalidationCommitOutcome,
  PersonalResolutionMemoryInvalidationRepository,
  PersonalResolutionMemoryLookup,
} from '../application/ports/PersonalResolutionMemoryInvalidationRepository';

const v = 'personal-resolution-memory-v1' as const;
const at = '2026-07-21T11:00:00.000Z';
function memory(
  id: string,
  level: PersonalResolutionMemory['level'] = 'P1_provisional',
  status: PersonalResolutionMemory['status'] = 'active',
): PersonalResolutionMemory {
  return {
    contractVersion: v,
    memoryId: id,
    locale: 'de',
    scopeKey: `scope-${id}`,
    target: { sourceType: 'catalog', sourceId: `source-${id}`, kind: 'source_grounded' },
    level,
    status,
    createdAt: at,
    updatedAt: at,
    observedAt: at,
  };
}
function request(memoryId = 'one', reason = 'user_correction', actionId = 'action-1') {
  return {
    contractVersion: 'personal-resolution-memory-invalidation-v1',
    ownerId: 'owner-a',
    memoryId,
    actionId,
    reason,
    occurredAt: at,
  };
}
describe('RESOLVER-V3-018 personal memory invalidation', () => {
  it.each([
    ['contradiction', 'contradicted'],
    ['user_correction', 'superseded'],
    ['explicit_user_delete', 'deleted'],
    ['source_unavailable', 'deleted'],
  ])('transitions active P0/P2 safely for %s', async (reason, status) => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed(
      'owner-a',
      memory(
        'one',
        reason === 'explicit_user_delete' || reason === 'source_unavailable'
          ? 'P2_confirmed'
          : 'P0_observed',
      ),
    );
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('one', reason),
    );
    expect(out.status).toBe('invalidated');
    expect(repo.events[0].nextStatus).toBe(status);
  });
  it('weakens a provisional source-unavailable memory without treating P2 as immutable', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('one'));
    const useCase = new InvalidatePersonalResolutionMemoryUseCase(repo);
    expect((await useCase.execute(request('one', 'source_unavailable'))).status).toBe('weakened');
    expect(repo.events[0].nextLevel).toBe('P0_observed');
  });
  it('is idempotent and writes one audit event for a repeated action', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('one'));
    const useCase = new InvalidatePersonalResolutionMemoryUseCase(repo);
    await useCase.execute(request());
    await useCase.execute(request());
    expect(repo.events).toHaveLength(1);
  });
  it('fails closed for versions, reasons, missing owner, missing target and other owners', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-b', memory('one'));
    const useCase = new InvalidatePersonalResolutionMemoryUseCase(repo);
    await expect(
      useCase.execute({ ...request(), contractVersion: 'unknown' }),
    ).resolves.toMatchObject({ status: 'invalid_request', code: 'unknown_contract_version' });
    await expect(useCase.execute(request('one', 'free-text'))).resolves.toMatchObject({
      status: 'invalid_request',
      code: 'unknown_reason',
    });
    await expect(useCase.execute({ ...request(), ownerId: '' })).resolves.toMatchObject({
      status: 'invalid_request',
      code: 'missing_owner',
    });
    await expect(useCase.execute({ ...request(), memoryId: '' })).resolves.toMatchObject({
      status: 'invalid_request',
      code: 'missing_memory_id',
    });
    await expect(useCase.execute(request())).resolves.toMatchObject({
      status: 'blocked_owner_mismatch',
    });
  });
  it('propagates direct and multi-step private dependencies deterministically', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-a', memory('b'), ['a']);
    repo.seed('owner-a', memory('c'), ['b']);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out.affectedMemoryIds).toEqual(['a', 'b', 'c']);
    expect(repo.events.map((event) => event.reason)).toEqual([
      'contradiction',
      'dependency_invalidated',
      'dependency_invalidated',
    ]);
  });
  it('fails closed for dependency cycles and traversal limits', async () => {
    const cycle = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    cycle.seed('owner-a', memory('a'), ['b']);
    cycle.seed('owner-a', memory('b'), ['a']);
    await expect(
      new InvalidatePersonalResolutionMemoryUseCase(cycle).execute(request('a')),
    ).resolves.toMatchObject({ status: 'failed', code: 'cycle_detected' });
    const deep = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    for (let i = 0; i < 101; i++) deep.seed('owner-a', memory(String(i)), i ? [String(i - 1)] : []);
    await expect(
      new InvalidatePersonalResolutionMemoryUseCase(deep).execute(request('0')),
    ).resolves.toMatchObject({ status: 'failed', code: 'traversal_limit_exceeded' });
  });
});

describe('RESOLVER-V3-027 graph correctness', () => {
  function seedDiamond(repo: InMemoryPersonalResolutionMemoryInvalidationRepository): void {
    // A -> {B, C} -> D  (D is reachable via two valid, acyclic paths)
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-a', memory('b'), ['a']);
    repo.seed('owner-a', memory('c'), ['a']);
    repo.seed('owner-a', memory('d'), ['b', 'c']);
  }

  it('invalidates a diamond dependency graph successfully instead of reporting a false cycle', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedDiamond(repo);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out.status).toBe('invalidated');
    expect(out.code).toBeUndefined();
  });

  it('writes the diamond-reachable node exactly once, not once per path', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedDiamond(repo);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out.affectedMemoryIds.filter((id) => id === 'd')).toHaveLength(1);
    expect(repo.events.filter((event) => event.memoryId === 'd')).toHaveLength(1);
    expect(new Set(out.affectedMemoryIds).size).toBe(out.affectedMemoryIds.length);
  });

  it('true cycles still fail closed with zero mutations', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'), ['b']);
    repo.seed('owner-a', memory('b'), ['a']);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out).toMatchObject({ status: 'failed', code: 'cycle_detected', affectedMemoryIds: [] });
    expect(repo.events).toHaveLength(0);
  });

  it('produces a deterministic order that does not depend on how the diamond is re-run', async () => {
    const repoOne = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedDiamond(repoOne);
    const outOne = await new InvalidatePersonalResolutionMemoryUseCase(repoOne).execute(
      request('a', 'contradiction', 'action-order-1'),
    );
    const repoTwo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedDiamond(repoTwo);
    const outTwo = await new InvalidatePersonalResolutionMemoryUseCase(repoTwo).execute(
      request('a', 'contradiction', 'action-order-2'),
    );
    expect(outOne.affectedMemoryIds).toEqual(outTwo.affectedMemoryIds);
  });
});

describe('RESOLVER-V3-027 atomicity', () => {
  function seedChain(repo: InMemoryPersonalResolutionMemoryInvalidationRepository): void {
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-a', memory('b'), ['a']);
    repo.seed('owner-a', memory('c'), ['b']);
  }

  it.each([
    ['first', 0],
    ['middle', 1],
    ['last', 2],
  ])('a commit failure at the %s planned write leaves zero mutations', async (_label, index) => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedChain(repo);
    repo.injectCommitFailureAtWriteIndex(index);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out).toMatchObject({
      status: 'failed',
      code: 'atomic_commit_failed',
      affectedMemoryIds: [],
    });
    expect(repo.events).toHaveLength(0);
    for (const id of ['a', 'b', 'c']) {
      expect(await repo.findForInvalidation('owner-a', id)).toMatchObject({
        memory: { status: 'active' },
      });
    }
  });

  it('an event-write failure inside the commit leaves no state mutation behind', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedChain(repo);
    repo.injectCommitFailureAtWriteIndex(1);
    await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    const a = await repo.findForInvalidation('owner-a', 'a');
    expect(a).toMatchObject({ memory: { status: 'active' } });
    expect(repo.events).toHaveLength(0);
  });

  it('a state-write failure inside the commit leaves no event behind', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedChain(repo);
    repo.injectCommitFailureAtWriteIndex(2);
    await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(repo.events).toHaveLength(0);
    const c = await repo.findForInvalidation('owner-a', 'c');
    expect(c).toMatchObject({ memory: { status: 'active' } });
  });

  it('a failed result always means the prior state is fully preserved, and a retry succeeds fully', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    seedChain(repo);
    repo.injectCommitFailureAtWriteIndex(0);
    const failed = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction', 'retry-action'),
    );
    expect(failed.status).toBe('failed');
    expect(repo.events).toHaveLength(0);

    const retried = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction', 'retry-action'),
    );
    expect(retried.status).toBe('invalidated');
    expect(retried.affectedMemoryIds).toEqual(['a', 'b', 'c']);
    expect(repo.events).toHaveLength(3);
  });
});

describe('RESOLVER-V3-027 already-inactive nodes', () => {
  it('an already-inactive root still invalidates its active dependent', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('root', 'P1_provisional', 'superseded'));
    repo.seed('owner-a', memory('dependent'), ['root']);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('root', 'contradiction'),
    );
    expect(out.status).toBe('already_inactive');
    expect(out.affectedMemoryIds).toEqual(['dependent']);
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0].memoryId).toBe('dependent');
  });

  it('an already-inactive intermediate node still propagates to an active descendant', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('root'));
    repo.seed('owner-a', memory('middle', 'P1_provisional', 'deleted'), ['root']);
    repo.seed('owner-a', memory('leaf'), ['middle']);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('root', 'contradiction'),
    );
    expect(out.affectedMemoryIds).toEqual(['root', 'leaf']);
    expect(repo.events.map((event) => event.memoryId)).toEqual(['root', 'leaf']);
  });

  it('an already-inactive node never receives a duplicate audit event across unrelated actions', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('root', 'P1_provisional', 'contradicted'));
    repo.seed('owner-a', memory('dependent'), ['root']);
    const useCase = new InvalidatePersonalResolutionMemoryUseCase(repo);
    await useCase.execute(request('root', 'contradiction', 'action-1'));
    await useCase.execute(request('root', 'user_correction', 'action-2'));
    const rootEvents = repo.events.filter((event) => event.memoryId === 'root');
    expect(rootEvents).toHaveLength(0);
  });

  it('a retry after a simulated partial-failure scenario still reaches active dependents', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('root'));
    repo.seed('owner-a', memory('dependent'), ['root']);
    repo.injectCommitFailureAtWriteIndex(1);
    const failed = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('root', 'contradiction', 'partial-then-retry'),
    );
    expect(failed.status).toBe('failed');
    expect(repo.events).toHaveLength(0);

    const retried = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('root', 'contradiction', 'partial-then-retry'),
    );
    expect(retried.status).toBe('invalidated');
    expect(retried.affectedMemoryIds).toEqual(['root', 'dependent']);
  });
});

describe('RESOLVER-V3-027 idempotence', () => {
  it('the same action ID twice returns the same result and writes nothing twice', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-a', memory('b'), ['a']);
    const useCase = new InvalidatePersonalResolutionMemoryUseCase(repo);
    const first = await useCase.execute(request('a', 'contradiction', 'dup-action'));
    const second = await useCase.execute(request('a', 'contradiction', 'dup-action'));
    expect(second).toEqual(first);
    expect(repo.events).toHaveLength(2);
  });

  it('the same action ID after a simulated commit failure is not treated as already committed', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    repo.injectCommitFailureAtWriteIndex(0);
    const failed = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction', 'retry-id'),
    );
    expect(failed.status).toBe('failed');
    const succeeded = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction', 'retry-id'),
    );
    expect(succeeded.status).toBe('invalidated');
    expect(repo.events).toHaveLength(1);
  });

  it('different action IDs against an already-inactive graph do not produce contradictory mutations', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    const useCase = new InvalidatePersonalResolutionMemoryUseCase(repo);
    const first = await useCase.execute(request('a', 'contradiction', 'action-1'));
    expect(first.status).toBe('invalidated');
    const second = await useCase.execute(request('a', 'user_correction', 'action-2'));
    expect(second.status).toBe('already_inactive');
    expect(second.affectedMemoryIds).toEqual([]);
    expect(repo.events).toHaveLength(1);
  });

  it('writes exactly one event per transition that was actually written', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-a', memory('b'), ['a']);
    repo.seed('owner-a', memory('c'), ['a']);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(repo.events).toHaveLength(out.affectedMemoryIds.length);
    expect(new Set(repo.events.map((event) => event.eventId)).size).toBe(repo.events.length);
  });
});

/**
 * Minimal repository test double that deliberately does NOT owner-filter dependency edges, so it
 * can simulate a corrupted/malicious graph (a dangling edge, or a cross-owner edge) even though the
 * production in-memory adapter and the hardened migration make that structurally impossible. This
 * exercises the use case's own defense-in-depth referential-integrity check.
 */
class CorruptedEdgeRepository implements PersonalResolutionMemoryInvalidationRepository {
  readonly writtenEvents: PersonalResolutionMemoryInvalidationEvent[] = [];
  private readonly memories = new Map<
    string,
    { ownerId: string; memory: PersonalResolutionMemory }
  >();
  private readonly committed = new Map<string, PersonalResolutionMemoryInvalidationResult>();
  constructor(private readonly corruptDependents: Record<string, string[]>) {}
  seed(ownerId: string, m: PersonalResolutionMemory): void {
    this.memories.set(m.memoryId, { ownerId, memory: m });
  }
  async findForInvalidation(
    ownerId: string,
    memoryId: string,
  ): Promise<PersonalResolutionMemoryLookup> {
    const found = this.memories.get(memoryId);
    return !found
      ? { kind: 'not_found' }
      : found.ownerId !== ownerId
        ? { kind: 'owner_mismatch' }
        : { kind: 'found', memory: found.memory };
  }
  async findDependents(_ownerId: string, memoryId: string): Promise<string[]> {
    return this.corruptDependents[memoryId] ?? [];
  }
  async findCommittedAction(
    ownerId: string,
    actionId: string,
  ): Promise<PersonalResolutionMemoryInvalidationResult | null> {
    return this.committed.get(`${ownerId}:${actionId}`) ?? null;
  }
  async applyInvalidationPlanAtomically(
    plan: PersonalResolutionMemoryInvalidationPlan,
  ): Promise<PersonalResolutionMemoryInvalidationCommitOutcome> {
    for (const entry of plan.entries)
      if (entry.classification === 'write' && entry.event) this.writtenEvents.push(entry.event);
    this.committed.set(`${plan.ownerId}:${plan.actionId}`, plan.result);
    return 'applied';
  }
}

describe('RESOLVER-V3-027 owner isolation', () => {
  it('a root belonging to another owner is blocked before any traversal', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-b', memory('a'));
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out).toMatchObject({ status: 'blocked_owner_mismatch', affectedMemoryIds: [] });
    expect(repo.events).toHaveLength(0);
  });

  it('a dependency edge pointing at a non-existent memory fails closed as invalid_dependency', async () => {
    const repo = new CorruptedEdgeRepository({ a: ['ghost'] });
    repo.seed('owner-a', memory('a'));
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out).toMatchObject({
      status: 'failed',
      code: 'invalid_dependency',
      affectedMemoryIds: [],
    });
    expect(repo.writtenEvents).toHaveLength(0);
  });

  it('a manipulated cross-owner dependency edge fails closed and writes nothing', async () => {
    const repo = new CorruptedEdgeRepository({ a: ['other-owner-memory'] });
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-b', memory('other-owner-memory'));
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out).toMatchObject({
      status: 'failed',
      code: 'invalid_dependency',
      affectedMemoryIds: [],
    });
    expect(out.affectedMemoryIds.join()).not.toContain('other-owner-memory');
    expect(repo.writtenEvents).toHaveLength(0);
  });

  it('a missing owner is rejected before any repository access', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute({
      ...request('a', 'contradiction'),
      ownerId: '',
    });
    expect(out).toMatchObject({ status: 'invalid_request', code: 'missing_owner' });
  });

  it('never surfaces another owner memory ID in a successful result', async () => {
    const repo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
    repo.seed('owner-a', memory('a'));
    repo.seed('owner-a', memory('b'), ['a']);
    repo.seed('owner-b', memory('foreign-a'));
    repo.seed('owner-b', memory('foreign-b'), ['foreign-a']);
    const out = await new InvalidatePersonalResolutionMemoryUseCase(repo).execute(
      request('a', 'contradiction'),
    );
    expect(out.affectedMemoryIds).toEqual(['a', 'b']);
    expect(out.affectedMemoryIds).not.toContain('foreign-a');
    expect(out.affectedMemoryIds).not.toContain('foreign-b');
  });
});
