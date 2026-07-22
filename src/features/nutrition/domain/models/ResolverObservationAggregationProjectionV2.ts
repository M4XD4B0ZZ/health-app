import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from './ResolverObservation';
import {
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  RESOLVER_OBSERVATION_SAFE_REASON_CODES,
} from './ResolverObservationPrivacy';

/**
 * Explicit, own successor to the implicitly-versioned V1 projection (RESOLVER-V3-030 design §6/§7).
 * Unlike `ResolverObservationAggregationProjectionV1`, this contract carries its own
 * `projectionVersion` discriminant, separate from `privacyPolicyVersion` and
 * `observationContractVersion` — the three version axes are never conflated. This does not
 * replace, reinterpret, or feed V1; both exist independently.
 */
export const RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION =
  'resolver-observation-aggregation-projection-v2' as const;

export const RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_LOCALES = ['de', 'en'] as const;
export type ResolverObservationAggregationProjectionV2Locale =
  (typeof RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_LOCALES)[number];

/** Closed input-type union: the three `FoodSearchQuery.inputType` values plus `'unknown'`. */
export const RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_INPUT_TYPES = [
  'generic',
  'branded',
  'ambiguous',
  'unknown',
] as const;
export type ResolverObservationAggregationProjectionV2InputType =
  (typeof RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_INPUT_TYPES)[number];

export const RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_OUTCOMES = [
  'accepted',
  'ambiguous',
  'abstained',
  'technical_error',
] as const;
export type ResolverObservationAggregationProjectionV2Outcome =
  (typeof RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_OUTCOMES)[number];

export const RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_SOURCE_TYPES = [
  'bls',
  'off',
  'usda',
] as const;
export type ResolverObservationAggregationProjectionV2SourceType =
  (typeof RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_SOURCE_TYPES)[number];

export const RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_PROVENANCE_STATUSES = [
  'source_grounded',
  'not_resolved',
] as const;
export type ResolverObservationAggregationProjectionV2ProvenanceStatus =
  (typeof RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_SAFE_PROVENANCE_STATUSES)[number];

/**
 * Root closed field set (12 fields). Deliberately excludes: source ID, observation ID,
 * resolver-run ID, owner ID, raw/normalized input, exact private timestamp, food payloads,
 * candidate payloads, journal/correction data, provider output, prompts, and any metadata bag.
 * `selectedSource` can only ever carry a closed source *type* — there is no `id` field in this
 * type at all, so a source ID cannot be represented, not merely omitted at runtime.
 */
export interface ResolverObservationAggregationProjectionV2 {
  projectionVersion: typeof RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION;
  privacyPolicyVersion: typeof RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION;
  observationContractVersion: typeof RESOLVER_OBSERVATION_CONTRACT_VERSION;
  locale: ResolverObservationAggregationProjectionV2Locale;
  inputType: ResolverObservationAggregationProjectionV2InputType;
  outcome: ResolverObservationAggregationProjectionV2Outcome;
  candidateCount: number;
  selectedSource: { type: ResolverObservationAggregationProjectionV2SourceType } | null;
  provenanceStatus: ResolverObservationAggregationProjectionV2ProvenanceStatus;
  resolverVersion: string;
  totalLatencyMs: number | 'unknown';
  reasonCodes: readonly (typeof RESOLVER_OBSERVATION_SAFE_REASON_CODES)[number][];
}

/**
 * Closed blocked-result reasons for the V2 producer. Distinct from the V1 enforcer's reason set
 * only in that the V2 producer additionally validates locale/input-type/outcome/provenance/
 * latency at runtime rather than trusting the static `ResolverObservation` type (RESOLVER-V3-031
 * inventory finding: V1 does not runtime-validate all of these).
 */
export type ResolverObservationAggregationProjectionV2BlockedReason =
  | 'unknown_contract_version'
  | 'unknown_privacy_policy_version'
  | 'unclassified_field'
  | 'invalid_observation'
  | 'unsafe_free_text'
  | 'personal_source'
  | 'unknown_source_type'
  | 'unsafe_reason_code'
  | 'invalid_locale'
  | 'invalid_input_type'
  | 'invalid_outcome'
  | 'invalid_provenance_status'
  | 'invalid_latency';

export type ResolverObservationAggregationProjectionV2Result =
  | { status: 'projected'; projection: ResolverObservationAggregationProjectionV2 }
  | { status: 'blocked'; reason: ResolverObservationAggregationProjectionV2BlockedReason };
