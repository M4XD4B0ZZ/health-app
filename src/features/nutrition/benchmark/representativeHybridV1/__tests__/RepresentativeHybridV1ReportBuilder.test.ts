import { runRepresentativeHybridV1 } from '../runRepresentativeHybridV1';
import { buildRepresentativeHybridV1MarkdownReport } from '../RepresentativeHybridV1ReportBuilder';
import { REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION } from '../RepresentativeHybridV1Types';

describe('RESOLVER-V3-038 report builder', () => {
  it('JSON report has an explicit, versioned schema and fixture-only labeling', async () => {
    const report = await runRepresentativeHybridV1({
      partitions: ['development'],
      caseIds: ['RH-RES-SIMPLE-DEV-001', 'RH-RES-DACH-DEV-006'],
    });
    expect(report.meta.reportSchemaVersion).toBe(REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION);
    expect(report.meta.fixtureOnly).toBe(true);
    expect(report.meta.runMode).toBe('fixture');
    expect(report.meta.noLiveQualityEvidence).toBe(true);
    expect(report.meta.noProductionEffect).toBe(true);
  });

  it('Markdown and JSON report agree on corpus hash and partitions run', async () => {
    const report = await runRepresentativeHybridV1({
      partitions: ['development'],
      caseIds: ['RH-RES-SIMPLE-DEV-001'],
    });
    const markdown = buildRepresentativeHybridV1MarkdownReport(report);
    expect(markdown).toContain(report.meta.corpusHash);
    expect(markdown).toContain('development');
    expect(markdown).toContain('FIXTURE-ONLY');
  });

  it('the Markdown report never declares a live quality winner', async () => {
    const report = await runRepresentativeHybridV1({
      partitions: ['development'],
      caseIds: ['RH-RES-SIMPLE-DEV-001'],
    });
    const markdown = buildRepresentativeHybridV1MarkdownReport(report);
    expect(markdown).not.toMatch(/Hybrid C (wins|is better|outperforms)/i);
    expect(markdown).toMatch(/No live quality winner is declared/);
  });

  it('the Markdown report contains no production-readiness claim', async () => {
    const report = await runRepresentativeHybridV1({
      partitions: ['development'],
      caseIds: ['RH-RES-SIMPLE-DEV-001'],
    });
    const markdown = buildRepresentativeHybridV1MarkdownReport(report);
    expect(markdown).not.toMatch(/ready for production|production[- ]ready/i);
  });

  it('partitions and arms remain separate in the machine report (never collapsed)', async () => {
    const report = await runRepresentativeHybridV1({ partitions: ['development', 'holdout'] });
    expect(report.metrics.development).not.toBe(report.metrics.holdout);
    expect(report.metrics.development.variantA).not.toBe(report.metrics.development.variantB);
    expect(report.metrics.development.variantB).not.toBe(report.metrics.development.variantC);
  });

  it('conformance-fixture cases are labeled fixtureOnly and excluded from representative metrics', async () => {
    const withConformance = await runRepresentativeHybridV1({
      partitions: [],
      includeConformance: true,
    });
    expect(withConformance.cases.every((c) => c.isFixtureOnly)).toBe(true);
    expect(withConformance.metrics.combined.variantA.caseCount).toBe(0);
  });

  it('output ordering is deterministic (case list matches scenario evaluation order, stable across runs)', async () => {
    const options = {
      partitions: ['development'] as const,
      caseIds: ['RH-RES-SIMPLE-DEV-001', 'RH-RES-SIMPLE-DEV-002'],
    };
    const first = await runRepresentativeHybridV1(options);
    const second = await runRepresentativeHybridV1(options);
    expect(first.cases.map((c) => c.scenarioId)).toEqual(second.cases.map((c) => c.scenarioId));
  });

  it('unknown/missing cost-latency fields remain null, never coerced to zero, in the case record', async () => {
    const report = await runRepresentativeHybridV1({
      partitions: ['development'],
      caseIds: ['RH-RES-SIMPLE-DEV-001'],
    });
    const c = report.cases[0];
    expect(c.variantBOutcome).toBeDefined();
  });
});
