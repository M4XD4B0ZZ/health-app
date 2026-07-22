import { validateResolverKnowledgeCandidatePayloadForFingerprint } from './ResolverKnowledgeFingerprintPayloadValidator';
import { classifyResolverKnowledgeCandidateContributionRelation } from './ResolverKnowledgeCandidateContributionRelationClassifier';
import { computeResolverKnowledgeCandidateFingerprintV2 } from './ResolverKnowledgeCandidateFingerprintV2Calculator';
import {
  deriveResolverKnowledgeCandidateIdFromFingerprintV2,
  deserializeResolverKnowledgeCandidateFingerprintV2,
  serializeResolverKnowledgeCandidateFingerprintV2,
} from './ResolverKnowledgeCandidateFingerprintV2IdentityMapper';
import { computeResolverKnowledgeContributionId } from './ResolverKnowledgeContributionIdCalculator';
import { stableJsonStringify } from './ResolverKnowledgeContributionLedgerEquality';
import { resolveResolverKnowledgeCandidateTerminalChain } from './ResolverKnowledgeCandidateTerminalChainResolver';
import { isValidResolverObservationAggregationProjectionV2 } from '../observations/ResolverObservationAggregationProjectionV2Validator';
import { buildResolverKnowledgeCandidateCanonicalInputV2 } from '../../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidate,
  type ResolverKnowledgeCandidateEvidence,
  type ResolverKnowledgeCandidatePayload,
  type ResolverKnowledgeCandidateType,
} from '../../domain/models/ResolverKnowledgeCandidate';
import { RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeContributionLedger';
import type { ResolverKnowledgeContribution } from '../../domain/models/ResolverKnowledgeContributionLedger';
import type { ResolverObservationAggregationProjectionV2 } from '../../domain/models/ResolverObservationAggregationProjectionV2';
import type { ResolverKnowledgeFingerprintHasher } from '../ports/ResolverKnowledgeFingerprintHasher';

export interface ResolverKnowledgeContributionRecordingRequest {
  observationId: string;
  resolverRunId: string;
  candidateContractVersion: string;
  /** Unvalidated incoming payload; validated internally against the V3-031 payload validator. */
  incomingPayload: unknown;
  /** Unvalidated V2 aggregation projection; validated internally. */
  projection: unknown;
  /**
   * Explicit original target candidate, or `null` to find-or-create a candidate at the incoming
   * payload's own fingerprint (RESOLVER-V3-032 binding requirement §15 — target discovery beyond
   * this explicit-or-self-fingerprint rule is out of scope; approximate scanning is never done
   * here).
   */
  explicitOriginalTargetCandidateId: string | null;
  now: string;
}

export type ResolverKnowledgeContributionRecordingFailureCode =
  | 'invalid_input'
  | 'target_not_found'
  | 'fingerprint_payload_conflict'
  | 'chain_resolution_failed';

export type ResolverKnowledgeContributionRecordingPlan =
  | {
      status: 'record';
      contribution: ResolverKnowledgeContribution;
      createCandidate: ResolverKnowledgeCandidate | null;
      terminalCandidateId: string;
    }
  | { status: 'already_recorded'; contributionId: string; terminalCandidateId: string }
  | { status: 'conflict'; contributionId: string }
  | { status: 'failed'; code: ResolverKnowledgeContributionRecordingFailureCode };

function riskFor(candidateType: ResolverKnowledgeCandidateType): 'low' | 'medium' | 'high' {
  if (candidateType === 'negative-source-routing-rule') return 'high';
  if (candidateType === 'source-routing-pattern') return 'low';
  return 'medium';
}

function emptyLegacyEvidence(): ResolverKnowledgeCandidateEvidence {
  return {
    supportingEvidenceCount: 0,
    contradictingEvidenceCount: 0,
    abstentionSignalCount: 0,
    clarificationSignalCount: 0,
    contradictionStatus: 'none',
    negativeEvidenceSummary: 'none',
    independentUserEvidence: 'not_evaluable',
    locales: [],
    inputTypes: [],
    sourceTypes: [],
    provenanceStatuses: [],
    reasonCodes: [],
    privacyPolicyVersions: [],
    observationContractVersions: [],
    resolverVersions: [],
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isContributionLogicallyEqual(
  a: ResolverKnowledgeContribution,
  b: ResolverKnowledgeContribution,
): boolean {
  const { recordedAt: _a, ...restA } = a;
  const { recordedAt: _b, ...restB } = b;
  return stableJsonStringify(restA) === stableJsonStringify(restB);
}

/**
 * Pure(-ish; hashing is async) planning function for recording one contribution
 * (RESOLVER-V3-032 binding requirement §3-§16). Takes read-only snapshots of the current candidate
 * and contribution state and returns a closed plan describing exactly what should be written — it
 * never mutates its inputs itself; the caller (the in-memory repository) is responsible for
 * staging the plan atomically.
 */
export async function planResolverKnowledgeContributionRecording(
  request: ResolverKnowledgeContributionRecordingRequest,
  currentCandidates: readonly ResolverKnowledgeCandidate[],
  currentContributions: readonly ResolverKnowledgeContribution[],
  hasher: ResolverKnowledgeFingerprintHasher,
): Promise<ResolverKnowledgeContributionRecordingPlan> {
  if (!isNonEmptyString(request.observationId) || !isNonEmptyString(request.resolverRunId))
    return { status: 'failed', code: 'invalid_input' };
  if (request.candidateContractVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION)
    return { status: 'failed', code: 'invalid_input' };

  let incomingPayload: ResolverKnowledgeCandidatePayload;
  try {
    validateResolverKnowledgeCandidatePayloadForFingerprint(
      request.candidateContractVersion,
      request.incomingPayload,
    );
    incomingPayload = request.incomingPayload as ResolverKnowledgeCandidatePayload;
  } catch {
    return { status: 'failed', code: 'invalid_input' };
  }

  if (!isValidResolverObservationAggregationProjectionV2(request.projection))
    return { status: 'failed', code: 'invalid_input' };
  const projection = request.projection as ResolverObservationAggregationProjectionV2;

  let targetCandidate: ResolverKnowledgeCandidate;
  let createCandidate: ResolverKnowledgeCandidate | null = null;

  if (request.explicitOriginalTargetCandidateId !== null) {
    const found = currentCandidates.find(
      (candidate) => candidate.candidateId === request.explicitOriginalTargetCandidateId,
    );
    if (!found) return { status: 'failed', code: 'target_not_found' };
    if (!deserializeResolverKnowledgeCandidateFingerprintV2(found.fingerprint))
      return { status: 'failed', code: 'target_not_found' };
    targetCandidate = found;
  } else {
    const fingerprint = await computeResolverKnowledgeCandidateFingerprintV2(
      request.candidateContractVersion,
      incomingPayload,
      hasher,
    );
    const serializedFingerprint = serializeResolverKnowledgeCandidateFingerprintV2(fingerprint);
    const existing = currentCandidates.find(
      (candidate) => candidate.fingerprint === serializedFingerprint,
    );
    if (existing) {
      const existingCanonical = buildResolverKnowledgeCandidateCanonicalInputV2(
        RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
        existing.payload,
      );
      const incomingCanonical = buildResolverKnowledgeCandidateCanonicalInputV2(
        RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
        incomingPayload,
      );
      if (existingCanonical !== incomingCanonical)
        return { status: 'failed', code: 'fingerprint_payload_conflict' };
      targetCandidate = existing;
    } else {
      const candidateId = deriveResolverKnowledgeCandidateIdFromFingerprintV2(fingerprint);
      const seed: ResolverKnowledgeCandidate = {
        candidateId,
        contractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
        candidateType: incomingPayload.type,
        fingerprint: serializedFingerprint,
        payload: incomingPayload,
        evidence: emptyLegacyEvidence(),
        risk: riskFor(incomingPayload.type),
        status: 'candidate',
        duplicateOfCandidateId: null,
        supersededByCandidateId: null,
        quarantineReasonCode: null,
        createdAt: request.now,
        updatedAt: request.now,
      };
      createCandidate = seed;
      targetCandidate = seed;
    }
  }

  const originalCandidateFingerprint = deserializeResolverKnowledgeCandidateFingerprintV2(
    targetCandidate.fingerprint,
  );
  if (!originalCandidateFingerprint) return { status: 'failed', code: 'target_not_found' };

  const contributionId = await computeResolverKnowledgeContributionId(
    request.observationId,
    request.resolverRunId,
    originalCandidateFingerprint,
    hasher,
  );

  const candidatesForChainResolution = createCandidate
    ? [...currentCandidates, createCandidate]
    : currentCandidates;
  const chainResult = resolveResolverKnowledgeCandidateTerminalChain(
    targetCandidate.candidateId,
    candidatesForChainResolution,
  );
  if (chainResult.status !== 'resolved')
    return { status: 'failed', code: 'chain_resolution_failed' };

  const relation = classifyResolverKnowledgeCandidateContributionRelation(
    targetCandidate.payload,
    incomingPayload,
    request.candidateContractVersion,
  );

  const contribution: ResolverKnowledgeContribution = {
    ledgerContractVersion: RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
    contributionId,
    observationId: request.observationId,
    resolverRunId: request.resolverRunId,
    originalCandidateFingerprint,
    originalCandidateId: targetCandidate.candidateId,
    candidatePayload: incomingPayload,
    relation,
    projectionVersion: projection.projectionVersion,
    privacyPolicyVersion: projection.privacyPolicyVersion,
    observationContractVersion: projection.observationContractVersion,
    candidateContractVersion: request.candidateContractVersion,
    fingerprintVersion: originalCandidateFingerprint.fingerprintVersion,
    evidenceSnapshot: {
      locale: projection.locale,
      inputType: projection.inputType,
      outcome: projection.outcome,
      sourceType: projection.selectedSource ? projection.selectedSource.type : null,
      provenanceStatus: projection.provenanceStatus,
      resolverVersion: projection.resolverVersion,
      reasonCodes: [...projection.reasonCodes],
    },
    contributorToken: null,
    recordedAt: request.now,
  };

  const existingContribution = currentContributions.find(
    (candidateContribution) => candidateContribution.contributionId === contributionId,
  );
  if (existingContribution) {
    if (isContributionLogicallyEqual(existingContribution, contribution))
      return {
        status: 'already_recorded',
        contributionId,
        terminalCandidateId: chainResult.terminalCandidateId,
      };
    return { status: 'conflict', contributionId };
  }

  return {
    status: 'record',
    contribution,
    createCandidate,
    terminalCandidateId: chainResult.terminalCandidateId,
  };
}
