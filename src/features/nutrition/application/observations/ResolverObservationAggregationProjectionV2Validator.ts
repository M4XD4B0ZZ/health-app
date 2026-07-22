import {
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_INPUT_TYPES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_LOCALES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_OUTCOMES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_PROVENANCE_STATUSES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_SOURCE_TYPES,
  RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
} from '../../domain/models/ResolverObservationAggregationProjectionV2';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../../domain/models/ResolverObservation';
import {
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  RESOLVER_OBSERVATION_SAFE_REASON_CODES,
} from '../../domain/models/ResolverObservationPrivacy';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ROOT_KEYS = [
  'projectionVersion',
  'privacyPolicyVersion',
  'observationContractVersion',
  'locale',
  'inputType',
  'outcome',
  'candidateCount',
  'selectedSource',
  'provenanceStatus',
  'resolverVersion',
  'totalLatencyMs',
  'reasonCodes',
] as const;

/**
 * Recursive, closed-allowlist runtime validator for `ResolverObservationAggregationProjectionV2`
 * (RESOLVER-V3-031 binding requirement §3). Types alone are insufficient: this accepts `unknown`
 * so adversarial runtime-cast objects (a V1 shape, a mixed-version object, an object with a
 * nested `selectedSource.id`) are rejected explicitly rather than merely mistyped. Returns an
 * empty array when valid; never silently strips unsafe fields and accepts the remainder.
 */
export function validateResolverObservationAggregationProjectionV2(
  value: unknown,
  path = '$',
): readonly string[] {
  if (!isPlainObject(value)) return [`${path}: expected an object`];
  const violations: string[] = [];
  const allowedKeys = new Set<string>(ROOT_KEYS);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) violations.push(`${path}.${key}: unknown root field`);
  }
  if (value.projectionVersion !== RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION)
    violations.push(`${path}.projectionVersion: expected literal V2 projection version`);
  if (value.privacyPolicyVersion !== RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION)
    violations.push(`${path}.privacyPolicyVersion: unsupported privacy-policy version`);
  if (value.observationContractVersion !== RESOLVER_OBSERVATION_CONTRACT_VERSION)
    violations.push(`${path}.observationContractVersion: unsupported observation-contract version`);
  if (
    typeof value.locale !== 'string' ||
    !(RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_LOCALES as readonly string[]).includes(
      value.locale,
    )
  )
    violations.push(`${path}.locale: unsupported locale`);
  if (
    typeof value.inputType !== 'string' ||
    !(
      RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_INPUT_TYPES as readonly string[]
    ).includes(value.inputType)
  )
    violations.push(`${path}.inputType: unsupported input type`);
  if (
    typeof value.outcome !== 'string' ||
    !(RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_OUTCOMES as readonly string[]).includes(
      value.outcome,
    )
  )
    violations.push(`${path}.outcome: unsupported outcome`);
  if (
    typeof value.candidateCount !== 'number' ||
    !Number.isInteger(value.candidateCount) ||
    value.candidateCount < 0
  )
    violations.push(`${path}.candidateCount: expected a non-negative integer`);
  if (value.selectedSource !== null) {
    if (!isPlainObject(value.selectedSource)) {
      violations.push(`${path}.selectedSource: expected an object with { type } or null`);
    } else {
      const sourceKeys = Object.keys(value.selectedSource);
      for (const key of sourceKeys) {
        if (key !== 'type') violations.push(`${path}.selectedSource.${key}: unknown nested field`);
      }
      const sourceType = value.selectedSource.type;
      if (
        typeof sourceType !== 'string' ||
        !(
          RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_SOURCE_TYPES as readonly string[]
        ).includes(sourceType)
      )
        violations.push(`${path}.selectedSource.type: unsupported source type`);
    }
  }
  if (
    typeof value.provenanceStatus !== 'string' ||
    !(
      RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_PROVENANCE_STATUSES as readonly string[]
    ).includes(value.provenanceStatus)
  )
    violations.push(`${path}.provenanceStatus: unsupported provenance status`);
  if (typeof value.resolverVersion !== 'string' || value.resolverVersion.length === 0)
    violations.push(`${path}.resolverVersion: expected a non-empty string`);
  if (
    value.totalLatencyMs !== 'unknown' &&
    !(typeof value.totalLatencyMs === 'number' && Number.isFinite(value.totalLatencyMs))
  )
    violations.push(`${path}.totalLatencyMs: expected a finite number or "unknown"`);
  if (!Array.isArray(value.reasonCodes)) {
    violations.push(`${path}.reasonCodes: expected an array`);
  } else {
    const safe = new Set<string>(RESOLVER_OBSERVATION_SAFE_REASON_CODES);
    value.reasonCodes.forEach((code, index) => {
      if (typeof code !== 'string' || !safe.has(code))
        violations.push(`${path}.reasonCodes[${index}]: unsafe reason code`);
    });
  }
  return violations;
}

export function isValidResolverObservationAggregationProjectionV2(value: unknown): boolean {
  return validateResolverObservationAggregationProjectionV2(value).length === 0;
}
