import { SupabaseResolverObservationWriter } from '../infrastructure/observations/SupabaseResolverObservationWriter';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';

const request = () => ({
  ownerId: 'owner-a',
  observation: {
    contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
    observationId: 'observation-1',
    resolverRunId: 'run-1',
    occurredAt: '2026-07-20T00:00:00.000Z',
    input: {
      rawInput: 'private apple',
      normalizedInput: 'apple',
      locale: 'de' as const,
      inputType: 'generic' as const,
    },
    decision: {
      outcome: 'accepted' as const,
      reasonCodes: ['OK'],
      candidateCount: 1,
      selectedSource: { type: 'bls', id: '1' },
      provenanceStatus: 'source_grounded' as const,
    },
    versions: { resolverVersion: 'v2' },
    operational: { totalLatencyMs: 'unknown' as const },
  },
});
const client = (result: object = { error: null }) => {
  const insert = jest.fn().mockResolvedValue(result);
  return { from: jest.fn().mockReturnValue({ insert }) } as any;
};

describe('SupabaseResolverObservationWriter', () => {
  it('serializes the full V1 payload under its explicit private owner', async () => {
    const supabase = client();
    const writer = new SupabaseResolverObservationWriter(supabase);
    await expect(writer.write(request())).resolves.toEqual({ status: 'written' });
    expect(supabase.from).toHaveBeenCalledWith('resolver_observations');
    expect(supabase.from.mock.results[0].value.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'owner-a',
        observation_id: 'observation-1',
        resolver_run_id: 'run-1',
        contract_version: RESOLVER_OBSERVATION_CONTRACT_VERSION,
        observation_payload: request().observation,
      }),
    );
  });
  it('fails validation before any persistence for invalid or expanded payloads', async () => {
    const supabase = client();
    const invalid: any = request();
    invalid.observation.extra = 'rejected';
    await expect(new SupabaseResolverObservationWriter(supabase).write(invalid)).resolves.toEqual({
      status: 'failed',
      code: 'validation_failed',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('maps a unique conflict to duplicate and other errors to secret-safe write_failed', async () => {
    await expect(
      new SupabaseResolverObservationWriter(
        client({ error: { code: '23505', message: 'private apple secret' } }),
      ).write(request()),
    ).resolves.toEqual({ status: 'duplicate' });
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    await expect(
      new SupabaseResolverObservationWriter(
        client({ error: { code: '42501', message: 'private apple secret' } }),
      ).write(request()),
    ).resolves.toEqual({ status: 'failed', code: 'write_failed' });
    expect(warn).toHaveBeenCalledWith('[SupabaseResolverObservationWriter] insert failed', '42501');
    warn.mockRestore();
  });
  it('fails closed without an owner and does not create a shared owner', async () => {
    const supabase = client();
    await expect(
      new SupabaseResolverObservationWriter(supabase).write({ ...request(), ownerId: '' }),
    ).resolves.toEqual({ status: 'failed', code: 'write_failed' });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
