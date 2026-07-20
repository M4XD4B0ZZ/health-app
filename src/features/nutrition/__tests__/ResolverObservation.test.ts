import { InMemoryResolverObservationWriter } from '../infrastructure/observations/InMemoryResolverObservationWriter';
import {
  RESOLVER_OBSERVATION_CONTRACT_VERSION,
  RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS,
} from '../domain/models/ResolverObservation';

const observation = () => ({
  contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
  observationId: 'observation-1',
  resolverRunId: 'run-1',
  occurredAt: '2026-07-20T00:00:00.000Z',
  input: {
    rawInput: '1 Apfel',
    normalizedInput: 'apfel',
    locale: 'de' as const,
    inputType: 'generic' as const,
  },
  decision: {
    outcome: 'accepted' as const,
    reasonCodes: [],
    candidateCount: 1,
    selectedSource: { type: 'bls', id: '123' },
    provenanceStatus: 'source_grounded' as const,
  },
  versions: { resolverVersion: 'v2' },
  operational: { totalLatencyMs: 'unknown' as const },
});
describe('ResolverObservation v1', () => {
  it('accepts a classified versioned observation and rejects duplicates', async () => {
    const writer = new InMemoryResolverObservationWriter();
    await expect(writer.write({ ownerId: 'user-1', observation: observation() })).resolves.toEqual({
      status: 'written',
    });
    await expect(writer.write({ ownerId: 'user-1', observation: observation() })).resolves.toEqual({
      status: 'duplicate',
    });
    expect(writer.observations).toHaveLength(1);
  });
  it('fails closed for an unknown version and keeps raw input private', async () => {
    const writer = new InMemoryResolverObservationWriter();
    const invalid = observation() as any;
    invalid.contractVersion = 'v2';
    await expect(writer.write(invalid)).resolves.toEqual({
      status: 'failed',
      code: 'validation_failed',
    });
    expect(RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS['input.rawInput']).toBe('private_raw');
    expect(RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS['input.normalizedInput']).toBe(
      'aggregatable_only_after_approved_deidentification',
    );
  });
});
