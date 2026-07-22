import {
  RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
  RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_ALLOWED_SELECTOR_KINDS,
  RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_REASONS,
  RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_SELECTOR_KINDS,
  type ResolverKnowledgeContribution,
  type ResolverKnowledgeContributionRetractionEvent,
  type ResolverKnowledgeContributionRetractionRequest,
  type ResolverKnowledgeContributionSafeEvidenceSnapshot,
} from '../../domain/models/ResolverKnowledgeContributionLedger';
import { RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION } from '../../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeCandidate';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRIBUTION_RELATIONS } from '../../domain/models/ResolverKnowledgeCandidateContributionRelation';
import { validateResolverKnowledgeCandidatePayloadForFingerprint } from './ResolverKnowledgeFingerprintPayloadValidator';

const SAFE_LOCALES = ['de', 'en'] as const;
const SAFE_INPUT_TYPES = ['generic', 'branded', 'ambiguous', 'unknown'] as const;
const SAFE_OUTCOMES = ['accepted', 'ambiguous', 'abstained', 'technical_error'] as const;
const SAFE_SOURCE_TYPES = ['bls', 'off', 'usda'] as const;
const SAFE_PROVENANCE_STATUSES = ['source_grounded', 'not_resolved'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const sameKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** Runtime validator for the globally-safe per-contribution evidence snapshot (closed keys). */
export function validateResolverKnowledgeContributionSafeEvidenceSnapshot(
  value: unknown,
): asserts value is ResolverKnowledgeContributionSafeEvidenceSnapshot {
  if (!isPlainObject(value)) throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID');
  if (
    !sameKeys(value, [
      'locale',
      'inputType',
      'outcome',
      'sourceType',
      'provenanceStatus',
      'resolverVersion',
      'reasonCodes',
    ])
  )
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_UNKNOWN_FIELD');
  if (!(SAFE_LOCALES as readonly string[]).includes(value.locale as string))
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_LOCALE');
  if (!(SAFE_INPUT_TYPES as readonly string[]).includes(value.inputType as string))
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_INPUT_TYPE');
  if (!(SAFE_OUTCOMES as readonly string[]).includes(value.outcome as string))
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_OUTCOME');
  if (
    value.sourceType !== null &&
    !(SAFE_SOURCE_TYPES as readonly string[]).includes(value.sourceType as string)
  )
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_SOURCE_TYPE');
  if (!(SAFE_PROVENANCE_STATUSES as readonly string[]).includes(value.provenanceStatus as string))
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_PROVENANCE_STATUS');
  if (!isNonEmptyString(value.resolverVersion))
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_RESOLVER_VERSION');
  if (!isStringArray(value.reasonCodes))
    throw new Error('CONTRIBUTION_EVIDENCE_SNAPSHOT_INVALID_REASON_CODES');
}

/**
 * Runtime validator for the immutable private contribution record (RESOLVER-V3-032 binding
 * requirement §5). Closed root-key set, recursive nested validation (fingerprint, candidate
 * payload, evidence snapshot), fail-closed on unknown versions/discriminants/malformed values, and
 * a hard fail-closed check that `contributorToken` is `null` (RESOLVER-V3-035 remains blocked).
 */
export function validateResolverKnowledgeContribution(
  value: unknown,
): asserts value is ResolverKnowledgeContribution {
  if (!isPlainObject(value)) throw new Error('CONTRIBUTION_INVALID');
  if (
    !sameKeys(value, [
      'ledgerContractVersion',
      'contributionId',
      'observationId',
      'resolverRunId',
      'originalCandidateFingerprint',
      'originalCandidateId',
      'candidatePayload',
      'relation',
      'projectionVersion',
      'privacyPolicyVersion',
      'observationContractVersion',
      'candidateContractVersion',
      'fingerprintVersion',
      'evidenceSnapshot',
      'contributorToken',
      'recordedAt',
    ])
  )
    throw new Error('CONTRIBUTION_UNKNOWN_ROOT_FIELD');
  if (value.ledgerContractVersion !== RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION)
    throw new Error('CONTRIBUTION_UNSUPPORTED_LEDGER_CONTRACT_VERSION');
  if (!isNonEmptyString(value.contributionId)) throw new Error('CONTRIBUTION_INVALID_ID');
  if (!isNonEmptyString(value.observationId))
    throw new Error('CONTRIBUTION_INVALID_OBSERVATION_ID');
  if (!isNonEmptyString(value.resolverRunId)) throw new Error('CONTRIBUTION_INVALID_RUN_ID');
  if (!isNonEmptyString(value.originalCandidateId))
    throw new Error('CONTRIBUTION_INVALID_ORIGINAL_CANDIDATE_ID');

  const fingerprint = value.originalCandidateFingerprint;
  if (
    !isPlainObject(fingerprint) ||
    !sameKeys(fingerprint, ['fingerprintVersion', 'digest']) ||
    fingerprint.fingerprintVersion !== RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION ||
    !isNonEmptyString(fingerprint.digest)
  )
    throw new Error('CONTRIBUTION_INVALID_ORIGINAL_FINGERPRINT');

  if (value.candidateContractVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION)
    throw new Error('CONTRIBUTION_UNSUPPORTED_CANDIDATE_CONTRACT_VERSION');
  validateResolverKnowledgeCandidatePayloadForFingerprint(
    value.candidateContractVersion,
    value.candidatePayload,
  );

  if (
    typeof value.relation !== 'string' ||
    !(RESOLVER_KNOWLEDGE_CANDIDATE_CONTRIBUTION_RELATIONS as readonly string[]).includes(
      value.relation,
    )
  )
    throw new Error('CONTRIBUTION_UNKNOWN_RELATION');
  if (!isNonEmptyString(value.projectionVersion))
    throw new Error('CONTRIBUTION_INVALID_PROJECTION_VERSION');
  if (!isNonEmptyString(value.privacyPolicyVersion))
    throw new Error('CONTRIBUTION_INVALID_PRIVACY_POLICY_VERSION');
  if (!isNonEmptyString(value.observationContractVersion))
    throw new Error('CONTRIBUTION_INVALID_OBSERVATION_CONTRACT_VERSION');
  if (value.fingerprintVersion !== RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION)
    throw new Error('CONTRIBUTION_UNSUPPORTED_FINGERPRINT_VERSION');

  validateResolverKnowledgeContributionSafeEvidenceSnapshot(value.evidenceSnapshot);

  if (value.contributorToken !== null)
    throw new Error('CONTRIBUTION_CONTRIBUTOR_TOKEN_NOT_AUTHORIZED');
  if (!isIsoTimestamp(value.recordedAt)) throw new Error('CONTRIBUTION_INVALID_RECORDED_AT');
}

/** Runtime validator for an immutable retraction event (closed keys, closed reason set). */
export function validateResolverKnowledgeContributionRetractionEvent(
  value: unknown,
): asserts value is ResolverKnowledgeContributionRetractionEvent {
  if (!isPlainObject(value)) throw new Error('RETRACTION_EVENT_INVALID');
  if (
    !sameKeys(value, [
      'ledgerContractVersion',
      'retractionEventId',
      'retractionActionId',
      'contributionId',
      'reason',
      'occurredAt',
    ])
  )
    throw new Error('RETRACTION_EVENT_UNKNOWN_FIELD');
  if (value.ledgerContractVersion !== RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION)
    throw new Error('RETRACTION_EVENT_UNSUPPORTED_LEDGER_CONTRACT_VERSION');
  if (!isNonEmptyString(value.retractionEventId)) throw new Error('RETRACTION_EVENT_INVALID_ID');
  if (!isNonEmptyString(value.retractionActionId))
    throw new Error('RETRACTION_EVENT_INVALID_ACTION_ID');
  if (!isNonEmptyString(value.contributionId))
    throw new Error('RETRACTION_EVENT_INVALID_CONTRIBUTION_ID');
  if (
    typeof value.reason !== 'string' ||
    !(RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_REASONS as readonly string[]).includes(
      value.reason,
    )
  )
    throw new Error('RETRACTION_EVENT_UNKNOWN_REASON');
  if (!isIsoTimestamp(value.occurredAt)) throw new Error('RETRACTION_EVENT_INVALID_OCCURRED_AT');
}

function validateSelector(reason: string, selector: unknown): void {
  if (!isPlainObject(selector)) throw new Error('RETRACTION_REQUEST_INVALID_SELECTOR');
  const kind = selector.kind;
  if (
    typeof kind !== 'string' ||
    !(RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_SELECTOR_KINDS as readonly string[]).includes(kind)
  )
    throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_KIND');

  const allowedKinds =
    RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_ALLOWED_SELECTOR_KINDS[
      reason as keyof typeof RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_ALLOWED_SELECTOR_KINDS
    ];
  if (!allowedKinds || !(allowedKinds as readonly string[]).includes(kind))
    throw new Error('RETRACTION_REQUEST_SELECTOR_REASON_MISMATCH');

  switch (kind) {
    case 'contribution_ids': {
      if (!sameKeys(selector, ['kind', 'contributionIds']))
        throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_FIELD');
      if (!isStringArray(selector.contributionIds) || selector.contributionIds.length === 0)
        throw new Error('RETRACTION_REQUEST_INVALID_CONTRIBUTION_IDS');
      return;
    }
    case 'observation_id': {
      if (!sameKeys(selector, ['kind', 'observationId']))
        throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_FIELD');
      if (!isNonEmptyString(selector.observationId))
        throw new Error('RETRACTION_REQUEST_INVALID_OBSERVATION_ID');
      return;
    }
    case 'observation_contract_version': {
      if (!sameKeys(selector, ['kind', 'observationContractVersion']))
        throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_FIELD');
      if (!isNonEmptyString(selector.observationContractVersion))
        throw new Error('RETRACTION_REQUEST_INVALID_OBSERVATION_CONTRACT_VERSION');
      return;
    }
    case 'projection_version': {
      if (!sameKeys(selector, ['kind', 'projectionVersion']))
        throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_FIELD');
      if (!isNonEmptyString(selector.projectionVersion))
        throw new Error('RETRACTION_REQUEST_INVALID_PROJECTION_VERSION');
      return;
    }
    case 'privacy_policy_version': {
      if (!sameKeys(selector, ['kind', 'privacyPolicyVersion']))
        throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_FIELD');
      if (!isNonEmptyString(selector.privacyPolicyVersion))
        throw new Error('RETRACTION_REQUEST_INVALID_PRIVACY_POLICY_VERSION');
      return;
    }
    case 'source_type': {
      if (!sameKeys(selector, ['kind', 'sourceType']))
        throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_FIELD');
      if (!(SAFE_SOURCE_TYPES as readonly string[]).includes(selector.sourceType as string))
        throw new Error('RETRACTION_REQUEST_INVALID_SOURCE_TYPE');
      return;
    }
    default:
      throw new Error('RETRACTION_REQUEST_UNKNOWN_SELECTOR_KIND');
  }
}

/** Runtime validator for a closed retraction request (RESOLVER-V3-032 binding requirement §17). */
export function validateResolverKnowledgeContributionRetractionRequest(
  value: unknown,
): asserts value is ResolverKnowledgeContributionRetractionRequest {
  if (!isPlainObject(value)) throw new Error('RETRACTION_REQUEST_INVALID');
  if (
    !sameKeys(value, [
      'ledgerContractVersion',
      'retractionActionId',
      'reason',
      'selector',
      'occurredAt',
    ])
  )
    throw new Error('RETRACTION_REQUEST_UNKNOWN_FIELD');
  if (value.ledgerContractVersion !== RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION)
    throw new Error('RETRACTION_REQUEST_UNSUPPORTED_LEDGER_CONTRACT_VERSION');
  if (!isNonEmptyString(value.retractionActionId))
    throw new Error('RETRACTION_REQUEST_INVALID_ACTION_ID');
  if (
    typeof value.reason !== 'string' ||
    !(RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_REASONS as readonly string[]).includes(
      value.reason,
    )
  )
    throw new Error('RETRACTION_REQUEST_UNKNOWN_REASON');
  validateSelector(value.reason, value.selector);
  if (!isIsoTimestamp(value.occurredAt)) throw new Error('RETRACTION_REQUEST_INVALID_OCCURRED_AT');
}
