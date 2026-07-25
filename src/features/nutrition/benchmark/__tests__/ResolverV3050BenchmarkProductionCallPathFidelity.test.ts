import { describe, it, expect } from '@jest/globals';
import { buildVariantAResolver, runVariantACase } from '../ResolverV3VariantAAdapter';
import { normalizeText } from '../../application/utils/normalizeText';
import { detectInputType } from '../../application/utils/detectInputType';
import { DeterministicFoodParser } from '../../infrastructure/parsers/DeterministicFoodParser';
import { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import { FoodSearchQuery } from '../../domain/catalog/FoodCatalogSource';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { REPRESENTATIVE_HYBRID_V1_SIMPLE_SCENARIOS } from '../representativeHybridV1/RepresentativeHybridV1SimpleCorpus';

/**
 * RESOLVER-V3-050: permanent regression tests for the benchmark's production-call-path fidelity
 * fix in `ResolverV3VariantAAdapter.runVariantACase`. Reproduces the OLD (pre-fix) benchmark
 * boundary explicitly -- `normalizeText(rawInput)` sent straight to the resolver, skipping
 * `DeterministicFoodParser` -- alongside the real, already-fixed `runVariantACase`, so both this
 * defect and its correction stay provable forever, not just at the moment of the fix.
 *
 * Per RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md §4/§7: real production never
 * calls the resolver with `normalizeText(rawInput)` -- `LogFoodFromRawInputUseCase.resolveCanonicalFood`
 * always normalizes `parsed.name` (the `DeterministicFoodParser.parse(rawInput)` result), never the
 * raw string itself.
 */

function caseFor(rawInput: string, overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-050-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput,
    locale: 'de',
    expectedComponents: [{ componentId: 'c1', expectedName: rawInput, required: true }],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 1, protein_g: 1, fat_g: 1, carbs_g: 1 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

/** The OLD (pre-RESOLVER-V3-050) benchmark boundary, preserved verbatim here for regression
 * purposes only -- production code no longer contains this call shape. Mirrors exactly what
 * `runVariantACase` used to do: `normalizeText(rawInput)` straight to the resolver, no parser. */
async function runOldBenchmarkBoundary(
  resolver: FoodCatalogResolver,
  rawInput: string,
  locale: 'de' | 'en' = 'de',
) {
  const normalized = normalizeText(rawInput);
  const inputType = detectInputType(rawInput);
  const traceId = 'old-boundary-test';
  const query: FoodSearchQuery = { raw: rawInput, normalized, locale, inputType, traceId };
  const decision = await resolver.resolve(query, { traceId });
  return { query, decision };
}

describe('RESOLVER-V3-050: benchmark production-call-path fidelity', () => {
  describe('target case: RH-RES-SIMPLE-DEV-003 ("Ein Apfel")', () => {
    const targetScenario = REPRESENTATIVE_HYBRID_V1_SIMPLE_SCENARIOS.find(
      (s) => s.scenarioId === 'RH-RES-SIMPLE-DEV-003',
    );

    it('exists in the frozen SIMPLE corpus with rawInput "Ein Apfel"', () => {
      expect(targetScenario).toBeDefined();
      expect(targetScenario!.case.rawInput).toBe('Ein Apfel');
    });

    it('real production parsing (DeterministicFoodParser) removes the leading article', () => {
      const parsed = new DeterministicFoodParser().parse('Ein Apfel');
      expect(parsed.name).toBe('apfel');
      expect(parsed.quantityCount).toBe(1);
      expect(parsed.unit).toBe('count');
    });

    it('OLD benchmark boundary sends a resolver query containing the leading article', async () => {
      const { resolver } = buildVariantAResolver();
      const old = await runOldBenchmarkBoundary(resolver, targetScenario!.case.rawInput);
      expect(old.query.normalized).toBe('ein apfel');
    });

    it('corrected (current) runVariantACase strips the article via the real parser first', async () => {
      const { resolver } = buildVariantAResolver();
      const corrected = await runVariantACase(targetScenario!.case, resolver);
      expect(corrected.query.normalized).toBe('apfel');
      expect(corrected.parserResult.name).toBe('apfel');
      expect(corrected.parserResult.quantityCount).toBe(1);
    });

    it('OLD boundary result differs from the corrected (current) result', async () => {
      const { resolver: resolverForOld } = buildVariantAResolver();
      const { resolver: resolverForNew } = buildVariantAResolver();
      const old = await runOldBenchmarkBoundary(resolverForOld, targetScenario!.case.rawInput);
      const corrected = await runVariantACase(targetScenario!.case, resolverForNew);

      expect(old.query.normalized).not.toBe(corrected.query.normalized);
      expect(old.decision.status).not.toBe(corrected.decision.status);
    });

    it('OLD boundary was a false accept (spurious substring collision); corrected boundary is honest ambiguity, not the historical false acceptance', async () => {
      const { resolver: resolverForOld } = buildVariantAResolver();
      const { resolver: resolverForNew } = buildVariantAResolver();
      const old = await runOldBenchmarkBoundary(resolverForOld, targetScenario!.case.rawInput);
      const corrected = await runVariantACase(targetScenario!.case, resolverForNew);

      // The historical false acceptance: "ein apfel" is a substring of the normalized name of a
      // real, unrelated BLS pastry record ("Apfelküchlein (Apfelringe im Milchbackteig) gebraten",
      // sourceId Y845242) -- "...kuechl[ein] [apfel]ringe..." -- which the OLD boundary's raw
      // article-prefixed query spuriously collided with via BlsLookupEngine's includes-match stage.
      expect(old.decision.status).toBe('accepted');
      expect(old.decision.best?.food.sourceId).toBe('Y845242');
      expect(old.decision.best?.food.sourceId).not.toBe('F110100'); // real "Apfel roh" sourceId

      // The corrected boundary matches production: an honest ambiguous result, never a silent
      // false accept -- production never sends "ein apfel" to the resolver in the first place.
      expect(corrected.decision.status).toBe('ambiguous');
    });
  });

  describe('quantity/count-prefixed inputs strip the prefix before resolver dispatch', () => {
    const parser = new DeterministicFoodParser();

    it.each([
      ['200g Brötchen', 'broetchen'],
      ['Ein Brötchen', 'broetchen'],
      ['2x Apfel', 'apfel'],
      ['zwei Äpfel', 'aepfel'],
      // "another real count/unit input confirmed from current parser tests"
      // (DeterministicFoodParser.test.ts's "Deutsche Zahlwörter" suite: 'sieben brötchen').
      ['sieben brötchen', 'broetchen'],
    ])(
      'corrected boundary for %s normalizes to the parsed name "%s", not the raw article/quantity-prefixed string',
      async (rawInput, expectedNormalized) => {
        const { resolver } = buildVariantAResolver();

        const old = await runOldBenchmarkBoundary(resolver, rawInput);
        const corrected = await runVariantACase(caseFor(rawInput), resolver);

        // OLD boundary retained the quantity/article prefix inside the resolver query.
        expect(old.query.normalized).not.toBe(expectedNormalized);
        expect(old.query.normalized.startsWith(normalizeText(rawInput).split(' ')[0])).toBe(true);

        // Corrected boundary sends exactly the parsed, prefix-stripped, normalized name.
        expect(corrected.query.normalized).toBe(expectedNormalized);
        expect(corrected.query.normalized).toBe(normalizeText(parser.parse(rawInput).name));

        // `raw` field (production's `FoodSearchQuery.raw`) is always the ORIGINAL unparsed input,
        // in both boundaries and in production -- this must never change.
        expect(corrected.query.raw).toBe(rawInput);
        expect(corrected.originalRawInput).toBe(rawInput);
      },
    );
  });

  describe('no-op controls: inputs without a removable prefix are unchanged', () => {
    it.each([
      ['bare generic food', 'Reis'],
      ['qualified preparation food', 'Brötchen (Blätterteig)'],
      ['branded input', 'Milka Schokolade'],
      ['ambiguous input', 'Speck'],
      ['malformed/nonsensical input', 'ApfelApfelApfel!!!123'],
    ])(
      '%s ("%s"): boundary and decision are byte-identical old vs. corrected',
      async (_label, rawInput) => {
        const { resolver: resolverForOld } = buildVariantAResolver();
        const { resolver: resolverForNew } = buildVariantAResolver();
        const old = await runOldBenchmarkBoundary(resolverForOld, rawInput);
        const corrected = await runVariantACase(caseFor(rawInput), resolverForNew);

        expect(corrected.query.normalized).toBe(old.query.normalized);
        expect(corrected.query.raw).toBe(old.query.raw);
        expect(corrected.query.inputType).toBe(old.query.inputType);
        expect(corrected.decision.status).toBe(old.decision.status);
        expect(corrected.decision.best?.food.sourceId).toBe(old.decision.best?.food.sourceId);
      },
    );
  });
});
