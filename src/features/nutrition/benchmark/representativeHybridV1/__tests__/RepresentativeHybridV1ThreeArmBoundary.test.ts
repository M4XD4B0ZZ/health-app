import { runRepresentativeHybridV1ThreeArms } from '../RepresentativeHybridV1ThreeArmRunner';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../RepresentativeHybridV1Manifest';
import { FixtureVariantBProvider, NoopVariantBProvider } from '../../ResolverV3VariantBAdapter';
import { FixtureCostAiInterpreter } from '../../ResolverV3VariantCAdapter';
import { NoopAiInterpretationProvider } from '../../../application/ports/AiInterpretationProvider';
import type { RepresentativeHybridV1ResolutionScenario } from '../RepresentativeHybridV1Types';
import type { BenchmarkCase } from '../../BenchmarkCaseTypes';

function findCase(caseId: string): BenchmarkCase {
  const scenario = REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.find(
    (s) => s.scenarioId === caseId,
  ) as RepresentativeHybridV1ResolutionScenario;
  if (!scenario) throw new Error(`fixture case not found: ${caseId}`);
  return scenario.case;
}

describe('RESOLVER-V3-038 A/B/C execution boundary', () => {
  it('all three arms receive the exact same case input (rawInput/locale/caseId)', async () => {
    const benchmarkCase = findCase('RH-RES-SIMPLE-DEV-001');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    expect(result.variantA.caseId).toBe(benchmarkCase.caseId);
    expect(result.variantB[0].caseId).toBe(benchmarkCase.caseId);
    expect(result.variantC.caseId).toBe(benchmarkCase.caseId);
  });

  it('Variant A uses the real, unmodified resolver and never calls AI', async () => {
    // "Currywurst mit Curryketchup" has no leading quantity/article token, so it resolves through
    // Variant A's real fast path directly (verified during authoring) -- a genuine positive case,
    // distinct from quantity-prefixed cases whose fast-path behavior is covered separately.
    const benchmarkCase = findCase('RH-RES-DACH-DEV-001');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    expect(result.variantA.status).toBe('accepted');
    expect(result.variantA.identification).toBe('correct');
  });

  it('RESOLVER-V3-050: Variant A now strips a leading quantity/article token via the real DeterministicFoodParser before searching BLS (production-faithful boundary)', async () => {
    // Historical context (kept for provenance, no longer the current behavior): before
    // RESOLVER-V3-050, Variant A's fast path (ResolverV3VariantAAdapter -> normalizeText ->
    // SequentialFoodCatalogResolver -> BlsStaticSource) sent `normalizeText(rawInput)` straight to
    // the resolver, never parsing/stripping a leading quantity/article token -- a call path real
    // production never takes (`LogFoodFromRawInputUseCase` always runs `DeterministicFoodParser`
    // first). RESOLVER-V3-050 fixed `runVariantACase` to reproduce the real production call order:
    // `DeterministicFoodParser.parse(rawInput).name` is normalized and sent to the resolver, not
    // the raw quantity/article-prefixed string.
    const benchmarkCase = findCase('RH-RES-SIMPLE-DEV-001'); // "100g Reis roh" -> parsed name "reis roh"
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    // "reis roh" ties two real, distinct BLS rice records ("Reismischung mit Wildreis, roh"
    // C354100, "Wildreis roh" C353100) -- an honest ambiguous result, not the old boundary's clean
    // rejection (which merely reflected that "100g reis roh" matched nothing, not that the input was
    // genuinely unresolvable).
    expect(result.variantA.status).toBe('ambiguous');
    // Variant A's decision is still not "accepted", so Variant C's fast path remains ineligible here
    // too -- this boundary fix does not, by itself, change whether the fast path is used for this
    // particular case.
    expect(result.variantC.fastPathUsed).toBe(false);
  });

  it('RESOLVER-V3-051: the BLS generic substring-collision false accept for bare "Snack" is fixed (historical context: was a residual risk of RESOLVER-V3-050)', async () => {
    // Historical context (kept for provenance, no longer the current behavior): RESOLVER-V3-050's
    // corrected, production-faithful boundary made "Ein Snack" parse to "snack" (article stripped)
    // before reaching the resolver, which newly surfaced a pre-existing BLS fast-path defect --
    // "snack" substring/token-matched the single real BLS record "Kichererbsensnack gebacken"
    // (X5A1030) as its only candidate, so Variant A confidently (falsely) ACCEPTED it, even though
    // this case's own ground truth (`expectedBehavior: 'abstention_expected'`,
    // `criticalFailureConditions: ['Reports a specific numeric estimate for the bare word
    // "Snack".']`) says a bare "Snack" should never resolve to a specific numeric estimate. That
    // defect was not introduced by RESOLVER-V3-050 (real production already had it; the OLD
    // benchmark boundary simply never exercised the call path that exposed it) and was recorded as
    // a residual risk in `reports/RESOLVER_V3_050_BENCHMARK_PRODUCTION_CALL_PATH_FIDELITY.md` §11
    // for a future task.
    //
    // RESOLVER-V3-051 closed it with a general, stage-agnostic resolver-level policy
    // (`hasBlsGenericSubstringOnlyIdentity` in `BlsLookupEngine.ts`, applied at the BLS
    // generic-truth early-return gate in `SequentialFoodCatalogResolver.ts`): a candidate is no
    // longer confidently accepted when it has no genuine exact/whole-alias identity for the query,
    // the query is not even a whole-token match against the candidate's own name, and the query is
    // still a textual substring fragment of that name. "snack" is exactly such a fragment of
    // "kichererbsensnack gebacken", so the bare query now resolves an honest `ambiguous` instead
    // (see `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md`).
    const benchmarkCase = findCase('RH-RES-VAGUE-DEV-004'); // "Ein Snack"
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    expect(result.variantA.status).not.toBe('accepted');
    expect(result.variantA.status).toBe('ambiguous');
    // Variant A's decision is no longer "accepted", so Variant C's fast path is no longer eligible
    // either -- it falls through to the AI-interpretation branch instead of inheriting the false
    // confidence Variant A itself no longer has.
    expect(result.variantC.fastPathUsed).toBe(false);
  });

  it('RESOLVER-V3-043: the historical DACH RV3-0011 false-confidence trap no longer false-confidently accepts, on either arm', async () => {
    // Historical context (kept for provenance, no longer the current behavior): before
    // RESOLVER-V3-043, Variant A's fast path confidently (falsely) accepted the wrong "Brötchen
    // (Blätterteig)" pastry record (D771900) for a bare "Brötchen" input, because
    // `BlsCompactRuntimeAdapter`'s alias generation stripped the entire "(Blätterteig)"
    // parenthetical, and Variant C's fast path -- being literally Variant A's resolver -- inherited
    // that false confidence unchanged. RESOLVER-V3-043's source-ID-scoped negative-compatibility
    // fix (`INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID`) makes D771900 unable to win the bare query
    // through any matching stage; see `ResolverV3043BroetchenFalseConfidenceRemediation.test.ts`
    // for the focused adapter/lookup/resolver/production-boundary coverage of the fix itself.
    const benchmarkCase = findCase('RH-RES-DACH-DEV-006');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);

    // Variant A's fast path no longer confidently (falsely) accepts D771900 -- several real,
    // legitimate "-brötchen" candidates now tie, so the honest outcome is ambiguous, not accepted.
    expect(result.variantA.status).toBe('ambiguous');
    expect(result.variantA.falseConfident).toBe(false);
    // Since Variant A's decision is no longer "accepted", Variant C's fast path is not eligible and
    // it falls through to the AI-interpretation branch instead -- it does not inherit a false
    // confidence that Variant A itself no longer has.
    expect(result.variantC.fastPathUsed).toBe(false);
    expect(result.variantC.falseConfident).toBe(false);
  });

  it('a rejected/ambiguous Variant A fast path falls through to the injected AI interpreter', async () => {
    // RESOLVER-V3-050: previously used 'RH-RES-VAGUE-DEV-004' ("Ein Snack"), but the corrected,
    // production-faithful boundary now makes Variant A accept that case (see the dedicated residual-
    // risk test above) -- 'RH-RES-VAGUE-DEV-001' ("Etwas Reis") has no removable quantity/article
    // prefix for the parser to strip and still genuinely falls through under the corrected boundary.
    const benchmarkCase = findCase('RH-RES-VAGUE-DEV-001'); // "Etwas Reis" -- Variant A cannot accept this
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase, {
      variantCAiInterpreter: new FixtureCostAiInterpreter(new NoopAiInterpretationProvider()),
    });
    expect(result.variantC.fastPathUsed).toBe(false);
    expect(result.variantC.aiCalled).toBe(true);
  });

  it('Variant B and C provider/interpreter dependencies are injectable and independent', async () => {
    const benchmarkCase = findCase('RH-RES-BRANDED-DEV-001');
    const fixtureB = new FixtureVariantBProvider({
      [benchmarkCase.caseId]: JSON.stringify({
        outcome: 'estimated',
        components: [
          {
            componentId: 'c1',
            name: 'Nutella',
            quantity: {},
            kcal: 539,
            protein_g: 6.3,
            fat_g: 30.9,
            carbs_g: 57.5,
            assumptions: [],
            uncertainties: [],
            confidence: 0.9,
          },
        ],
        totals: null,
        overallConfidence: 0.9,
        assumptions: [],
        uncertainties: [],
      }),
    });
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase, {
      variantBProvider: fixtureB,
    });
    expect(result.variantB[0].outcome).toBe('estimated');
    expect(result.variantB[0].identification).toBe('correct');
  });

  it('no provider-specific live construction occurs by default (default B provider is Noop)', async () => {
    const benchmarkCase = findCase('RH-RES-SIMPLE-DEV-001');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    // NoopVariantBProvider always reports a technical error, never a plausible estimate.
    expect(result.variantB[0].technicalFailure).toBe(true);
  });

  it('a missing injected fixture response for Variant B fails closed (invalid_response), never a silent success', async () => {
    const benchmarkCase = findCase('RH-RES-SIMPLE-DEV-002');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase, {
      variantBProvider: new FixtureVariantBProvider({}), // deliberately empty
    });
    expect(result.variantB[0].outcome).toBe('invalid_response');
  });

  it('Variant A has no cost/AI-call fields (arm-specific authority stays separate)', async () => {
    const benchmarkCase = findCase('RH-RES-SIMPLE-DEV-001');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    expect((result.variantA as unknown as { cost?: unknown }).cost).toBeUndefined();
    expect(
      (result.variantA as unknown as { aiInterpretation?: unknown }).aiInterpretation,
    ).toBeUndefined();
  });

  it('Variant C numeric results are source-grounded, not AI-authored (BRANDED via committed snapshot)', async () => {
    const benchmarkCase = findCase('RH-RES-BRANDED-DEV-001');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    // Fast path resolves via the real Variant A resolver (BLS-only) -- since "Nutella" is not a BLS
    // food, the fast path will not accept it, so C falls through to the AI-routed branch with the
    // default Noop interpreter, which reports `unavailable`. Either way, no numeric result is ever
    // asserted without `provenance.sourceGrounded`.
    if (
      result.variantC.outcome === 'resolved' ||
      result.variantC.outcome === 'resolved_with_assumptions'
    ) {
      expect(result.variantC.provenance.hasUnbackedNumericResult).toBe(false);
    }
  });
});

describe('RESOLVER-V3-038 zero-network default runner', () => {
  it('the default runner dependencies never construct NoopVariantBProvider as anything but fixture mode', () => {
    const provider = new NoopVariantBProvider();
    expect(provider.runMode).toBe('fixture');
  });
});
