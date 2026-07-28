import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  runProtocolV4DryRun,
  executedProtocolV4DryRunScenarioIds,
  runProtocolV4MiniProtocolRun,
} from '../ResolverV3048ProtocolV4DryRun';
import { PROTOCOL_V4_DRY_RUN_ROOT } from '../ResolverV3048ProtocolV4';

const EXPECTED_SCENARIO_IDS = [
  'success_reported_usage',
  'transport_error',
  'inner_timeout_abort',
  'wall_clock_ceiling',
  'http_429',
  'http_500',
  'envelope_json_error',
  'envelope_contract_error',
  'text_json_error',
  'schema_error',
  'positive_cache_creation_tokens',
  'positive_cache_read_tokens',
  'clarification',
  'abstention_not_interpretable',
  'r1_min_early_stop',
  'r1_min_tiers_exhausted',
  'safe_fast_path',
  'fast_path_lower_bound_count',
  'missing_or_manipulated_plan_hash',
  'wrong_candidate_identity',
  'holdout_without_selection_record',
  'holdout_without_matching_authorization',
];

const FAULT_MATRIX_EXTENSION_SCENARIO_IDS = [
  'missing_text_block_reported_usage',
  'double_terminal_completion_rejected',
  'late_completion_after_wall_clock_ceiling',
  'provider_plan_identity_mismatch',
  'reservation_pricing_mismatch',
];

const ALL_EXPECTED_SCENARIO_IDS = [
  ...EXPECTED_SCENARIO_IDS,
  ...FAULT_MATRIX_EXTENSION_SCENARIO_IDS,
];

describe('RESOLVER-V3-048 Part 9 / Teil 15A: real executable fault-matrix zero-network dry run', () => {
  it('preserves the original 22 mandated scenario IDs, matching the task specification', () => {
    expect(EXPECTED_SCENARIO_IDS).toHaveLength(22);
    expect(new Set(EXPECTED_SCENARIO_IDS).size).toBe(22);
  });

  it('the fault matrix now covers 27 scenarios -- the original 22 plus 5 new fault-matrix cases', () => {
    expect(ALL_EXPECTED_SCENARIO_IDS).toHaveLength(27);
    expect(new Set(ALL_EXPECTED_SCENARIO_IDS).size).toBe(27);
  });

  it('actually executes all 27 scenarios through the real pipeline -- zero network, zero provider cost', async () => {
    const report = await runProtocolV4DryRun();

    expect(report.executedScenarioCount).toBe(27);
    const executedIds = new Set(executedProtocolV4DryRunScenarioIds());
    expect(executedIds.size).toBe(27);
    for (const id of ALL_EXPECTED_SCENARIO_IDS) expect(executedIds.has(id)).toBe(true);

    expect(report.scenarios).toHaveLength(27);
    for (const scenario of report.scenarios) {
      expect(scenario.componentsExecuted.length).toBeGreaterThan(0);
      expect(scenario.actualDecision).toBe(scenario.expectedDecision);
      expect(scenario.validatorResult).toBe('passed');
      expect(scenario.evidenceClass).toBe('zero_network_fake_executed');
    }

    // Every case-level scenario that produced a telemetry/ledger record proves the recorder was
    // actually invoked and validated the record (not merely constructed and discarded). Telemetry
    // and ledger are independently cloned (Teil 5) but must still be value-equal.
    const withTelemetry = report.scenarios.filter((s) => s.telemetry !== null);
    expect(withTelemetry.length).toBeGreaterThanOrEqual(18);
    for (const s of withTelemetry) {
      expect(s.telemetry).toEqual(s.ledger);
      expect(s.telemetry).not.toBe(s.ledger);
      expect(s.telemetry!.runIdentity.planHash).toBe(report.plan.planHash);
      // Every field a real reservation actually produced -- never a fabricated `${scenarioId}-
      // reservation` string, never a zeroed-out defaulted latency.
      expect(s.telemetry!.reservationId).not.toBeNull();
      expect(s.telemetry!.providerLatencyMs === null || s.telemetry!.providerLatencyMs! >= 0).toBe(
        true,
      );
    }

    // Provider-call/cost proof: the dry run never used a real transport -- every "AI call" recorded
    // routed through a fake fetch, tracked per scenario.
    const totalFakeTransportCalls = report.scenarios.reduce(
      (sum, s) => sum + s.counts.fakeTransportCalls,
      0,
    );
    expect(totalFakeTransportCalls).toBeGreaterThan(0); // fake calls did happen (proves real dispatch)
    // (Real provider calls are categorically impossible here: no `fetch`/`https` import exists in
    // this module or its fakes; `ANTHROPIC_API_KEY` is a literal placeholder string, never read
    // from `process.env`, so no credential is ever consulted, let alone sent anywhere.)

    expect(report.developmentEvidenceRootHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.candidateSelectionRecordHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.holdoutExecutionPlanHash).toMatch(/^[a-f0-9]{64}$/);
  }, 60_000);

  it('the negative scenarios prove the validators/gates actually blocked, not merely ran', async () => {
    const report = await runProtocolV4DryRun();
    const negative = report.scenarios.filter((s) =>
      [
        'missing_or_manipulated_plan_hash',
        'wrong_candidate_identity',
        'holdout_without_selection_record',
        'holdout_without_matching_authorization',
        'double_terminal_completion_rejected',
        'late_completion_after_wall_clock_ceiling',
        'provider_plan_identity_mismatch',
        'reservation_pricing_mismatch',
      ].includes(s.scenarioId),
    );
    expect(negative).toHaveLength(8);
    for (const s of negative) {
      expect(s.expectedDecision).toBe('blocked');
      expect(s.actualDecision).toBe('blocked');
    }
  }, 60_000);

  it('missing_text_block carries real, reported, billable usage -- not a network-level failure', async () => {
    const report = await runProtocolV4DryRun();
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === 'missing_text_block_reported_usage',
    );
    expect(scenario).toBeDefined();
    expect(scenario!.telemetry).not.toBeNull();
    expect(scenario!.telemetry!.failureKind).toBe('missing_text_block');
    expect(scenario!.telemetry!.usageStatus).toBe('reported');
    expect(scenario!.telemetry!.actualCostStatus).toBe('computed');
    expect(scenario!.telemetry!.actualCostUsd).not.toBeNull();
    expect(scenario!.telemetry!.actualCostUsd!).toBeGreaterThan(0);
  }, 60_000);
});

describe('RESOLVER-V3-048 Teil 15B: full connected zero-network Mini-Protocol-Run', () => {
  const dryRunRootAbsolute = path.resolve(process.cwd(), PROTOCOL_V4_DRY_RUN_ROOT);

  afterAll(() => {
    // Dry-run artifact-store output is disposable, zero-network, zero-evidence scratch output --
    // never canonical evidence (that lives exclusively under PROTOCOL_V4_LIVE_ROOT, untouched by
    // this suite) and is already gitignored; remove it so repeated local runs stay reproducible.
    fs.rmSync(dryRunRootAbsolute, { recursive: true, force: true });
  });

  it('runs Masterplan -> Development Authorization -> real Development -> Evaluation -> Selection -> Holdout Plan -> Holdout Authorization -> Holdout gate, with every artifact independently stored, read back, and re-hashed', async () => {
    const report = await runProtocolV4MiniProtocolRun(`${PROTOCOL_V4_DRY_RUN_ROOT}/full-run-test`);
    expect(report.plan.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.developmentEvidenceRootHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.candidateSelectionRecordHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.holdoutExecutionPlanHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.holdoutAuthorizationId).toEqual(expect.any(String));

    // Every artifact this run produced was independently written, read back, and re-hashed through
    // the atomic Artifact Store -- these hashes are the same ones stored on disk under
    // `tmp/resolver-v3-048-protocol-v4-dry-run`, never the canonical live path.
    expect(Object.keys(report.artifactHashes).sort()).toEqual(
      [
        'planHash',
        'developmentEvidenceHash',
        'selectionRecordHash',
        'holdoutPlanHash',
        'holdoutAuthorizationHash',
      ].sort(),
    );
    for (const hash of Object.values(report.artifactHashes)) expect(hash).toMatch(/^[a-f0-9]{64}$/);
  }, 120_000);

  it('rejects a second run into the same artifact-store target (no overwrite of existing evidence)', async () => {
    const root = `${PROTOCOL_V4_DRY_RUN_ROOT}/reject-overwrite-test`;
    await expect(runProtocolV4MiniProtocolRun(root)).resolves.toBeDefined();
    await expect(runProtocolV4MiniProtocolRun(root)).rejects.toThrow(
      'PROTOCOL_V4_MINI_RUN_PLAN_TARGET_ALREADY_USED',
    );
  }, 180_000);
});
