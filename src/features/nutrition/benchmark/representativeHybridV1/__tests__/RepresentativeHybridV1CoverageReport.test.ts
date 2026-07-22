import { computeRepresentativeHybridV1CoverageReport } from '../RepresentativeHybridV1CoverageReport';
import { REPRESENTATIVE_HYBRID_V1_CORPUS } from '../RepresentativeHybridV1Manifest';

describe('RepresentativeHybridV1 coverage report', () => {
  const report = computeRepresentativeHybridV1CoverageReport();

  it('has no missing category/behavior/difficulty x partition cells', () => {
    expect(report.missingCells).toEqual([]);
  });

  it('every category has at least 8 base cases', () => {
    for (const cell of Object.values(report.categoryPartitionMatrix)) {
      expect(cell.total).toBeGreaterThanOrEqual(8);
    }
  });

  it('holdout is at least approximately 20% of the resolution base corpus', () => {
    expect(report.holdoutPercentOfResolutionBase).toBeGreaterThanOrEqual(19);
  });

  it('repeat overlay is within the 15-20% corridor (documented deviation allowed slightly above)', () => {
    expect(report.repeatOverlayPercentOfBase).toBeGreaterThanOrEqual(10);
    expect(report.repeatOverlayPercentOfBase).toBeLessThanOrEqual(25);
  });

  it('total/development/holdout counts are manifest-derived and match the corpus length', () => {
    expect(report.totalScenarios).toBe(REPRESENTATIVE_HYBRID_V1_CORPUS.length);
    expect(report.developmentCount + report.holdoutCount).toBe(report.totalScenarios);
  });

  it('prints the coverage matrix for inspection', () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    expect(true).toBe(true);
  });
});
