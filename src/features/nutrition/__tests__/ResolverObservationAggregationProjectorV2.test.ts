import { projectResolverObservationForAggregationV2 } from '../application/observations/ResolverObservationAggregationProjectorV2';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';
import {
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  type ResolverObservationAggregationProjectionV1,
} from '../domain/models/ResolverObservationPrivacy';
import { RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION } from '../domain/models/ResolverObservationAggregationProjectionV2';
import { ResolverObservationPrivacyEnforcer } from '../application/observations/ResolverObservationPrivacyEnforcer';

const observation = (overrides: Record<string, unknown> = {}) => ({
  contractVersion: RESOLVER_OBSERVATION_CONTRACT_VERSION,
  observationId: 'observation-a',
  resolverRunId: 'run-a',
  occurredAt: '2026-07-20T00:00:00.000Z',
  input: {
    rawInput: 'private apple',
    normalizedInput: 'apple',
    locale: 'de' as const,
    inputType: 'generic' as const,
  },
  decision: {
    outcome: 'accepted' as const,
    reasonCodes: ['ACCEPTED_STRONG_MATCH'],
    candidateCount: 1,
    selectedSource: { type: 'bls', id: 'B123' },
    provenanceStatus: 'source_grounded' as const,
  },
  versions: { resolverVersion: 'v2' },
  operational: { totalLatencyMs: 'unknown' as const },
  ...overrides,
});

describe('projectResolverObservationForAggregationV2', () => {
  it('has an explicit projection-version literal distinct from privacy-policy/observation-contract versions', () => {
    const result = projectResolverObservationForAggregationV2(observation() as any);
    expect(result.status).toBe('projected');
    if (result.status === 'projected') {
      expect(result.projection.projectionVersion).toBe(
        RESOLVER_OBSERVATION_AGGREGATION_PROJECTION_V2_VERSION,
      );
      expect(result.projection.privacyPolicyVersion).toBe(
        RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
      );
      expect(result.projection.observationContractVersion).toBe(
        RESOLVER_OBSERVATION_CONTRACT_VERSION,
      );
    }
  });

  it('carries the selected source type but has no field capable of a source id', () => {
    const result = projectResolverObservationForAggregationV2(observation() as any);
    expect(result.status).toBe('projected');
    if (result.status === 'projected') {
      expect(result.projection.selectedSource).toEqual({ type: 'bls' });
      expect(result.projection.selectedSource).not.toHaveProperty('id');
    }
  });

  it('excludes source id, raw/normalized input, observation id, resolver-run id, and the private timestamp', () => {
    const result = projectResolverObservationForAggregationV2(observation() as any);
    expect(result.status).toBe('projected');
    if (result.status === 'projected') {
      const serialized = JSON.stringify(result.projection);
      expect(serialized).not.toContain('B123');
      expect(serialized).not.toContain('private apple');
      expect(serialized).not.toContain('"observation-a"');
      expect(serialized).not.toContain('"run-a"');
      expect(serialized).not.toContain('2026-07-20T00:00:00');
      expect(result.projection).not.toHaveProperty('observationId');
      expect(result.projection).not.toHaveProperty('resolverRunId');
      expect(result.projection).not.toHaveProperty('occurredAt');
      expect(result.projection).not.toHaveProperty('rawInput');
      expect(result.projection).not.toHaveProperty('normalizedInput');
    }
  });

  it('preserves only the accepted closed operational fields', () => {
    const result = projectResolverObservationForAggregationV2(observation() as any);
    expect(result.status).toBe('projected');
    if (result.status === 'projected') {
      expect(Object.keys(result.projection).sort()).toEqual(
        [
          'projectionVersion',
          'privacyPolicyVersion',
          'observationContractVersion',
          'locale',
          'inputType',
          'outcome',
          'candidateCount',
          'selectedSource',
          'provenanceStatus',
          'resolverVersion',
          'totalLatencyMs',
          'reasonCodes',
        ].sort(),
      );
    }
  });

  it('is deterministic', () => {
    const first = projectResolverObservationForAggregationV2(observation() as any);
    const second = projectResolverObservationForAggregationV2(observation() as any);
    expect(first).toEqual(second);
  });

  it('does not mutate its input', () => {
    const input = observation();
    const frozen = JSON.parse(JSON.stringify(input));
    projectResolverObservationForAggregationV2(input as any);
    expect(input).toEqual(frozen);
  });

  it.each(['bls', 'off', 'usda'])('accepts safe source type %s', (type) => {
    const result = projectResolverObservationForAggregationV2(
      observation({
        decision: {
          outcome: 'accepted',
          reasonCodes: ['ACCEPTED_STRONG_MATCH'],
          candidateCount: 1,
          selectedSource: { type, id: 'x' },
          provenanceStatus: 'source_grounded',
        },
      }) as any,
    );
    expect(result.status).toBe('projected');
  });

  it.each(['user', 'ai', 'future'])('fails closed for source type %s', (type) => {
    const result = projectResolverObservationForAggregationV2(
      observation({
        decision: {
          outcome: 'accepted',
          reasonCodes: ['ACCEPTED_STRONG_MATCH'],
          candidateCount: 1,
          selectedSource: { type, id: 'x' },
          provenanceStatus: 'source_grounded',
        },
      }) as any,
    );
    expect(result).toEqual({
      status: 'blocked',
      reason: type === 'user' ? 'personal_source' : 'unknown_source_type',
    });
  });

  it('fails closed for an unknown observation-contract version', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation({ contractVersion: 'resolver-observation-v2' }) as any,
      ),
    ).toEqual({ status: 'blocked', reason: 'unknown_contract_version' });
  });

  it('fails closed for an unknown privacy-policy version', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation() as any,
        'resolver-observation-privacy-v2',
      ),
    ).toEqual({ status: 'blocked', reason: 'unknown_privacy_policy_version' });
  });

  it('fails closed for an unsafe reason code', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation({
          decision: {
            outcome: 'accepted',
            reasonCodes: ['free text reason'],
            candidateCount: 1,
            selectedSource: { type: 'bls', id: 'x' },
            provenanceStatus: 'source_grounded',
          },
        }) as any,
      ),
    ).toEqual({ status: 'blocked', reason: 'unsafe_reason_code' });
  });

  it('fails closed for an invalid locale', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation({
          input: { rawInput: 'a', normalizedInput: 'a', locale: 'fr', inputType: 'generic' },
        }) as any,
      ),
    ).toEqual({ status: 'blocked', reason: 'invalid_locale' });
  });

  it('fails closed for an invalid input type', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation({
          input: { rawInput: 'a', normalizedInput: 'a', locale: 'de', inputType: 'invented' },
        }) as any,
      ),
    ).toEqual({ status: 'blocked', reason: 'invalid_input_type' });
  });

  it('fails closed for an invalid outcome', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation({
          decision: {
            outcome: 'invented',
            reasonCodes: [],
            candidateCount: 1,
            selectedSource: null,
            provenanceStatus: 'source_grounded',
          },
        }) as any,
      ).status,
    ).toBe('blocked');
  });

  it('fails closed for an invalid provenance status', () => {
    expect(
      projectResolverObservationForAggregationV2(
        observation({
          decision: {
            outcome: 'accepted',
            reasonCodes: ['ACCEPTED_STRONG_MATCH'],
            candidateCount: 1,
            selectedSource: { type: 'bls', id: 'x' },
            provenanceStatus: 'invented',
          },
        }) as any,
      ),
    ).toEqual({ status: 'blocked', reason: 'invalid_provenance_status' });
  });

  it.each([-1, 1.5, NaN, Infinity])(
    'fails closed for an invalid candidate count %s',
    (candidateCount) => {
      expect(
        projectResolverObservationForAggregationV2(
          observation({
            decision: {
              outcome: 'accepted',
              reasonCodes: ['ACCEPTED_STRONG_MATCH'],
              candidateCount,
              selectedSource: { type: 'bls', id: 'x' },
              provenanceStatus: 'source_grounded',
            },
          }) as any,
        ).status,
      ).toBe('blocked');
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    'fails closed for an invalid latency %s',
    (totalLatencyMs) => {
      expect(
        projectResolverObservationForAggregationV2(
          observation({ operational: { totalLatencyMs } }) as any,
        ),
      ).toEqual({ status: 'blocked', reason: 'invalid_latency' });
    },
  );

  it('accepts a finite numeric latency', () => {
    const result = projectResolverObservationForAggregationV2(
      observation({ operational: { totalLatencyMs: 42 } }) as any,
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'projected',
        projection: expect.objectContaining({ totalLatencyMs: 42 }),
      }),
    );
  });

  it('V1 privacy-enforcer behavior is unchanged by the V2 producer existing', () => {
    const v1 = new ResolverObservationPrivacyEnforcer().project(observation() as any);
    expect(v1.status).toBe('projected');
    if (v1.status === 'projected') {
      const v1Projection = v1.projection as ResolverObservationAggregationProjectionV1;
      expect(v1Projection).not.toHaveProperty('projectionVersion');
      expect(v1Projection.selectedSource).toEqual({ type: 'bls', id: 'B123' });
    }
  });
});
