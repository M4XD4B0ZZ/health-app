import type {
  ResolverObservationDeletionPort,
  ResolverObservationDeletionResult,
} from '../../application/ports/ResolverObservationDeletionPort';
import type { InMemoryResolverObservationWriter } from './InMemoryResolverObservationWriter';

export class InMemoryResolverObservationDeletionPort implements ResolverObservationDeletionPort {
  constructor(private readonly writer: InMemoryResolverObservationWriter) {}
  async deleteForOwner(ownerId: string): Promise<ResolverObservationDeletionResult> {
    if (!ownerId) return { status: 'failed', code: 'delete_failed' };
    const retained = this.writer.requests.filter((request) => request.ownerId !== ownerId);
    const count = this.writer.requests.length - retained.length;
    this.writer.requests.splice(0, this.writer.requests.length, ...retained);
    this.writer.observations.splice(
      0,
      this.writer.observations.length,
      ...retained.map((item) => item.observation),
    );
    return { status: 'deleted', count };
  }
}
