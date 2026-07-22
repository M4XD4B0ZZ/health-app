import type { ResolverKnowledgeCandidateFingerprintV2 } from './ResolverKnowledgeCandidateFingerprintV2';
import type { ResolverKnowledgeCandidatePayload } from './ResolverKnowledgeCandidate';
import type { ResolverKnowledgeCandidateContributionRelation } from './ResolverKnowledgeCandidateContributionRelation';

/**
 * Private, closed contribution-ledger contract (RESOLVER-V3-032 binding requirement §1). Distinct
 * from `resolver-knowledge-candidate-v1` (the global candidate contract), candidate lifecycle
 * events, review events, shadow evaluation, and resolver observations. Never reused as, or
 * conflated with, any of those contract versions.
 */
export const RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION =
  'resolver-knowledge-contribution-ledger-v1' as const;

/**
 * Closed retraction-trigger reason set (RESOLVER-V3-030 design §15). No free-text reason is ever
 * accepted; the "unsafe observation/projection contract" case is expressed through the
 * `observation_invalidated` reason with a bulk (contract/projection-version) selector rather than
 * inventing a new reason string.
 */
export const RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_REASONS = [
  'owner_deletion',
  'observation_invalidated',
  'privacy_policy_revoked',
  'source_update_invalidated',
  'developer_action',
] as const;
export type ResolverKnowledgeContributionRetractionReason =
  (typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_REASONS)[number];

/**
 * Globally safe evidence snapshot captured per contribution, sourced only from the already
 * privacy-safe `ResolverObservationAggregationProjectionV2` (RESOLVER-V3-031). Contains no private
 * identifier of any kind.
 */
export interface ResolverKnowledgeContributionSafeEvidenceSnapshot {
  locale: 'de' | 'en';
  inputType: 'generic' | 'branded' | 'ambiguous' | 'unknown';
  outcome: 'accepted' | 'ambiguous' | 'abstained' | 'technical_error';
  sourceType: 'bls' | 'off' | 'usda' | null;
  provenanceStatus: 'source_grounded' | 'not_resolved';
  resolverVersion: string;
  reasonCodes: readonly string[];
}

/**
 * Immutable private contribution record (RESOLVER-V3-032 binding requirement §1-§2). Append-only:
 * no operation ever edits a contribution's payload, relation, identifiers, or evidence snapshot
 * after creation. Effective active/retracted state is derived from this record plus its
 * retraction events (`ResolverKnowledgeContributionRetractionEvent`), never from a mutable status
 * field on this type itself — see the contract documentation for the full append-only/retraction
 * design rationale.
 *
 * `contributorToken` is a reserved, fail-closed slot for the RESOLVER-V3-035 independent-user
 * evidence policy, which is blocked and not authorized here. It MUST be `null` in this contract
 * version; runtime validation rejects any non-null value (see
 * `ResolverKnowledgeContributionLedgerValidator`).
 *
 * `observationId` and `resolverRunId` are authorized only inside this private ledger boundary —
 * they must never cross into a global candidate, evidence summary, lifecycle event, or any other
 * global-zone-facing object.
 */
export interface ResolverKnowledgeContribution {
  ledgerContractVersion: typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION;
  contributionId: string;
  observationId: string;
  resolverRunId: string;
  originalCandidateFingerprint: ResolverKnowledgeCandidateFingerprintV2;
  originalCandidateId: string;
  candidatePayload: ResolverKnowledgeCandidatePayload;
  relation: ResolverKnowledgeCandidateContributionRelation;
  projectionVersion: string;
  privacyPolicyVersion: string;
  observationContractVersion: string;
  candidateContractVersion: string;
  fingerprintVersion: string;
  evidenceSnapshot: ResolverKnowledgeContributionSafeEvidenceSnapshot;
  contributorToken: null;
  recordedAt: string;
}

/**
 * Immutable, append-only retraction event. There is no "unretract"/reactivation operation
 * anywhere in this contract; a contribution's effective state can only ever move from active to
 * retracted, never back.
 */
export interface ResolverKnowledgeContributionRetractionEvent {
  ledgerContractVersion: typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION;
  retractionEventId: string;
  retractionActionId: string;
  contributionId: string;
  reason: ResolverKnowledgeContributionRetractionReason;
  occurredAt: string;
}

/** Closed retraction-selector discriminant set (RESOLVER-V3-032 binding requirement §17). */
export const RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_SELECTOR_KINDS = [
  'contribution_ids',
  'observation_id',
  'observation_contract_version',
  'projection_version',
  'privacy_policy_version',
  'source_type',
] as const;
export type ResolverKnowledgeContributionRetractionSelectorKind =
  (typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_SELECTOR_KINDS)[number];

/**
 * Closed selector union. `contribution_ids` is used for both `developer_action` (explicitly
 * selected rows) and `owner_deletion` (a private contribution-ID set already resolved by an
 * upstream, not-yet-authorized owner lookup — see the contract documentation's owner-deletion
 * limitation section).
 */
export type ResolverKnowledgeContributionRetractionSelector =
  | { kind: 'contribution_ids'; contributionIds: readonly string[] }
  | { kind: 'observation_id'; observationId: string }
  | { kind: 'observation_contract_version'; observationContractVersion: string }
  | { kind: 'projection_version'; projectionVersion: string }
  | { kind: 'privacy_policy_version'; privacyPolicyVersion: string }
  | { kind: 'source_type'; sourceType: 'bls' | 'off' | 'usda' };

/**
 * A single closed retraction request/action. `retractionActionId` is the idempotency key: an
 * exact retry (identical `reason` + `selector`) is a zero-mutation no-op; reusing the same ID with
 * different content fails closed as a conflict (mirroring contribution-recording idempotency).
 */
export interface ResolverKnowledgeContributionRetractionRequest {
  ledgerContractVersion: typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION;
  retractionActionId: string;
  reason: ResolverKnowledgeContributionRetractionReason;
  selector: ResolverKnowledgeContributionRetractionSelector;
  occurredAt: string;
}

/**
 * Closed mapping from retraction reason to the selector kind(s) it authorizes (RESOLVER-V3-030
 * design §15, RESOLVER-V3-032 binding requirement §17). Never a free combination — this is what
 * makes the "unsafe observation/projection contract" bulk case expressible through the existing
 * `observation_invalidated` reason without inventing a new reason string.
 */
export const RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_ALLOWED_SELECTOR_KINDS: Record<
  ResolverKnowledgeContributionRetractionReason,
  readonly ResolverKnowledgeContributionRetractionSelectorKind[]
> = {
  owner_deletion: ['contribution_ids'],
  observation_invalidated: ['observation_id', 'observation_contract_version', 'projection_version'],
  privacy_policy_revoked: ['privacy_policy_version'],
  source_update_invalidated: ['source_type'],
  developer_action: ['contribution_ids'],
};
