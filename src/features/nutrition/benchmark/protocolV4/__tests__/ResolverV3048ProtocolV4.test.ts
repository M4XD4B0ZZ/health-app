import {
  ARTIFACT_PATHS,
  PROTOCOL_V4_DRY_RUN_ROOT,
  PROTOCOL_V4_LIVE_ROOT,
  PROTOCOL_V4_G2_GATES,
  PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
  assertHoldoutAuthorized,
  assertTelemetryLedgerParity,
  buildProtocolV4MasterPlan,
  deriveHoldoutExecutionPlan,
  hashProtocolV4,
  selectCandidate,
  selectCandidateFromDevelopmentEvidence,
  sealProtocolV4Artifact,
  validateCandidateEvaluation,
  validateCategoryEvidence,
  validateCandidateSelectionRecord,
  validateHoldoutExecutionPlan,
  validateMeasuredCount,
  validateProtocolV4CallCounts,
  validateProtocolV4MasterPlan,
  validateTerminalMetadata,
  type CandidateEvaluation,
  type CategoryEvidence,
  type HoldoutAuthorizationRecord,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4TerminalMetadata,
  type ResolverV3047CandidateId,
} from '../ResolverV3048ProtocolV4';
import { findLiveProviderPricing, ANTHROPIC_MESSAGES_PRICING } from '../../LiveProviderBudgetGate';
import {
  computeProtocolV4EvaluatorManifestHashFromFiles,
  readProtocolV4EvaluatorManifestFiles,
  computeProtocolV4EvaluatorManifestHash,
} from '../ResolverV3048ProtocolV4EvaluatorHash';
import { writeProtocolV4ArtifactExclusive } from '../ResolverV3048ProtocolV4ArtifactStore';

const plan = buildProtocolV4MasterPlan();
const g2AllPassed = Object.fromEntries(
  PROTOCOL_V4_G2_GATES.map((g) => [g, 'passed' as const]),
) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'passed'>;

const identity = (candidateId: ResolverV3047CandidateId = 'H0') => ({
  protocolVersion: plan.protocolVersion,
  planHash: plan.planHash,
  executionTreeHash: plan.developmentExecutionTreeHash,
  candidateId,
  candidateVersion: plan.candidates.find((c) => c.id === candidateId)!.version,
  promptVersion: plan.candidates.find((c) => c.id === candidateId)!.promptVersion,
  schemaVersion: plan.candidates.find((c) => c.id === candidateId)!.schemaVersion,
  routingVersion: plan.candidates.find((c) => c.id === candidateId)!.routingVersion,
  modelId: plan.modelId,
  pricingVersion: plan.pricing.pricingVersion,
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
  schemaVersion: 'resolver-v3-048-artifacts-v2',
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

describe('RESOLVER-V3-048 immutable master protocol plan', () => {
  it('hashes every evidence-relevant field and uses independent fake/live roots', () => {
    validateProtocolV4MasterPlan(plan);
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.developmentExecutionTreeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashProtocolV4({ ...plan, maxTokens: 1 })).not.toBe(plan.planHash);
    expect(PROTOCOL_V4_DRY_RUN_ROOT).not.toBe(PROTOCOL_V4_LIVE_ROOT);
    expect(new Set(Object.values(ARTIFACT_PATHS)).size).toBe(Object.keys(ARTIFACT_PATHS).length);
  });
  it('fails closed on missing/tampered hashes', () => {
    expect(() => validateProtocolV4MasterPlan({ ...plan, planHash: '' })).toThrow('PLAN_HASH');
    expect(() => validateProtocolV4MasterPlan({ ...plan, maxTokens: 1 as 1536 })).toThrow(
      'PLAN_HASH',
    );
  });
  it('never claims all three candidates run Holdout -- the template carries no candidateId', () => {
    const holdoutCandidateIds = new Set(
      (plan.holdoutTemplate.observations as unknown as { candidateId?: string }[]).map(
        (o) => o.candidateId,
      ),
    );
    expect(holdoutCandidateIds).toEqual(new Set([undefined]));
    expect(() =>
      validateProtocolV4MasterPlan({
        ...plan,
        holdoutTemplate: {
          observations: plan.holdoutTemplate.observations.map((o) => ({ ...o, candidateId: 'H0' })),
        } as unknown as typeof plan.holdoutTemplate,
      }),
    ).toThrow(); // hash would also drift, but the explicit guard fires deterministically
  });
  it('derives a proposal-only budget from frozen observations and the single pricing authority', () => {
    expect(plan.budget.authorization).toBe('proposal_only');
    expect(plan.budget.totalCalls).toBe(plan.budget.developmentCalls + plan.budget.holdoutCalls);
    expect(plan.budget.totalMaxTokens).toBe(
      plan.budget.developmentMaxTokens + plan.budget.holdoutMaxTokens,
    );
    expect(plan.budget.totalMaxCostUsd).toBeCloseTo(
      plan.budget.developmentMaxCostUsd + plan.budget.holdoutMaxCostUsd,
    );
    expect(plan.budget.maxConcurrentRequests).toBe(1);
    // The 352-call / $5.586944 total budget from the preflight report is a PROPOSAL, never an
    // authorization -- this test only proves the arithmetic stays internally consistent.
    expect(plan.budget.authorization).not.toBe('authorized');
  });
});

describe('RESOLVER-V3-048 Part 2: single pricing authority', () => {
  it('plan pricing equals the real ANTHROPIC_MESSAGES_PRICING row for the pinned model, not a separate literal', () => {
    const authority = findLiveProviderPricing(plan.modelId, ANTHROPIC_MESSAGES_PRICING);
    expect(authority).toBeDefined();
    expect(plan.pricing.pricingVersion).toBe(authority!.pricingVersion);
    expect(plan.pricing.modelId).toBe(plan.modelId);
    expect(plan.pricing.inputPerMillion).toBe(authority!.inputPerMillion);
    expect(plan.pricing.outputPerMillion).toBe(authority!.outputPerMillion);
    expect(hashProtocolV4(plan.pricing)).toBe(plan.pricingManifestHash);
  });
  it('blocks before dispatch on a pricing identity mismatch', () => {
    expect(() =>
      validateProtocolV4MasterPlan({
        ...plan,
        pricing: { ...plan.pricing, pricingVersion: 'drifted-pricing-version' },
      }),
    ).toThrow();
  });
});

describe('RESOLVER-V3-048 Part 3: real evaluator manifest hash authority', () => {
  it('is sensitive to actual evaluator file content, not a self-declared label', () => {
    const a = computeProtocolV4EvaluatorManifestHashFromFiles([
      { path: 'a.ts', content: 'export const x = 1;\n' },
    ]);
    const b = computeProtocolV4EvaluatorManifestHashFromFiles([
      { path: 'a.ts', content: 'export const x = 2;\n' },
    ]);
    expect(a).not.toBe(b);
  });
  it('reproducibly hashes the real, current canonical evaluator files from disk', () => {
    const files = readProtocolV4EvaluatorManifestFiles(process.cwd());
    expect(files.length).toBe(2);
    const hash1 = computeProtocolV4EvaluatorManifestHash(process.cwd());
    const hash2 = computeProtocolV4EvaluatorManifestHash(process.cwd());
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.evaluator.hash).toBe(hash1);
  });
});

describe('predeclared candidate selection (pure comparator)', () => {
  const evaluation = (
    candidateId: ResolverV3047CandidateId,
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
    g2Results: g2AllPassed,
    ...x,
  });
  it('rejects candidates failing any mandatory/non-averageable eligibility criterion', () => {
    // Final Phase-A Execution Closure remediation: Development-time eligibility no longer requires
    // the literal `allMandatoryG2CriteriaPass` boolean (the real, pinned evaluator's joint gate
    // combinator structurally reads every mandatory gate as `not_evaluable` -- never `passed` --
    // until Holdout data exists, so requiring a literal pass here would make every candidate
    // permanently ineligible). It instead requires no mandatory gate to have read an explicit
    // `failed` verdict from the real Development-only data that DOES exist; `criticalFalseConfidenceCount`
    // is honestly reported and still differentiates candidates, but as the ordered comparator's own
    // `lower_critical_failure_count` tie-breaker (SELECTION_RULE.tieBreakers[0]), not a hard gate --
    // a `fake_dry_run` cannot honestly certify "zero critical false confidence" for AI-routed
    // observations without a real provider judging real ambiguity/clarification scenarios.
    const g2OneFailed = { ...g2AllPassed, 'G2-B': 'failed' as const };
    expect(
      selectCandidate([
        evaluation('H0', { criticalFalseConfidenceCount: 3 }),
        evaluation('H1', { allMandatoryG2CriteriaPass: false, g2Results: g2OneFailed }),
        evaluation('H2', { criticalFalseConfidenceCount: 1 }),
      ]),
    ).toBe('H2');
    expect(() => selectCandidate([evaluation('H0', { contractsComplete: false })])).toThrow(
      'NO_ELIGIBLE',
    );
    expect(() =>
      selectCandidate([
        evaluation('H0', { allMandatoryG2CriteriaPass: false, g2Results: g2OneFailed }),
      ]),
    ).toThrow('NO_ELIGIBLE');
  });
  it('uses deterministic quality, economics, latency, failure/count and ID tie breakers', () => {
    expect(selectCandidate([evaluation('H2'), evaluation('H1'), evaluation('H0')])).toBe('H0');
    expect(
      selectCandidate([evaluation('H0'), evaluation('H1', { complexComponentQuality: 2 })]),
    ).toBe('H1');
  });
});

describe('RESOLVER-V3-048 Part 8: candidate evaluation guards NaN/Infinity/negative/incoherent G2', () => {
  const base: CandidateEvaluation = {
    candidateId: 'H0',
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
    g2Results: g2AllPassed,
  };
  it('accepts a fully finite, coherent evaluation', () =>
    expect(() => validateCandidateEvaluation(base)).not.toThrow());
  it.each(['identificationQuality', 'p50Ms', 'failureRate'] as const)(
    'rejects NaN in %s',
    (field) =>
      expect(() => validateCandidateEvaluation({ ...base, [field]: NaN })).toThrow('NON_FINITE'),
  );
  it.each(['identificationQuality', 'costPerValidatedLogUsd'] as const)(
    'rejects Infinity in %s',
    (field) =>
      expect(() => validateCandidateEvaluation({ ...base, [field]: Infinity })).toThrow(
        'NON_FINITE',
      ),
  );
  it('rejects negative counts', () =>
    expect(() => validateCandidateEvaluation({ ...base, aiCalls: -1 })).toThrow('NEGATIVE_COUNT'));
  it('rejects a missing G2 result', () => {
    const { 'G2-A': _omit, ...rest } = g2AllPassed;
    expect(() =>
      validateCandidateEvaluation({ ...base, g2Results: rest as typeof g2AllPassed }),
    ).toThrow('MISSING_G2_RESULT');
  });
  it('rejects allMandatoryG2CriteriaPass=true alongside a failed G2 gate', () =>
    expect(() =>
      validateCandidateEvaluation({ ...base, g2Results: { ...g2AllPassed, 'G2-B': 'failed' } }),
    ).toThrow('G2_RESULT_INCOHERENT'));
});

describe('category evidence and partition closure', () => {
  function completeRows(candidateId: ResolverV3047CandidateId = 'H0'): CategoryEvidence[] {
    return plan.developmentObservations
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
  const expected = plan.developmentObservations.filter(
    (o) => o.partition === 'development' && o.candidateId === 'H0',
  );
  it('accepts the frozen scenario/category/repetition matrix', () =>
    expect(() =>
      validateCategoryEvidence(expected, plan.planHash, 'H0', completeRows()),
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
      validateCategoryEvidence(expected, plan.planHash, 'H0', mutate(completeRows())),
    ).toThrow(),
  );
});

describe('RESOLVER-V3-048 Part 8: MeasuredCount validator', () => {
  it('requires a finite non-negative integer for exact/lower_bound', () => {
    expect(() =>
      validateMeasuredCount({ value: 1, accuracy: 'exact', boundary: 'source_adapter' }, 'f'),
    ).not.toThrow();
    expect(() =>
      validateMeasuredCount({ value: null, accuracy: 'exact', boundary: 'source_adapter' }, 'f'),
    ).toThrow('MEASURED_COUNT_INVALID');
    expect(() =>
      validateMeasuredCount({ value: -1, accuracy: 'exact', boundary: 'source_adapter' }, 'f'),
    ).toThrow('MEASURED_COUNT_INVALID');
    expect(() =>
      validateMeasuredCount(
        { value: 1.5, accuracy: 'lower_bound', boundary: 'source_adapter' },
        'f',
      ),
    ).toThrow('MEASURED_COUNT_INVALID');
  });
  it('requires null for unknown/not_applicable', () =>
    expect(() =>
      validateMeasuredCount({ value: 1, accuracy: 'unknown', boundary: 'source_adapter' }, 'f'),
    ).toThrow('VALUE_FORBIDDEN'));
  it('never allows a legacy aggregate to be exact', () =>
    expect(() =>
      validateMeasuredCount(
        { value: 1, accuracy: 'exact', boundary: 'resolver_legacy_aggregate' },
        'f',
      ),
    ).toThrow('LEGACY_AGGREGATE_NEVER_EXACT'));
  it('rejects automatic retries != 0 and internally-inconsistent totals', () => {
    expect(() =>
      validateProtocolV4CallCounts({
        ...counts,
        automaticRetries: { value: 1, accuracy: 'exact', boundary: 'retry_controller' },
      }),
    ).toThrow('AUTOMATIC_RETRIES_MUST_BE_ZERO');
    expect(() =>
      validateProtocolV4CallCounts({
        ...counts,
        blsCalls: { value: 5, accuracy: 'exact', boundary: 'source_adapter' },
        totalExternalRequests: { value: 1, accuracy: 'exact', boundary: 'benchmark_dispatch' },
      }),
    ).toThrow('TOTAL_EXTERNAL_REQUESTS_INCONSISTENT');
  });
});

describe('RESOLVER-V3-048 Part 8: terminal metadata coherence', () => {
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
      expect(() => validateTerminalMetadata(terminal({ [field]: 1 }))).toThrow('NO_CACHE');
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
  it('requires telemetry and ledger parity across every evidence-relevant field', () => {
    expect(() => assertTelemetryLedgerParity(terminal(), terminal())).not.toThrow();
    expect(() => assertTelemetryLedgerParity(terminal(), terminal({ actualCostUsd: 2 }))).toThrow(
      'MISMATCH',
    );
    expect(() =>
      assertTelemetryLedgerParity(
        terminal(),
        terminal({
          counts: {
            ...counts,
            totalExternalRequests: {
              value: 999,
              accuracy: 'exact',
              boundary: 'benchmark_dispatch',
            },
          },
        }),
      ),
    ).toThrow('MISMATCH:counts');
    expect(() =>
      assertTelemetryLedgerParity(terminal(), terminal({ providerLatencyMs: 999 })),
    ).toThrow('MISMATCH:providerLatencyMs');
    expect(() => assertTelemetryLedgerParity(terminal(), terminal({ httpStatus: 500 }))).toThrow(
      'MISMATCH:httpStatus',
    );
  });
  it('rejects a computed cost status with a null actual cost', () =>
    expect(() =>
      validateTerminalMetadata(terminal({ actualCostStatus: 'computed', actualCostUsd: null })),
    ).toThrow('COMPUTED_REQUIRES_ACTUAL_COST'));
  it('rejects a network-level failure claiming reported usage, and failure without a failure kind', () => {
    expect(() =>
      validateTerminalMetadata(terminal({ failureKind: 'transport_error', retryable: true })),
    ).toThrow('NETWORK_FAILURE_CANNOT_REPORT_USAGE');
    // A downstream parse/schema failure CAN legitimately report real, billable usage.
    expect(() =>
      validateTerminalMetadata(
        terminal({ failureKind: 'schema_contract_error', retryable: false }),
      ),
    ).not.toThrow();
    expect(() =>
      validateTerminalMetadata(
        terminal({
          usageStatus: 'unknown',
          actualCostStatus: 'usage_unknown',
          actualCostUsd: null,
          inputTokens: null,
          outputTokens: null,
          failureKind: null,
        }),
      ),
    ).toThrow('FAILURE_REQUIRES_FAILURE_KIND');
  });
  it('rejects negative or non-finite costs and latencies', () => {
    expect(() => validateTerminalMetadata(terminal({ reservedWorstCaseCostUsd: -1 }))).toThrow(
      'RESERVED_COST_INVALID',
    );
    expect(() => validateTerminalMetadata(terminal({ endToEndLatencyMs: -5 }))).toThrow(
      'LATENCY_INVALID',
    );
    expect(() => validateTerminalMetadata(terminal({ endToEndLatencyMs: Infinity }))).toThrow(
      'LATENCY_INVALID',
    );
  });
  it('rejects a run identity that does not match the plan/observation context', () =>
    expect(() =>
      validateTerminalMetadata(terminal(), {
        planHash: 'other-plan-hash',
        executionTreeHash: plan.developmentExecutionTreeHash,
        candidateId: 'H0',
        scenarioId: 'fake',
        partition: 'development',
      }),
    ).toThrow('RUN_IDENTITY_CONTEXT_MISMATCH'));
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
    expect(() => validateTerminalMetadata(fast)).not.toThrow();
    expect(fast.counts.totalExternalRequests.accuracy).toBe('lower_bound');
  });
});

describe('RESOLVER-V3-048 Parts 4-6: two-stage plan identity, artifact-bound evidence, strict authorization', () => {
  function buildEvidence(): ProtocolV4DevelopmentEvidence {
    const candidates: ProtocolV4DevelopmentCandidateArtifacts[] = (['H0', 'H1', 'H2'] as const).map(
      (candidateId, index) => {
        const expected = plan.developmentObservations.filter(
          (o) => o.partition === 'development' && o.candidateId === candidateId,
        );
        const categoryRows: CategoryEvidence[] = expected.map((o) => ({
          ...o,
          planHash: plan.planHash,
          identificationOutcome: 'resolved',
          criticalError: false,
          failureKind: null,
          resolverOutcome: 'resolved',
          componentCount: 1,
          clarification: false,
          abstention: false,
        }));
        // Teil 9: every planned observation needs a matching terminal telemetry/ledger record, not
        // an empty array -- one coherent, plan-context-valid terminal per observation.
        const terminals: ProtocolV4TerminalMetadata[] = expected.map((o) =>
          terminal({
            runIdentity: {
              ...identity(candidateId),
              scenarioId: o.scenarioId,
              runIndex: o.runIndex,
              callId: `development:${candidateId}:${o.scenarioId}:${o.runIndex}`,
            },
          }),
        );
        const evaluation: CandidateEvaluation = {
          candidateId,
          allMandatoryG2CriteriaPass: true,
          criticalFalseConfidenceCount: 0,
          contractsComplete: true,
          identificationQuality: 1 - index * 0.01,
          complexComponentQuality: 1 - index * 0.01,
          clarificationAbstentionQuality: 1,
          repeatConsistency: 1,
          costPerValidatedLogUsd: 0.001,
          p50Ms: 1000,
          p95Ms: 2000,
          failureRate: 0,
          aiCalls: expected.length,
          sourceCalls: 0,
          g2Results: g2AllPassed,
        };
        return {
          candidateId,
          checkpoint: sealProtocolV4Artifact(
            `development-checkpoint-${candidateId}`,
            plan.planHash,
            {
              completedCallIds: terminals.map((t) => t.runIdentity.callId),
              candidateId,
            },
          ),
          rawResults: sealProtocolV4Artifact(
            `development-raw-results-${candidateId}`,
            plan.planHash,
            {
              candidateId,
              results: expected.map((o) => ({ scenarioId: o.scenarioId, runIndex: o.runIndex })),
            },
          ),
          categoryTable: sealProtocolV4Artifact(
            `development-category-table-${candidateId}`,
            plan.planHash,
            categoryRows,
          ),
          telemetry: sealProtocolV4Artifact(
            `development-telemetry-${candidateId}`,
            plan.planHash,
            terminals,
          ),
          ledger: sealProtocolV4Artifact(
            `development-ledger-${candidateId}`,
            plan.planHash,
            terminals,
          ),
          evaluation: sealProtocolV4Artifact(
            `development-evaluation-${candidateId}`,
            plan.planHash,
            evaluation,
          ),
        };
      },
    );
    return {
      planManifest: sealProtocolV4Artifact('development-plan-manifest', plan.planHash, {
        planHash: plan.planHash,
        developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
      }),
      candidates,
      candidateEvaluationTable: sealProtocolV4Artifact(
        'candidate-evaluation-table',
        plan.planHash,
        candidates.map((c) => c.evaluation.content),
      ),
    };
  }

  it('selectCandidate cannot be reached without complete, validated development evidence for all 3 candidates', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    expect(() => validateCandidateSelectionRecord(plan, selection)).not.toThrow();
    expect(selection.frozen).toBe(true);
    expect(['H0', 'H1', 'H2']).toContain(selection.candidateId);

    const incomplete: ProtocolV4DevelopmentEvidence = {
      ...evidence,
      candidates: evidence.candidates.slice(0, 2),
    };
    expect(() => selectCandidateFromDevelopmentEvidence(plan, incomplete)).toThrow(
      'DEVELOPMENT_EVIDENCE_CANDIDATE_SET_INCOMPLETE',
    );

    const tamperedTable = { ...evidence.candidateEvaluationTable, contentHash: 'tampered' };
    expect(() =>
      selectCandidateFromDevelopmentEvidence(plan, {
        ...evidence,
        candidateEvaluationTable: tamperedTable,
      }),
    ).toThrow('ARTIFACT_CONTENT_HASH_MISMATCH');
  });

  it('derives a Holdout Execution Plan naming exactly one candidate, and any change moves the hash', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const holdoutPlan = deriveHoldoutExecutionPlan(
      plan,
      selection.developmentEvidenceRootHash,
      selection,
    );
    expect(() =>
      validateHoldoutExecutionPlan(
        plan,
        holdoutPlan,
        selection.developmentEvidenceRootHash,
        selection,
      ),
    ).not.toThrow();
    expect(holdoutPlan.candidateId).toBe(selection.candidateId);
    expect(
      holdoutPlan.holdoutObservations.every((o) => o.candidateId === selection.candidateId),
    ).toBe(true);
    expect(holdoutPlan.holdoutCalls).toBe(plan.budget.holdoutCalls);
    expect(holdoutPlan.holdoutMaxCostUsd).toBeCloseTo(plan.budget.holdoutMaxCostUsd);

    const otherEvidence = buildEvidence();
    (otherEvidence.candidates[0].evaluation.content as { p50Ms: number }).p50Ms = 999999;
    // (content mutated without re-sealing -> would fail its own artifact hash check first)
    expect(() => selectCandidateFromDevelopmentEvidence(plan, otherEvidence)).toThrow(
      'ARTIFACT_CONTENT_HASH_MISMATCH',
    );
  });

  it('enforces the strict Holdout authorization gate end to end', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const holdoutPlan = deriveHoldoutExecutionPlan(
      plan,
      selection.developmentEvidenceRootHash,
      selection,
    );
    const authorization: HoldoutAuthorizationRecord = {
      authorizationSchemaVersion: PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
      kind: 'fake_dry_run',
      masterPlanHash: plan.planHash,
      holdoutExecutionPlanHash: holdoutPlan.holdoutPlanHash,
      developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
      candidateSelectionRecordHash: selection.selectionRecordHash,
      candidateId: holdoutPlan.candidateId,
      maxCalls: holdoutPlan.holdoutCalls,
      maxInputTokens: holdoutPlan.holdoutCalls * 8192,
      maxOutputTokens: holdoutPlan.holdoutCalls * 1536,
      maxTotalTokens: holdoutPlan.holdoutMaxTokens,
      maxCostUsd: holdoutPlan.holdoutMaxCostUsd,
      currency: 'USD',
      maxConcurrency: 1,
      authorizedPhase: 'holdout',
      authorizationId: 'fake-dry-run-test',
      humanApprovalReference: null,
      consumed: false,
    };
    const holdoutGateStoreRoot = `${PROTOCOL_V4_DRY_RUN_ROOT}/test-holdout-gate-${Math.random().toString(36).slice(2, 8)}`;
    const valid = {
      plan,
      holdoutPlan,
      selection,
      authorization,
      artifactStoreRoot: holdoutGateStoreRoot,
      artifactRelativePath: 'holdout-gate-test-target.json',
      consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      plannedBudget: {
        calls: holdoutPlan.holdoutCalls,
        inputTokens: holdoutPlan.holdoutMaxInputTokens,
        outputTokens: holdoutPlan.holdoutMaxOutputTokens,
        costUsd: holdoutPlan.holdoutMaxCostUsd,
      },
      liveExecution: false,
    };
    expect(() => assertHoldoutAuthorized(valid)).not.toThrow();

    // Defect 11 regression: an authorization with starved limits must now be rejected.
    expect(() =>
      assertHoldoutAuthorized({
        ...valid,
        authorization: { ...authorization, maxCalls: 0, maxTotalTokens: 0, maxCostUsd: 0 },
      }),
    ).toThrow('AUTHORIZATION_LIMITS_INSUFFICIENT');

    expect(() =>
      assertHoldoutAuthorized({ ...valid, authorization: { ...authorization, consumed: true } }),
    ).toThrow('ALREADY_CONSUMED');

    // Storage-authoritative (Final Phase-A Execution Closure): "artifact target reused" is now a real
    // Artifact Store query, never a caller-supplied boolean -- prove it by actually writing a real
    // file at the checked target first.
    writeProtocolV4ArtifactExclusive(
      holdoutGateStoreRoot,
      'holdout-gate-test-target-reused.json',
      sealProtocolV4Artifact('holdout-gate-test-target-reused', plan.planHash, { already: 'here' }),
    );
    expect(() =>
      assertHoldoutAuthorized({
        ...valid,
        artifactRelativePath: 'holdout-gate-test-target-reused.json',
      }),
    ).toThrow('ARTIFACT_TARGET_REUSED');

    // Storage-authoritative (Final Phase-A Execution Closure): "remaining budget" is no longer a
    // caller-supplied number -- it is `authorization.max* - (real cumulative consumedBudget +
    // plannedBudget)`. Simulate a fully-consumed authorization by setting `consumedBudget` to the
    // authorization's own ceiling: any nonzero `plannedBudget` must then be rejected.
    expect(() =>
      assertHoldoutAuthorized({
        ...valid,
        consumedBudget: {
          calls: authorization.maxCalls,
          inputTokens: authorization.maxInputTokens,
          outputTokens: authorization.maxOutputTokens,
          costUsd: authorization.maxCostUsd,
        },
      }),
    ).toThrow('BUDGET_INSUFFICIENT');
    // A fake_dry_run authorization can never authorize live execution -- either specific error
    // (fake-cannot-live, or the generic human-live-required check) is an acceptable closed reason.
    expect(() => assertHoldoutAuthorized({ ...valid, liveExecution: true })).toThrow('LIVE');
    expect(() =>
      assertHoldoutAuthorized({
        ...valid,
        authorization: {
          ...authorization,
          candidateId: (['H0', 'H1', 'H2'] as const).find((c) => c !== authorization.candidateId)!,
        },
      }),
    ).toThrow('IDENTITY_MISMATCH');
    // Human ceiling: authorization may not exceed what a human separately approved.
    expect(() =>
      assertHoldoutAuthorized({
        ...valid,
        humanApprovedCeiling: { maxCalls: 0, maxTotalTokens: 0, maxCostUsd: 0 },
      }),
    ).toThrow('EXCEEDS_HUMAN_CEILING');
  });
});
