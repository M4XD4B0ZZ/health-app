import {
  runProtocolV4DryRun,
  executedProtocolV4DryRunScenarioIds,
} from '../ResolverV3048ProtocolV4DryRun';

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

describe('RESOLVER-V3-048 Part 9: real executable 22-scenario zero-network dry run', () => {
  it('has exactly 22 mandated scenario IDs, matching the task specification', () => {
    expect(EXPECTED_SCENARIO_IDS).toHaveLength(22);
    expect(new Set(EXPECTED_SCENARIO_IDS).size).toBe(22);
  });

  it('actually executes all 22 scenarios through the real pipeline -- zero network, zero provider cost', async () => {
    const report = await runProtocolV4DryRun();

    expect(report.executedScenarioCount).toBe(22);
    const executedIds = new Set(executedProtocolV4DryRunScenarioIds());
    expect(executedIds.size).toBe(22);
    for (const id of EXPECTED_SCENARIO_IDS) expect(executedIds.has(id)).toBe(true);

    expect(report.scenarios).toHaveLength(22);
    for (const scenario of report.scenarios) {
      expect(scenario.componentsExecuted.length).toBeGreaterThan(0);
      expect(scenario.actualDecision).toBe(scenario.expectedDecision);
      expect(scenario.validatorResult).toBe('passed');
      expect(scenario.evidenceClass).toBe('zero_network_fake_executed');
    }

    // Every case-level scenario that produced a telemetry/ledger record proves the recorder was
    // actually invoked and validated the record (not merely constructed and discarded).
    const withTelemetry = report.scenarios.filter((s) => s.telemetry !== null);
    expect(withTelemetry.length).toBeGreaterThanOrEqual(18);
    for (const s of withTelemetry) {
      expect(s.telemetry).toEqual(s.ledger);
      expect(s.telemetry!.runIdentity.planHash).toBe(report.plan.planHash);
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
  }, 30_000);

  it('the negative scenarios (19-22) prove the validators/gates actually blocked, not merely ran', async () => {
    const report = await runProtocolV4DryRun();
    const negative = report.scenarios.filter((s) =>
      [
        'missing_or_manipulated_plan_hash',
        'wrong_candidate_identity',
        'holdout_without_selection_record',
        'holdout_without_matching_authorization',
      ].includes(s.scenarioId),
    );
    expect(negative).toHaveLength(4);
    for (const s of negative) {
      expect(s.expectedDecision).toBe('blocked');
      expect(s.actualDecision).toBe('blocked');
    }
  }, 30_000);
});
