import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { runResolverV3VariantBBenchmark } from '../runResolverV3VariantBBenchmark';
import { RESOLVER_V3_VARIANT_A_SMOKE_CORPUS } from '../resolverV3VariantASmokeCorpus';
import { FixtureVariantBProvider } from '../ResolverV3VariantBAdapter';

/**
 * RESOLVER-V3-004: end-to-end fixture-mode run of the committed corpus. Asserts the harness
 * pipeline runs deterministically, performs zero network I/O in fixture mode, and never touches
 * Variant A's own log files.
 */

describe('runResolverV3VariantBBenchmark (fixture mode)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('performs zero network calls in fixture mode', async () => {
    const fetchSpy = jest.fn();
    // @ts-expect-error -- test double, not a full fetch implementation
    global.fetch = fetchSpy;

    await runResolverV3VariantBBenchmark({ writeReports: false, repeatConsistencyRuns: 1 });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('runs the full committed corpus deterministically and reports fixture run mode', async () => {
    const { report } = await runResolverV3VariantBBenchmark({
      writeReports: false,
      repeatConsistencyRuns: 1,
    });
    expect(report.meta.variant).toBe('B');
    expect(report.meta.runMode).toBe('fixture');
    expect(report.cases).toHaveLength(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.length);
    expect(report.metrics.caseCount).toBe(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.length);
  });

  it('uses the SAME shared corpus and case ids as Variant A (no separate case selection)', async () => {
    const { report } = await runResolverV3VariantBBenchmark({
      writeReports: false,
      repeatConsistencyRuns: 1,
    });
    const reportedIds = report.cases.map((c) => c.caseId).sort();
    const corpusIds = RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.map((c) => c.caseId).sort();
    expect(reportedIds).toEqual(corpusIds);
  });

  it('produces a stable machine report structure across repeated runs', async () => {
    const first = await runResolverV3VariantBBenchmark({
      writeReports: false,
      repeatConsistencyRuns: 1,
    });
    const second = await runResolverV3VariantBBenchmark({
      writeReports: false,
      repeatConsistencyRuns: 1,
    });
    expect(first.report.metrics.identification).toEqual(second.report.metrics.identification);
    expect(first.report.cases.map((c) => c.caseId)).toEqual(
      second.report.cases.map((c) => c.caseId),
    );
  });

  it('accepts an explicit provider override for isolated testing', async () => {
    const provider = new FixtureVariantBProvider({});
    const { report } = await runResolverV3VariantBBenchmark({
      writeReports: false,
      provider,
      repeatConsistencyRuns: 1,
    });
    expect(report.meta.provider).toEqual({
      providerId: 'fixture',
      modelId: 'fixture-recorded-response',
    });
    // Every case is unfixtured under this empty provider -- all should be invalid_response/technical failures,
    // never silently treated as a real result.
    expect(report.metrics.notEvaluableCases.length).toBeGreaterThan(0);
  });

  it('restricts a run to an explicit case subset without touching the shared corpus', async () => {
    const subset = RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.filter((c) => c.caseId === 'RV3-0001');
    const { report } = await runResolverV3VariantBBenchmark({
      writeReports: false,
      cases: subset,
      repeatConsistencyRuns: 1,
    });
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].caseId).toBe('RV3-0001');
  });
});
