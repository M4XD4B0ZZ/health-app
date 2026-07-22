import { computeResolverKnowledgeCandidateFingerprintV2 } from '../application/knowledge/ResolverKnowledgeCandidateFingerprintV2Calculator';
import { NodeCryptoResolverKnowledgeFingerprintHasher } from '../infrastructure/knowledge/NodeCryptoResolverKnowledgeFingerprintHasher';
import {
  RESOLVER_KNOWLEDGE_CANONICAL_INPUT_FORMAT_VERSION,
  RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION,
  buildResolverKnowledgeCandidateCanonicalInputV2,
} from '../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import { RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION } from '../domain/models/ResolverKnowledgeCandidate';
import { resolverKnowledgeCandidateFingerprintFor as v1FingerprintFor } from '../application/knowledge/ResolverKnowledgeCandidateAggregator';

const hasher = new NodeCryptoResolverKnowledgeFingerprintHasher();
const contractVersion = RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION;

const routingPayload = (overrides: Record<string, unknown> = {}) => ({
  type: 'source-routing-pattern' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  sourceType: 'bls' as const,
  ...overrides,
});

describe('ResolverKnowledgeCandidateFingerprintV2 canonical serialization', () => {
  it('includes candidate-contract version, candidate type, and the exact closed payload', () => {
    const canonical = buildResolverKnowledgeCandidateCanonicalInputV2(
      contractVersion,
      routingPayload(),
    );
    const parsed = JSON.parse(canonical);
    expect(parsed[0]).toBe(RESOLVER_KNOWLEDGE_CANONICAL_INPUT_FORMAT_VERSION);
    expect(parsed[1]).toBe(contractVersion);
    expect(parsed[2]).toBe('source-routing-pattern');
    expect(parsed[3]).toEqual(['source-routing-pattern', 'de', 'generic', 'bls']);
  });

  it('excludes every private/operational non-identity field', () => {
    const canonical = buildResolverKnowledgeCandidateCanonicalInputV2(
      contractVersion,
      routingPayload(),
    );
    expect(canonical).not.toMatch(
      /sourceId|observationId|ownerId|resolverRunId|rawInput|normalizedInput|occurredAt|evidence|status|risk|candidateId|fingerprint|resolverVersion/i,
    );
  });

  it('is insensitive to payload property insertion order', () => {
    const inOrder = {
      type: 'source-routing-pattern',
      locale: 'de',
      inputType: 'generic',
      sourceType: 'bls',
    } as const;
    const reordered = {
      sourceType: 'bls',
      inputType: 'generic',
      locale: 'de',
      type: 'source-routing-pattern',
    } as const;
    expect(buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, inOrder)).toBe(
      buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, reordered),
    );
  });

  it('produces a different string for a locale difference', () => {
    expect(
      buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, routingPayload()),
    ).not.toBe(
      buildResolverKnowledgeCandidateCanonicalInputV2(
        contractVersion,
        routingPayload({ locale: 'en' }),
      ),
    );
  });

  it('produces a different string for an input-type difference', () => {
    expect(
      buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, routingPayload()),
    ).not.toBe(
      buildResolverKnowledgeCandidateCanonicalInputV2(
        contractVersion,
        routingPayload({ inputType: 'branded' }),
      ),
    );
  });

  it('produces a different string for a source-type difference', () => {
    expect(
      buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, routingPayload()),
    ).not.toBe(
      buildResolverKnowledgeCandidateCanonicalInputV2(
        contractVersion,
        routingPayload({ sourceType: 'off' }),
      ),
    );
  });

  it('produces a different string for a reason-code difference', () => {
    const a = {
      type: 'abstention-policy-signal',
      locale: 'de',
      inputType: 'generic',
      reasonCode: 'NO_CANDIDATES',
    } as const;
    const b = {
      type: 'abstention-policy-signal',
      locale: 'de',
      inputType: 'generic',
      reasonCode: 'LOW_SCORE',
    } as const;
    expect(buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, a)).not.toBe(
      buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, b),
    );
  });

  it('does not collide across different candidate types for otherwise-similar fields', () => {
    const provenanceGap = { type: 'provenance-gap', locale: 'de', inputType: 'generic' } as const;
    const abstention = {
      type: 'abstention-policy-signal',
      locale: 'de',
      inputType: 'generic',
      reasonCode: 'NO_CANDIDATES',
    } as const;
    const clarification = {
      type: 'clarification-policy-signal',
      locale: 'de',
      inputType: 'generic',
      reasonCode: 'MULTIPLE_CLOSE_MATCHES',
    } as const;
    const negativeRouting = {
      type: 'negative-source-routing-rule',
      locale: 'de',
      inputType: 'generic',
      sourceType: 'bls',
      reasonCode: 'NO_CANDIDATES',
    } as const;
    const canonicalStrings = new Set(
      [routingPayload(), provenanceGap, abstention, clarification, negativeRouting].map((payload) =>
        buildResolverKnowledgeCandidateCanonicalInputV2(contractVersion, payload as any),
      ),
    );
    expect(canonicalStrings.size).toBe(5);
  });
});

describe('computeResolverKnowledgeCandidateFingerprintV2', () => {
  it('returns an explicit fingerprint version alongside the digest', async () => {
    const fingerprint = await computeResolverKnowledgeCandidateFingerprintV2(
      contractVersion,
      routingPayload(),
      hasher,
    );
    expect(fingerprint.fingerprintVersion).toBe(RESOLVER_KNOWLEDGE_FINGERPRINT_V2_VERSION);
    expect(fingerprint.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is a real SHA-256-class digest, not FNV-1a, and does not match the V1 fingerprint format', async () => {
    const fingerprint = await computeResolverKnowledgeCandidateFingerprintV2(
      contractVersion,
      routingPayload(),
      hasher,
    );
    expect(fingerprint.digest).not.toMatch(/^rkc-v1-/);
    expect(fingerprint.digest.length).toBe(64);
  });

  it('produces the same digest repeatedly for the same canonical input', async () => {
    const first = await computeResolverKnowledgeCandidateFingerprintV2(
      contractVersion,
      routingPayload(),
      hasher,
    );
    const second = await computeResolverKnowledgeCandidateFingerprintV2(
      contractVersion,
      routingPayload(),
      hasher,
    );
    expect(first).toEqual(second);
  });

  it('matches a hard-coded golden SHA-256 vector for a canonical source-routing-pattern payload', async () => {
    // Independently computed outside this test (and outside this codebase's own hashing code) via:
    //   node -e "const c=require('crypto');const s=JSON.stringify(['resolver-knowledge-candidate-canonical-input-v2','resolver-knowledge-candidate-v1','source-routing-pattern',['source-routing-pattern','de','generic','bls']]);console.log(c.createHash('sha256').update(s,'utf8').digest('hex'))"
    const GOLDEN_SHA256_HEX = '2e119200e1412214ce5073da5bdb930a3e7ef9f1cf30e6890977c5b558de4146';
    const fingerprint = await computeResolverKnowledgeCandidateFingerprintV2(
      contractVersion,
      routingPayload(),
      hasher,
    );
    expect(fingerprint.digest).toBe(GOLDEN_SHA256_HEX);
  });

  it('rejects unknown extra payload fields rather than ignoring them', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        { ...routingPayload(), extra: 'unexpected' },
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_PAYLOAD_TYPE_MISMATCH');
  });

  it('rejects a source id on the payload', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        { ...routingPayload(), sourceId: 'leaked' },
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_PAYLOAD_TYPE_MISMATCH');
  });

  it.each(['ownerId', 'observationId', 'resolverRunId'])(
    'rejects owner/observation/run field %s at the top level',
    async (field) => {
      await expect(
        computeResolverKnowledgeCandidateFingerprintV2(
          contractVersion,
          { ...routingPayload(), [field]: 'leaked' },
          hasher,
        ),
      ).rejects.toThrow('FINGERPRINT_PAYLOAD_TYPE_MISMATCH');
    },
  );

  it('rejects an unknown candidate-contract version', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        'resolver-knowledge-candidate-v2',
        routingPayload(),
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_UNKNOWN_CANDIDATE_CONTRACT_VERSION');
  });

  it('rejects an unknown candidate type', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        { type: 'invented-type', locale: 'de', inputType: 'generic' },
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_UNKNOWN_CANDIDATE_TYPE');
  });

  it('rejects a payload/type mismatch', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        {
          type: 'source-routing-pattern',
          locale: 'de',
          inputType: 'generic',
          reasonCode: 'NO_CANDIDATES',
        },
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_PAYLOAD_TYPE_MISMATCH');
  });

  it('rejects a personal source type', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        routingPayload({ sourceType: 'user' }),
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_UNSAFE_SOURCE_TYPE');
  });

  it('rejects an unsupported locale', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        routingPayload({ locale: 'fr' }),
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_UNSUPPORTED_LOCALE');
  });

  it('rejects an unsafe reason code', async () => {
    await expect(
      computeResolverKnowledgeCandidateFingerprintV2(
        contractVersion,
        {
          type: 'abstention-policy-signal',
          locale: 'de',
          inputType: 'generic',
          reasonCode: 'INVENTED_REASON',
        },
        hasher,
      ),
    ).rejects.toThrow('FINGERPRINT_UNSAFE_REASON_CODE');
  });
});

describe('V1 fingerprint preservation', () => {
  it('remains byte-for-byte unchanged for an existing fixture', () => {
    const payload = {
      type: 'source-routing-pattern' as const,
      locale: 'de' as const,
      inputType: 'generic' as const,
      sourceType: 'bls' as const,
    };
    expect(v1FingerprintFor(payload)).toBe('rkc-v1-d1832578');
  });
});
