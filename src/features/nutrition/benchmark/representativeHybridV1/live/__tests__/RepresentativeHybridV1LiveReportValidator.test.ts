import {
  assertValidRepresentativeHybridV1LiveReport,
  RepresentativeHybridV1LiveReportValidationError,
} from '../RepresentativeHybridV1LiveReportValidator';
import { buildRepresentativeHybridV1LiveExecutionPlan } from '../RepresentativeHybridV1LiveExecutionPlan';
import { buildRepresentativeHybridV1LiveReport } from '../RepresentativeHybridV1LiveReportBuilder';
import { REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION } from '../RepresentativeHybridV1LiveVersions';

describe('RESOLVER-V3-039 live report validator', () => {
  async function buildBlockedReport() {
    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
    return buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits: {
        currency: 'USD',
        maxCalls: plan.budget.maxCalls,
        maxInputTokens: plan.budget.maxInputTokens,
        maxOutputTokens: plan.budget.maxOutputTokens,
        maxCost: plan.budget.worstCaseReservedCostUsd,
        maxInFlight: 1,
      },
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: {
        phase: 'protocol_frozen_only',
        blockerReason: 'ANTHROPIC_API_KEY not set',
      },
      rawTelemetry: [],
      developmentCaseRecords: null,
      holdoutCaseRecords: null,
      expectedBehaviorByScenarioId: new Map(),
    });
  }

  it('accepts a well-formed report', async () => {
    const report = await buildBlockedReport();
    expect(() => assertValidRepresentativeHybridV1LiveReport(report)).not.toThrow();
  });

  it('rejects an unknown top-level field (closed schema)', async () => {
    const report = await buildBlockedReport();
    const withExtra = { ...report, unexpectedField: 'nope' };
    expect(() => assertValidRepresentativeHybridV1LiveReport(withExtra)).toThrow(
      RepresentativeHybridV1LiveReportValidationError,
    );
  });

  it('rejects a missing required field', async () => {
    const report = (await buildBlockedReport()) as unknown as Record<string, unknown>;
    delete report.gateVerdicts;
    expect(() => assertValidRepresentativeHybridV1LiveReport(report)).toThrow(
      RepresentativeHybridV1LiveReportValidationError,
    );
  });

  it('rejects a report-version mismatch', async () => {
    const report = await buildBlockedReport();
    const wrongVersion = { ...report, reportVersion: 'some-other-version' };
    expect(() => assertValidRepresentativeHybridV1LiveReport(wrongVersion)).toThrow();
    expect(report.reportVersion).toBe(REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION);
  });

  it('rejects an invalid gate verdict enum value', async () => {
    const report = await buildBlockedReport();
    const bad = {
      ...report,
      gateVerdicts: { ...report.gateVerdicts, g2a_representativeQuality: 'maybe' },
    };
    expect(() => assertValidRepresentativeHybridV1LiveReport(bad)).toThrow();
  });

  it('rejects a non-zero retryCount (this protocol makes zero automatic retries)', async () => {
    const report = await buildBlockedReport();
    const bad = { ...report, actualUsage: { ...report.actualUsage, retryCount: 1 } };
    expect(() => assertValidRepresentativeHybridV1LiveReport(bad)).toThrow();
  });

  it('every gate dimension defaults to not_evaluable, never a silent pass, when execution is blocked', async () => {
    const report = await buildBlockedReport();
    for (const verdict of Object.values(report.gateVerdicts)) {
      expect(verdict).toBe('not_evaluable');
    }
  });
});
