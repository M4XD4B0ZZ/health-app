import { validateResolverObservation } from './ResolverObservationValidator';
import {
  RESOLVER_OBSERVATION_CONTRACT_FIELD_PRIVACY,
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  RESOLVER_OBSERVATION_SAFE_REASON_CODES,
  type ResolverObservationDeidentificationResult,
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
const safeSources = ['bls', 'off', 'usda'] as const;

/** Produces an in-memory-only future aggregation shape; it never reads or writes global data. */
export class ResolverObservationPrivacyEnforcer {
  project(
    observation: ResolverObservation,
    policyVersion: string = RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  ): ResolverObservationDeidentificationResult {
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
    const source = observation.decision.selectedSource;
    if (source?.type === 'user') return { status: 'blocked', reason: 'personal_source' };
    if (source && !safeSources.includes(source.type as (typeof safeSources)[number]))
      return { status: 'blocked', reason: 'unknown_source_type' };
    if (
      !observation.decision.reasonCodes.every((code) =>
        RESOLVER_OBSERVATION_SAFE_REASON_CODES.includes(code as any),
      )
    )
      return { status: 'blocked', reason: 'unsafe_reason_code' };
    return {
      status: 'projected',
      projection: {
        privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
        contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
        locale: observation.input.locale,
        inputType: observation.input.inputType,
        outcome: observation.decision.outcome,
        candidateCount: observation.decision.candidateCount,
        selectedSource: source as { type: 'bls' | 'off' | 'usda'; id: string } | null,
        provenanceStatus: observation.decision.provenanceStatus,
        resolverVersion: observation.versions.resolverVersion,
        totalLatencyMs: observation.operational.totalLatencyMs,
        reasonCodes: observation.decision.reasonCodes as any,
      },
    };
  }
}
