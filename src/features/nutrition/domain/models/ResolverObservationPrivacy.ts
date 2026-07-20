import {
  RESOLVER_OBSERVATION_CONTRACT_VERSION,
  type ResolverObservation,
} from './ResolverObservation';

export const RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION =
  'resolver-observation-privacy-v1' as const;

/** Closed, non-personal machine codes currently emitted by ResolverDecisionPolicy. */
export const RESOLVER_OBSERVATION_SAFE_REASON_CODES = [
  'NO_CANDIDATES',
  'ACCEPTED_STRONG_MATCH',
  'MULTIPLE_CLOSE_MATCHES',
  'LOW_SCORE',
  'BLS_GENERIC_TRUTH',
  'USER_SOURCE_PRIORITY',
] as const;

export type ResolverObservationPrivacyTreatment =
  | 'retain_private'
  | 'exclude_from_projection'
  | 'project_after_approved_deidentification'
  | 'project_as_closed_operational_field';

export const RESOLVER_OBSERVATION_STORAGE_FIELD_PRIVACY = {
  id: 'exclude_from_projection',
  owner_id: 'retain_private',
  observation_id: 'exclude_from_projection',
  resolver_run_id: 'exclude_from_projection',
  contract_version: 'project_as_closed_operational_field',
  occurred_at: 'exclude_from_projection',
  observation_payload: 'retain_private',
  created_at: 'exclude_from_projection',
} as const satisfies Record<string, ResolverObservationPrivacyTreatment>;

export const RESOLVER_OBSERVATION_CONTRACT_FIELD_PRIVACY = {
  contractVersion: 'project_as_closed_operational_field',
  observationId: 'exclude_from_projection',
  resolverRunId: 'exclude_from_projection',
  occurredAt: 'exclude_from_projection',
  input: 'retain_private',
  'input.rawInput': 'retain_private',
  'input.normalizedInput': 'project_after_approved_deidentification',
  'input.locale': 'project_as_closed_operational_field',
  'input.inputType': 'project_as_closed_operational_field',
  decision: 'retain_private',
  'decision.outcome': 'project_as_closed_operational_field',
  'decision.reasonCodes': 'project_after_approved_deidentification',
  'decision.candidateCount': 'project_as_closed_operational_field',
  'decision.selectedSource': 'retain_private',
  'decision.selectedSource.type': 'project_after_approved_deidentification',
  'decision.selectedSource.id': 'project_after_approved_deidentification',
  'decision.provenanceStatus': 'project_as_closed_operational_field',
  versions: 'retain_private',
  'versions.resolverVersion': 'project_as_closed_operational_field',
  operational: 'retain_private',
  'operational.totalLatencyMs': 'project_as_closed_operational_field',
} as const satisfies Record<string, ResolverObservationPrivacyTreatment>;

export interface ResolverObservationAggregationProjectionV1 {
  privacyPolicyVersion: typeof RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION;
  contractVersion: typeof RESOLVER_OBSERVATION_CONTRACT_VERSION;
  locale: 'de' | 'en';
  inputType: ResolverObservation['input']['inputType'];
  outcome: ResolverObservation['decision']['outcome'];
  candidateCount: number;
  selectedSource: { type: 'bls' | 'off' | 'usda'; id: string } | null;
  provenanceStatus: ResolverObservation['decision']['provenanceStatus'];
  resolverVersion: string;
  totalLatencyMs: number | 'unknown';
  reasonCodes: readonly (typeof RESOLVER_OBSERVATION_SAFE_REASON_CODES)[number][];
}

export type ResolverObservationDeidentificationResult =
  | { status: 'projected'; projection: ResolverObservationAggregationProjectionV1 }
  | {
      status: 'blocked';
      reason:
        | 'unknown_contract_version'
        | 'unknown_privacy_policy_version'
        | 'unclassified_field'
        | 'unsafe_free_text'
        | 'personal_source'
        | 'unknown_source_type'
        | 'unsafe_reason_code'
        | 'invalid_observation'
        | 'unsupported_field';
    };
