import { runRepresentativeHybridV1 } from '../runRepresentativeHybridV1';

describe('runRepresentativeHybridV1 smoke', () => {
  it('runs the full development partition through all three arms without throwing', async () => {
    const report = await runRepresentativeHybridV1({ partitions: ['development'] });
    expect(report.meta.runMode).toBe('fixture');
    expect(report.metrics.development.variantA.caseCount).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          devA: report.metrics.development.variantA,
          devC: report.metrics.development.variantC,
        },
        null,
        2,
      ),
    );
  }, 60000);

  it('runs the holdout partition through all three arms without throwing', async () => {
    const report = await runRepresentativeHybridV1({ partitions: ['holdout'] });
    expect(report.metrics.holdout.variantA.caseCount).toBeGreaterThan(0);
  }, 60000);

  it('runs the conformance fixtures without throwing', async () => {
    const report = await runRepresentativeHybridV1({
      partitions: [],
      includeConformance: true,
    });
    expect(report.cases.filter((c) => c.isFixtureOnly).length).toBe(6);
  }, 60000);
});
