import { validateResolverObservation } from '../../application/observations/ResolverObservationValidator';
import type {
  ResolverObservationWriter,
  ResolverObservationWriteResult,
} from '../../application/ports/ResolverObservationWriter';
import type { ResolverObservation } from '../../domain/models/ResolverObservation';

export class InMemoryResolverObservationWriter implements ResolverObservationWriter {
  readonly observations: ResolverObservation[] = [];
  async write(observation: ResolverObservation): Promise<ResolverObservationWriteResult> {
    try {
      validateResolverObservation(observation);
    } catch {
      return { status: 'failed', code: 'validation_failed' };
    }
    if (this.observations.some(({ observationId }) => observationId === observation.observationId))
      return { status: 'duplicate' };
    this.observations.push(observation);
    return { status: 'written' };
  }
}
