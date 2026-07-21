import { InvalidatePersonalResolutionMemoryUseCase } from '../application/usecases/InvalidatePersonalResolutionMemoryUseCase';
import { InMemoryPersonalResolutionMemoryInvalidationRepository } from '../infrastructure/repositories/InMemoryPersonalResolutionMemoryInvalidationRepository';
import type { PersonalResolutionMemory } from '../domain/models/PersonalResolutionMemory';

const v = 'personal-resolution-memory-v1' as const;
const at = '2026-07-21T11:00:00.000Z';
function memory(
  id: string,
  level: PersonalResolutionMemory['level'] = 'P1_provisional',
): PersonalResolutionMemory {
  return {
    contractVersion: v,
    memoryId: id,
    locale: 'de',
    scopeKey: `scope-${id}`,
    target: { sourceType: 'catalog', sourceId: `source-${id}`, kind: 'source_grounded' },
    level,
    status: 'active',
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
