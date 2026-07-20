import { DeleteResolverObservationsForCurrentOwner } from '../application/usecases/DeleteResolverObservationsForCurrentOwner';
import { InMemoryResolverObservationDeletionPort } from '../infrastructure/observations/InMemoryResolverObservationDeletionPort';
import { InMemoryResolverObservationWriter } from '../infrastructure/observations/InMemoryResolverObservationWriter';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';

const record = (id: string) => ({
  contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
  observationId: id,
  resolverRunId: id,
  occurredAt: '2026-07-20T00:00:00.000Z',
  input: {
    rawInput: 'private',
    normalizedInput: 'private',
    locale: 'de' as const,
    inputType: 'generic' as const,
  },
  decision: {
    outcome: 'accepted' as const,
    reasonCodes: [],
    candidateCount: 0,
    selectedSource: null,
    provenanceStatus: 'not_resolved' as const,
  },
  versions: { resolverVersion: 'v2' },
  operational: { totalLatencyMs: 'unknown' as const },
});
describe('DeleteResolverObservationsForCurrentOwner', () => {
  it('deletes only the authenticated owner records', async () => {
    const writer = new InMemoryResolverObservationWriter();
    await writer.write({ ownerId: 'a', observation: record('a') });
    await writer.write({ ownerId: 'b', observation: record('b') });
    await expect(
      new DeleteResolverObservationsForCurrentOwner(
        { getOwnerId: async () => 'a' },
        new InMemoryResolverObservationDeletionPort(writer),
      ).execute(),
    ).resolves.toEqual({ status: 'deleted', count: 1 });
    expect(writer.requests.map((request) => request.ownerId)).toEqual(['b']);
  });
  it('fails closed without an authenticated owner', async () => {
    const port = { deleteForOwner: jest.fn() };
    await expect(
      new DeleteResolverObservationsForCurrentOwner(
        { getOwnerId: async () => null },
        port,
      ).execute(),
    ).resolves.toEqual({ status: 'failed', code: 'missing_owner' });
    expect(port.deleteForOwner).not.toHaveBeenCalled();
  });
});
