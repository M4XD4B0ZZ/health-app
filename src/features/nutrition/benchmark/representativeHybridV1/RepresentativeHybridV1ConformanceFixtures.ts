import {
  AI_INTERPRETATION_CONTRACT_VERSION,
  NoopAiInterpretationProvider,
  type AiInterpretationProvider,
} from '../../application/ports/AiInterpretationProvider';
import type {
  AiInterpretationRequest,
  AiInterpretationResult,
  ComponentSearchPlan,
  InterpretedFoodComponent,
} from '../../domain/models/AiInterpretationTypes';
import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import { FixtureVariantBProvider, NoopVariantBProvider } from '../ResolverV3VariantBAdapter';
import { FixtureCostAiInterpreter } from '../ResolverV3VariantCAdapter';
import type { RepresentativeHybridV1RunnerDependencies } from './RepresentativeHybridV1ThreeArmRunner';

/**
 * RESOLVER-V3-038 harness-conformance fixture set (requirement 19). Deliberately SEPARATE from the
 * representative evaluation corpus (`RepresentativeHybridV1Manifest.ts`) and NEVER included in its
 * quality metrics -- these six cases exist only to prove the harness plumbing works (every
 * provider/result branch, multi-component search planning, clarification, abstention,
 * invalid/unavailable responses, source retrieval + deterministic calculation, report
 * reproducibility), not to produce representative live-quality evidence. Any result computed from
 * this fixture set MUST be reported under a `fixtureOnly: true` label (requirement 19/32) and must
 * never be presented as live Hybrid C quality evidence.
 */

const CONFORMANCE_CORPUS_VERSION = '1.0.0';

function baseCase(
  overrides: Partial<BenchmarkCase> & Pick<BenchmarkCase, 'caseId'>,
): BenchmarkCase {
  const defaults: BenchmarkCase = {
    caseId: overrides.caseId,
    corpusVersion: CONFORMANCE_CORPUS_VERSION,
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: overrides.caseId,
    locale: 'de',
    expectedComponents: [],
    groundTruthSource: 'no_numeric_ground_truth',
    referenceNutrients: null,
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'Harness-conformance fixture, not representative-quality evidence.',
    personalDataFree: true,
  };
  return { ...defaults, ...overrides };
}

/** Multi-component search planning + deterministic calculation: one BLS component (Reis) and one
 * committed-snapshot 'off' component (Nutella) -- proves the harness actually executes every
 * component's plan and sums deterministically, not just the first. */
export const CONFORMANCE_MULTI_COMPONENT: BenchmarkCase = baseCase({
  caseId: 'RH-CONF-MULTI-COMPONENT',
  category: 'COMPOSED',
  rawInput: '100g Reis mit einem Löffel Nutella',
  expectedComponents: [
    {
      componentId: 'c1',
      expectedName: 'Reis poliert, roh',
      required: true,
      expectedSourceId: 'C352000',
      expectedSourceType: 'bls',
    },
    {
      componentId: 'c2',
      expectedName: 'Nutella',
      required: true,
      expectedSourceId: 'manufacturer-label-nutella-v1',
      expectedSourceType: 'off',
    },
  ],
  groundTruthSource: 'documented_recipe',
  groundTruthProvenance: 'Conformance fixture only -- not a representative-quality case.',
  referenceNutrients: { kcal: 366.9, protein_g: 8.559, fat_g: 4.775, carbs_g: 88.65 },
  expectedBehavior: 'direct_resolution',
});

export const CONFORMANCE_CLARIFICATION: BenchmarkCase = baseCase({
  caseId: 'RH-CONF-CLARIFICATION',
  category: 'VAGUE',
  rawInput: 'Etwas mit Käse',
  expectedBehavior: 'clarification_required',
  expectedClarificationKind: 'ambiguous_food_identity',
});

export const CONFORMANCE_ABSTENTION: BenchmarkCase = baseCase({
  caseId: 'RH-CONF-ABSTENTION',
  category: 'UNRELIABLE',
  rawInput: 'xqzflarb',
  expectedBehavior: 'abstention_expected',
});

export const CONFORMANCE_INVALID_RESPONSE: BenchmarkCase = baseCase({
  caseId: 'RH-CONF-INVALID-RESPONSE',
  category: 'SIMPLE',
  rawInput: 'Ein Konformitätstest ohne hinterlegte Fixture-Antwort',
});

export const CONFORMANCE_ERROR: BenchmarkCase = baseCase({
  caseId: 'RH-CONF-ERROR',
  category: 'SIMPLE',
  rawInput: 'Ein Konformitätstest, der einen technischen Fehler simuliert',
});

export const CONFORMANCE_SOURCE_RETRIEVAL: BenchmarkCase = baseCase({
  caseId: 'RH-CONF-SOURCE-RETRIEVAL',
  category: 'SIMPLE',
  rawInput: 'Apfel',
  expectedComponents: [
    {
      componentId: 'c1',
      expectedName: 'Apfel roh',
      required: true,
      expectedSourceId: 'F110100',
      expectedSourceType: 'bls',
    },
  ],
  groundTruthSource: 'bls_generic',
  groundTruthProvenance: 'Conformance fixture only -- not a representative-quality case.',
  referenceNutrients: { kcal: 58, protein_g: 0.424, fat_g: 0.5, carbs_g: 11.7 },
});

export const REPRESENTATIVE_HYBRID_V1_CONFORMANCE_CASES: readonly BenchmarkCase[] = [
  CONFORMANCE_MULTI_COMPONENT,
  CONFORMANCE_CLARIFICATION,
  CONFORMANCE_ABSTENTION,
  CONFORMANCE_INVALID_RESPONSE,
  CONFORMANCE_ERROR,
  CONFORMANCE_SOURCE_RETRIEVAL,
];

function interpretationResult(input: {
  outcome: 'interpreted' | 'interpreted_with_assumptions';
  components: InterpretedFoodComponent[];
  searchPlan: ComponentSearchPlan[];
}): AiInterpretationResult {
  return {
    outcome: input.outcome,
    components: input.components,
    searchPlan: input.searchPlan,
    meta: {
      contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
      interpreterVersion: 'representative-hybrid-v1-conformance-fixture-v1',
      latencyMs: 0,
      executionStatus: 'completed',
    },
  };
}

/** Deterministic, no-I/O AI-interpretation fixture keyed by `caseId`, exercising every C-arm
 * result branch (interpreted, clarification_required, not_interpretable). Falls back to the real
 * `NoopAiInterpretationProvider` (`unavailable`) for any case not in the table -- proves the
 * "invalid/unavailable" branch honestly rather than fabricating one. */
export class RepresentativeHybridV1ConformanceAiInterpretationProvider implements AiInterpretationProvider {
  private readonly noop = new NoopAiInterpretationProvider();

  async interpret(request: AiInterpretationRequest): Promise<AiInterpretationResult> {
    const caseId = request.traceId?.split(':')[1];

    if (caseId === CONFORMANCE_MULTI_COMPONENT.caseId) {
      return interpretationResult({
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Reis',
            interpretedName: 'Reis',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.9,
          },
          {
            id: 'c2',
            originalSegment: 'Nutella',
            interpretedName: 'Nutella',
            quantity: { value: 15, unit: 'g' },
            confidence: 0.85,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'reis roh' }],
            expectedResolutionKind: 'generic_food',
          },
          {
            componentId: 'c2',
            suitableSourceTypes: ['off'],
            nativeQueries: [{ sourceType: 'off', query: 'nutella' }],
            expectedResolutionKind: 'branded_product',
          },
        ],
      });
    }

    if (caseId === CONFORMANCE_CLARIFICATION.caseId) {
      return {
        outcome: 'clarification_required',
        components: [
          {
            id: 'c1',
            originalSegment: 'Käse',
            interpretedName: 'Käse',
            quantity: {},
            confidence: 0.3,
          },
        ],
        clarification: {
          componentId: 'c1',
          missingInformation: 'Käsesorte',
          clarificationKind: 'ambiguous_food_identity',
        },
        meta: {
          contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
          interpreterVersion: 'representative-hybrid-v1-conformance-fixture-v1',
          latencyMs: 0,
          executionStatus: 'completed',
        },
      };
    }

    if (caseId === CONFORMANCE_ABSTENTION.caseId) {
      return {
        outcome: 'not_interpretable',
        reason: 'Conformance fixture: gibberish input, deliberately not interpretable.',
        meta: {
          contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
          interpreterVersion: 'representative-hybrid-v1-conformance-fixture-v1',
          latencyMs: 0,
          executionStatus: 'completed',
        },
      };
    }

    if (caseId === CONFORMANCE_ERROR.caseId) {
      return {
        outcome: 'error',
        message: 'Conformance fixture: simulated technical failure.',
        meta: {
          contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
          interpreterVersion: 'representative-hybrid-v1-conformance-fixture-v1',
          latencyMs: 0,
          executionStatus: 'failed',
        },
      };
    }

    if (caseId === CONFORMANCE_SOURCE_RETRIEVAL.caseId) {
      return interpretationResult({
        outcome: 'interpreted',
        components: [
          {
            id: 'c1',
            originalSegment: 'Apfel',
            interpretedName: 'Apfel',
            quantity: { value: 100, unit: 'g' },
            confidence: 0.9,
          },
        ],
        searchPlan: [
          {
            componentId: 'c1',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: 'apfel roh' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
      });
    }

    // RH-CONF-INVALID-RESPONSE and any unregistered case: honest `unavailable`, never a fabricated
    // plausible-looking interpretation.
    return this.noop.interpret(request);
  }
}

/** Conformance-only Variant B raw responses -- deliberately includes NO entry for
 * `RH-CONF-INVALID-RESPONSE` (proves the invalid/unavailable branch) and uses `NoopVariantBProvider`
 * for `RH-CONF-ERROR` at the call site instead of a raw-text fixture (proves the technical-error
 * branch honestly). */
export const REPRESENTATIVE_HYBRID_V1_CONFORMANCE_VARIANT_B_RESPONSES: Readonly<
  Record<string, string>
> = {
  'RH-CONF-MULTI-COMPONENT': JSON.stringify({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Reis',
        quantity: { value: 100, unit: 'g' },
        kcal: 351,
        protein_g: 7.9,
        fat_g: 0.6,
        carbs_g: 77.1,
        assumptions: [],
        uncertainties: [],
        confidence: 0.8,
      },
      {
        componentId: 'c2',
        name: 'Nutella',
        quantity: { value: 15, unit: 'g' },
        kcal: 81,
        protein_g: 0.9,
        fat_g: 4.6,
        carbs_g: 8.6,
        assumptions: [],
        uncertainties: [],
        confidence: 0.8,
      },
    ],
    totals: { kcal: 432, protein_g: 8.8, fat_g: 5.2, carbs_g: 85.7 },
    overallConfidence: 0.8,
    assumptions: [],
    uncertainties: [],
  }),
  'RH-CONF-CLARIFICATION': JSON.stringify({
    outcome: 'clarification_required',
    components: [
      {
        componentId: 'c1',
        name: 'Käse',
        quantity: {},
        assumptions: [],
        uncertainties: [],
        confidence: 0.3,
      },
    ],
    clarification: {
      componentId: 'c1',
      missingInformation: 'Käsesorte',
      clarificationKind: 'ambiguous_food_identity',
    },
  }),
  'RH-CONF-ABSTENTION': JSON.stringify({
    outcome: 'abstained',
    components: [],
    reason: 'Conformance fixture: gibberish input.',
  }),
  'RH-CONF-SOURCE-RETRIEVAL': JSON.stringify({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Apfel',
        quantity: { value: 100, unit: 'g' },
        kcal: 58,
        protein_g: 0.4,
        fat_g: 0.5,
        carbs_g: 11.7,
        assumptions: [],
        uncertainties: [],
        confidence: 0.9,
      },
    ],
    totals: { kcal: 58, protein_g: 0.4, fat_g: 0.5, carbs_g: 11.7 },
    overallConfidence: 0.9,
    assumptions: [],
    uncertainties: [],
  }),
};

/** Builds the exact `RepresentativeHybridV1RunnerDependencies` for a harness-conformance run --
 * always fixture-mode, always zero-network. Every case not explicitly covered above honestly
 * exercises the "no fixture recorded" branch rather than silently falling back to a plausible guess
 * (requirement 19/64: "missing injected fixture response fails closed", "no silent fixture
 * fallback"). */
export function buildRepresentativeHybridV1ConformanceDependencies(): RepresentativeHybridV1RunnerDependencies {
  return {
    variantBProvider: new FixtureVariantBProvider(
      REPRESENTATIVE_HYBRID_V1_CONFORMANCE_VARIANT_B_RESPONSES,
    ),
    variantCAiInterpreter: new FixtureCostAiInterpreter(
      new RepresentativeHybridV1ConformanceAiInterpretationProvider(),
    ),
  };
}

/** Dependencies for the `RH-CONF-ERROR` case specifically -- uses `NoopVariantBProvider` (reports a
 * technical `error`, not `invalid_response`) instead of the shared fixture-response table, so both
 * distinct B-arm failure branches are exercised across the conformance set. */
export function buildRepresentativeHybridV1ConformanceErrorDependencies(): RepresentativeHybridV1RunnerDependencies {
  return {
    variantBProvider: new NoopVariantBProvider(),
    variantCAiInterpreter: new FixtureCostAiInterpreter(
      new RepresentativeHybridV1ConformanceAiInterpretationProvider(),
    ),
  };
}
