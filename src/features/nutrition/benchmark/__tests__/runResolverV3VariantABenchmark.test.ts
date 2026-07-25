import { describe, it, expect } from '@jest/globals';
import { runResolverV3VariantABenchmark } from '../runResolverV3VariantABenchmark';
import { RESOLVER_V3_VARIANT_A_SMOKE_CORPUS } from '../resolverV3VariantASmokeCorpus';
import { BenchmarkCase } from '../BenchmarkCaseTypes';

describe('runResolverV3VariantABenchmark', () => {
  it('runs the full committed smoke corpus deterministically without writing files when disabled', async () => {
    const { report } = await runResolverV3VariantABenchmark({ writeReports: false });

    expect(report.cases).toHaveLength(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.length);
    expect(report.metrics.caseCount).toBe(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.length);
  }, 30_000);

  it('is a no-AI baseline: no AI provider is used and no "ai" source is ever registered', async () => {
    const { report } = await runResolverV3VariantABenchmark({ writeReports: false });

    expect(report.meta.configuration.aiProviderUsed).toBe(false);
    expect(report.meta.configuration.aiCallCount).toBe(0);
    expect(report.meta.configuration.sourcesRegistered).not.toContain('ai');
  }, 30_000);

  it('produces the same case ordering regardless of the input corpus array order', async () => {
    const forward = [...RESOLVER_V3_VARIANT_A_SMOKE_CORPUS];
    const reversed = [...RESOLVER_V3_VARIANT_A_SMOKE_CORPUS].reverse();

    const [forwardRun, reversedRun] = await Promise.all([
      runResolverV3VariantABenchmark({ cases: forward, writeReports: false }),
      runResolverV3VariantABenchmark({ cases: reversed, writeReports: false }),
    ]);

    expect(forwardRun.report.cases.map((c) => c.caseId)).toEqual(
      reversedRun.report.cases.map((c) => c.caseId),
    );
  }, 30_000);

  it('finds the committed Quark/Magerquark and Ei/Eier repeat groups consistent', async () => {
    const { report } = await runResolverV3VariantABenchmark({ writeReports: false });
    const quarkGroup = report.metrics.repeatGroups.find(
      (g) => g.repeatGroupId === 'quark-magerquark-synonym',
    );
    const eiGroup = report.metrics.repeatGroups.find((g) => g.repeatGroupId === 'ei-eier-plural');

    expect(quarkGroup?.consistent).toBe(true);
    expect(eiGroup?.consistent).toBe(true);
  }, 30_000);

  it('RESOLVER-V3-043: the committed Brötchen case (RV3-0011) is no longer a false-confident failure', async () => {
    // Historical context (kept for provenance, no longer the current behavior): before
    // RESOLVER-V3-043, this case's bare "Brötchen" input confidently (falsely) resolved to
    // D771900 ("Brötchen (Blätterteig)", a puff-pastry variant) instead of the plain wheat roll
    // (B511000) the case's ground truth expects, because `BlsCompactRuntimeAdapter`'s alias
    // generation stripped the entire "(Blätterteig)" parenthetical from D771900's display name.
    // RESOLVER-V3-043's source-ID-scoped negative-compatibility fix
    // (`INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID`) makes D771900 unable to win the bare query
    // through any matching stage, so the resolver now honestly returns `ambiguous` (several real
    // "-brötchen" candidates tie) instead of falsely accepting -- see
    // `ResolverV3043BroetchenFalseConfidenceRemediation.test.ts` for the focused fix coverage.
    // Precisely which single candidate should win an ambiguous bare "Brötchen" query is a
    // separate, deferred ranking-quality question (RESOLVER-V3-049) -- this test only asserts the
    // false-confidence/critical-failure defect itself is gone, per this task's explicit
    // instruction not to force a specific acceptance just to make a benchmark case green.
    const { report } = await runResolverV3VariantABenchmark({ writeReports: false });
    const rv30011 = report.cases.find((c) => c.caseId === 'RV3-0011');

    expect(report.metrics.falseConfidentCases).not.toContain('RV3-0011');
    expect(rv30011?.falseConfident).toBe(false);
    expect(rv30011?.isCriticalFailure).toBe(false);
    expect(rv30011?.resolverStatus).toBe('ambiguous');
  }, 30_000);

  it('aborts with a precise error instead of scoring an invalid fixture', async () => {
    const invalidCase = {
      ...RESOLVER_V3_VARIANT_A_SMOKE_CORPUS[0],
      caseId: '', // invalid: caseId must be a non-empty string
    } as BenchmarkCase;

    await expect(
      runResolverV3VariantABenchmark({ cases: [invalidCase], writeReports: false }),
    ).rejects.toThrow(/caseId is required/);
  });

  it('rejects a corpus with duplicate caseIds', async () => {
    const [first] = RESOLVER_V3_VARIANT_A_SMOKE_CORPUS;
    await expect(
      runResolverV3VariantABenchmark({ cases: [first, first], writeReports: false }),
    ).rejects.toThrow(/Duplicate caseId/);
  });
});
