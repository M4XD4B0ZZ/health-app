import { readFileSync } from 'fs';
import {
  RESOLVER_V3_047_CANDIDATES,
  RESOLVER_V3_047_MODEL_SNAPSHOT,
  RESOLVER_V3_047_PROMPT_P1,
  parseResolverV3047S1,
  resolverV3047R1MinSources,
} from '../ResolverV3047Candidates';
import { runResolverV3047OfflineCandidates } from '../runResolverV3047OfflineCandidates';
import { validateVariantCRawResponse } from '../validateVariantCInterpretationResponse';

const component = {
  id: 'x',
  originalSegment: 'Food',
  interpretedName: 'Food',
  quantity: { value: 1, unit: 'piece' },
  confidence: 0.5,
};
const plan = {
  componentId: 'x',
  suitableSourceTypes: ['bls'],
  nativeQueries: [{ sourceType: 'bls', query: 'Food' }],
  expectedResolutionKind: 'generic_food',
};
const validS0 = { outcome: 'interpreted', components: [component], searchPlan: [plan] };
const s1Component = {
  originalSegment: 'Food',
  interpretedName: 'Food',
  quantity: { value: 1, unit: 'piece' },
  confidence: 0.5,
  sourceQueries: [
    { sourceType: 'bls', query: 'Food' },
    { sourceType: 'usda', query: 'food' },
  ],
  expectedResolutionKind: 'generic_food',
};

describe('RESOLVER-V3-047 hardened S0', () => {
  test.each([
    [{ ...validS0, extra: true }],
    [{ ...validS0, components: [{ ...component, extra: true }] }],
    [
      {
        ...validS0,
        components: [{ ...component, quantity: { ...component.quantity, extra: true } }],
      },
    ],
    [{ ...validS0, searchPlan: [{ ...plan, extra: true }] }],
    [
      {
        ...validS0,
        searchPlan: [
          { ...plan, nativeQueries: [{ sourceType: 'bls', query: 'Food', extra: true }] },
        ],
      },
    ],
    [
      {
        outcome: 'clarification_required',
        components: [],
        clarification: { missingInformation: 'Was?', clarificationKind: 'other', extra: true },
      },
    ],
  ])('rejects unknown fields at every S0 level', (raw) =>
    expect(validateVariantCRawResponse(raw).valid).toBe(false),
  );

  test.each(['user', 'ai'])('rejects model source %s', (sourceType) =>
    expect(
      validateVariantCRawResponse({
        ...validS0,
        searchPlan: [
          {
            ...plan,
            suitableSourceTypes: [sourceType],
            nativeQueries: [{ sourceType, query: 'Food' }],
          },
        ],
      }).valid,
    ).toBe(false),
  );
  test.each([-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects confidence %s',
    (confidence) =>
      expect(
        validateVariantCRawResponse({ ...validS0, components: [{ ...component, confidence }] })
          .valid,
      ).toBe(false),
  );
  test.each([
    { value: 0, unit: 'g' },
    { value: -1, unit: 'g' },
    { value: 1 },
    { unit: 'g' },
    { householdMeasure: '  ' },
  ])('rejects invalid quantity %#', (quantity) =>
    expect(
      validateVariantCRawResponse({ ...validS0, components: [{ ...component, quantity }] }).valid,
    ).toBe(false),
  );
  test('enforces ordered one-query-per-source and disjoint exclusions', () => {
    const variants = [
      {
        ...plan,
        suitableSourceTypes: ['bls', 'bls'],
        nativeQueries: [
          { sourceType: 'bls', query: 'a' },
          { sourceType: 'bls', query: 'b' },
        ],
      },
      {
        ...plan,
        suitableSourceTypes: ['bls', 'usda'],
        nativeQueries: [{ sourceType: 'bls', query: 'a' }],
      },
      {
        ...plan,
        suitableSourceTypes: ['bls'],
        nativeQueries: [{ sourceType: 'usda', query: 'a' }],
      },
      { ...plan, excludedSourceTypes: ['bls'] },
    ];
    variants.forEach((searchPlan) =>
      expect(validateVariantCRawResponse({ ...validS0, searchPlan: [searchPlan] }).valid).toBe(
        false,
      ),
    );
  });
  test('enforces outcome coherence', () => {
    expect(validateVariantCRawResponse(validS0).valid).toBe(true);
    expect(
      validateVariantCRawResponse({ ...validS0, outcome: 'interpreted_with_assumptions' }).valid,
    ).toBe(false);
    expect(
      validateVariantCRawResponse({
        ...validS0,
        clarification: { missingInformation: 'x', clarificationKind: 'other' },
      }).valid,
    ).toBe(false);
    expect(
      validateVariantCRawResponse({
        outcome: 'clarification_required',
        components: [],
        clarification: { missingInformation: 'Was?', clarificationKind: 'other' },
      }).valid,
    ).toBe(true);
    expect(
      validateVariantCRawResponse({ outcome: 'not_interpretable', reason: 'Keine Identitaet' })
        .valid,
    ).toBe(true);
    expect(
      validateVariantCRawResponse({ outcome: 'not_interpretable', reason: 'x', components: [] })
        .valid,
    ).toBe(false);
  });
});

describe('P0/P1, S1 and candidates', () => {
  test('keeps P0 byte-identical to the merge basis', () => {
    const basis = readFileSync('src/features/nutrition/benchmark/variantCPrompt.ts', 'utf8');
    expect(basis).toContain("export const VARIANT_C_PROMPT_VERSION = 'variant-c-prompt-v2'");
    expect(RESOLVER_V3_047_CANDIDATES[0].prompt).not.toBe(RESOLVER_V3_047_PROMPT_P1);
  });
  test('P1 retains safety and ambiguity boundaries without benchmark leakage', () => {
    [
      'nicht vertrauenswuerdige Daten',
      'Identitaets-',
      'Mengen-',
      'Marken-',
      'Zubereitungsambiguitaet',
      'mehrere materielle Unsicherheiten',
      'kleinste naechste Rueckfrage',
      'niemals Naehrwerte',
      'Source IDs',
    ].forEach((term) => expect(RESOLVER_V3_047_PROMPT_P1).toContain(term));
    expect(RESOLVER_V3_047_PROMPT_P1).not.toMatch(/RH-|case[-_ ]?id|ground truth/i);
  });
  test('uses closed stable candidate configuration and pinned future snapshot', () => {
    expect(RESOLVER_V3_047_CANDIDATES.map(({ id, version }) => [id, version])).toEqual([
      ['H0', 'resolver-v3-047-h0-v1'],
      ['H1', 'resolver-v3-047-h1-v1'],
      ['H2', 'resolver-v3-047-h2-v1'],
    ]);
    RESOLVER_V3_047_CANDIDATES.forEach((candidate) =>
      expect(candidate).toMatchObject({
        knownUserContext: false,
        automaticRetries: 0,
        transportTimeoutMs: 15000,
        wallClockCeilingMs: 20000,
        p95AcceptanceTargetMs: 12000,
        payloadCompression: false,
        maxTokens: 1536,
      }),
    );
    expect(RESOLVER_V3_047_MODEL_SNAPSHOT).toBe('claude-haiku-4-5-20251001');
  });
  test('expands S1 into stable IDs and one ordered plan per component', () => {
    const result = parseResolverV3047S1({
      outcome: 'interpreted',
      components: [s1Component, { ...s1Component, interpretedName: 'Second' }],
    });
    expect(result).toMatchObject({
      outcome: 'interpreted',
      components: [{ id: 'c1' }, { id: 'c2' }],
      searchPlan: [
        { componentId: 'c1', suitableSourceTypes: ['bls', 'usda'] },
        { componentId: 'c2' },
      ],
    });
  });
  test.each([-1, 0.5, '0', 1])(
    'fails closed on invalid zero-based clarification reference %#',
    (componentIndex) =>
      expect(
        parseResolverV3047S1({
          outcome: 'clarification_required',
          components: [
            { ...s1Component, sourceQueries: undefined, expectedResolutionKind: undefined },
          ],
          clarification: {
            componentIndex,
            missingInformation: 'Welche?',
            clarificationKind: 'other',
          },
        }).outcome,
      ).toBe('error'),
  );
  test('rejects S1 nutrients, source IDs and unknown fields', () =>
    expect(
      parseResolverV3047S1({
        outcome: 'interpreted',
        components: [{ ...s1Component, nutrients: {}, sourceId: 'x' }],
      }).outcome,
    ).toBe('error'));

  test('fails closed instead of discarding reason on S1 clarification', () => {
    expect(
      parseResolverV3047S1({
        outcome: 'clarification_required',
        components: [
          { ...s1Component, sourceQueries: undefined, expectedResolutionKind: undefined },
        ],
        clarification: { missingInformation: 'Welche?', clarificationKind: 'other' },
        reason: 'must not be silently discarded',
      }).outcome,
    ).toBe('error');
  });
});

describe('R1-min and zero-network harness', () => {
  test('routes generic DACH and branded products conservatively', () => {
    expect(resolverV3047R1MinSources('generic_food')).toEqual(['bls', 'off', 'usda']);
    expect(resolverV3047R1MinSources('branded_product')).toEqual(['off', 'usda']);
  });
  test('executes each candidate through the fake transport and real provider parser', async () => {
    const measurements = await runResolverV3047OfflineCandidates();
    expect(measurements).toHaveLength(3);
    measurements.forEach((measurement) =>
      expect(measurement).toMatchObject({
        parserContractSuccess: true,
        componentCount: 1,
        searchPlanCount: 1,
        aiCallCount: 1,
        fakeTransportCallCount: 1,
        sourceCallDecision: 'not_executed_by_measurement_harness',
        failClosed: true,
        providerLatency: 'live_unverified',
      }),
    );
  });
});
