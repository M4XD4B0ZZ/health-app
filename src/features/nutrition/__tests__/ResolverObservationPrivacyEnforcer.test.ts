import { ResolverObservationPrivacyEnforcer } from '../application/observations/ResolverObservationPrivacyEnforcer';
import {
  RESOLVER_OBSERVATION_CONTRACT_FIELD_PRIVACY,
  RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
  RESOLVER_OBSERVATION_STORAGE_FIELD_PRIVACY,
} from '../domain/models/ResolverObservationPrivacy';
import { RESOLVER_OBSERVATION_CONTRACT_VERSION } from '../domain/models/ResolverObservation';

const observation = () => ({
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
});
describe('ResolverObservationPrivacyEnforcer', () => {
  it('has explicit policy treatment for every persisted and nested V1 contract field', () => {
    expect(Object.keys(RESOLVER_OBSERVATION_STORAGE_FIELD_PRIVACY).sort()).toEqual([
      'contract_version',
      'created_at',
      'id',
      'observation_id',
      'observation_payload',
      'occurred_at',
      'owner_id',
      'resolver_run_id',
    ]);
    expect(Object.keys(RESOLVER_OBSERVATION_CONTRACT_FIELD_PRIVACY)).toEqual(
      expect.arrayContaining([
        'input.rawInput',
        'input.normalizedInput',
        'decision.selectedSource.type',
        'decision.selectedSource.id',
      ]),
    );
  });
  it('creates only the closed structured projection and excludes private/linkable fields', () => {
    const result = new ResolverObservationPrivacyEnforcer().project(observation());
    expect(result).toEqual(expect.objectContaining({ status: 'projected' }));
    if (result.status === 'projected') {
      expect(result.projection).toEqual(
        expect.objectContaining({
          privacyPolicyVersion: RESOLVER_OBSERVATION_PRIVACY_POLICY_VERSION,
          selectedSource: { type: 'bls', id: 'B123' },
        }),
      );
      expect(JSON.stringify(result.projection)).not.toMatch(
        /private apple|observation-a|run-a|2026-07-20/,
      );
      expect(result.projection).not.toHaveProperty('ownerId');
    }
  });
  it.each([
    [
      'unknown contract',
      (value: any) => {
        value.contractVersion = 'resolver-observation-v2';
      },
      'unknown_contract_version',
    ],
    ['unknown policy', (_value: any) => {}, 'unknown_privacy_policy_version'],
    [
      'personal source',
      (value: any) => {
        value.decision.selectedSource = { type: 'user', id: 'private-food' };
      },
      'personal_source',
    ],
    [
      'unknown source',
      (value: any) => {
        value.decision.selectedSource = { type: 'future', id: '1' };
      },
      'unknown_source_type',
    ],
    [
      'unsafe reason',
      (value: any) => {
        value.decision.reasonCodes = ['private free text'];
      },
      'unsafe_reason_code',
    ],
    [
      'unknown nested field',
      (value: any) => {
        value.input.extra = 'blocked';
      },
      'invalid_observation',
    ],
  ])('fails closed for %s', (_name, mutate, expected) => {
    const value = observation();
    mutate(value);
    expect(
      new ResolverObservationPrivacyEnforcer().project(
        value,
        expected === 'unknown_privacy_policy_version' ? 'future' : undefined,
      ),
    ).toEqual(expect.objectContaining({ status: 'blocked', reason: expected }));
  });
});
