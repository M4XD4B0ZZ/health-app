import {
  containsDenylistedField,
  validateResolverKnowledgeShadowCandidateSnapshot,
  validateResolverKnowledgeShadowGroundTruth,
  validateResolverProductionDecisionProjection,
} from '../application/shadow/ResolverKnowledgeShadowPrivacyValidator';
import type { ResolverKnowledgeShadowCandidateSnapshot } from '../domain/models/ResolverKnowledgeShadowEvaluation';
import type { ResolverProductionDecisionProjectionV1 } from '../domain/models/ResolverProductionDecisionProjection';
import { RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION } from '../domain/models/ResolverProductionDecisionProjection';
import { RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION } from '../domain/models/ResolverKnowledgeShadowGroundTruth';

const validCandidate = (): ResolverKnowledgeShadowCandidateSnapshot => ({
  candidateId: 'candidate-1',
  fingerprint: 'fingerprint-1',
  candidateType: 'abstention-policy-signal',
  candidateVersion: 'resolver-knowledge-candidate-v1',
  payload: {
    type: 'abstention-policy-signal',
    locale: 'de',
    inputType: 'generic',
    reasonCode: 'LOW_SCORE',
  } as any,
});

const validProjection = (): ResolverProductionDecisionProjectionV1 => ({
  projectionVersion: RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION,
  status: 'accepted',
  reasonCodes: ['ACCEPTED_STRONG_MATCH'],
  candidateCount: 1,
  selectedSourceType: 'bls',
  provenanceClassification: 'source_grounded',
  inputConfidenceLevel: 'high',
});

describe('ResolverKnowledgeShadowPrivacyValidator', () => {
  it('accepts a fully valid candidate snapshot', () => {
    expect(validateResolverKnowledgeShadowCandidateSnapshot(validCandidate())).toHaveLength(0);
  });

  it('accepts a fully valid production decision projection', () => {
    expect(validateResolverProductionDecisionProjection(validProjection())).toHaveLength(0);
  });

  it.each(['unknown', 'not_evaluable'] as const)(
    'accepts a valid %s ground truth',
    (evidenceClass) => {
      const groundTruth =
        evidenceClass === 'unknown'
          ? {
              evidenceVersion: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
              evidenceClass: 'unknown' as const,
            }
          : {
              evidenceVersion: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
              evidenceClass: 'not_evaluable' as const,
              reasonCode: 'GROUND_TRUTH_NOT_SUPPORTED_BY_CONTRACT' as const,
            };
      expect(validateResolverKnowledgeShadowGroundTruth(groundTruth)).toHaveLength(0);
    },
  );

  it('accepts a valid fixture-derived ground truth', () => {
    expect(
      validateResolverKnowledgeShadowGroundTruth({
        evidenceVersion: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
        evidenceClass: 'fixture-derived',
        expectedStatus: 'accepted',
        corpusRegistryVersion: 'resolver-knowledge-shadow-corpus-registry-v1',
        corpusCaseId: 'case-1',
      }),
    ).toHaveLength(0);
  });

  it('rejects an unknown top-level key on the candidate snapshot', () => {
    const invalid = { ...validCandidate(), ownerId: 'owner-secret' } as any;
    expect(validateResolverKnowledgeShadowCandidateSnapshot(invalid).length).toBeGreaterThan(0);
  });

  it('rejects an unknown top-level key on the production decision projection', () => {
    const invalid = { ...validProjection(), normalizedQuery: 'leak' } as any;
    expect(validateResolverProductionDecisionProjection(invalid).length).toBeGreaterThan(0);
  });

  it('rejects a nested private field injected inside the candidate payload', () => {
    const invalid = {
      ...validCandidate(),
      payload: { ...validCandidate().payload, meta: { ownerId: 'owner-secret' } },
    } as any;
    expect(validateResolverKnowledgeShadowCandidateSnapshot(invalid).length).toBeGreaterThan(0);
  });

  it('rejects a private field hidden inside an array element', () => {
    const invalid = {
      ...validProjection(),
      reasonCodes: ['ACCEPTED_STRONG_MATCH', { ownerId: 'x' }],
    } as any;
    expect(validateResolverProductionDecisionProjection(invalid).length).toBeGreaterThan(0);
  });

  it('rejects an unknown discriminant value on the candidate payload', () => {
    const invalid = {
      ...validCandidate(),
      candidateType: 'unknown-future-type',
      payload: { type: 'unknown-future-type', locale: 'de', inputType: 'generic' },
    } as any;
    expect(validateResolverKnowledgeShadowCandidateSnapshot(invalid).length).toBeGreaterThan(0);
  });

  it('rejects an unknown discriminant value on the ground truth', () => {
    const invalid = {
      evidenceVersion: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
      evidenceClass: 'proven',
    } as any;
    expect(validateResolverKnowledgeShadowGroundTruth(invalid).length).toBeGreaterThan(0);
  });

  it('rejects snake_case variants of denylisted keys the same as camelCase', () => {
    const invalid = { ...validCandidate(), owner_id: 'owner-secret' } as any;
    expect(validateResolverKnowledgeShadowCandidateSnapshot(invalid).length).toBeGreaterThan(0);
  });

  it('rejects a candidate payload with a valid top level but unsafe nested content', () => {
    const invalid = {
      ...validCandidate(),
      candidateType: 'source-routing-pattern',
      payload: {
        type: 'source-routing-pattern',
        locale: 'de',
        inputType: 'generic',
        sourceType: { nested: { rawInput: 'leak' } },
      },
    } as any;
    expect(validateResolverKnowledgeShadowCandidateSnapshot(invalid).length).toBeGreaterThan(0);
  });

  it('rejects an unsupported ground-truth evidence version', () => {
    const invalid = {
      evidenceVersion: 'resolver-knowledge-shadow-ground-truth-v99',
      evidenceClass: 'unknown',
    } as any;
    expect(validateResolverKnowledgeShadowGroundTruth(invalid).length).toBeGreaterThan(0);
  });

  describe('containsDenylistedField (defense in depth)', () => {
    it('detects a denylisted key at the top level', () => {
      expect(containsDenylistedField({ ownerId: 'x' })).toBe(true);
    });

    it('detects a denylisted key nested inside an object', () => {
      expect(containsDenylistedField({ payload: { meta: { rawInput: 'x' } } })).toBe(true);
    });

    it('detects a denylisted key nested inside an array', () => {
      expect(containsDenylistedField({ items: [{ ok: true }, { sourceId: 'x' }] })).toBe(true);
    });

    it('returns false for a clean object', () => {
      expect(containsDenylistedField(validProjection())).toBe(false);
    });
  });
});
