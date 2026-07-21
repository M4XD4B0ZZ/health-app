import { RecordPersonalResolutionMemoryUseCase } from '../application/usecases/RecordPersonalResolutionMemoryUseCase';
import { PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION as VERSION } from '../domain/models/PersonalResolutionMemoryRecording';
import type {
  PersonalResolutionMemory,
  PersonalResolutionMemoryEvidence,
  PersonalResolutionMemoryTransition,
  PersonalResolutionNegativeEvidence,
} from '../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryRecordOutcome,
  PersonalResolutionMemoryRepository,
} from '../application/ports/PersonalResolutionMemoryRepository';

interface RecordedCall {
  ownerId: string;
  memory: PersonalResolutionMemory;
  evidence: PersonalResolutionMemoryEvidence;
  transition: PersonalResolutionMemoryTransition;
  negativeEvidence?: PersonalResolutionNegativeEvidence;
}

class FakeRepository implements PersonalResolutionMemoryRepository {
  calls: RecordedCall[] = [];
  private readonly committed = new Set<string>();
  forcedOutcome: PersonalResolutionMemoryRecordOutcome | null = null;

  async record(
    ownerId: string,
    memory: PersonalResolutionMemory,
    evidence: PersonalResolutionMemoryEvidence,
    transition: PersonalResolutionMemoryTransition,
    negativeEvidence?: PersonalResolutionNegativeEvidence,
  ): Promise<PersonalResolutionMemoryRecordOutcome> {
    if (this.forcedOutcome) return this.forcedOutcome;
    const key = `${ownerId}:${memory.memoryId}`;
    const isDuplicate = this.committed.has(key);
    this.committed.add(key);
    this.calls.push({ ownerId, memory, evidence, transition, negativeEvidence });
    return isDuplicate ? 'duplicate' : 'written';
  }
}

const occurredAt = '2026-07-21T12:00:00.000Z';
const baseRequest = () => ({
  contractVersion: VERSION,
  ownerId: 'owner-a',
  actionId: 'action-1',
  locale: 'de' as const,
  target: { sourceType: 'bls', sourceId: 'egg-raw', kind: 'source_grounded' as const },
  evidenceType: 'logged_without_explicit_confirmation',
  occurredAt,
});

describe('RESOLVER-V3-026 RecordPersonalResolutionMemoryUseCase', () => {
  it('records unchanged logging as P0 only, keyed on the action ID', async () => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({ status: 'written', memoryId: 'action-1', level: 'P0_observed' });
    expect(repo.calls).toHaveLength(1);
    expect(repo.calls[0].memory).toMatchObject({
      memoryId: 'action-1',
      level: 'P0_observed',
      status: 'active',
      scopeKey: 'bls:egg-raw',
    });
    expect(repo.calls[0].evidence).toMatchObject({
      evidenceId: 'action-1:evidence',
      type: 'logged_without_explicit_confirmation',
    });
    expect(repo.calls[0].transition).toMatchObject({
      transitionId: 'action-1:transition',
      nextLevel: 'P0_observed',
      nextStatus: 'active',
    });
    expect(repo.calls[0].negativeEvidence).toBeUndefined();
  });

  it.each([
    ['deliberate_candidate_selection', 'P1_provisional'],
    ['explicit_confirmation', 'P2_confirmed'],
    ['deliberately_saved_personal_meal', 'P2_confirmed'],
    ['manual_personal_definition', 'P2_confirmed'],
  ])('promotes %s to %s and only that level — no invented intent', async (evidenceType, level) => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute({ ...baseRequest(), evidenceType });

    expect(result.status).toBe('written');
    expect(result.level).toBe(level);
    expect(repo.calls[0].memory.level).toBe(level);
  });

  it('is idempotent on a literal actionId retry: same memory ID, no new event objects', async () => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const first = await useCase.execute(baseRequest());
    const second = await useCase.execute(baseRequest());

    expect(first.status).toBe('written');
    expect(second).toEqual({ status: 'duplicate', memoryId: 'action-1', level: 'P0_observed' });
    // The repository is still asked to record identical, byte-for-byte-derivable rows both
    // times (idempotent retries are the repository's job to absorb via unique constraints in
    // production); the use case's own contribution to idempotence is that every ID is a pure
    // function of actionId, so both calls produce identical IDs.
    expect(repo.calls[0].memory.memoryId).toBe(repo.calls[1].memory.memoryId);
    expect(repo.calls[0].evidence.evidenceId).toBe(repo.calls[1].evidence.evidenceId);
    expect(repo.calls[0].transition.transitionId).toBe(repo.calls[1].transition.transitionId);
  });

  it('never lets two different owners collide on the same actionId-derived memory ID', async () => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    await useCase.execute(baseRequest());
    const other = await useCase.execute({ ...baseRequest(), ownerId: 'owner-b' });

    expect(other.status).toBe('written');
    expect(repo.calls[0].ownerId).toBe('owner-a');
    expect(repo.calls[1].ownerId).toBe('owner-b');
  });

  it('rejects explicit_correction without a named prior memory — never invents what was corrected', async () => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute({
      ...baseRequest(),
      evidenceType: 'explicit_correction',
    });

    expect(result).toEqual({
      status: 'invalid_request',
      code: 'correction_requires_prior_memory_id',
    });
    expect(repo.calls).toHaveLength(0);
  });

  it('enforces correction precedence: always creates negative evidence against the named prior memory', async () => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute({
      ...baseRequest(),
      evidenceType: 'explicit_correction',
      priorMemoryId: 'prior-memory-1',
    });

    expect(result).toEqual({ status: 'written', memoryId: 'action-1', level: 'P2_confirmed' });
    expect(repo.calls[0].memory).toMatchObject({
      supersedesMemoryId: 'prior-memory-1',
      correctionReference: 'prior-memory-1',
    });
    expect(repo.calls[0].negativeEvidence).toMatchObject({
      priorMemoryId: 'prior-memory-1',
      correctedMemoryId: 'action-1',
      reason: 'user_correction',
      correctionReference: 'prior-memory-1',
    });
  });

  it.each([
    ['unknown_contract_version', { contractVersion: 'v2' }],
    ['missing_owner', { ownerId: '' }],
    ['missing_action_id', { actionId: '' }],
    [
      'missing_target',
      { target: { sourceType: '', sourceId: '', kind: 'source_grounded' as const } },
    ],
    ['unknown_evidence_type', { evidenceType: 'invented_signal' }],
  ])('fails closed with %s and never reaches the repository', async (code, overrides) => {
    const repo = new FakeRepository();
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute({ ...baseRequest(), ...overrides });

    expect(result).toEqual({ status: 'invalid_request', code });
    expect(repo.calls).toHaveLength(0);
  });

  it('surfaces a genuine repository failure as failed, not written', async () => {
    const repo = new FakeRepository();
    repo.forcedOutcome = 'failed';
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({ status: 'failed' });
  });

  it('surfaces an unexpected repository throw as failed', async () => {
    const repo: PersonalResolutionMemoryRepository = {
      record: async () => {
        throw new Error('boom');
      },
    };
    const useCase = new RecordPersonalResolutionMemoryUseCase(repo);

    const result = await useCase.execute(baseRequest());

    expect(result).toEqual({ status: 'failed' });
  });
});
