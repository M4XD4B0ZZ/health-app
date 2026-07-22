import { validateResolverObservationAggregationProjectionV2 } from '../application/observations/ResolverObservationAggregationProjectionV2Validator';
import { RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION } from '../domain/models/ResolverObservationAggregationProjectionV2';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';
import { RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION } from '../domain/models/ResolverObservationPrivacy';

const validProjection = () => ({
  projectionVersion: RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
  privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  observationContractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
  locale: 'de',
  inputType: 'generic',
  outcome: 'accepted',
  candidateCount: 1,
  selectedSource: { type: 'bls' },
  provenanceStatus: 'source_grounded',
  resolverVersion: 'resolver-v3',
  totalLatencyMs: 'unknown',
  reasonCodes: ['ACCEPTED_STRONG_MATCH'],
});

describe('validateResolverObservationAggregationProjectionV2', () => {
  it('accepts a valid V2 projection', () => {
    expect(validateResolverObservationAggregationProjectionV2(validProjection())).toEqual([]);
  });

  it('rejects a V2 object with a nested selectedSource.id', () => {
    const value = { ...validProjection(), selectedSource: { type: 'bls', id: 'leaked' } };
    expect(validateResolverObservationAggregationProjectionV2(value).length).toBeGreaterThan(0);
  });

  it('rejects a V1-shaped object', () => {
    const v1Shaped = {
      privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
      contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
      locale: 'de',
      inputType: 'generic',
      outcome: 'accepted',
      candidateCount: 1,
      selectedSource: { type: 'bls', id: 'x' },
      provenanceStatus: 'source_grounded',
      resolverVersion: 'resolver-v3',
      totalLatencyMs: 'unknown',
      reasonCodes: ['ACCEPTED_STRONG_MATCH'],
    };
    expect(validateResolverObservationAggregationProjectionV2(v1Shaped).length).toBeGreaterThan(0);
  });

  it('rejects a missing projectionVersion', () => {
    const value: any = validProjection();
    delete value.projectionVersion;
    expect(validateResolverObservationAggregationProjectionV2(value).length).toBeGreaterThan(0);
  });

  it('rejects an unknown projectionVersion', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        projectionVersion: 'resolver-observation-aggregation-projection-v3',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a V1 projection-version literal masquerading as V2', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        projectionVersion: 'resolver-observation-privacy-v1',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a correct V2 literal combined with V1-only fields', () => {
    const value: any = validProjection();
    value.contractVersion = RESOLVER_OBSERVATION_CONTRACT_VERSION;
    expect(validateResolverObservationAggregationProjectionV2(value).length).toBeGreaterThan(0);
  });

  it('rejects a correct V2 literal combined with an unknown observation-contract version', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        observationContractVersion: 'resolver-observation-v2',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a correct V2 literal combined with an unknown privacy-policy version', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        privacyPolicyVersion: 'resolver-observation-privacy-v2',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects unknown root fields rather than silently stripping them', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        ownerId: 'leaked',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects an unknown metadata bag', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        metadata: { anything: true },
      }).length,
    ).toBeGreaterThan(0);
  });

  it.each(['fr', 'US', '', 1, null])('rejects an invalid locale %s', (locale) => {
    expect(
      validateResolverObservationAggregationProjectionV2({ ...validProjection(), locale }).length,
    ).toBeGreaterThan(0);
  });

  it.each(['single-item', 'complex', 1, null])('rejects an invalid input type %s', (inputType) => {
    expect(
      validateResolverObservationAggregationProjectionV2({ ...validProjection(), inputType })
        .length,
    ).toBeGreaterThan(0);
  });

  it.each(['rejected', 'pending', 1, null])('rejects an invalid outcome %s', (outcome) => {
    expect(
      validateResolverObservationAggregationProjectionV2({ ...validProjection(), outcome }).length,
    ).toBeGreaterThan(0);
  });

  it.each(['user', 'ai', 'future'])('rejects an unsafe selectedSource.type %s', (type) => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        selectedSource: { type },
      }).length,
    ).toBeGreaterThan(0);
  });

  it.each(['guessed', 'not_evaluable', 1, null])(
    'rejects an invalid provenance status %s',
    (provenanceStatus) => {
      expect(
        validateResolverObservationAggregationProjectionV2({
          ...validProjection(),
          provenanceStatus,
        }).length,
      ).toBeGreaterThan(0);
    },
  );

  it.each([-1, 1.5, NaN, Infinity, '1'])(
    'rejects an invalid candidate count %s',
    (candidateCount) => {
      expect(
        validateResolverObservationAggregationProjectionV2({
          ...validProjection(),
          candidateCount,
        }).length,
      ).toBeGreaterThan(0);
    },
  );

  it.each([NaN, Infinity, -Infinity, '42', null])(
    'rejects an invalid latency representation %s',
    (totalLatencyMs) => {
      expect(
        validateResolverObservationAggregationProjectionV2({
          ...validProjection(),
          totalLatencyMs,
        }).length,
      ).toBeGreaterThan(0);
    },
  );

  it('rejects an unsafe reason code', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        reasonCodes: ['free text reason'],
      }).length,
    ).toBeGreaterThan(0);
  });

  it('accepts a null selectedSource', () => {
    expect(
      validateResolverObservationAggregationProjectionV2({
        ...validProjection(),
        selectedSource: null,
      }),
    ).toEqual([]);
  });

  it('rejects a non-object input', () => {
    expect(
      validateResolverObservationAggregationProjectionV2('not-an-object').length,
    ).toBeGreaterThan(0);
    expect(validateResolverObservationAggregationProjectionV2(null).length).toBeGreaterThan(0);
    expect(validateResolverObservationAggregationProjectionV2(undefined).length).toBeGreaterThan(0);
  });
});
