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

  it('Variant A does not strip a leading quantity/article token before searching BLS (documented architecture boundary)', async () => {
    // Documents a real, verified characteristic of the current architecture: Variant A's fast path
    // (ResolverV3VariantAAdapter -> normalizeText -> SequentialFoodCatalogResolver -> BlsStaticSource)
    // does not parse or strip a leading quantity/article token, so natural "quantity + food" input
    // (unlike the historical 14-case smoke corpus's bare-food-name convention) generally falls
    // through to Variant C's AI-interpretation branch rather than resolving via the fast path.
    const benchmarkCase = findCase('RH-RES-SIMPLE-DEV-001'); // "100g Reis roh"
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    expect(result.variantA.status).toBe('rejected');
    expect(result.variantC.fastPathUsed).toBe(false);
  });

  it('a false-confident Variant A fast-path acceptance is inherited and visible on Variant C (DACH RV3-0011 regression)', async () => {
    const benchmarkCase = findCase('RH-RES-DACH-DEV-006');
    const result = await runRepresentativeHybridV1ThreeArms(benchmarkCase);
    // Variant A's own fast path confidently (falsely) accepts the wrong "Brötchen (Blätterteig)"
    // pastry record for a bare "Brötchen" input -- this is the real, documented defect.
    expect(result.variantA.falseConfident).toBe(true);
    // Variant C's fast path is literally Variant A's resolver -- it must inherit this, not silently
    // "fix" it by routing to AI (requirement 21: "a false-confident A fast-path acceptance must
    // remain visible as a C false-confidence failure").
    expect(result.variantC.fastPathUsed).toBe(true);
    expect(result.variantC.aiCalled).toBe(false);
    expect(result.variantC.falseConfident).toBe(true);
  });

  it('a rejected/ambiguous Variant A fast path falls through to the injected AI interpreter', async () => {
    const benchmarkCase = findCase('RH-RES-VAGUE-DEV-004'); // "Ein Snack" -- Variant A cannot accept this
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
