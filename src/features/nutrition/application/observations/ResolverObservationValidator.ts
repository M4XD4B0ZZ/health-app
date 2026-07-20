import {
  RESOLVER_OBSERVATION_CONTRACT_VERSION,
  RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS,
  type ResolverObservation,
} from '../../domain/models/ResolverObservation';

export function validateResolverObservation(observation: ResolverObservation): void {
  if (observation.contractVersion !== RESOLVER_OBSERVATION_CONTRACT_VERSION)
    throw new Error('OBSERVATION_UNSUPPORTED_CONTRACT_VERSION');
  if (!observation.observationId || !observation.resolverRunId || !observation.occurredAt)
    throw new Error('OBSERVATION_MISSING_IDENTITY');
  if (!observation.input.rawInput || !observation.input.normalizedInput)
    throw new Error('OBSERVATION_MISSING_INPUT');
  if (
    !['accepted', 'ambiguous', 'abstained', 'technical_error'].includes(
      observation.decision.outcome,
    )
  )
    throw new Error('OBSERVATION_INVALID_OUTCOME');
  if (!Object.keys(RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS).includes('input.rawInput'))
    throw new Error('OBSERVATION_UNCLASSIFIED_FIELD');
}
