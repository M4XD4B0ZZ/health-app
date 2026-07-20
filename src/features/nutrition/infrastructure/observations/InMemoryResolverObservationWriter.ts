import { validateResolverObservation } from '../../application/observations/ResolverObservationValidator';
import type {
  ResolverObservationWriter,
  ResolverObservationWriteRequest,
  ResolverObservationWriteResult,
} from '../../application/ports/ResolverObservationWriter';
import type { ResolverObservation } from '../../domain/models/ResolverObservation';

export class InMemoryResolverObservationWriter implements ResolverObservationWriter {
  readonly observations: ResolverObservation[] = [];
  readonly requests: ResolverObservationWriteRequest[] = [];
  async write({
    ownerId,
    observation,
  }: ResolverObservationWriteRequest): Promise<ResolverObservationWriteResult> {
    try {
      validateResolverObservation(observation);
    } catch {
      return { status: 'failed', code: 'validation_failed' };
    }
    if (
      this.requests.some(
        (request) =>
          request.ownerId === ownerId &&
          request.observation.observationId === observation.observationId,
      )
    )
      return { status: 'duplicate' };
    this.observations.push(observation);
    this.requests.push({ ownerId, observation });
    return { status: 'written' };
  }
}
