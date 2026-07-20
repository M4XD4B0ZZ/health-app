import type { ResolverDecision } from './ResolverDecision';
import type { FoodSearchQuery } from '../catalog/FoodCatalogSource';

export const RESOLVER_OBSERVATION_CONTRACT_VERSION = 'resolver-observation-v1' as const;
export type ResolverObservationContractVersion = typeof RESOLVER_OBSERVATION_CONTRACT_VERSION;

export type ResolverObservationOutcome = 'accepted' | 'ambiguous' | 'abstained' | 'technical_error';
export type ResolverObservationClassification =
  | 'private_raw'
  | 'private_user_scoped'
  | 'aggregatable_only_after_approved_deidentification'
  | 'non_personal_operational';

/** Audit evidence only; never a resolver source, memory record, or knowledge candidate. */
export interface ResolverObservation {
  contractVersion: ResolverObservationContractVersion;
  observationId: string;
  resolverRunId: string;
  occurredAt: string;
  input: {
    rawInput: string;
    normalizedInput: string;
    locale: 'de' | 'en';
    inputType: FoodSearchQuery['inputType'] | 'unknown';
  };
  decision: {
    outcome: ResolverObservationOutcome;
    reasonCodes: string[];
    candidateCount: number;
    selectedSource: { type: string; id: string } | null;
    provenanceStatus: 'source_grounded' | 'not_resolved';
  };
  versions: { resolverVersion: string };
  operational: { totalLatencyMs: number | 'unknown' };
}

export const RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS = {
  contractVersion: 'non_personal_operational',
  observationId: 'private_user_scoped',
  resolverRunId: 'private_user_scoped',
  occurredAt: 'private_user_scoped',
  input: 'private_raw',
  'input.rawInput': 'private_raw',
  'input.normalizedInput': 'aggregatable_only_after_approved_deidentification',
  'input.locale': 'aggregatable_only_after_approved_deidentification',
  'input.inputType': 'aggregatable_only_after_approved_deidentification',
  decision: 'private_user_scoped',
  'decision.outcome': 'non_personal_operational',
  'decision.reasonCodes': 'aggregatable_only_after_approved_deidentification',
  'decision.candidateCount': 'non_personal_operational',
  'decision.selectedSource': 'aggregatable_only_after_approved_deidentification',
  'decision.provenanceStatus': 'aggregatable_only_after_approved_deidentification',
  versions: 'private_user_scoped',
  'versions.resolverVersion': 'non_personal_operational',
  operational: 'private_user_scoped',
  'operational.totalLatencyMs': 'non_personal_operational',
} as const satisfies Record<string, ResolverObservationClassification>;

export function toResolverObservationOutcome(
  decision: ResolverDecision,
): ResolverObservationOutcome {
  if (decision.status === 'accepted') return 'accepted';
  if (decision.status === 'ambiguous') return 'ambiguous';
  return 'abstained';
}
