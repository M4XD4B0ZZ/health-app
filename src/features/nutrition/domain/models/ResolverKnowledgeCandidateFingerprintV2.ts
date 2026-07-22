import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidatePayload,
  type ResolverKnowledgeCandidateType,
} from './ResolverKnowledgeCandidate';

/**
 * Versioned fingerprint-algorithm identifier (RESOLVER-V3-030 design §9). Independent of the
 * observation-contract, privacy-policy, projection, and candidate-contract version axes. The V1
 * FNV-1a fingerprint (`ResolverKnowledgeCandidateAggregator.fingerprintFor`) is untouched by this
 * addition and continues to exist exactly as merged for RESOLVER-V3-020.
 */
export const RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION =
  'resolver-knowledge-fingerprint-v2' as const;

/**
 * Versioned digest result. Never an unlabelled string — every V2 digest carries its algorithm
 * version alongside the hex-encoded SHA-256 value.
 */
export interface ResolverKnowledgeCandidateFingerprintV2 {
  fingerprintVersion: typeof RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION;
  digest: string;
}

/**
 * Canonical-input format identifier, documented and golden-tested so a future server-side
 * implementation (RESOLVER-V3-033/034) can reproduce the exact same digest byte-for-byte.
 *
 * Format: `JSON.stringify([formatVersion, candidateContractVersion, candidateType, orderedPayloadValues])`
 * where `orderedPayloadValues` is the payload's own closed fields picked out **by name, in a
 * fixed per-type order** (never `Object.keys`), so property-insertion order on the runtime
 * payload object can never change the canonical string. This is deliberately not
 * `JSON.stringify(payload)` — an arbitrary runtime object is never hashed directly (RESOLVER-V3-031
 * binding requirement §6).
 */
export const RESOLVER_KNOWLEDGE_CANONICAL_INPUT_FORMAT_VERSION =
  'resolver-knowledge-candidate-canonical-input-v2' as const;

/** Fixed per-type payload field order for canonical serialization. `type` is always first. */
const CANONICAL_PAYLOAD_FIELD_ORDER: Record<ResolverKnowledgeCandidateType, readonly string[]> = {
  'source-routing-pattern': ['type', 'locale', 'inputType', 'sourceType'],
  'abstention-policy-signal': ['type', 'locale', 'inputType', 'reasonCode'],
  'clarification-policy-signal': ['type', 'locale', 'inputType', 'reasonCode'],
  'provenance-gap': ['type', 'locale', 'inputType'],
  'negative-source-routing-rule': ['type', 'locale', 'inputType', 'sourceType', 'reasonCode'],
};

/**
 * Pure, deterministic canonical-input builder. Assumes `payload` has already passed the
 * dedicated fingerprint-input validator (`validateResolverKnowledgeCandidatePayloadForFingerprint`)
 * — it does not itself re-validate, so it must never be called directly on unvalidated input.
 * Contains no I/O and no Expo/Node-specific API, so it can be shared unchanged between the app
 * and any future server-only worker.
 */
export function buildResolverKnowledgeCandidateCanonicalInputV2(
  candidateContractVersion: typeof RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  payload: ResolverKnowledgeCandidatePayload,
): string {
  const fieldOrder = CANONICAL_PAYLOAD_FIELD_ORDER[payload.type];
  const payloadRecord = payload as unknown as Record<string, string>;
  const orderedPayloadValues = fieldOrder.map((field) => payloadRecord[field]);
  return JSON.stringify([
    RESOLVER_KNOWLEDGE_CANONICAL_INPUT_FORMAT_VERSION,
    candidateContractVersion,
    payload.type,
    orderedPayloadValues,
  ]);
}
