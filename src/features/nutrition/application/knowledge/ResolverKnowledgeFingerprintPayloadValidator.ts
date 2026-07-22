import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  RESOLVER_KNOWLEDGE_CANDIDATE_TYPES,
  type ResolverKnowledgeCandidatePayload,
} from '../../domain/models/ResolverKnowledgeCandidate';

const SAFE_LOCALES = ['de', 'en'] as const;
const SAFE_INPUT_TYPES = ['generic', 'branded', 'ambiguous', 'unknown'] as const;
const SAFE_SOURCE_TYPES = ['bls', 'off', 'usda'] as const;
const SAFE_ABSTENTION_REASON_CODES = ['NO_CANDIDATES', 'LOW_SCORE'] as const;
const SAFE_CLARIFICATION_REASON_CODES = ['MULTIPLE_CLOSE_MATCHES'] as const;

const PAYLOAD_FIELD_KEYS: Record<string, readonly string[]> = {
  'source-routing-pattern': ['type', 'locale', 'inputType', 'sourceType'],
  'abstention-policy-signal': ['type', 'locale', 'inputType', 'reasonCode'],
  'clarification-policy-signal': ['type', 'locale', 'inputType', 'reasonCode'],
  'provenance-gap': ['type', 'locale', 'inputType'],
  'negative-source-routing-rule': ['type', 'locale', 'inputType', 'sourceType', 'reasonCode'],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const sameKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

/**
 * Dedicated fingerprint-input validator (RESOLVER-V3-031 binding requirement §8). Deliberately
 * NOT `validateResolverKnowledgeCandidate` — that validator is coupled to candidate status,
 * lifecycle, and evidence, which are unrelated to what makes a *payload* safe to fingerprint.
 * Accepts `unknown` so runtime-cast adversarial objects fail closed rather than merely mistyped.
 * Throws a closed-code `Error` on any violation; never returns a partially-validated payload.
 */
export function validateResolverKnowledgeCandidatePayloadForFingerprint(
  candidateContractVersion: unknown,
  payload: unknown,
): asserts payload is ResolverKnowledgeCandidatePayload {
  if (candidateContractVersion !== RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION)
    throw new Error('FINGERPRINT_UNKNOWN_CANDIDATE_CONTRACT_VERSION');
  if (!isPlainObject(payload)) throw new Error('FINGERPRINT_INVALID_PAYLOAD');
  const type = payload.type;
  if (
    typeof type !== 'string' ||
    !(RESOLVER_KNOWLEDGE_CANDIDATE_TYPES as readonly string[]).includes(type)
  )
    throw new Error('FINGERPRINT_UNKNOWN_CANDIDATE_TYPE');
  const expectedKeys = PAYLOAD_FIELD_KEYS[type];
  if (!sameKeys(payload, expectedKeys)) throw new Error('FINGERPRINT_PAYLOAD_TYPE_MISMATCH');
  if (
    typeof payload.locale !== 'string' ||
    !(SAFE_LOCALES as readonly string[]).includes(payload.locale)
  )
    throw new Error('FINGERPRINT_UNSUPPORTED_LOCALE');
  if (
    typeof payload.inputType !== 'string' ||
    !(SAFE_INPUT_TYPES as readonly string[]).includes(payload.inputType)
  )
    throw new Error('FINGERPRINT_UNSUPPORTED_INPUT_TYPE');
  if ('sourceType' in payload) {
    if (
      typeof payload.sourceType !== 'string' ||
      !(SAFE_SOURCE_TYPES as readonly string[]).includes(payload.sourceType)
    )
      throw new Error('FINGERPRINT_UNSAFE_SOURCE_TYPE');
  }
  if ('reasonCode' in payload) {
    const safeReasonCodes: readonly string[] =
      type === 'clarification-policy-signal'
        ? SAFE_CLARIFICATION_REASON_CODES
        : SAFE_ABSTENTION_REASON_CODES;
    if (typeof payload.reasonCode !== 'string' || !safeReasonCodes.includes(payload.reasonCode))
      throw new Error('FINGERPRINT_UNSAFE_REASON_CODE');
  }
}
