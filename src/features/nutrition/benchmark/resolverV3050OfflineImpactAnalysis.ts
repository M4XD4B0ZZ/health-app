import { BenchmarkCase } from './BenchmarkCaseTypes';
import { FoodCatalogResolver } from '../application/services/FoodCatalogResolver';
import { ResolverDecision, ResolverStatus } from '../domain/models/ResolverDecision';
import { normalizeText } from '../application/utils/normalizeText';
import { detectInputType } from '../application/utils/detectInputType';
import {
  buildVariantAResolver,
  runVariantACase,
  VariantARawResult,
} from './ResolverV3VariantAAdapter';
import { evaluateVariantACase, IdentificationOutcome } from './evaluateVariantACase';
import {
  RepresentativeHybridV1ResolutionScenario,
  RepresentativeHybridV1Scenario,
} from './representativeHybridV1/RepresentativeHybridV1Types';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from './representativeHybridV1/RepresentativeHybridV1Manifest';

/**
 * RESOLVER-V3-050 §"Complete offline impact analysis": runs the OLD (pre-fix, article/quantity-
 * polluted) and the CORRECTED (production-faithful) benchmark input boundaries over the entire
 * frozen representative corpus, offline, with zero provider calls. The OLD boundary is
 * deliberately reproduced verbatim here -- not imported from anywhere, because it no longer
 * exists in production/benchmark code after this task's fix -- solely so this historical
 * comparison stays reproducible without reverting the fix itself.
 *
 * Variant C's deterministic fast path is, by construction (`ResolverV3VariantCAdapter.
 * buildFastPathMealResult`), always exactly Variant A's own decision -- `runVariantCCase` calls
 * `runVariantACase` and uses the fast path iff `decision.status === 'accepted'`. So Variant C's
 * fast-path applicability and outcome are fully and deterministically derivable from the same
 * Variant A raw result computed here, without invoking `runVariantCCase` a second time. For cases
 * where the fast path is NOT used (old or corrected), what the AI-routed branch *would* produce is
 * explicitly NOT simulated (task instruction: "Do not run or simulate new Haiku outputs").
 */

function isResolutionScenario(
  scenario: RepresentativeHybridV1Scenario,
): scenario is RepresentativeHybridV1ResolutionScenario {
  return scenario.scenarioType === 'resolution_decomposition';
}

/** Verbatim reproduction of the OLD (pre-RESOLVER-V3-050) `runVariantACase` boundary:
 * `normalizeText(rawInput)` sent straight to the resolver, never running `DeterministicFoodParser`
 * first. Kept ONLY for this historical offline-impact comparison -- no current production or
 * benchmark call path uses this shape anymore. */
async function runOldVariantABoundaryCase(
  benchmarkCase: BenchmarkCase,
  resolver: FoodCatalogResolver,
): Promise<{ query: VariantARawResult['query']; decision: ResolverDecision }> {
  const normalized = normalizeText(benchmarkCase.rawInput);
  const inputType = detectInputType(benchmarkCase.rawInput);
  const traceId = `resolver-v3-variant-a-OLD-BOUNDARY:${benchmarkCase.caseId}`;
  const query = {
    raw: benchmarkCase.rawInput,
    normalized,
    locale: benchmarkCase.locale,
    inputType,
    traceId,
  };
  const decision = await resolver.resolve(query, { traceId });
  return { query, decision };
}

export interface ResolverV3050ArmOutcome {
  status: ResolverStatus;
  winnerSourceId: string | null;
  identification: IdentificationOutcome;
  falseConfident: boolean;
}

export interface ResolverV3050VariantCFastPathOutcome {
  fastPathUsed: boolean;
  /** Mirrors the Variant A outcome exactly when the fast path is used (see module docstring);
   * `null` when the fast path was not used (falls through to the AI-routed branch, not simulated
   * here). */
  outcome: ResolverV3050ArmOutcome | null;
}

export interface ResolverV3050CaseImpact {
  caseId: string;
  partition: string;
  category: string;
  rawInput: string;
  oldNormalizedResolverInput: string;
  correctedParsedResolverInput: string;
  boundaryChanged: boolean;
  variantAOld: ResolverV3050ArmOutcome;
  variantACorrected: ResolverV3050ArmOutcome;
  variantAOutcomeChanged: boolean;
  winnerSourceIdChanged: boolean;
  falseConfidenceChanged: boolean;
  identificationChanged: boolean;
  acceptedToAmbiguous: boolean;
  ambiguousToAccepted: boolean;
  acceptedToRejectedOrNoMatch: boolean;
  rejectedOrNoMatchToAccepted: boolean;
  variantCOld: ResolverV3050VariantCFastPathOutcome;
  variantCCorrected: ResolverV3050VariantCFastPathOutcome;
}

export interface ResolverV3050OfflineImpactTotals {
  allCases: number;
  changedInputs: number;
  changedOutcomes: number;
  acceptedToAmbiguous: number;
  ambiguousToAccepted: number;
  acceptedToRejectedOrNoMatch: number;
  rejectedOrNoMatchToAccepted: number;
  winnerSourceIdChanges: number;
  falseConfidenceChanges: number;
  newlyFalseConfident: number;
  noLongerFalseConfident: number;
  identificationChanges: number;
  categoryDistributionOfChangedOutcomes: Record<string, number>;
  partitionDistributionOfChangedOutcomes: Record<string, number>;
}

export interface ResolverV3050OfflineImpactReport {
  totals: ResolverV3050OfflineImpactTotals;
  cases: ResolverV3050CaseImpact[];
}

function armOutcomeOf(
  benchmarkCase: BenchmarkCase,
  raw: { query: VariantARawResult['query']; decision: ResolverDecision; latencyMs?: number },
): ResolverV3050ArmOutcome {
  const evaluation = evaluateVariantACase(benchmarkCase, {
    caseId: benchmarkCase.caseId,
    originalRawInput: benchmarkCase.rawInput,
    parserResult: { name: raw.query.normalized },
    query: raw.query,
    decision: raw.decision,
    latencyMs: raw.latencyMs ?? 0,
  });
  return {
    status: evaluation.status,
    winnerSourceId: raw.decision.best?.food.sourceId ?? null,
    identification: evaluation.identification,
    falseConfident: evaluation.falseConfident,
  };
}

/** Runs the complete offline (zero-provider-call) impact analysis for one case: old boundary,
 * corrected boundary, and their Variant C fast-path consequences, all against fresh resolver
 * instances (never sharing state across cases). */
export async function analyzeResolverV3050CaseImpact(
  benchmarkCase: BenchmarkCase,
  partition: string,
): Promise<ResolverV3050CaseImpact> {
  const { resolver: resolverOld } = buildVariantAResolver();
  const { resolver: resolverNew } = buildVariantAResolver();

  const oldRaw = await runOldVariantABoundaryCase(benchmarkCase, resolverOld);
  const correctedRaw = await runVariantACase(benchmarkCase, resolverNew);

  const variantAOld = armOutcomeOf(benchmarkCase, oldRaw);
  const variantACorrected = armOutcomeOf(benchmarkCase, correctedRaw);

  const rejectedOrNoMatch = (status: ResolverStatus) => status === 'rejected';

  const variantCOld: ResolverV3050VariantCFastPathOutcome = {
    fastPathUsed: variantAOld.status === 'accepted',
    outcome: variantAOld.status === 'accepted' ? variantAOld : null,
  };
  const variantCCorrected: ResolverV3050VariantCFastPathOutcome = {
    fastPathUsed: variantACorrected.status === 'accepted',
    outcome: variantACorrected.status === 'accepted' ? variantACorrected : null,
  };

  return {
    caseId: benchmarkCase.caseId,
    partition,
    category: benchmarkCase.category,
    rawInput: benchmarkCase.rawInput,
    oldNormalizedResolverInput: oldRaw.query.normalized,
    correctedParsedResolverInput: correctedRaw.query.normalized,
    boundaryChanged: oldRaw.query.normalized !== correctedRaw.query.normalized,
    variantAOld,
    variantACorrected,
    variantAOutcomeChanged: variantAOld.status !== variantACorrected.status,
    winnerSourceIdChanged: variantAOld.winnerSourceId !== variantACorrected.winnerSourceId,
    falseConfidenceChanged: variantAOld.falseConfident !== variantACorrected.falseConfident,
    identificationChanged: variantAOld.identification !== variantACorrected.identification,
    acceptedToAmbiguous:
      variantAOld.status === 'accepted' && variantACorrected.status === 'ambiguous',
    ambiguousToAccepted:
      variantAOld.status === 'ambiguous' && variantACorrected.status === 'accepted',
    acceptedToRejectedOrNoMatch:
      variantAOld.status === 'accepted' && rejectedOrNoMatch(variantACorrected.status),
    rejectedOrNoMatchToAccepted:
      rejectedOrNoMatch(variantAOld.status) && variantACorrected.status === 'accepted',
    variantCOld,
    variantCCorrected,
  };
}

function emptyTotals(allCases: number): ResolverV3050OfflineImpactTotals {
  return {
    allCases,
    changedInputs: 0,
    changedOutcomes: 0,
    acceptedToAmbiguous: 0,
    ambiguousToAccepted: 0,
    acceptedToRejectedOrNoMatch: 0,
    rejectedOrNoMatchToAccepted: 0,
    winnerSourceIdChanges: 0,
    falseConfidenceChanges: 0,
    newlyFalseConfident: 0,
    noLongerFalseConfident: 0,
    identificationChanges: 0,
    categoryDistributionOfChangedOutcomes: {},
    partitionDistributionOfChangedOutcomes: {},
  };
}

export function aggregateResolverV3050OfflineImpact(
  cases: readonly ResolverV3050CaseImpact[],
): ResolverV3050OfflineImpactTotals {
  const totals = emptyTotals(cases.length);
  for (const c of cases) {
    if (c.boundaryChanged) totals.changedInputs += 1;
    if (c.variantAOutcomeChanged) {
      totals.changedOutcomes += 1;
      totals.categoryDistributionOfChangedOutcomes[c.category] =
        (totals.categoryDistributionOfChangedOutcomes[c.category] ?? 0) + 1;
      totals.partitionDistributionOfChangedOutcomes[c.partition] =
        (totals.partitionDistributionOfChangedOutcomes[c.partition] ?? 0) + 1;
    }
    if (c.acceptedToAmbiguous) totals.acceptedToAmbiguous += 1;
    if (c.ambiguousToAccepted) totals.ambiguousToAccepted += 1;
    if (c.acceptedToRejectedOrNoMatch) totals.acceptedToRejectedOrNoMatch += 1;
    if (c.rejectedOrNoMatchToAccepted) totals.rejectedOrNoMatchToAccepted += 1;
    if (c.winnerSourceIdChanged) totals.winnerSourceIdChanges += 1;
    if (c.falseConfidenceChanged) {
      totals.falseConfidenceChanges += 1;
      if (!c.variantAOld.falseConfident && c.variantACorrected.falseConfident) {
        totals.newlyFalseConfident += 1;
      } else {
        totals.noLongerFalseConfident += 1;
      }
    }
    if (c.identificationChanged) totals.identificationChanges += 1;
  }
  return totals;
}

/** Runs the complete offline impact analysis over the entire frozen RESOLVER-V3-038
 * representative corpus (`REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS`, 104 resolution-
 * decomposition cases: 80 development + 24 holdout). Zero provider calls -- every case runs
 * against the real, deterministic BLS-backed resolver only. */
export async function runResolverV3050OfflineImpactAnalysis(
  scenarios: readonly RepresentativeHybridV1Scenario[] = REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS,
): Promise<ResolverV3050OfflineImpactReport> {
  const resolutionScenarios = scenarios.filter(isResolutionScenario);
  const orderedScenarios = [...resolutionScenarios].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  );

  const cases: ResolverV3050CaseImpact[] = [];
  for (const scenario of orderedScenarios) {
    // eslint-disable-next-line no-await-in-loop
    const impact = await analyzeResolverV3050CaseImpact(scenario.case, scenario.partition);
    cases.push(impact);
  }

  return { totals: aggregateResolverV3050OfflineImpact(cases), cases };
}
