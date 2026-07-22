import {
  RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
  type ResolverKnowledgeCandidateFingerprintV2,
} from '../../domain/models/ResolverKnowledgeCandidateFingerprintV2';

const SEPARATOR = '::';

/**
 * Deterministic global candidate ID derived from the versioned V2 fingerprint (RESOLVER-V3-032
 * binding requirement §10). Keyed by both the fingerprint-algorithm version and the digest — never
 * the digest alone — so a future fingerprint-algorithm version can never collide with this one.
 * Distinct from, and never colliding with, V1's `rkc-v1-XXXXXXXX` candidate IDs.
 *
 * This is new RESOLVER-V3-032 identity-mapping logic; it does not modify, and is kept out of, the
 * RESOLVER-V3-031 fingerprint files (`ResolverKnowledgeCandidateFingerprintV2.ts`,
 * `ResolverKnowledgeCandidateFingerprintV2Calculator.ts`), whose behavior must remain unchanged.
 */
export function serializeResolverKnowledgeCandidateFingerprintV2(
  fingerprint: ResolverKnowledgeCandidateFingerprintV2,
): string {
  return `${fingerprint.fingerprintVersion}${SEPARATOR}${fingerprint.digest}`;
}

/** Inverse of `serializeResolverKnowledgeCandidateFingerprintV2`. Returns `null` on any malformed input. */
export function deserializeResolverKnowledgeCandidateFingerprintV2(
  value: string,
): ResolverKnowledgeCandidateFingerprintV2 | null {
  const separatorIndex = value.indexOf(SEPARATOR);
  if (separatorIndex < 0) return null;
  const fingerprintVersion = value.slice(0, separatorIndex);
  const digest = value.slice(separatorIndex + SEPARATOR.length);
  if (fingerprintVersion !== RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION || digest.length === 0)
    return null;
  return { fingerprintVersion, digest };
}

export function deriveResolverKnowledgeCandidateIdFromFingerprintV2(
  fingerprint: ResolverKnowledgeCandidateFingerprintV2,
): string {
  return `rkc-v2:${serializeResolverKnowledgeCandidateFingerprintV2(fingerprint)}`;
}
