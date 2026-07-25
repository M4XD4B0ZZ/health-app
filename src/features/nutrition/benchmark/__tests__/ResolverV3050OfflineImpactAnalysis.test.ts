import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  runResolverV3050OfflineImpactAnalysis,
  ResolverV3050OfflineImpactReport,
} from '../resolverV3050OfflineImpactAnalysis';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../representativeHybridV1/RepresentativeHybridV1Manifest';

/**
 * RESOLVER-V3-050: complete offline impact analysis over the entire frozen RESOLVER-V3-038
 * representative corpus (104 resolution-decomposition cases: 80 development + 24 holdout).
 * Zero provider calls -- every case runs against the real, deterministic BLS-backed resolver
 * only, both under the OLD (pre-fix) and corrected (production-faithful) benchmark boundaries.
 *
 * Also writes the full per-case report to `logs/resolver-v3-050-offline-impact-analysis.json`
 * (gitignored, same convention as other benchmark harness reports) -- the source data for the
 * committed, versioned summary in
 * `reports/resolver-v3-050-benchmark-production-call-path-fidelity.json`.
 */
describe('RESOLVER-V3-050: complete offline corpus impact analysis', () => {
  let report: ResolverV3050OfflineImpactReport;

  beforeAll(async () => {
    report = await runResolverV3050OfflineImpactAnalysis();

    const outputDir = path.resolve(__dirname, '../../../../../logs');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, 'resolver-v3-050-offline-impact-analysis.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }, 60_000);

  it('covers the entire frozen corpus (104 resolution-decomposition cases: 80 development + 24 holdout)', () => {
    expect(report.totals.allCases).toBe(104);
    expect(report.cases).toHaveLength(104);
    const byPartition = report.cases.reduce<Record<string, number>>((acc, c) => {
      acc[c.partition] = (acc[c.partition] ?? 0) + 1;
      return acc;
    }, {});
    expect(byPartition.development).toBe(80);
    expect(byPartition.holdout).toBe(24);
  });

  it('every case ID in the report corresponds to a real, current corpus scenario', () => {
    const knownIds = new Set(
      REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.map((s) => s.scenarioId),
    );
    for (const c of report.cases) {
      expect(knownIds.has(c.caseId)).toBe(true);
    }
  });

  it('the target case RH-RES-SIMPLE-DEV-003 ("Ein Apfel") is recorded as a changed, false-confidence-resolved case', () => {
    const target = report.cases.find((c) => c.caseId === 'RH-RES-SIMPLE-DEV-003');
    expect(target).toBeDefined();
    expect(target!.rawInput).toBe('Ein Apfel');
    expect(target!.boundaryChanged).toBe(true);
    expect(target!.acceptedToAmbiguous).toBe(true);
    expect(target!.variantAOld.falseConfident).toBe(true);
    expect(target!.variantACorrected.falseConfident).toBe(false);
  });

  it('transition counts are mutually exclusive and consistent with the totals', () => {
    for (const c of report.cases) {
      // A case can be at most one of these four transitions (status can only move one way).
      const transitionCount = [
        c.acceptedToAmbiguous,
        c.ambiguousToAccepted,
        c.acceptedToRejectedOrNoMatch,
        c.rejectedOrNoMatchToAccepted,
      ].filter(Boolean).length;
      expect(transitionCount).toBeLessThanOrEqual(1);
      // Every one of these four transitions implies the outcome changed.
      if (transitionCount === 1) {
        expect(c.variantAOutcomeChanged).toBe(true);
      }
    }

    const sum = (
      key:
        | 'acceptedToAmbiguous'
        | 'ambiguousToAccepted'
        | 'acceptedToRejectedOrNoMatch'
        | 'rejectedOrNoMatchToAccepted',
    ) => report.cases.filter((c) => c[key]).length;

    expect(report.totals.acceptedToAmbiguous).toBe(sum('acceptedToAmbiguous'));
    expect(report.totals.ambiguousToAccepted).toBe(sum('ambiguousToAccepted'));
    expect(report.totals.acceptedToRejectedOrNoMatch).toBe(sum('acceptedToRejectedOrNoMatch'));
    expect(report.totals.rejectedOrNoMatchToAccepted).toBe(sum('rejectedOrNoMatchToAccepted'));
    expect(report.totals.changedInputs).toBe(report.cases.filter((c) => c.boundaryChanged).length);
    expect(report.totals.changedOutcomes).toBe(
      report.cases.filter((c) => c.variantAOutcomeChanged).length,
    );
    expect(report.totals.winnerSourceIdChanges).toBe(
      report.cases.filter((c) => c.winnerSourceIdChanged).length,
    );
  });

  it("Variant C's fast-path outcome exactly mirrors Variant A's own outcome for both boundaries, on every case (fast path IS Variant A)", () => {
    for (const c of report.cases) {
      expect(c.variantCOld.fastPathUsed).toBe(c.variantAOld.status === 'accepted');
      expect(c.variantCCorrected.fastPathUsed).toBe(c.variantACorrected.status === 'accepted');
      if (c.variantCOld.fastPathUsed) {
        expect(c.variantCOld.outcome).toEqual(c.variantAOld);
      } else {
        expect(c.variantCOld.outcome).toBeNull();
      }
      if (c.variantCCorrected.fastPathUsed) {
        expect(c.variantCCorrected.outcome).toEqual(c.variantACorrected);
      } else {
        expect(c.variantCCorrected.outcome).toBeNull();
      }
    }
  });

  it('no-op cases (boundary unchanged) never show an outcome change', () => {
    for (const c of report.cases) {
      if (!c.boundaryChanged) {
        expect(c.variantAOutcomeChanged).toBe(false);
        expect(c.winnerSourceIdChanged).toBe(false);
        expect(c.falseConfidenceChanged).toBe(false);
      }
    }
  });
});
