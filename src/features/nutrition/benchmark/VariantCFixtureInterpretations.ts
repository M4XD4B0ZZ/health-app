import {
  AiInterpretationProvider,
  AI_INTERPRETATION_CONTRACT_VERSION,
} from '../application/ports/AiInterpretationProvider';
import {
  AiInterpretationRequest,
  AiInterpretationResult,
} from '../domain/models/AiInterpretationTypes';

/**
 * RESOLVER-V3-005: deterministic, network-free, cost-free fixture `AiInterpretationResult`s for
 * the shared RESOLVER-V3-003 smoke corpus's AI-routed cases (the ones where Variant A's own fast
 * path did NOT return `status: 'accepted'` -- see `resolverV3VariantASmokeCorpus.ts`'s own
 * `reproducibilityNotes` per case for which those are). Mirrors RESOLVER-V3-004's
 * `variantBFixtureResponses.ts` precedent: hand-authored, mixed-quality-by-design, never copying
 * a ground-truth ID/value verbatim into what represents an independent (simulated) AI read.
 *
 * These fixtures are NOT real AI-quality evidence (fixture-mode banner in the Markdown report
 * makes this explicit) -- they exist to exercise the harness's search-plan-execution/retrieval/
 * ranking/decision/quantity-scaling pipeline deterministically. Several are DELIBERATELY not
 * "wins": RV3-0013 (Spätzle) is authored with a domain-precise native query that plausibly breaks
 * an existing score tie (a real, honestly-reported possible improvement over Variant A), while
 * RV3-0014 (Zwiebelrostbraten) is authored to still correctly abstain (BLS genuinely has no entry
 * for this compound DACH dish name) -- neither is manufactured to guarantee a particular result;
 * the actual harness run (not this file) determines what really happens.
 */

function interpreted(input: {
  caseId: string;
  componentId: string;
  originalSegment: string;
  interpretedName: string;
  quantityValue?: number;
  nativeQuery: string;
  confidence: number;
  assumptions?: string[];
  uncertainties?: string[];
  withAssumptions?: boolean;
}): AiInterpretationResult {
  return {
    outcome: input.withAssumptions ? 'interpreted_with_assumptions' : 'interpreted',
    components: [
      {
        id: input.componentId,
        originalSegment: input.originalSegment,
        interpretedName: input.interpretedName,
        quantity:
          input.quantityValue !== undefined ? { value: input.quantityValue, unit: 'g' } : {},
        confidence: input.confidence,
        assumptions: input.assumptions,
        uncertainties: input.uncertainties,
      },
    ],
    searchPlan: [
      {
        componentId: input.componentId,
        suitableSourceTypes: ['bls'],
        nativeQueries: [{ sourceType: 'bls', query: input.nativeQuery }],
        expectedResolutionKind: 'generic_food',
      },
    ],
    meta: {
      contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
      interpreterVersion: 'variant-c-fixture-v1',
      latencyMs: 0,
      executionStatus: 'completed',
    },
  };
}

export const VARIANT_C_FIXTURE_INTERPRETATIONS: Readonly<Record<string, AiInterpretationResult>> = {
  // RV3-0007 Himbeeren -- Variant A already picks the right top-1 but flags "ambiguous" due to a
  // tied ScoreCalculator score; the AI stage repeats the same generic-food read (no engineered win).
  'RV3-0007': interpreted({
    caseId: 'RV3-0007',
    componentId: 'c1',
    originalSegment: 'Himbeeren',
    interpretedName: 'Himbeere',
    quantityValue: 100,
    nativeQuery: 'himbeere roh',
    confidence: 0.85,
  }),

  // RV3-0008 Speck -- the AI recognizes the genuine three-way BLS ambiguity itself and asks a
  // targeted clarification WITHOUT running retrieval at all (test requirement #3).
  'RV3-0008': {
    outcome: 'clarification_required',
    components: [
      {
        id: 'c1',
        originalSegment: 'Speck',
        interpretedName: 'Speck',
        quantity: {},
        confidence: 0.35,
        uncertainties: [
          'Speck ist mehrdeutig zwischen Bauchspeck/Bacon, Rückenspeck/Fettspeck und Schinkenspeck',
        ],
      },
    ],
    clarification: {
      componentId: 'c1',
      missingInformation: 'Art des Specks (Bauch-, Rücken- oder Schinkenspeck)',
      clarificationKind: 'ambiguous_food_identity',
    },
    meta: {
      contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
      interpreterVersion: 'variant-c-fixture-v1',
      latencyMs: 0,
      executionStatus: 'completed',
    },
  },

  // RV3-0009 Tomate -- Variant A's known defect selects the composite "Tomate-Mozzarella" dish. A
  // more specific "roh" query is a plausible, honest attempt to disambiguate toward the plain
  // vegetable -- whether it actually does is left to the real harness run, not asserted here.
  'RV3-0009': interpreted({
    caseId: 'RV3-0009',
    componentId: 'c1',
    originalSegment: 'Tomate',
    interpretedName: 'Tomate',
    quantityValue: 100,
    nativeQuery: 'tomate roh',
    confidence: 0.8,
    assumptions: ['Rohe, unverarbeitete Tomate angenommen (kein Gericht)'],
  }),

  // RV3-0010 Gurke -- same pattern as Tomate: Variant A's known defect selects a derived juice
  // product; the AI plans a "roh" query as a plausible disambiguation attempt.
  'RV3-0010': interpreted({
    caseId: 'RV3-0010',
    componentId: 'c1',
    originalSegment: 'Gurke',
    interpretedName: 'Gurke',
    quantityValue: 100,
    nativeQuery: 'gurke roh',
    confidence: 0.8,
    assumptions: ['Rohe, unverarbeitete Gurke angenommen (kein Derivat wie Saft)'],
  }),

  // RV3-0012 Reis -- two legitimate BLS records exist (spec: acceptable canonical equivalence);
  // the AI's own read does not resolve that ambiguity, matching the case's own expected behavior.
  'RV3-0012': interpreted({
    caseId: 'RV3-0012',
    componentId: 'c1',
    originalSegment: 'Reis',
    interpretedName: 'Reis',
    quantityValue: 100,
    nativeQuery: 'reis roh',
    confidence: 0.8,
  }),

  // RV3-0013 Spätzle -- Variant A already picks the correct top-1 egg-noodle record but flags
  // "ambiguous" due to tied scores among 3 BLS candidates; the AI supplies the more precise BLS
  // canonical name as its native query, which plausibly breaks the tie via ScoreCalculator's
  // exact/prefix-match bonuses -- reported as a real (not guaranteed) possible improvement.
  'RV3-0013': interpreted({
    caseId: 'RV3-0013',
    componentId: 'c1',
    originalSegment: 'Spätzle',
    interpretedName: 'Spätzle',
    quantityValue: 100,
    nativeQuery: 'eier-frischteigwaren spätzle selbstgemacht roh',
    confidence: 0.75,
    withAssumptions: true,
    assumptions: ['Einfache Eiernudel-Spätzle angenommen (nicht Leberspätzle o.ä.)'],
  }),

  // RV3-0014 Zwiebelrostbraten -- a genuine DACH regional dish name BLS has no entry for (Variant
  // A itself returns NO_CANDIDATES here). The AI recognizes it cannot ground this in a single
  // generic BLS lookup and does not fabricate a number -- searching still correctly finds nothing,
  // producing an honest `abstained` meal outcome rather than a false-confident number.
  'RV3-0014': interpreted({
    caseId: 'RV3-0014',
    componentId: 'c1',
    originalSegment: 'Zwiebelrostbraten',
    interpretedName: 'Zwiebelrostbraten',
    nativeQuery: 'zwiebelrostbraten',
    confidence: 0.4,
    withAssumptions: true,
    uncertainties: [
      'Zwiebelrostbraten ist ein zusammengesetztes DACH-Regionalgericht ohne generischen BLS-Eintrag',
    ],
  }),
};

/**
 * Deterministic, no-I/O test double keyed by `caseId` -- mirrors `FixtureFoodCatalogSource`
 * (RESOLVER-V3-003) and `FixtureVariantBProvider` (RESOLVER-V3-004)'s declarative, table-driven
 * pattern. Falls back to `NoopAiInterpretationProvider`-equivalent `unavailable` behavior for any
 * case not present in the table, so an incomplete fixture table never silently produces a
 * plausible-looking result.
 */
export class FixtureAiInterpretationProvider implements AiInterpretationProvider {
  constructor(
    private readonly resultsByCaseId: Readonly<
      Record<string, AiInterpretationResult>
    > = VARIANT_C_FIXTURE_INTERPRETATIONS,
  ) {}

  async interpret(request: AiInterpretationRequest): Promise<AiInterpretationResult> {
    const caseId = request.traceId?.split(':')[1];
    const fixture = caseId ? this.resultsByCaseId[caseId] : undefined;
    if (fixture) {
      return { ...fixture, meta: { ...fixture.meta, traceId: request.traceId } };
    }
    return {
      outcome: 'unavailable',
      reason: `No fixture interpretation recorded for this request (traceId=${request.traceId ?? 'none'})`,
      meta: {
        contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
        interpreterVersion: 'variant-c-fixture-v1',
        latencyMs: 0,
        traceId: request.traceId,
        executionStatus: 'completed',
      },
    };
  }
}
