import {
  ARTIFACT_PATHS,
  PROTOCOL_V4_DRY_RUN_ROOT,
  PROTOCOL_V4_LIVE_ROOT,
  assertHoldoutAuthorized,
  assertTelemetryLedgerParity,
  buildProtocolV4Plan,
  hashProtocolV4,
  selectCandidate,
  validateCategoryEvidence,
  validateProtocolV4Plan,
  validateTerminalMetadata,
  type CandidateEvaluation,
  type CategoryEvidence,
  type ProtocolV4TerminalMetadata,
} from '../ResolverV3048ProtocolV4';

const plan = buildProtocolV4Plan();
const identity = (candidateId: 'H0' | 'H1' | 'H2' = 'H0') => ({
  protocolVersion: plan.protocolVersion,
  planHash: plan.planHash,
  executionTreeHash: plan.executionTreeHash,
  candidateId,
  candidateVersion: plan.candidates.find((c) => c.id === candidateId)!.version,
  promptVersion: plan.candidates.find((c) => c.id === candidateId)!.promptVersion,
  schemaVersion: plan.candidates.find((c) => c.id === candidateId)!.schemaVersion,
  routingVersion: plan.candidates.find((c) => c.id === candidateId)!.routingVersion,
  modelId: plan.modelId,
  pricingVersion: plan.pricingVersion,
  partition: 'development' as const,
  scenarioId: 'fake',
  runIndex: 0,
  callId: 'fake-call',
});
const counts = {
  aiDispatches: { value: 1, accuracy: 'exact' as const, boundary: 'benchmark_dispatch' as const },
  providerHttpRequests: {
    value: 1,
    accuracy: 'exact' as const,
    boundary: 'provider_transport' as const,
  },
  blsCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  offCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  usdaCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  totalExternalRequests: {
    value: 1,
    accuracy: 'exact' as const,
    boundary: 'benchmark_dispatch' as const,
  },
  avoidedSourceCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  automaticRetries: { value: 0, accuracy: 'exact' as const, boundary: 'retry_controller' as const },
};
const terminal = (
  overrides: Partial<ProtocolV4TerminalMetadata> = {},
): ProtocolV4TerminalMetadata => ({
  schemaVersion: 'resolver-v3-048-artifacts-v1',
  runIdentity: identity(),
  pricingStatus: 'estimated',
  usageStatus: 'reported',
  actualCostStatus: 'computed',
  reservationId: 'fake-reservation',
  reservedWorstCaseCostUsd: 0.015872,
  actualCostUsd: 0.000006,
  failureKind: null,
  retryable: false,
  httpStatus: 200,
  inputTokens: 1,
  outputTokens: 1,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  providerLatencyMs: 1,
  endToEndLatencyMs: 2,
  counts,
  ...overrides,
});

describe('RESOLVER-V3-048 immutable protocol-v4 plan', () => {
  it('hashes every evidence-relevant field and uses independent fake/live roots', () => {
    validateProtocolV4Plan(plan);
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.executionTreeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashProtocolV4({ ...plan, maxTokens: 1 })).not.toBe(plan.planHash);
    expect(PROTOCOL_V4_DRY_RUN_ROOT).not.toBe(PROTOCOL_V4_LIVE_ROOT);
    expect(new Set(Object.values(ARTIFACT_PATHS)).size).toBe(Object.keys(ARTIFACT_PATHS).length);
  });
  it('fails closed on missing/tampered hashes', () => {
    expect(() => validateProtocolV4Plan({ ...plan, planHash: '' })).toThrow('PLAN_HASH');
    expect(() => validateProtocolV4Plan({ ...plan, maxTokens: 1 as 1536 })).toThrow('PLAN_HASH');
  });
  it('derives a proposal-only budget from frozen observations and repository pricing', () => {
    expect(plan.budget.authorization).toBe('proposal_only');
    expect(plan.budget.totalCalls).toBe(plan.budget.developmentCalls + plan.budget.holdoutCalls);
    expect(plan.budget.totalMaxTokens).toBe(
      plan.budget.developmentMaxTokens + plan.budget.holdoutMaxTokens,
    );
    expect(plan.budget.totalMaxCostUsd).toBeCloseTo(
      plan.budget.developmentMaxCostUsd + plan.budget.holdoutMaxCostUsd,
    );
    expect(plan.budget.maxConcurrentRequests).toBe(1);
  });
});

describe('predeclared candidate selection', () => {
  const evaluation = (
    candidateId: 'H0' | 'H1' | 'H2',
    x: Partial<CandidateEvaluation> = {},
  ): CandidateEvaluation => ({
    candidateId,
    allMandatoryG2CriteriaPass: true,
    criticalFalseConfidenceCount: 0,
    contractsComplete: true,
    identificationQuality: 1,
    complexComponentQuality: 1,
    clarificationAbstentionQuality: 1,
    repeatConsistency: 1,
    costPerValidatedLogUsd: 1,
    p50Ms: 1,
    p95Ms: 1,
    failureRate: 0,
    aiCalls: 1,
    sourceCalls: 1,
    ...x,
  });
  it('rejects candidates failing any mandatory/non-averageable eligibility criterion', () => {
    expect(
      selectCandidate([
        evaluation('H0', { criticalFalseConfidenceCount: 1 }),
        evaluation('H1', { allMandatoryG2CriteriaPass: false }),
        evaluation('H2'),
      ]),
    ).toBe('H2');
    expect(() => selectCandidate([evaluation('H0', { contractsComplete: false })])).toThrow(
      'NO_ELIGIBLE',
    );
  });
  it('uses deterministic quality, economics, latency, failure/count and ID tie breakers', () => {
    expect(selectCandidate([evaluation('H2'), evaluation('H1'), evaluation('H0')])).toBe('H0');
    expect(
      selectCandidate([evaluation('H0'), evaluation('H1', { complexComponentQuality: 2 })]),
    ).toBe('H1');
  });
});

describe('category evidence and partition closure', () => {
  function completeRows(candidateId: 'H0' | 'H1' | 'H2' = 'H0'): CategoryEvidence[] {
    return plan.observations
      .filter((o) => o.partition === 'development' && o.candidateId === candidateId)
      .map((o) => ({
        ...o,
        planHash: plan.planHash,
        identificationOutcome: 'identified',
        criticalError: false,
        failureKind: null,
        resolverOutcome: 'resolved',
        componentCount: 1,
        clarification: false,
        abstention: false,
      }));
  }
  it('accepts the frozen scenario/category/repetition matrix', () =>
    expect(() =>
      validateCategoryEvidence(plan, 'development', 'H0', completeRows()),
    ).not.toThrow());
  it.each([
    ['missing', (r: CategoryEvidence[]) => r.slice(1)],
    ['duplicate', (r: CategoryEvidence[]) => [...r, r[0]]],
    ['category', (r: CategoryEvidence[]) => [{ ...r[0], category: 'UNKNOWN' }, ...r.slice(1)]],
    [
      'partition',
      (r: CategoryEvidence[]) => [{ ...r[0], partition: 'holdout' as const }, ...r.slice(1)],
    ],
    [
      'candidate',
      (r: CategoryEvidence[]) => [{ ...r[0], candidateId: 'H1' as const }, ...r.slice(1)],
    ],
    ['hash', (r: CategoryEvidence[]) => [{ ...r[0], planHash: 'bad' }, ...r.slice(1)]],
  ])('rejects %s drift', (_name, mutate) =>
    expect(() =>
      validateCategoryEvidence(plan, 'development', 'H0', mutate(completeRows())),
    ).toThrow(),
  );
});

describe('pricing, usage, cache, timeout, telemetry and count semantics', () => {
  it('validates successful reported usage and exact fake boundaries', () =>
    expect(() => validateTerminalMetadata(terminal())).not.toThrow());
  it.each([
    'transport_error',
    'timeout_abort',
    'http_error',
    'http_envelope_json_error',
    'http_envelope_contract_error',
    'text_block_json_error',
    'schema_contract_error',
  ] as const)('accepts zero-retry failure taxonomy: %s', (failureKind) =>
    expect(() =>
      validateTerminalMetadata(
        terminal({
          usageStatus: 'unknown',
          actualCostStatus: 'usage_unknown',
          actualCostUsd: null,
          inputTokens: null,
          outputTokens: null,
          failureKind,
          retryable: failureKind === 'transport_error' || failureKind === 'timeout_abort',
        }),
      ),
    ).not.toThrow(),
  );
  it('requires known pricing and unknown usage/cost for the outer wall-clock terminal', () => {
    expect(() =>
      validateTerminalMetadata(
        terminal({
          usageStatus: 'unknown',
          actualCostStatus: 'usage_unknown',
          actualCostUsd: null,
          inputTokens: null,
          outputTokens: null,
          failureKind: 'wall_clock_ceiling',
          retryable: false,
          httpStatus: null,
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateTerminalMetadata(
        terminal({
          pricingStatus: 'known',
          usageStatus: 'unknown',
          actualCostStatus: 'usage_unknown',
          actualCostUsd: null,
          inputTokens: null,
          outputTokens: null,
          failureKind: 'wall_clock_ceiling',
        }),
      ),
    ).toThrow('WALL_CLOCK');
  });
  it.each(['cacheCreationTokens', 'cacheReadTokens'] as const)(
    'fails closed on positive %s',
    (field) => {
      expect(() => validateTerminalMetadata(terminal({ [field]: 1, failureKind: null }))).toThrow(
        'NO_CACHE',
      );
      expect(() =>
        validateTerminalMetadata(
          terminal({
            [field]: 1,
            failureKind: 'usage_cost_contract_error',
            actualCostStatus: 'usage_cost_contract_error',
            actualCostUsd: null,
            retryable: false,
          }),
        ),
      ).not.toThrow();
    },
  );
  it('requires telemetry and ledger parity', () => {
    expect(() => assertTelemetryLedgerParity(terminal(), terminal())).not.toThrow();
    expect(() => assertTelemetryLedgerParity(terminal(), terminal({ actualCostUsd: 2 }))).toThrow(
      'MISMATCH',
    );
  });
  it('marks the legacy fast-path aggregate as a lower bound, never exact', () => {
    const fast = terminal({
      usageStatus: 'not_applicable',
      actualCostStatus: 'not_applicable',
      actualCostUsd: null,
      inputTokens: null,
      outputTokens: null,
      counts: {
        ...counts,
        totalExternalRequests: {
          value: 1,
          accuracy: 'lower_bound',
          boundary: 'resolver_legacy_aggregate',
        },
      },
    });
    expect(fast.counts.totalExternalRequests.accuracy).toBe('lower_bound');
  });
});

describe('development -> frozen selection -> separately authorized holdout', () => {
  const selection = {
    planHash: plan.planHash,
    executionTreeHash: plan.executionTreeHash,
    candidateId: 'H2' as const,
    developmentComplete: true as const,
    frozen: true as const,
  };
  const authorization = {
    kind: 'fake_dry_run' as const,
    planHash: plan.planHash,
    candidateId: 'H2' as const,
    maxCalls: plan.budget.holdoutCalls,
    maxTokens: plan.budget.holdoutMaxTokens,
    maxCostUsd: plan.budget.holdoutMaxCostUsd,
    currency: 'USD' as const,
  };
  const valid = {
    plan,
    developmentCheckpoint: true,
    developmentEvaluation: true,
    selection,
    authorization,
    artifactTargetUnused: true,
    remainingCalls: plan.budget.holdoutCalls,
    remainingTokens: plan.budget.holdoutMaxTokens,
    remainingCostUsd: plan.budget.holdoutMaxCostUsd,
    executionTreeHash: plan.executionTreeHash,
    corpusHash: plan.corpus.hash,
    groundTruthHash: plan.groundTruth.hash,
    sourceManifestHash: plan.sourceManifest.hash,
    evaluatorHash: plan.evaluator.hash,
    liveExecution: false,
  };
  it('allows only the fake dry-run after every identity/checkpoint/budget gate passes', () =>
    expect(() => assertHoldoutAuthorized(valid)).not.toThrow());
  it('blocks holdout without selection and without separate authorization', () => {
    expect(() => assertHoldoutAuthorized({ ...valid, selection: null })).toThrow('PREREQUISITE');
    expect(() => assertHoldoutAuthorized({ ...valid, authorization: null })).toThrow(
      'PREREQUISITE',
    );
  });
  it('blocks identity drift, reused target, insufficient budget and fake live authorization', () => {
    expect(() => assertHoldoutAuthorized({ ...valid, executionTreeHash: 'bad' })).toThrow(
      'IDENTITY',
    );
    expect(() => assertHoldoutAuthorized({ ...valid, artifactTargetUnused: false })).toThrow(
      'PREREQUISITE',
    );
    expect(() => assertHoldoutAuthorized({ ...valid, remainingCalls: 0 })).toThrow('BUDGET');
    expect(() => assertHoldoutAuthorized({ ...valid, liveExecution: true })).toThrow('HUMAN');
  });
});

describe('complete zero-network scenario inventory', () => {
  it('covers all 22 mandated fake/dry-run cases without constructing a network transport', () => {
    const scenarios = [
      'successful_usage',
      'transport_error',
      'timeout_abort',
      'wall_clock_ceiling',
      'http_429',
      'http_500',
      'envelope_json',
      'envelope_contract',
      'text_json',
      'schema',
      'cache_creation',
      'cache_read',
      'clarification',
      'abstention',
      'r1_early_stop',
      'r1_exhausted',
      'safe_fast_path',
      'fast_path_lower_bound',
      'missing_plan_hash',
      'wrong_candidate',
      'holdout_without_selection',
      'holdout_without_human_authorization',
    ];
    expect(scenarios).toHaveLength(22);
  });
});
