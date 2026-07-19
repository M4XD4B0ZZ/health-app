import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { runResolverV3VariantCBenchmark } from '../runResolverV3VariantCBenchmark';
import { RESOLVER_V3_VARIANT_A_SMOKE_CORPUS } from '../resolverV3VariantASmokeCorpus';
import { FixtureCostAiInterpreter } from '../ResolverV3VariantCAdapter';
import { FixtureAiInterpretationProvider } from '../VariantCFixtureInterpretations';

/**
 * RESOLVER-V3-005: end-to-end fixture-mode run of the SAME committed corpus Variant A/B use.
 * Asserts the hybrid harness runs deterministically, performs zero network I/O in fixture mode,
 * and never touches Variant A/B's own log files.
 */

describe('runResolverV3VariantCBenchmark (fixture mode)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('performs zero network calls in fixture mode', async () => {
    const fetchSpy = jest.fn();
    // @ts-expect-error -- test double, not a full fetch implementation
    global.fetch = fetchSpy;

    await runResolverV3VariantCBenchmark({ writeReports: false });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('runs the full committed corpus deterministically and reports fixture run mode', async () => {
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false });
    expect(report.meta.variant).toBe('C');
    expect(report.meta.runMode).toBe('fixture');
    expect(report.cases).toHaveLength(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.length);
    expect(report.metrics.caseCount).toBe(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.length);
  });

  it('uses the SAME shared corpus and case ids as Variant A/B (no separate case selection)', async () => {
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false });
    const reportedIds = report.cases.map((c) => c.caseId).sort();
    const corpusIds = RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.map((c) => c.caseId).sort();
    expect(reportedIds).toEqual(corpusIds);
  });

  it('produces a stable machine report structure across repeated runs', async () => {
    const first = await runResolverV3VariantCBenchmark({ writeReports: false });
    const second = await runResolverV3VariantCBenchmark({ writeReports: false });
    expect(first.report.metrics.identification).toEqual(second.report.metrics.identification);
    expect(first.report.cases.map((c) => c.caseId)).toEqual(
      second.report.cases.map((c) => c.caseId),
    );
    expect(first.report.metrics.fastPath).toEqual(second.report.metrics.fastPath);
  });

  it('some cases use the validated fast path and skip the AI interpreter entirely (real Variant A accept threshold)', async () => {
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false });
    expect(report.metrics.fastPath.usedCount).toBeGreaterThan(0);
    expect(report.metrics.fastPath.usedCount).toBeLessThan(report.metrics.caseCount);
    expect(report.metrics.fastPath.aiCalledCount).toBeGreaterThan(0);
  });

  it('never produces an unbacked numeric (resolved-but-not-source-grounded) result', async () => {
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false });
    expect(report.metrics.provenance.unbackedNumericResultCount).toBe(0);
  });

  it('never misreports a partial meal as a complete "resolved" outcome', async () => {
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false });
    expect(report.metrics.partialMisreportedAsCompleteCases).toEqual([]);
  });

  it('accepts an explicit AI interpreter override for isolated testing', async () => {
    const aiInterpreter = new FixtureCostAiInterpreter(new FixtureAiInterpretationProvider({}));
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false, aiInterpreter });
    expect(report.meta.provider).toBeNull();
  });

  it('restricts a run to an explicit case subset without touching the shared corpus', async () => {
    const subset = RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.filter((c) => c.caseId === 'RV3-0001');
    const { report } = await runResolverV3VariantCBenchmark({ writeReports: false, cases: subset });
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].caseId).toBe('RV3-0001');
  });

  it('aborts with a precise error instead of scoring an invalid fixture', async () => {
    const invalidCase = { ...RESOLVER_V3_VARIANT_A_SMOKE_CORPUS[0], caseId: '' } as never;
    await expect(
      runResolverV3VariantCBenchmark({ writeReports: false, cases: [invalidCase] }),
    ).rejects.toThrow(/caseId is required/);
  });
});
