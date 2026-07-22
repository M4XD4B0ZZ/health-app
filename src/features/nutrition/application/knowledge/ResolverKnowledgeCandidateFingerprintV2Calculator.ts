import { validateResolverKnowledgeCandidatePayloadForFingerprint } from './ResolverKnowledgeFingerprintPayloadValidator';
import {
  RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
  buildResolverKnowledgeCandidateCanonicalInputV2,
  type ResolverKnowledgeCandidateFingerprintV2,
} from '../../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../../domain/models/ResolverKnowledgeCandidate';
import type { ResolverKnowledgeFingerprintHasher } from '../ports/ResolverKnowledgeFingerprintHasher';

/**
 * Versioned V2 fingerprint (RESOLVER-V3-031 §5-8). Unlike V1's synchronous `fingerprintFor`, this
 * is asynchronous because its concrete digest adapter is (SHA-256 via an injected hasher port).
 * Validates the payload before hashing, so an unsafe/malformed payload never reaches the digest
 * step. Never wired into any production caller.
 */
export async function computeResolverKnowledgeCandidateFingerprintV2(
  candidateContractVersion: unknown,
  payload: unknown,
  hasher: ResolverKnowledgeFingerprintHasher,
): Promise<ResolverKnowledgeCandidateFingerprintV2> {
  validateResolverKnowledgeCandidatePayloadForFingerprint(candidateContractVersion, payload);
  const canonicalInput = buildResolverKnowledgeCandidateCanonicalInputV2(
    RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    payload,
  );
  const digest = await hasher.sha256Hex(canonicalInput);
  return { fingerprintVersion: RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION, digest };
}
