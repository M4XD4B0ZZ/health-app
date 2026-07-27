import { BenchmarkCase } from './BenchmarkCaseTypes';
import { AiInterpretationProvider } from '../application/ports/AiInterpretationProvider';
import { AiInterpretationRequest } from '../domain/models/AiInterpretationTypes';
import { FoodCatalogResolver } from '../application/services/FoodCatalogResolver';
import { FoodCatalogSource, FoodSourceType } from '../domain/catalog/FoodCatalogSource';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { buildVariantAResolver, runVariantACase } from './ResolverV3VariantAAdapter';
import {
  decideComponentCandidate,
  retrieveCandidatesForComponentPlan,
  retrieveCandidatesForComponentPlanTiered,
  TieredComponentRetrievalResult,
} from './ResolverV3VariantCRetrieval';
import { ResolverV3047Candidate, resolverV3047R1MinSources } from './ResolverV3047Candidates';
import { resolveComponentGrams } from './VariantCQuantity';
import { computeTotals } from '../domain/portion/computeTotals';
import {
  decideVariantCInterpretationConfidence,
  selectVariantCUnresolvedClarification,
} from './VariantCConfidencePolicy';
import {
  CandidateMacros100g,
  ComponentProvenance,
  ScaledNutrients,
  VariantCAiInterpretationCall,
  VariantCAiInterpreter,
  VariantCComponentResolverStatus,
  VariantCComponentResult,
  VariantCMealOutcome,
  VariantCMealResult,
  VariantCRawCaseResult,
} from './VariantCTypes';

/**
 * Wraps a plain `AiInterpretationProvider` (e.g. `NoopAiInterpretationProvider` or a fixture
 * provider) as a `VariantCAiInterpreter` with zero-cost run metadata -- no real AI call happened,
 * so `$0`/`known` is the true cost, not an "unknown" placeholder (mirrors
 * `FixtureVariantBProvider.computeCostUsd`'s identical reasoning).
 */
export class FixtureCostAiInterpreter implements VariantCAiInterpreter {
  constructor(private readonly provider: AiInterpretationProvider) {}

  async interpret(request: AiInterpretationRequest): Promise<VariantCAiInterpretationCall> {
    const result = await this.provider.interpret(request);
    return {
      result,
      runMeta: {
        costUsd: 0,
        pricingStatus: 'known',
        usageStatus: 'unknown',
        actualCostStatus: 'usage_unknown',
        inputTokens: null,
        outputTokens: null,
      },
    };
  }
}

/**
 * RESOLVER-V3-005: canonical Variant C orchestrator. Isolated benchmark-spike code -- imports
 * only existing, unmodified pieces (`AiInterpretationProvider` port, `BlsStaticSource`,
 * `ScoreCalculator`/`ResolverDecisionPolicy` via `ResolverV3VariantCRetrieval.ts`,
 * `resolvePortionGrams`/`computeTotals`) and RESOLVER-V3-003's own `buildVariantAResolver`/
 * `runVariantACase` for the fast path. Nothing here is registered in `container.ts`; no
 * production code is touched.
 *
 * Flow (spec-required pipeline):
 *   BenchmarkCase -> fast path attempt (real Variant A resolver + its own accept threshold)
 *     -> if accepted: done, no AI call
 *     -> else: AiInterpretationProvider.interpret() -> per-component ComponentSearchPlan
 *        execution against only the planned source types (BLS real, OFF/USDA via whatever
 *        `FoodCatalogSource`s the caller registers) -> ScoreCalculator/ResolverDecisionPolicy
 *        (reused, not duplicated) -> deterministic portion scaling (`resolvePortionGrams`) ->
 *        deterministic meal-level summation -> normalized `VariantCMealResult`.
 */

export interface VariantCDependencies {
  /** `AiInterpretationProvider` (RESOLVER-V3-002, unmodified) wrapped with run-only cost/token
   * metadata -- see `VariantCAiInterpreter`'s docstring. Use `FixtureCostAiInterpreter` to wrap a
   * plain fixture/Noop provider for fixture-mode runs. */
  aiInterpreter: VariantCAiInterpreter;
  /** Defaults to RESOLVER-V3-003's own `buildVariantAResolver()` -- the real, unmodified
   * `SequentialFoodCatalogResolver` + `BlsStaticSource`, used ONLY to decide whether a validated
   * fast path already exists (its own `ResolverDecision.status === 'accepted'`), never re-scored
   * here. No new confidence threshold is invented (task instruction). */
  fastPathResolver?: FoodCatalogResolver;
  /** Sources available to the AI-routed, search-plan-constrained retrieval step. Defaults to a
   * fresh `BlsStaticSource` only (the shared 14-case corpus never plans an OFF/USDA search) --
   * callers (tests, a future live run) may register OFF/USDA fixture/real sources here without
   * changing this module. */
  sourcesByType?: ReadonlyMap<FoodSourceType, FoodCatalogSource>;
  candidate?: ResolverV3047Candidate;
  /** Positive benchmark-local structural proof. H2 fails closed to AI when absent. */
  singleComponentFastPathProof?: (benchmarkCase: BenchmarkCase) => boolean;
}

function defaultSourcesByType(): ReadonlyMap<FoodSourceType, FoodCatalogSource> {
  return new Map<FoodSourceType, FoodCatalogSource>([['bls', new BlsStaticSource()]]);
}

function hrMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function macrosOf(food: {
  macrosPer100g: { kcal: number; protein: number; carbs: number; fat: number };
}): CandidateMacros100g {
  return {
    kcal: food.macrosPer100g.kcal,
    protein_g: food.macrosPer100g.protein,
    fat_g: food.macrosPer100g.fat,
    carbs_g: food.macrosPer100g.carbs,
  };
}

function emptyProvenance(): ComponentProvenance {
  return { sourceType: null, sourceId: null, sourceName: null, sourceGrounded: false };
}

/**
 * Consumer-boundary safety contract: retrieval/ranking diagnostics may survive a non-resolution,
 * but a component that is not authorized as resolved must not expose a selected food or numeric
 * food result. Keeping this at the final result boundary prevents every current and future
 * consumer from accidentally persisting an internal best candidate.
 */
function withoutAuthoritativeResolution(
  component: VariantCComponentResult,
): VariantCComponentResult {
  return {
    ...component,
    chosenCandidateName: null,
    resolverStatus: component.resolverStatus === 'accepted' ? 'rejected' : component.resolverStatus,
    nativeScore: null,
    provenance: emptyProvenance(),
    macrosPer100g: null,
    scaledNutrients: null,
    gramsUsed: null,
  };
}

// -------------------------------------------------------------------------------------------
// Fast path branch
// -------------------------------------------------------------------------------------------

interface FastPathAttempt {
  usedFastPath: boolean;
  fastPathMs: number;
  mealResult: VariantCMealResult | null;
}

async function buildFastPathMealResult(
  benchmarkCase: BenchmarkCase,
  fastPathResolver: FoodCatalogResolver,
): Promise<FastPathAttempt> {
  const start = process.hrtime.bigint();
  const raw = await runVariantACase(benchmarkCase, fastPathResolver);
  const fastPathMs = hrMs(start);

  if (raw.decision.status !== 'accepted' || !raw.decision.best) {
    return { usedFastPath: false, fastPathMs, mealResult: null };
  }

  const best = raw.decision.best;
  const componentId = 'fp1';
  const macrosPer100g = macrosOf(best.food);

  const component: VariantCComponentResult = {
    componentId,
    originalSegment: benchmarkCase.rawInput,
    interpretedName: best.food.name,
    quantity: {},
    quantityAssumptions: [],
    sourceTraces: [],
    suitableSourceTypesPlanned: [],
    excludedSourceTypesPlanned: [],
    expectedResolutionKind: null,
    candidateCount: raw.decision.candidates.length,
    chosenCandidateName: best.food.name,
    resolverStatus: 'fast_path_accepted',
    nativeScore: best.score,
    provenance: {
      sourceType: best.food.source,
      sourceId: best.food.sourceId ?? null,
      sourceName: best.food.name,
      sourceGrounded: Boolean(best.food.sourceId),
    },
    macrosPer100g,
    // Fast path deliberately does not parse a consumed quantity in this spike -- mirrors
    // RESOLVER-V3-003's own documented Variant A harness boundary ("quantity parsing lives in a
    // separate layer not exercised here"); per-100g values are still fully source-grounded.
    scaledNutrients: null,
    gramsUsed: null,
    warnings: [],
    errors: [],
  };

  const mealResult: VariantCMealResult = {
    outcome: 'resolved',
    components: [component],
    totals: null,
    unresolvedComponentIds: [],
    assumptions: [],
    uncertainties: [],
    clarificationRequests: [],
    fastPath: {
      used: true,
      reason:
        'Variant A resolver (SequentialFoodCatalogResolver + BlsStaticSource) already returned ' +
        'ResolverDecision.status === "accepted" (ResolverDecisionPolicy\'s existing accept ' +
        'threshold) -- no new confidence threshold invented, no AI interpretation call made.',
      avoidedAiCalls: 1,
    },
    aiInterpretation: {
      called: false,
      outcome: null,
      interpreterVersion: null,
      contractVersion: null,
      latencyMs: null,
    },
    // The Variant A resolver boundary does not expose a per-source external-request count on
    // `ResolverDecision` -- reported as 1 (at least the winning source was contacted), a
    // documented floor rather than a fabricated precise count.
    externalRequestCount: 1,
    latencyMs: { fastPathMs, aiInterpretationMs: 0, retrievalMs: 0, totalMs: fastPathMs },
    cost: { costUsd: 0, pricingStatus: 'not_applicable', inputTokens: null, outputTokens: null },
    aiCallMetadata: null,
    warnings: [],
    errors: [],
  };

  return { usedFastPath: true, fastPathMs, mealResult };
}

// -------------------------------------------------------------------------------------------
// AI-routed branch
// -------------------------------------------------------------------------------------------

export async function runVariantCCase(
  benchmarkCase: BenchmarkCase,
  deps: VariantCDependencies,
): Promise<VariantCRawCaseResult> {
  const traceId = `resolver-v3-variant-c:${benchmarkCase.caseId}`;
  const totalStart = process.hrtime.bigint();
  const fastPathResolver = deps.fastPathResolver ?? buildVariantAResolver().resolver;
  const sourcesByType = deps.sourcesByType ?? defaultSourcesByType();

  const h2 = deps.candidate?.routingVersion !== undefined && deps.candidate.routingVersion !== 'R0';
  const fastPathAllowed = !h2 || deps.singleComponentFastPathProof?.(benchmarkCase) === true;
  const fastPathAttempt = fastPathAllowed
    ? await buildFastPathMealResult(benchmarkCase, fastPathResolver)
    : { usedFastPath: false, fastPathMs: 0, mealResult: null };
  if (fastPathAttempt.usedFastPath && fastPathAttempt.mealResult) {
    return { caseId: benchmarkCase.caseId, traceId, mealResult: fastPathAttempt.mealResult };
  }

  const aiRequest: AiInterpretationRequest = {
    rawInput: benchmarkCase.rawInput,
    locale: benchmarkCase.locale,
    traceId,
  };
  const aiStart = process.hrtime.bigint();
  const aiCall = await deps.aiInterpreter.interpret(aiRequest);
  const aiResult = aiCall.result;
  const aiInterpretationMs = hrMs(aiStart);
  const fastPathMs = fastPathAttempt.fastPathMs;
  const aiCost = aiCall.runMeta;

  const aiSummary = {
    called: true,
    outcome: aiResult.outcome,
    interpreterVersion: aiResult.meta.interpreterVersion,
    contractVersion: aiResult.meta.contractVersion,
    latencyMs: aiResult.meta.latencyMs,
  };
  const fastPathInfo = {
    used: false,
    reason:
      'Variant A resolver decision was not "accepted" (ambiguous/rejected) -- AI interpretation ' +
      "was invoked for this fall-through branch, per the spike's post-fast-path scope.",
    avoidedAiCalls: 0,
  };

  function finish(
    mealResult: Omit<VariantCMealResult, 'latencyMs' | 'fastPath' | 'aiInterpretation'>,
    retrievalMs = 0,
  ): VariantCRawCaseResult {
    const totalMs = hrMs(totalStart);
    return {
      caseId: benchmarkCase.caseId,
      traceId,
      mealResult: {
        ...mealResult,
        aiCallMetadata: aiCost,
        fastPath: fastPathInfo,
        aiInterpretation: aiSummary,
        latencyMs: { fastPathMs, aiInterpretationMs, retrievalMs, totalMs },
      },
    };
  }

  if (aiResult.outcome === 'clarification_required') {
    return finish({
      outcome: 'clarification_required',
      components: [],
      totals: null,
      unresolvedComponentIds: aiResult.components.map((c) => c.id),
      assumptions: [],
      uncertainties: aiResult.components.flatMap((c) => c.uncertainties ?? []),
      clarificationRequests: [aiResult.clarification],
      externalRequestCount: 0,
      cost: {
        costUsd: aiCost.costUsd,
        pricingStatus: aiCost.pricingStatus,
        inputTokens: aiCost.inputTokens,
        outputTokens: aiCost.outputTokens,
      },
      warnings: [],
      errors: [],
    });
  }

  if (aiResult.outcome === 'not_interpretable') {
    return finish({
      outcome: 'not_interpretable',
      components: [],
      totals: null,
      unresolvedComponentIds: [],
      assumptions: [],
      uncertainties: [],
      clarificationRequests: [],
      externalRequestCount: 0,
      cost: {
        costUsd: aiCost.costUsd,
        pricingStatus: aiCost.pricingStatus,
        inputTokens: aiCost.inputTokens,
        outputTokens: aiCost.outputTokens,
      },
      warnings: [aiResult.reason],
      errors: [],
    });
  }

  if (aiResult.outcome === 'unavailable') {
    return finish({
      outcome: 'unavailable',
      components: [],
      totals: null,
      unresolvedComponentIds: [],
      assumptions: [],
      uncertainties: [],
      clarificationRequests: [],
      externalRequestCount: 0,
      cost: {
        costUsd: aiCost.costUsd,
        pricingStatus: aiCost.pricingStatus,
        inputTokens: aiCost.inputTokens,
        outputTokens: aiCost.outputTokens,
      },
      warnings: [aiResult.reason],
      errors: [],
    });
  }

  if (aiResult.outcome === 'error') {
    return finish({
      outcome: 'error',
      components: [],
      totals: null,
      unresolvedComponentIds: [],
      assumptions: [],
      uncertainties: [],
      clarificationRequests: [],
      externalRequestCount: 0,
      cost: {
        costUsd: aiCost.costUsd,
        pricingStatus: aiCost.pricingStatus,
        inputTokens: aiCost.inputTokens,
        outputTokens: aiCost.outputTokens,
      },
      warnings: [],
      errors: [aiResult.message],
    });
  }

  // outcome === 'interpreted' | 'interpreted_with_assumptions'
  const confidenceDecision = decideVariantCInterpretationConfidence(aiResult);
  if (confidenceDecision.action === 'clarify' && confidenceDecision.clarification) {
    return finish({
      outcome: 'clarification_required',
      components: [],
      totals: null,
      unresolvedComponentIds: aiResult.components.map((component) => component.id),
      assumptions: [],
      uncertainties: aiResult.components.flatMap((component) => component.uncertainties ?? []),
      clarificationRequests: [confidenceDecision.clarification],
      externalRequestCount: 0,
      cost: {
        costUsd: aiCost.costUsd,
        pricingStatus: aiCost.pricingStatus,
        inputTokens: aiCost.inputTokens,
        outputTokens: aiCost.outputTokens,
      },
      warnings: [confidenceDecision.reason],
      errors: [],
    });
  }

  const retrievalStart = process.hrtime.bigint();
  const warnings: string[] = [];
  const componentResults: VariantCComponentResult[] = [];
  let externalRequestCount = 0;

  for (const component of aiResult.components) {
    const plan = aiResult.searchPlan.find((p) => p.componentId === component.id);
    const gramsResolution = await resolveComponentGrams(component);
    const quantityAssumptions = gramsResolution.assumptions;
    const componentWarnings = [...gramsResolution.warnings];

    if (!plan) {
      warnings.push(`No search plan for component "${component.id}" -- treated as unresolved.`);
      componentResults.push({
        componentId: component.id,
        originalSegment: component.originalSegment,
        interpretedName: component.interpretedName,
        quantity: component.quantity,
        quantityAssumptions,
        sourceTraces: [],
        suitableSourceTypesPlanned: [],
        excludedSourceTypesPlanned: [],
        expectedResolutionKind: null,
        candidateCount: 0,
        chosenCandidateName: null,
        resolverStatus: 'not_searched',
        nativeScore: null,
        provenance: emptyProvenance(),
        macrosPer100g: null,
        scaledNutrients: null,
        gramsUsed: null,
        warnings: componentWarnings,
        errors: [],
        retrievalExecution: null,
      });
      continue;
    }

    const effectivePlan = h2
      ? {
          ...plan,
          suitableSourceTypes: [...resolverV3047R1MinSources(plan.expectedResolutionKind)],
          nativeQueries: resolverV3047R1MinSources(plan.expectedResolutionKind).map(
            (sourceType) => ({
              sourceType,
              query:
                plan.nativeQueries.find((query) => query.sourceType === sourceType)?.query ??
                component.interpretedName,
            }),
          ),
        }
      : plan;
    const retrieval = await (
      h2 ? retrieveCandidatesForComponentPlanTiered : retrieveCandidatesForComponentPlan
    )({
      plan: effectivePlan,
      interpretedName: component.interpretedName,
      locale: benchmarkCase.locale,
      traceId,
      sourcesByType,
    });
    externalRequestCount += retrieval.traces.length;
    retrieval.unregisteredSourceTypes.forEach((sourceType) => {
      componentWarnings.push(
        `Search plan named source type "${sourceType}" for component "${component.id}", but no ` +
          'such source is registered in this benchmark run.',
      );
    });

    let resolverStatus: VariantCComponentResolverStatus = 'rejected';
    let chosenCandidateName: string | null = null;
    let nativeScore: number | null = null;
    let provenance = emptyProvenance();
    let macrosPer100g: CandidateMacros100g | null = null;
    let candidateCount = 0;

    if (retrieval.rawCandidates.length > 0) {
      const decision = h2
        ? (retrieval as TieredComponentRetrievalResult).decision
        : decideComponentCandidate(component.interpretedName, retrieval.rawCandidates);
      candidateCount = decision.candidates.length;
      if (decision.best) {
        resolverStatus = decision.status;
        chosenCandidateName = decision.best.food.name;
        nativeScore = decision.best.score;
        provenance = {
          sourceType: decision.best.food.source,
          sourceId: decision.best.food.sourceId ?? null,
          sourceName: decision.best.food.name,
          sourceGrounded: Boolean(decision.best.food.sourceId),
        };
        macrosPer100g = macrosOf(decision.best.food);
      }
    }

    let scaledNutrients: ScaledNutrients | null = null;
    let gramsUsed: number | null = null;
    if (resolverStatus === 'accepted' && macrosPer100g && gramsResolution.status === 'resolved') {
      gramsUsed = gramsResolution.grams;
      const scaled = computeTotals(
        {
          calories: macrosPer100g.kcal,
          protein: macrosPer100g.protein_g,
          carbs: macrosPer100g.carbs_g,
          fat: macrosPer100g.fat_g,
        },
        gramsResolution.grams ?? 0,
        1,
      );
      scaledNutrients = {
        kcal: scaled.totals.calories,
        protein_g: scaled.totals.protein,
        fat_g: scaled.totals.fat,
        carbs_g: scaled.totals.carbs,
      };
    }

    componentResults.push({
      componentId: component.id,
      originalSegment: component.originalSegment,
      interpretedName: component.interpretedName,
      quantity: component.quantity,
      quantityAssumptions,
      sourceTraces: retrieval.traces,
      suitableSourceTypesPlanned: effectivePlan.suitableSourceTypes,
      excludedSourceTypesPlanned: effectivePlan.excludedSourceTypes ?? [],
      expectedResolutionKind: plan.expectedResolutionKind,
      candidateCount,
      chosenCandidateName,
      resolverStatus,
      nativeScore,
      provenance,
      macrosPer100g,
      scaledNutrients,
      gramsUsed,
      warnings: componentWarnings,
      errors: [],
      retrievalExecution: h2
        ? {
            stopReason: (retrieval as TieredComponentRetrievalResult).stopReason,
            avoidedSourceTypes: (retrieval as TieredComponentRetrievalResult).avoidedSourceTypes,
            calledSourceTypes: retrieval.traces.map((trace) => trace.sourceType),
            candidateCountsByTier: retrieval.traces.map((trace) => ({
              sourceType: trace.sourceType,
              candidateCount: trace.candidateCount,
            })),
          }
        : null,
    });
  }

  const retrievalMs = hrMs(retrievalStart);

  const fullyResolved = componentResults.filter(
    (c) => c.resolverStatus === 'accepted' && c.scaledNutrients !== null,
  );
  const ambiguous = componentResults.filter((c) => c.resolverStatus === 'ambiguous');
  const unresolved = componentResults.filter((component) => !fullyResolved.includes(component));

  let outcome: VariantCMealOutcome;
  if (componentResults.length > 0 && fullyResolved.length === componentResults.length) {
    const hasAssumptions =
      aiResult.outcome === 'interpreted_with_assumptions' ||
      componentResults.some((c) => c.quantityAssumptions.length > 0) ||
      aiResult.components.some((c) => (c.assumptions?.length ?? 0) > 0);
    outcome = hasAssumptions ? 'resolved_with_assumptions' : 'resolved';
  } else if (
    componentResults.length > 0 &&
    ambiguous.length > 0 &&
    ambiguous.length === componentResults.length &&
    fullyResolved.length === 0
  ) {
    outcome = 'multiple_candidates';
  } else if (componentResults.length > 0 && unresolved.length === componentResults.length) {
    outcome = selectVariantCUnresolvedClarification(aiResult.components)
      ? 'clarification_required'
      : 'abstained';
  } else if (componentResults.length === 0) {
    outcome = 'not_interpretable';
  } else {
    outcome = 'partially_resolved';
  }

  const totals =
    outcome === 'resolved' || outcome === 'resolved_with_assumptions'
      ? fullyResolved.reduce<ScaledNutrients>(
          (acc, c) => ({
            kcal: (acc.kcal ?? 0) + (c.scaledNutrients?.kcal ?? 0),
            protein_g: (acc.protein_g ?? 0) + (c.scaledNutrients?.protein_g ?? 0),
            fat_g: (acc.fat_g ?? 0) + (c.scaledNutrients?.fat_g ?? 0),
            carbs_g: (acc.carbs_g ?? 0) + (c.scaledNutrients?.carbs_g ?? 0),
          }),
          { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
        )
      : null;

  const components = componentResults.map((component) => {
    const resolutionAuthorized =
      outcome === 'resolved' ||
      outcome === 'resolved_with_assumptions' ||
      (outcome === 'partially_resolved' && fullyResolved.includes(component));
    return resolutionAuthorized ? component : withoutAuthoritativeResolution(component);
  });

  return finish(
    {
      outcome,
      components,
      totals,
      unresolvedComponentIds: unresolved.map((c) => c.componentId),
      assumptions: [
        ...(aiResult.outcome === 'interpreted_with_assumptions'
          ? ['AI interpretation flagged this input as requiring assumptions.']
          : []),
        ...componentResults.flatMap((c) => c.quantityAssumptions.map((a) => a.note)),
      ],
      uncertainties: aiResult.components.flatMap((c) => c.uncertainties ?? []),
      clarificationRequests:
        outcome === 'clarification_required'
          ? [selectVariantCUnresolvedClarification(aiResult.components)].filter(
              (request): request is NonNullable<typeof request> => request !== null,
            )
          : [],
      externalRequestCount,
      cost: {
        costUsd: aiCost.costUsd,
        pricingStatus: aiCost.pricingStatus,
        inputTokens: aiCost.inputTokens,
        outputTokens: aiCost.outputTokens,
      },
      warnings,
      errors: [],
    },
    retrievalMs,
  );
}
