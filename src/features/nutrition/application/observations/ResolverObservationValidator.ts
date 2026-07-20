import {
  RESOLVER_OBSERVATION_CONTRACT_VERSION,
  RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS,
  type ResolverObservation,
} from '../../domain/models/ResolverObservation';

const sameKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys.sort()[index]);
};

/** Fail-closed structural validation for the closed resolver-observation-v1 payload. */
export function validateResolverObservation(observation: ResolverObservation): void {
  if (
    !sameKeys(observation, [
      'contractVersion',
      'observationId',
      'resolverRunId',
      'occurredAt',
      'input',
      'decision',
      'versions',
      'operational',
    ])
  )
    throw new Error('OBSERVATION_UNKNOWN_ROOT_FIELD');
  if (observation.contractVersion !== RESOLVER_OBSERVATION_CONTRACT_VERSION)
    throw new Error('OBSERVATION_UNSUPPORTED_CONTRACT_VERSION');
  if (!observation.observationId || !observation.resolverRunId || !observation.occurredAt)
    throw new Error('OBSERVATION_MISSING_IDENTITY');
  if (
    !sameKeys(observation.input, ['rawInput', 'normalizedInput', 'locale', 'inputType']) ||
    !observation.input.rawInput ||
    !observation.input.normalizedInput
  )
    throw new Error('OBSERVATION_MISSING_INPUT');
  if (
    !sameKeys(observation.decision, [
      'outcome',
      'reasonCodes',
      'candidateCount',
      'selectedSource',
      'provenanceStatus',
    ])
  )
    throw new Error('OBSERVATION_UNKNOWN_DECISION_FIELD');
  if (
    !['accepted', 'ambiguous', 'abstained', 'technical_error'].includes(
      observation.decision.outcome,
    )
  )
    throw new Error('OBSERVATION_INVALID_OUTCOME');
  if (
    !Array.isArray(observation.decision.reasonCodes) ||
    !Number.isInteger(observation.decision.candidateCount) ||
    observation.decision.candidateCount < 0
  )
    throw new Error('OBSERVATION_INVALID_DECISION');
  if (!sameKeys(observation.versions, ['resolverVersion']) || !observation.versions.resolverVersion)
    throw new Error('OBSERVATION_INVALID_VERSIONS');
  if (!sameKeys(observation.operational, ['totalLatencyMs']))
    throw new Error('OBSERVATION_INVALID_OPERATIONAL');
  if (!Object.keys(RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS).includes('input.rawInput'))
    throw new Error('OBSERVATION_UNCLASSIFIED_FIELD');
}
