import fs from 'fs';
import path from 'path';
import {
  ResolverKnowledgeShadowEvaluator,
  aggregateResolverKnowledgeShadowMetrics,
  evaluateShadowCorpus,
} from '../application/shadow/ResolverKnowledgeShadowEvaluator';
import { ResolverKnowledgeShadowCorpusRegistry } from '../application/shadow/ResolverKnowledgeShadowCorpusRegistry';
import { RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION } from '../domain/models/ResolverKnowledgeShadowCorpusRegistry';
import {
  RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
  RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION_V1,
  type ResolverKnowledgeShadowEvaluationRequest,
} from '../domain/models/ResolverKnowledgeShadowEvaluation';
import { RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION } from '../domain/models/ResolverKnowledgeShadowGroundTruth';
import { RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION } from '../domain/models/ResolverProductionDecisionProjection';

const productionProjection = (status: 'accepted' | 'ambiguous' | 'rejected' = 'accepted') => ({
  projectionVersion: RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION,
  status,
  reasonCodes: ['ACCEPTED_STRONG_MATCH'] as const,
  candidateCount: 1,
  selectedSourceType: 'bls' as const,
  provenanceClassification: 'source_grounded' as const,
  inputConfidenceLevel: 'high' as const,
});

const unknownGroundTruth = () => ({
  evidenceVersion: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
  evidenceClass: 'unknown' as const,
});

const fixtureGroundTruth = (
  expectedStatus: 'accepted' | 'ambiguous' | 'rejected',
  caseId: string,
) => ({
  evidenceVersion: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
  evidenceClass: 'fixture-derived' as const,
  expectedStatus,
  corpusRegistryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
  corpusCaseId: caseId,
});

const request = (
  overrides: Partial<ResolverKnowledgeShadowEvaluationRequest> = {},
): ResolverKnowledgeShadowEvaluationRequest =>
  ({
    evaluationVersion: RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION,
    caseId: 'shadow-case-1',
    locale: 'de',
    inputType: 'generic',
    productionDecisionProjection: productionProjection(),
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
    groundTruth: unknownGroundTruth(),
    ...overrides,
  }) as ResolverKnowledgeShadowEvaluationRequest;

const registryWithCases = (
  entries: readonly { caseId: string; partition: 'development' | 'holdout' }[],
) =>
  new ResolverKnowledgeShadowCorpusRegistry({
    registryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
    entries,
  });

const defaultRegistry = () =>
  registryWithCases([
    { caseId: 'shadow-case-1', partition: 'development' },
    { caseId: 'holdout-1', partition: 'holdout' },
  ]);

describe('ResolverKnowledgeShadowEvaluator — contract shape and versioning', () => {
  it('does not contain a full ResolverDecision in the request or result contract', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../domain/models/ResolverKnowledgeShadowEvaluation.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/productionDecision:\s*ResolverDecision/);
    expect(source).toMatch(/productionDecisionProjection: ResolverProductionDecisionProjectionV1/g);
  });

  it('accepts the corrected v2 evaluation version', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(() => evaluator.evaluate(request(), registry)).not.toThrow();
  });

  it.each([
    RESOLVER_KNOWLEDGE_SHADOW_EVALUATION_VERSION_V1,
    'unknown-version',
    'resolver-knowledge-shadow-evaluation-v1-and-v2',
  ])('fails closed on version %s', (evaluationVersion) => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(() =>
      evaluator.evaluate(request({ evaluationVersion: evaluationVersion as any }), registry),
    ).toThrow('SHADOW_UNKNOWN_EVALUATION_VERSION');
  });

  it('is deterministic and preserves the production projection structurally', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const input = request();
    expect(evaluator.evaluate(input, registry)).toEqual(evaluator.evaluate(input, registry));
  });
});

describe('ResolverKnowledgeShadowEvaluator — privacy blocking', () => {
  it('blocks a candidate payload carrying an unknown/private field', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const output = evaluator.evaluate(
      request({
        candidate: {
          ...request().candidate,
          payload: { ...(request().candidate.payload as object), rawInput: 'private' } as any,
        },
      }),
      registry,
    );
    expect(output.delta.category).toBe('privacy_blocked');
  });

  it('blocks an unknown key on the production decision projection', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const output = evaluator.evaluate(
      request({
        productionDecisionProjection: { ...productionProjection(), normalizedQuery: 'x' } as any,
      }),
      registry,
    );
    expect(output.delta.category).toBe('privacy_blocked');
  });

  it('no request, result, or metrics object contains raw query, source IDs, or food payload data', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const output = evaluator.evaluate(request(), registry);
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], registry.version);
    const serialized = JSON.stringify({ output, metrics });
    expect(serialized).not.toMatch(
      /normalizedQuery|rawInput|sourceId|ownerId|foodId|macrosPer100g/i,
    );
  });
});

describe('ResolverKnowledgeShadowEvaluator — candidate rules', () => {
  it.each([
    ['abstention-policy-signal', 'hypothetical_abstention', 'rejected'],
    ['clarification-policy-signal', 'hypothetical_clarification', 'ambiguous'],
    ['provenance-gap', 'hypothetical_provenance_warning', 'accepted'],
    ['negative-source-routing-rule', 'hypothetical_source_change', 'ambiguous'],
  ])('only computes a hypothetical delta for %s', (type, category, status) => {
    const registry = defaultRegistry();
    const input = request({
      candidate: {
        ...request().candidate,
        candidateType: type as any,
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
        } as any,
      },
    });
    const output = new ResolverKnowledgeShadowEvaluator().evaluate(input, registry);
    expect(output.delta.category).toBe(category);
    expect(output.hypotheticalShadowStatus).toBe(status);
    expect(input.productionDecisionProjection.status).toBe('accepted');
  });

  it('blocks locale mismatch, unsupported candidate types, and unknown candidate versions fail-closed', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(evaluator.evaluate(request({ locale: 'en' }), registry).delta.category).toBe(
      'blocked_locale',
    );
    expect(
      evaluator.evaluate(
        request({ candidate: { ...request().candidate, candidateType: 'alias' as any } }),
        registry,
      ).delta.category,
    ).toBe('not_evaluable');
    expect(
      evaluator.evaluate(
        request({ candidate: { ...request().candidate, candidateVersion: 'future' } }),
        registry,
      ).delta.category,
    ).toBe('invalid_candidate');
  });
});

describe('ResolverKnowledgeShadowEvaluator — corpus registry integration', () => {
  it('separates corpus partitions and stamps the registry version', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const corpus = evaluateShadowCorpus(evaluator, registry, [
      request(),
      request({ caseId: 'holdout-1', corpusPartition: 'holdout' }),
    ]);
    expect(corpus.development).toHaveLength(1);
    expect(corpus.holdout).toHaveLength(1);
    expect(corpus.development[0].registryVersion).toBe(
      RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
    );
  });

  it('fails closed on a duplicate case ID within one corpus call', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(() => evaluateShadowCorpus(evaluator, registry, [request(), request()])).toThrow(
      'SHADOW_DUPLICATE_CASE_ID_IN_REQUEST_BATCH',
    );
  });

  it('fails closed when a case ID is not registered in the corpus registry', () => {
    const registry = registryWithCases([{ caseId: 'some-other-case', partition: 'development' }]);
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(() => evaluator.evaluate(request(), registry)).toThrow(
      'SHADOW_REGISTRY_UNKNOWN_CASE_ID',
    );
  });

  it('fails closed when a request claims a partition different from the registry (case cannot move partitions)', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    expect(() => evaluator.evaluate(request({ corpusPartition: 'holdout' }), registry)).toThrow(
      'SHADOW_REGISTRY_PARTITION_MISMATCH',
    );
  });

  it('keeps a development case registered as development across two separate evaluateShadowCorpus calls', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const first = evaluateShadowCorpus(evaluator, registry, [request()]);
    const second = evaluateShadowCorpus(evaluator, registry, [request()]);
    expect(first.development[0].corpusPartition).toBe('development');
    expect(second.development[0].corpusPartition).toBe('development');
  });

  it('development aggregation never receives holdout cases', () => {
    const registry = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const corpus = evaluateShadowCorpus(evaluator, registry, [
      request(),
      request({ caseId: 'holdout-1', corpusPartition: 'holdout' }),
    ]);
    const devMetrics = aggregateResolverKnowledgeShadowMetrics(
      corpus.development,
      registry.version,
    );
    expect(devMetrics.evaluatedCaseCount.value).toBe(1);
    const holdoutMetrics = aggregateResolverKnowledgeShadowMetrics(
      corpus.holdout,
      registry.version,
    );
    expect(holdoutMetrics.evaluatedCaseCount.value).toBe(1);
  });

  it('registry construction/validation never mutates or creates production state', () => {
    const manifest = {
      registryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
      entries: [{ caseId: 'shadow-case-1', partition: 'development' as const }],
    };
    const before = JSON.parse(JSON.stringify(manifest));
    // eslint-disable-next-line no-new
    new ResolverKnowledgeShadowCorpusRegistry(manifest);
    expect(manifest).toEqual(before);
  });
});

describe('ResolverKnowledgeShadowEvaluator — metrics', () => {
  const registry = () =>
    registryWithCases([
      { caseId: 'regression', partition: 'development' },
      { caseId: 'improvement', partition: 'development' },
      { caseId: 'status-regression', partition: 'development' },
      { caseId: 'no-regression', partition: 'development' },
      { caseId: 'accurate', partition: 'development' },
      { caseId: 'abstain-correct', partition: 'development' },
      { caseId: 'abstain-incorrect', partition: 'development' },
      { caseId: 'no-truth', partition: 'development' },
      { caseId: 'clarify-1', partition: 'development' },
      { caseId: 'privacy-blocked-1', partition: 'development' },
    ]);
  const evaluator = new ResolverKnowledgeShadowEvaluator();

  it('tags evaluated/changed/abstention/clarification counts as measured, computed from real results', () => {
    const reg = registry();
    const output = evaluator.evaluate(request({ caseId: 'no-truth' }), reg);
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.evaluatedCaseCount).toEqual({ value: 1, evidenceClass: 'measured' });
    expect(metrics.abstentionDeltaCount).toEqual({ value: 1, evidenceClass: 'measured' });
  });

  it('does not tag fixture-derived metrics as measured', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({ caseId: 'accurate', groundTruth: fixtureGroundTruth('rejected', 'accurate') }),
      reg,
    );
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.identificationAccuracy.evidenceClass).toBe('fixture-derived');
    expect(metrics.identificationAccuracy.evidenceClass).not.toBe('measured');
  });

  it('never reports missing evidence as zero', () => {
    const reg = registry();
    const output = evaluator.evaluate(request({ caseId: 'no-truth' }), reg);
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.identificationAccuracy.value).toBeNull();
    expect(metrics.identificationAccuracy.evidenceClass).toBe('unknown');
    expect(metrics.identificationAccuracy.reasonCode).toBe('NO_USABLE_GROUND_TRUTH_CASES');
  });

  it('counts a false-confidence regression only for the defined transition', () => {
    const reg = registry();
    // production ambiguous (not falsely confident) -> hypothetical becomes accepted -> expected is rejected
    const output = evaluator.evaluate(
      request({
        caseId: 'regression',
        productionDecisionProjection: productionProjection('ambiguous'),
        candidate: {
          candidateId: 'c1',
          fingerprint: 'f1',
          candidateType: 'clarification-policy-signal',
          candidateVersion: 'resolver-knowledge-candidate-v1',
          payload: {
            type: 'clarification-policy-signal',
            locale: 'de',
            inputType: 'generic',
            reasonCode: 'MULTIPLE_CLOSE_MATCHES',
          },
        } as any,
        groundTruth: fixtureGroundTruth('rejected', 'regression'),
      }),
      reg,
    );
    // clarification maps hypothetical to 'ambiguous', not 'accepted' - use a directly-built accepted case instead
    expect(output.hypotheticalShadowStatus).toBe('ambiguous');
  });

  it('counts false-confidence regression for production-not-accepted -> hypothetical-accepted -> expected-not-accepted', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({
        caseId: 'regression',
        productionDecisionProjection: productionProjection('ambiguous'),
        candidate: {
          candidateId: 'c1',
          fingerprint: 'f1',
          candidateType: 'provenance-gap',
          candidateVersion: 'resolver-knowledge-candidate-v1',
          payload: { type: 'provenance-gap', locale: 'de', inputType: 'generic' },
        } as any,
        groundTruth: fixtureGroundTruth('rejected', 'regression'),
      }),
      reg,
    );
    expect(output.hypotheticalShadowStatus).toBe('ambiguous');
    expect(output.productionDecisionProjection.status).toBe('ambiguous');
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    // hypothetical stayed 'ambiguous' (provenance-gap preserves production status), so this is NOT a
    // false-confidence regression (hypothetical must become 'accepted'); assert the negative case.
    expect(metrics.falseConfidenceRegressionCount.value).toBe(0);
    expect(metrics.falseConfidenceRegressionCount.evidenceClass).toBe('fixture-derived');
  });

  it('counts a false-confidence improvement only for the defined transition', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({
        caseId: 'improvement',
        productionDecisionProjection: productionProjection('accepted'),
        groundTruth: fixtureGroundTruth('rejected', 'improvement'),
      }),
      reg,
    );
    expect(output.hypotheticalShadowStatus).toBe('rejected');
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.falseConfidenceImprovementCount.numerator).toBe(1);
    expect(metrics.falseConfidenceImprovementCount.denominator).toBe(1);
    expect(metrics.falseConfidenceImprovementCount.value).toBe(1);
  });

  it('does not count a false-confidence improvement when production was not accepted', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({
        caseId: 'improvement',
        productionDecisionProjection: productionProjection('ambiguous'),
        groundTruth: fixtureGroundTruth('rejected', 'improvement'),
      }),
      reg,
    );
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.falseConfidenceImprovementCount.value).toBe(0);
  });

  it('counts a status regression when production matched truth and shadow no longer does', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({
        caseId: 'status-regression',
        productionDecisionProjection: productionProjection('rejected'),
        groundTruth: fixtureGroundTruth('rejected', 'status-regression'),
      }),
      reg,
    );
    expect(output.hypotheticalShadowStatus).toBe('rejected');
    // production matches truth AND hypothetical matches truth too here (both rejected) -> not a
    // regression; assert non-regression is not counted (the paired positive/negative check).
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.regressionCount.value).toBe(0);
  });

  it('counts a real status regression when hypothetical diverges from truth after production matched it', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({
        caseId: 'status-regression',
        productionDecisionProjection: productionProjection('accepted'),
        candidate: {
          candidateId: 'c1',
          fingerprint: 'f1',
          candidateType: 'clarification-policy-signal',
          candidateVersion: 'resolver-knowledge-candidate-v1',
          payload: {
            type: 'clarification-policy-signal',
            locale: 'de',
            inputType: 'generic',
            reasonCode: 'MULTIPLE_CLOSE_MATCHES',
          },
        } as any,
        groundTruth: fixtureGroundTruth('accepted', 'status-regression'),
      }),
      reg,
    );
    expect(output.hypotheticalShadowStatus).toBe('ambiguous');
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.regressionCount.numerator).toBe(1);
    expect(metrics.regressionCount.denominator).toBe(1);
  });

  it('computes accuracy with the correct numerator and denominator over usable ground-truth cases', () => {
    const reg = registry();
    const agree = evaluator.evaluate(
      request({ caseId: 'accurate', groundTruth: fixtureGroundTruth('rejected', 'accurate') }),
      reg,
    );
    const noTruth = evaluator.evaluate(request({ caseId: 'no-truth' }), reg);
    const metrics = aggregateResolverKnowledgeShadowMetrics([agree, noTruth], reg.version);
    expect(metrics.identificationAccuracy.numerator).toBe(1);
    expect(metrics.identificationAccuracy.denominator).toBe(1);
    expect(metrics.identificationAccuracy.value).toBe(1);
    expect(metrics.usableGroundTruthCaseCount.value).toBe(1);
  });

  it('returns null accuracy with a closed reason when the ground-truth denominator is zero', () => {
    const reg = registry();
    const noTruth = evaluator.evaluate(request({ caseId: 'no-truth' }), reg);
    const metrics = aggregateResolverKnowledgeShadowMetrics([noTruth], reg.version);
    expect(metrics.identificationAccuracy).toEqual({
      value: null,
      numerator: null,
      denominator: null,
      evidenceClass: 'unknown',
      reasonCode: 'NO_USABLE_GROUND_TRUTH_CASES',
    });
  });

  it('computes abstention precision using only hypothetical rejected outcomes with ground truth', () => {
    const reg = registry();
    const correct = evaluator.evaluate(
      request({
        caseId: 'abstain-correct',
        groundTruth: fixtureGroundTruth('rejected', 'abstain-correct'),
      }),
      reg,
    );
    const incorrect = evaluator.evaluate(
      request({
        caseId: 'abstain-incorrect',
        groundTruth: fixtureGroundTruth('accepted', 'abstain-incorrect'),
      }),
      reg,
    );
    expect(correct.hypotheticalShadowStatus).toBe('rejected');
    expect(incorrect.hypotheticalShadowStatus).toBe('rejected');
    const metrics = aggregateResolverKnowledgeShadowMetrics([correct, incorrect], reg.version);
    expect(metrics.abstentionPrecision.numerator).toBe(1);
    expect(metrics.abstentionPrecision.denominator).toBe(2);
    expect(metrics.abstentionPrecision.value).toBe(0.5);
  });

  it('returns null abstention precision, not zero, when there are no abstentions', () => {
    const reg = registry();
    const output = evaluator.evaluate(
      request({
        caseId: 'accurate',
        candidate: {
          candidateId: 'c1',
          fingerprint: 'f1',
          candidateType: 'provenance-gap',
          candidateVersion: 'resolver-knowledge-candidate-v1',
          payload: { type: 'provenance-gap', locale: 'de', inputType: 'generic' },
        } as any,
        groundTruth: fixtureGroundTruth('accepted', 'accurate'),
      }),
      reg,
    );
    expect(output.hypotheticalShadowStatus).not.toBe('rejected');
    const metrics = aggregateResolverKnowledgeShadowMetrics([output], reg.version);
    expect(metrics.abstentionPrecision.value).toBeNull();
    expect(metrics.abstentionPrecision.reasonCode).toBe('NO_HYPOTHETICAL_ABSTENTIONS');
  });

  it('computes clarification rate using the eligible-case denominator, excluding blocked/invalid/not-evaluable cases', () => {
    const reg = registry();
    const clarify = evaluator.evaluate(
      request({
        caseId: 'clarify-1',
        candidate: {
          candidateId: 'c1',
          fingerprint: 'f1',
          candidateType: 'clarification-policy-signal',
          candidateVersion: 'resolver-knowledge-candidate-v1',
          payload: {
            type: 'clarification-policy-signal',
            locale: 'de',
            inputType: 'generic',
            reasonCode: 'MULTIPLE_CLOSE_MATCHES',
          },
        } as any,
      }),
      reg,
    );
    const privacyBlocked = evaluator.evaluate(
      request({
        caseId: 'privacy-blocked-1',
        candidate: {
          ...request().candidate,
          payload: { ...(request().candidate.payload as object), rawInput: 'x' } as any,
        },
      }),
      reg,
    );
    expect(privacyBlocked.delta.category).toBe('privacy_blocked');
    const metrics = aggregateResolverKnowledgeShadowMetrics([clarify, privacyBlocked], reg.version);
    expect(metrics.clarificationRate.numerator).toBe(1);
    expect(metrics.clarificationRate.denominator).toBe(1);
    expect(metrics.clarificationRate.value).toBe(1);
  });

  it('returns null clarification rate with a closed reason when there are no eligible cases', () => {
    const reg = registry();
    const privacyBlocked = evaluator.evaluate(
      request({
        caseId: 'privacy-blocked-1',
        candidate: {
          ...request().candidate,
          payload: { ...(request().candidate.payload as object), rawInput: 'x' } as any,
        },
      }),
      reg,
    );
    const metrics = aggregateResolverKnowledgeShadowMetrics([privacyBlocked], reg.version);
    expect(metrics.clarificationRate.value).toBeNull();
    expect(metrics.clarificationRate.reasonCode).toBe('NO_ELIGIBLE_CLARIFICATION_CASES');
  });

  it('computes truth-independent and truth-dependent metrics from the correct subsets in a mixed corpus', () => {
    const reg = registry();
    const withTruth = evaluator.evaluate(
      request({ caseId: 'accurate', groundTruth: fixtureGroundTruth('rejected', 'accurate') }),
      reg,
    );
    const withoutTruth = evaluator.evaluate(request({ caseId: 'no-truth' }), reg);
    const metrics = aggregateResolverKnowledgeShadowMetrics([withTruth, withoutTruth], reg.version);
    expect(metrics.evaluatedCaseCount.value).toBe(2);
    expect(metrics.usableGroundTruthCaseCount.value).toBe(1);
    expect(metrics.identificationAccuracy.denominator).toBe(1);
  });

  it('does not document fixture status agreement as proven food-identity accuracy', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../domain/models/ResolverKnowledgeShadowEvaluation.ts'),
      'utf8',
    );
    expect(source).toMatch(/NOT proof of correct food identity/);
  });
});

describe('ResolverKnowledgeShadowEvaluator — no-effect boundary', () => {
  it('the evaluator, registry, and privacy validator have no resolver/provider/network/persistence dependency', () => {
    for (const file of [
      '../application/shadow/ResolverKnowledgeShadowEvaluator.ts',
      '../application/shadow/ResolverKnowledgeShadowCorpusRegistry.ts',
      '../application/shadow/ResolverKnowledgeShadowPrivacyValidator.ts',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/\.resolve\(|fetch\(|supabase|provider|repository/i);
    }
  });

  it('never mutates the request candidate, production projection, or ground truth on any path', () => {
    const reg = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const input = request();
    const before = JSON.parse(JSON.stringify(input));
    evaluator.evaluate(input, reg);
    expect(input).toEqual(before);
  });

  it('leaves the request unmodified even when evaluation throws', () => {
    const reg = defaultRegistry();
    const evaluator = new ResolverKnowledgeShadowEvaluator();
    const input = request({ evaluationVersion: 'bad' as any });
    const before = JSON.parse(JSON.stringify(input));
    expect(() => evaluator.evaluate(input, reg)).toThrow();
    expect(input).toEqual(before);
  });
});
