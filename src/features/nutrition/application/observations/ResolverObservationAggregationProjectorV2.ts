import { validateResolverObservation } from './ResolverObservationValidator';
import { validateResolverObservationAggregationProjectionV2 } from './ResolverObservationAggregationProjectionV2Validator';
import {
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_INPUT_TYPES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_LOCALES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_OUTCOMES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_PROVENANCE_STATUSES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_SOURCE_TYPES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
  type ResolverObservationAggregationProjectionV2,
  type ResolverObservationAggregationProjectionV2Result,
  type ResolverObservationAggregationProjectionV2SourceType,
} from '../../domain/models/ResolverObservationAggregationProjectionV2';
import {
  RESOLVER_OBSERVATION_CONTRACT_FIELD_PRIVACY,
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  RESOLVER_OBSERVATION_SAFE_REASON_CODES,
} from '../../domain/models/ResolverObservationPrivacy';
import {
  RESOLVER_OBSERVATION_CONTRACT_VERSION,
  type ResolverObservation,
} from '../../domain/models/ResolverObservation';

const requiredFields = [
  'contractVersion',
  'observationId',
  'resolverRunId',
  'occurredAt',
  'input',
  'input.rawInput',
  'input.normalizedInput',
  'input.locale',
  'input.inputType',
  'decision',
  'decision.outcome',
  'decision.reasonCodes',
  'decision.candidateCount',
  'decision.selectedSource',
  'decision.selectedSource.type',
  'decision.selectedSource.id',
  'decision.provenanceStatus',
  'versions',
  'versions.resolverVersion',
  'operational',
  'operational.totalLatencyMs',
] as const;

/**
 * Dedicated V2 producer (RESOLVER-V3-031 binding requirement §2). This is a distinct function
 * from `ResolverObservationPrivacyEnforcer.project()` — it does not mutate, replace, or feed the
 * V1 enforcer, and V1's own behavior/output type is untouched. Deterministic and side-effect
 * free: same `observation` input always yields the same result, and `observation` is never
 * mutated.
 *
 * Removes the selected source ID *structurally*: the projection type has no field capable of
 * holding it (see `ResolverObservationAggregationProjectionV2.selectedSource`), so this function
 * never copies-then-redacts it.
 */
export function projectResolverObservationForAggregationV2(
  observation: ResolverObservation,
  policyVersion: string = RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
): ResolverObservationAggregationProjectionV2Result {
  if (policyVersion !== RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION)
    return { status: 'blocked', reason: 'unknown_privacy_policy_version' };
  if (observation.contractVersion !== RESOLVER_OBSERVATION_CONTRACT_VERSION)
    return { status: 'blocked', reason: 'unknown_contract_version' };
  if (requiredFields.some((field) => !(field in RESOLVER_OBSERVATION_CONTRACT_FIELD_PRIVACY)))
    return { status: 'blocked', reason: 'unclassified_field' };
  try {
    validateResolverObservation(observation);
  } catch {
    return { status: 'blocked', reason: 'invalid_observation' };
  }
  if (!observation.input.rawInput || !observation.input.normalizedInput)
    return { status: 'blocked', reason: 'unsafe_free_text' };
  const locale: unknown = observation.input.locale;
  if (
    typeof locale !== 'string' ||
    !(RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_LOCALES as readonly string[]).includes(
      locale,
    )
  )
    return { status: 'blocked', reason: 'invalid_locale' };
  const inputType: unknown = observation.input.inputType;
  if (
    typeof inputType !== 'string' ||
    !(
      RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_INPUT_TYPES as readonly string[]
    ).includes(inputType)
  )
    return { status: 'blocked', reason: 'invalid_input_type' };
  const outcome: unknown = observation.decision.outcome;
  if (
    typeof outcome !== 'string' ||
    !(RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_OUTCOMES as readonly string[]).includes(
      outcome,
    )
  )
    return { status: 'blocked', reason: 'invalid_outcome' };
  const provenanceStatus: unknown = observation.decision.provenanceStatus;
  if (
    typeof provenanceStatus !== 'string' ||
    !(
      RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_PROVENANCE_STATUSES as readonly string[]
    ).includes(provenanceStatus)
  )
    return { status: 'blocked', reason: 'invalid_provenance_status' };
  const totalLatencyMs: unknown = observation.operational.totalLatencyMs;
  if (
    totalLatencyMs !== 'unknown' &&
    !(typeof totalLatencyMs === 'number' && Number.isFinite(totalLatencyMs))
  )
    return { status: 'blocked', reason: 'invalid_latency' };
  const source = observation.decision.selectedSource;
  if (source?.type === 'user') return { status: 'blocked', reason: 'personal_source' };
  if (
    source &&
    !(
      RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_SOURCE_TYPES as readonly string[]
    ).includes(source.type)
  )
    return { status: 'blocked', reason: 'unknown_source_type' };
  if (
    !observation.decision.reasonCodes.every((code) =>
      (RESOLVER_OBSERVATION_SAFE_REASON_CODES as readonly string[]).includes(code),
    )
  )
    return { status: 'blocked', reason: 'unsafe_reason_code' };

  const projection: ResolverObservationAggregationProjectionV2 = {
    projectionVersion: RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
    privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
    observationContractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
    locale: locale as ResolverObservationAggregationProjectionV2['locale'],
    inputType: inputType as ResolverObservationAggregationProjectionV2['inputType'],
    outcome: outcome as ResolverObservationAggregationProjectionV2['outcome'],
    candidateCount: observation.decision.candidateCount,
    // Structurally source-type-only: this object literal has no `id` property to carry one.
    selectedSource: source
      ? { type: source.type as ResolverObservationAggregationProjectionV2SourceType }
      : null,
    provenanceStatus:
      provenanceStatus as ResolverObservationAggregationProjectionV2['provenanceStatus'],
    resolverVersion: observation.versions.resolverVersion,
    totalLatencyMs: totalLatencyMs as ResolverObservationAggregationProjectionV2['totalLatencyMs'],
    reasonCodes: observation.decision
      .reasonCodes as ResolverObservationAggregationProjectionV2['reasonCodes'],
  };

  const violations = validateResolverObservationAggregationProjectionV2(projection);
  if (violations.length > 0) {
    // Unreachable under the checks above; a violation here would be a producer invariant bug,
    // not an unsafe-input case, so it throws rather than leaking a partially-safe projection.
    throw new Error(`AGGREGATION_PROJECTION_V2_INVARIANT_VIOLATION: ${violations.join('; ')}`);
  }

  return { status: 'projected', projection };
}
