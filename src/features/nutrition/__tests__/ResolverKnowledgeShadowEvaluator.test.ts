import fs from 'fs';
import path from 'path';
import {
  ResolverKnowledgeShadowEvaluator,
  aggregateResolverKnowledgeShadowMetrics,
  evaluateShadowCorpus,
} from '../application/shadow/ResolverKnowledgeShadowEvaluator';
import {
  RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
  type ResolverKnowledgeShadowEvaluationRequest,
} from '../domain/models/ResolverKnowledgeShadowEvaluation';
const decision = () => ({
  normalizedQuery: 'not persisted',
  status: 'accepted' as const,
  reasonCodes: ['ACCEPTED_STRONG_MATCH'],
  candidates: [],
  createdAt: '2026-07-21T00:00:00.000Z',
});
const request = (
  overrides: Record<string, unknown> = {},
): ResolverKnowledgeShadowEvaluationRequest =>
  ({
    evaluationVersion: RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
    caseId: 'shadow-case-1',
    locale: 'de',
    inputType: 'generic',
    productionDecision: decision(),
    candidate: {
      candidateId: 'candidate-1',
      fingerprint: 'fingerprint-1',
      candidateType: 'abstention-policy-signal',
      candidateVersion: 'resolver-knowledge-candidate-v1',
      payload: {
        type: 'abstention-policy-signal',
        locale: 'de',
        inputType: 'generic',
        reasonCode: 'LOW_SCORE',
      },
    },
    resolverVersion: 'resolver-v3',
    corpusPartition: 'development',
    ...overrides,
  }) as ResolverKnowledgeShadowEvaluationRequest;
describe('ResolverKnowledgeShadowEvaluator', () => {
  it('is deterministic and preserves the production object structurally', () => {
    const production = decision();
    const input = request({ productionDecision: production });
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(evaluator.evaluate(input)).toEqual(evaluator.evaluate(input));
    expect(input.productionDecision).toBe(production);
    expect(production).toEqual(decision());
  });
  it.each([
    ['abstention-policy-signal', 'hypothetical_abstention', 'rejected'],
    ['clarification-policy-signal', 'hypothetical_clarification', 'ambiguous'],
    ['provenance-gap', 'hypothetical_provenance_warning', 'accepted'],
    ['negative-source-routing-rule', 'hypothetical_source_change', 'ambiguous'],
  ])('only computes a hypothetical delta for %s', (type, category, status) => {
    const input = request({
      candidate: {
        ...request().candidate,
        candidateType: type,
        payload: {
          type,
          locale: 'de',
          inputType: 'generic',
          ...(type === 'negative-source-routing-rule'
            ? { sourceType: 'bls', reasonCode: 'LOW_SCORE' }
            : type === 'abstention-policy-signal'
              ? { reasonCode: 'LOW_SCORE' }
              : type === 'clarification-policy-signal'
                ? { reasonCode: 'MULTIPLE_CLOSE_MATCHES' }
                : {}),
        },
      },
    });
    const output = new ResolverKnowledgeShadowEvaluator().evaluate(input);
    expect(output.delta.category).toBe(category);
    expect(output.hypotheticalShadowStatus).toBe(status);
    expect(input.productionDecision.status).toBe('accepted');
  });
  it('blocks locale mismatch, private fields, unsupported candidates, and unknown versions fail-closed', () => {
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(evaluator.evaluate(request({ locale: 'en' })).delta.category).toBe('blocked_locale');
    expect(
      evaluator.evaluate(
        request({
          candidate: {
            ...request().candidate,
            payload: { ...(request().candidate.payload as object), rawInput: 'private' },
          },
        }),
      ).delta.category,
    ).toBe('privacy_blocked');
    expect(
      evaluator.evaluate(request({ candidate: { ...request().candidate, candidateType: 'alias' } }))
        .delta.category,
    ).toBe('not_evaluable');
    expect(
      evaluator.evaluate(
        request({ candidate: { ...request().candidate, candidateVersion: 'future' } }),
      ).delta.category,
    ).toBe('invalid_candidate');
    expect(() => evaluator.evaluate(request({ evaluationVersion: 'future' as any }))).toThrow(
      'SHADOW_UNKNOWN_EVALUATION_VERSION',
    );
  });
  it('separates corpus partitions and reports unknown rather than invented metrics', () => {
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const corpus = evaluateShadowCorpus(evaluator, [
      request(),
      request({ caseId: 'holdout-1', corpusPartition: 'holdout' }),
    ]);
    expect(corpus.development).toHaveLength(1);
    expect(corpus.holdout).toHaveLength(1);
    expect(() =>
      evaluateShadowCorpus(evaluator, [request(), request({ corpusPartition: 'holdout' })]),
    ).toThrow('SHADOW_CASE_IN_MULTIPLE_PARTITIONS');
    expect(aggregateResolverKnowledgeShadowMetrics(corpus.development)).toMatchObject({
      evaluatedCaseCount: 1,
      abstentionDeltaCount: 1,
      identificationAccuracy: 'unknown',
      abstentionPrecision: 'unknown',
    });
  });
  it('has no resolver, provider, network, or persistence dependency', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../application/shadow/ResolverKnowledgeShadowEvaluator.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/\.resolve\(|fetch\(|supabase|provider|repository/i);
  });
});
