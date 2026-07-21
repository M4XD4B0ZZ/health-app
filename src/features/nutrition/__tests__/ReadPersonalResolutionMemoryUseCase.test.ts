import { ReadPersonalResolutionMemoryUseCase } from '../application/usecases/ReadPersonalResolutionMemoryUseCase';
import { PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION as VERSION } from '../domain/models/PersonalResolutionMemoryRead';
import type {
  PersonalResolutionMemoryReadRepository,
  PersonalResolutionMemoryReadRow,
} from '../application/ports/PersonalResolutionMemoryReadRepository';

class FakeRepository implements PersonalResolutionMemoryReadRepository {
  calls: { ownerId: string; scopeKeys: string[] }[] = [];
  rows: PersonalResolutionMemoryReadRow[] = [];
  throwOnCall = false;

  async findActiveByScopeKeys(
    ownerId: string,
    scopeKeys: string[],
  ): Promise<PersonalResolutionMemoryReadRow[]> {
    this.calls.push({ ownerId, scopeKeys });
    if (this.throwOnCall) throw new Error('boom');
    return this.rows;
  }
}

const baseRequest = () => ({
  contractVersion: VERSION,
  ownerId: 'owner-a',
  targets: [{ sourceType: 'bls', sourceId: 'egg-raw' }],
});

describe('RESOLVER-V3-019 ReadPersonalResolutionMemoryUseCase', () => {
  it('returns no matches when the repository has nothing for the requested scope keys', async () => {
    const repo = new FakeRepository();
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({ status: 'ok', matches: [] });
    expect(repo.calls).toEqual([{ ownerId: 'owner-a', scopeKeys: ['bls:egg-raw'] }]);
  });

  it('maps a P2_confirmed active row to a deterministic-reuse-eligible, preferred match', async () => {
    const repo = new FakeRepository();
    repo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P2_confirmed' }];
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({
      status: 'ok',
      matches: [
        {
          memoryId: 'memory-1',
          sourceType: 'bls',
          sourceId: 'egg-raw',
          level: 'P2_confirmed',
          eligibility: { deterministicReuse: true, preferred: true },
        },
      ],
    });
  });

  it('maps a P1_provisional active row to preferred-only, never deterministic reuse', async () => {
    const repo = new FakeRepository();
    repo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P1_provisional' }];
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result.matches[0].eligibility).toEqual({ deterministicReuse: false, preferred: true });
  });

  it('maps a P0_observed active row to no eligibility at all', async () => {
    const repo = new FakeRepository();
    repo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P0_observed' }];
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result.matches[0].eligibility).toEqual({ deterministicReuse: false, preferred: false });
  });

  it('dedupes identical targets into a single scope key before calling the repository', async () => {
    const repo = new FakeRepository();
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    await useCase.execute({
      ...baseRequest(),
      targets: [
        { sourceType: 'bls', sourceId: 'egg-raw' },
        { sourceType: 'bls', sourceId: 'egg-raw' },
        { sourceType: 'off', sourceId: 'off-123' },
      ],
    });

    expect(repo.calls[0].scopeKeys.sort()).toEqual(['bls:egg-raw', 'off:off-123']);
  });

  it('never trusts a row outside the requested scope-key set (defense in depth)', async () => {
    const repo = new FakeRepository();
    repo.rows = [{ memoryId: 'memory-x', scopeKey: 'off:unexpected', level: 'P2_confirmed' }];
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({ status: 'ok', matches: [] });
  });

  it.each([
    ['unknown_contract_version', { contractVersion: 'v0' }],
    ['no_targets', { targets: [] }],
    ['no_targets', { targets: [{ sourceType: '', sourceId: '' }] }],
  ])('fails closed with %s and never reaches the repository', async (code, overrides) => {
    const repo = new FakeRepository();
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute({ ...baseRequest(), ...overrides });

    expect(result.status).toBe('invalid_request');
    expect(result.code).toBe(code);
    expect(result.matches).toEqual([]);
    expect(repo.calls).toHaveLength(0);
  });

  it('fails closed with no_owner (distinct status) and never reaches the repository', async () => {
    const repo = new FakeRepository();
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute({ ...baseRequest(), ownerId: '' });

    expect(result).toEqual({ status: 'no_owner', code: 'missing_owner', matches: [] });
    expect(repo.calls).toHaveLength(0);
  });

  it('surfaces a repository throw as failed with no matches, never an exception', async () => {
    const repo = new FakeRepository();
    repo.throwOnCall = true;
    const useCase = new ReadPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({ status: 'failed', matches: [] });
  });
});
