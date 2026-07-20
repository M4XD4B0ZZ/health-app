import type { ResolverObservation } from '../../domain/models/ResolverObservation';

/** Private persistence context; deliberately separate from the versioned observation payload. */
export interface ResolverObservationWriteRequest {
  ownerId: string;
  observation: ResolverObservation;
}

export type ResolverObservationWriteResult =
  | { status: 'written' | 'duplicate' }
  | { status: 'failed'; code: 'validation_failed' | 'write_failed' };
/** Write-only audit port. It must never be used as a resolver, memory, or knowledge repository. */
export interface ResolverObservationWriter {
  write(request: ResolverObservationWriteRequest): Promise<ResolverObservationWriteResult>;
}
export class NoopResolverObservationWriter implements ResolverObservationWriter {
  async write(): Promise<ResolverObservationWriteResult> {
    return { status: 'written' };
  }
}
