import type { ResolverObservation } from '../../domain/models/ResolverObservation';

export type ResolverObservationWriteResult =
  | { status: 'written' | 'duplicate' }
  | { status: 'failed'; code: 'validation_failed' | 'write_failed' };
/** Write-only audit port. It must never be used as a resolver, memory, or knowledge repository. */
export interface ResolverObservationWriter {
  write(observation: ResolverObservation): Promise<ResolverObservationWriteResult>;
}
export class NoopResolverObservationWriter implements ResolverObservationWriter {
  async write(): Promise<ResolverObservationWriteResult> {
    return { status: 'written' };
  }
}
