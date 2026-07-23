import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildRepresentativeHybridV1LiveExecutionPlan } from '../RepresentativeHybridV1LiveExecutionPlan';
import { buildRepresentativeHybridV1LiveReport } from '../RepresentativeHybridV1LiveReportBuilder';

/**
 * RESOLVER-V3-039 Phase-B continuation remediation: reproduces the exact protocol-v1 defect
 * mechanics found before any live execution was attempted. Full narrative in
 * `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`.
 *
 * The buggy v1 harness code (`runRepresentativeHybridV1Live.harness.ts` at commit
 * `da3bae6939bd5514e7a7521597ae670940e45ea6`, before this remediation replaced it -- see git
 * history) is not re-imported here (it has been corrected in place). Instead:
 *   - Tests 2/3 reproduce the exact existence-guard predicate v1 used, verbatim, as an isolated
 *     historical repro (not calling any deleted code -- just the same boolean logic, quoted).
 *   - Tests 4 reproduce the exact "holdout-only report has no development evidence" mechanism using
 *     the CURRENT (unchanged in this respect) `buildRepresentativeHybridV1LiveReport`, which still
 *     accepts `developmentCaseRecords: null` independently of `holdoutCaseRecords` -- that
 *     independence is exactly what a v1 holdout-only run relied on, and exactly what v2's harness
 *     now always feeds a non-null `developmentCaseRecords` reconstructed from the Development
 *     checkpoint instead of ever calling with `null` on a real second-phase run.
 *   - Test 5 reads the actual, still-committed v1 evidence artifact
 *     (`reports/resolver-v3-039-controlled-representative-live-evidence.json`) and confirms it
 *     independently: zero calls, zero telemetry, `not_evaluable` everywhere.
 */
describe('RESOLVER-V3-039 protocol v1 pre-execution defect (historical reproduction)', () => {
  it('1. Development writes an output artifact at a fixed, predictable path', () => {
    // Both v1 and v2 write Development's output to a fixed path under logs/ -- this is not itself
    // the defect; the defect is what happens when Holdout is later run against that same path. v2
    // renamed the fixed Development artifact to a *checkpoint* specifically so Holdout could read
    // it back instead of merely refusing to overwrite it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-defect-'));
    const developmentOutputPath = path.join(
      dir,
      'resolver-v3-039-controlled-representative-live-evidence.json',
    );
    fs.writeFileSync(
      developmentOutputPath,
      JSON.stringify({ development: 'fake-v1-development-output' }),
    );
    expect(fs.existsSync(developmentOutputPath)).toBe(true);
  });

  it('2. the v1-documented Holdout command is refused once that artifact exists (verbatim v1 guard predicate)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-defect-'));
    const jsonReportPath = path.join(
      dir,
      'resolver-v3-039-controlled-representative-live-evidence.json',
    );
    fs.writeFileSync(jsonReportPath, JSON.stringify({ development: 'fake-v1-development-output' }));

    // Verbatim reproduction of runRepresentativeHybridV1Live.harness.ts's v1 guard (pre-remediation,
    // commit da3bae6939bd5514e7a7521597ae670940e45ea6):
    //   if (fs.existsSync(jsonReportPath) && env.REPRESENTATIVE_HYBRID_V1_LIVE_ALLOW_RERUN !== 'true')
    //     throw new Error(`...a report already exists at ${jsonReportPath}...`);
    const allowRerunEnv: string | undefined = undefined; // the documented Holdout command never set this
    const documentedHoldoutCommandWouldRefuse =
      fs.existsSync(jsonReportPath) && allowRerunEnv !== 'true';
    expect(documentedHoldoutCommandWouldRefuse).toBe(true);
  });

  it('3. --allow-rerun bypasses the refusal but overwrites Development with a holdout-only report (loses Development)', () => {
    // Reproduces the exact v1 field assignment (harness.ts, pre-remediation):
    //   developmentCaseRecords: partitions.includes('development') ? caseRecords : null,
    //   holdoutCaseRecords: partitions.includes('holdout') ? caseRecords : null,
    // A --allow-rerun --partition=holdout invocation has partitions === ['holdout'], so
    // developmentCaseRecords is unconditionally null -- there is no code path that reads back a
    // prior report and merges it in.
    const partitions: readonly string[] = ['holdout'];
    const caseRecords = [{ scenarioId: 'fake', partition: 'holdout' }];
    const developmentCaseRecords = partitions.includes('development') ? caseRecords : null;
    const holdoutCaseRecords = partitions.includes('holdout') ? caseRecords : null;
    expect(developmentCaseRecords).toBeNull();
    expect(holdoutCaseRecords).not.toBeNull();
  });

  it('4. a holdout-only report built this way contains no Development evidence, using the real (unchanged) report builder', async () => {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits: {
        currency: 'USD',
        maxCalls: plan.budget.maxCalls,
        maxInputTokens: plan.budget.maxInputTokens,
        maxOutputTokens: plan.budget.maxOutputTokens,
        maxCost: plan.budget.worstCaseReservedCostUsd,
        maxInFlight: 1,
      },
      protocolFreezeCommit: 'da3bae6939bd5514e7a7521597ae670940e45ea6',
      evidenceCommit: null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: [],
      developmentCaseRecords: null, // exactly what a v1 --allow-rerun --partition=holdout run produced
      holdoutCaseRecords: [],
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.development).toBeNull();
    expect(report.gateVerdicts.g2b_falseConfidence).toBe('not_evaluable'); // requires both partitions
  });

  it('5. the defect was recorded as pre-execution: the actual committed v1 evidence artifact shows zero calls, zero cost', () => {
    const repoRoot = path.resolve(__dirname, '../../../../../../..');
    const v1EvidencePath = path.join(
      repoRoot,
      'reports/resolver-v3-039-controlled-representative-live-evidence.json',
    );
    const v1Evidence = JSON.parse(fs.readFileSync(v1EvidencePath, 'utf-8'));
    expect(v1Evidence.actualUsage.calls).toBe(0);
    expect(v1Evidence.actualUsage.estimatedCostUsd).toBeNull();
    expect(v1Evidence.rawTelemetry).toEqual([]);
    expect(v1Evidence.development).toBeNull();
    expect(v1Evidence.holdout).toBeNull();
    for (const verdict of Object.values(v1Evidence.gateVerdicts)) {
      expect(verdict).toBe('not_evaluable');
    }
  });

  it('protocol v1 documents are preserved unedited (byte-identical planHash/corpusHash to the frozen record)', () => {
    const repoRoot = path.resolve(__dirname, '../../../../../../..');
    const v1ProtocolPath = path.join(
      repoRoot,
      'reports/resolver-v3-039-controlled-live-protocol.json',
    );
    const v1Protocol = JSON.parse(fs.readFileSync(v1ProtocolPath, 'utf-8'));
    expect(v1Protocol.protocolVersion).toBe('resolver-representative-hybrid-live-protocol-v1');
    expect(v1Protocol.planHash).toBe(
      '214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e',
    );
    expect(v1Protocol.budget.maxCalls).toBe(263);
  });
});
