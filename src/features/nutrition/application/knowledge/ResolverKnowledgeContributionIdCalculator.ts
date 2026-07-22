import type { ResolverKnowledgeCandidateFingerprintV2 } from '../../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import { RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeContributionLedger';
import type { ResolverKnowledgeFingerprintHasher } from '../ports/ResolverKnowledgeFingerprintHasher';

/**
 * Deterministic private contribution-ID derivation (RESOLVER-V3-032 binding requirement §3-§4,
 * §14). The identity is exactly `{observationId, resolverRunId, originalCandidateFingerprint}` —
 * the *original* matched-candidate fingerprint, never a mutable terminal-target identity, so a
 * duplicate/supersession chain change can never manufacture a second contribution from the same
 * observation/target pair, and a literal retry (identical triple) always re-derives the same ID.
 * Distinguishes one observation contributing to two distinct candidate targets, since the target
 * fingerprint is part of the identity.
 *
 * Private-zone-only: this ID (and its canonical input) must never be included in a global summary,
 * candidate fingerprint, review material, log, or benchmark-safe output.
 */
export const RESOLVER_KNOWLEDGE_CONTRIBUTION_ID_INPUT_FORMAT_VERSION =
  'resolver-knowledge-contribution-id-input-v1' as const;

export function buildResolverKnowledgeContributionIdCanonicalInput(
  observationId: string,
  resolverRunId: string,
  originalCandidateFingerprint: ResolverKnowledgeCandidateFingerprintV2,
): string {
  return JSON.stringify([
    RESOLVER_KNOWLEDGE_CONTRIBUTION_ID_INPUT_FORMAT_VERSION,
    RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
    observationId,
    resolverRunId,
    originalCandidateFingerprint.fingerprintVersion,
    originalCandidateFingerprint.digest,
  ]);
}

export async function computeResolverKnowledgeContributionId(
  observationId: string,
  resolverRunId: string,
  originalCandidateFingerprint: ResolverKnowledgeCandidateFingerprintV2,
  hasher: ResolverKnowledgeFingerprintHasher,
): Promise<string> {
  return hasher.sha256Hex(
    buildResolverKnowledgeContributionIdCanonicalInput(
      observationId,
      resolverRunId,
      originalCandidateFingerprint,
    ),
  );
}

/**
 * Deterministic retraction-event ID, derived from the retraction action ID and the contribution it
 * retracts. Purely for audit/dedup convenience within the reference repository; the actual
 * idempotency/conflict decision for a retraction *action* is made from the action's full
 * `(reason, selector)` content (see `ResolverKnowledgeContributionRetractionPlanner.ts`), not from
 * this ID alone.
 */
export const RESOLVER_KNOWLEDGE_RETRACTION_EVENT_ID_INPUT_FORMAT_VERSION =
  'resolver-knowledge-retraction-event-id-input-v1' as const;

export async function computeResolverKnowledgeRetractionEventId(
  retractionActionId: string,
  contributionId: string,
  hasher: ResolverKnowledgeFingerprintHasher,
): Promise<string> {
  const canonicalInput = JSON.stringify([
    RESOLVER_KNOWLEDGE_RETRACTION_EVENT_ID_INPUT_FORMAT_VERSION,
    RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_VERSION,
    retractionActionId,
    contributionId,
  ]);
  return hasher.sha256Hex(canonicalInput);
}
