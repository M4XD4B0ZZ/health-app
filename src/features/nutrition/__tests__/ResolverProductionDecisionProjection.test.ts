import type { CanonicalFood } from '../domain/catalog/FoodCatalogSource';
import type { ResolvedFoodCandidate, ResolverDecision } from '../domain/models/ResolverDecision';
import {
  RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION,
  projectResolverDecisionForShadowEvaluation,
} from '../domain/models/ResolverProductionDecisionProjection';

const food = (overrides: Partial<CanonicalFood> = {}): CanonicalFood => ({
  id: 'food-id-secret',
  name: 'Apfel raw name',
  normalizedName: 'apfel',
  macrosPer100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  source: 'bls',
  sourceId: 'bls-source-id-secret',
  ...overrides,
});

const candidate = (overrides: Partial<ResolvedFoodCandidate> = {}): ResolvedFoodCandidate => ({
  id: 'candidate-id-secret',
  source: 'bls',
  food: food(),
  score: 0.9,
  breakdown: {
    matchScore: 0.9,
    dataQualityScore: 0.9,
    kcalConsistencyScore: 0.9,
    sourceTrustScore: 0.9,
    finalScore: 0.9,
    notes: ['personal note revealing raw input'],
  },
  ...overrides,
});

const decision = (overrides: Partial<ResolverDecision> = {}): ResolverDecision => ({
  normalizedQuery: 'raw personal query text',
  status: 'accepted',
  reasonCodes: ['ACCEPTED_STRONG_MATCH'],
  candidates: [candidate()],
  best: candidate(),
  secondBest: candidate({ id: 'second-candidate-id-secret' }),
  createdAt: '2026-07-21T00:00:00.000Z',
  inputConfidence: { level: 'high', reason: 'free text reason', assumptions: ['assumption text'] },
  ...overrides,
});

describe('projectResolverDecisionForShadowEvaluation', () => {
  it('produces only the closed allowed field set', () => {
    const projection = projectResolverDecisionForShadowEvaluation(decision());
    expect(Object.keys(projection).sort()).toEqual(
      [
        'projectionVersion',
        'status',
        'reasonCodes',
        'candidateCount',
        'selectedSourceType',
        'provenanceClassification',
        'inputConfidenceLevel',
      ].sort(),
    );
    expect(projection.projectionVersion).toBe(RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION);
  });

  it('excludes normalizedQuery, candidates, best/secondBest, food payloads, source IDs, and free text', () => {
    const projection = projectResolverDecisionForShadowEvaluation(decision());
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toMatch(/raw personal query text/);
    expect(serialized).not.toMatch(/food-id-secret/);
    expect(serialized).not.toMatch(/bls-source-id-secret/);
    expect(serialized).not.toMatch(/candidate-id-secret/);
    expect(serialized).not.toMatch(/Apfel raw name/);
    expect(serialized).not.toMatch(/personal note revealing raw input/);
    expect(serialized).not.toMatch(/assumption text/);
    expect(serialized).not.toMatch(/free text reason/);
    const asRecord = projection as unknown as Record<string, unknown>;
    expect(asRecord.normalizedQuery).toBeUndefined();
    expect(asRecord.candidates).toBeUndefined();
    expect(asRecord.best).toBeUndefined();
    expect(asRecord.secondBest).toBeUndefined();
  });

  it('is deterministic for identical input', () => {
    const input = decision();
    expect(projectResolverDecisionForShadowEvaluation(input)).toEqual(
      projectResolverDecisionForShadowEvaluation(input),
    );
  });

  it('never mutates the original decision', () => {
    const input = decision();
    const before = JSON.parse(JSON.stringify(input));
    projectResolverDecisionForShadowEvaluation(input);
    expect(input).toEqual(before);
  });

  it('maps an unrecognized reason code to the closed UNCLASSIFIED_REASON_CODE fallback', () => {
    const projection = projectResolverDecisionForShadowEvaluation(
      decision({ reasonCodes: ['SOME_FUTURE_CODE_NOT_YET_CLASSIFIED'] }),
    );
    expect(projection.reasonCodes).toEqual(['UNCLASSIFIED_REASON_CODE']);
  });

  it('classifies provenance as not_evaluable when there is no selected candidate', () => {
    const projection = projectResolverDecisionForShadowEvaluation(
      decision({ status: 'rejected', best: undefined, secondBest: undefined, candidates: [] }),
    );
    expect(projection.provenanceClassification).toBe('not_evaluable');
    expect(projection.selectedSourceType).toBe('none');
    expect(projection.candidateCount).toBe(0);
  });

  it('classifies an AI-sourced best candidate as ai_suggested, never source_grounded', () => {
    const projection = projectResolverDecisionForShadowEvaluation(
      decision({ best: candidate({ food: food({ source: 'ai' }) }) }),
    );
    expect(projection.provenanceClassification).toBe('ai_suggested');
    expect(projection.selectedSourceType).toBe('ai');
  });

  it('classifies a non-AI source as source_grounded using only the closed source-type field', () => {
    const projection = projectResolverDecisionForShadowEvaluation(
      decision({ best: candidate({ food: food({ source: 'usda' }) }) }),
    );
    expect(projection.provenanceClassification).toBe('source_grounded');
    expect(projection.selectedSourceType).toBe('usda');
  });

  it('reports candidateCount matching the full candidate list length', () => {
    const projection = projectResolverDecisionForShadowEvaluation(
      decision({ candidates: [candidate(), candidate({ id: 'c2' }), candidate({ id: 'c3' })] }),
    );
    expect(projection.candidateCount).toBe(3);
  });

  it('falls back to unknown input confidence when absent', () => {
    const projection = projectResolverDecisionForShadowEvaluation(
      decision({ inputConfidence: undefined }),
    );
    expect(projection.inputConfidenceLevel).toBe('unknown');
  });
});
