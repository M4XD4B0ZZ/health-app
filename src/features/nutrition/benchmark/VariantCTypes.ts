import { FoodSourceType } from '../domain/catalog/FoodCatalogSource';
import {
  AiInterpretationRequest,
  AiInterpretationResult,
  ClarificationKind,
  ExpectedResolutionKind,
  InterpretedQuantity,
} from '../domain/models/AiInterpretationTypes';

/**
 * RESOLVER-V3-005: benchmark-local result model for Variant C (AI-first, source-grounded
 * hybrid spike). This module defines ONLY benchmark/spike-scoped types -- it does not extend or
 * modify `AiInterpretationTypes.ts`/`AiInterpretationProvider.ts` (RESOLVER-V3-002, reused
 * unchanged) and it does not extend `VariantBTypes.ts` (RESOLVER-V3-004's separate, intentionally
 * non-source-grounded contract). Decision Record §4/§5.2 and AGENTS.md "deterministic logic is
 * not replaced by AI" remain binding: nothing here carries an AI-authored nutrient value as
 * ground truth -- every `macrosPer100g`/`scaledNutrients` field is populated exclusively from a
 * `CanonicalFood` returned by a real source adapter (`BlsStaticSource`/OFF/USDA), selected by the
 * existing, reused `ScoreCalculator`/`ResolverDecisionPolicy`, never invented or copied from the
 * AI interpretation step.
 */

// ---------------------------------------------------------------------------------------------
// Provenance / per-component retrieval trace
// ---------------------------------------------------------------------------------------------

/** One source actually queried for one component -- native query used, candidate count returned,
 * and any error (never silently swallowed). */
export interface ComponentSourceTrace {
  sourceType: FoodSourceType;
  queryUsed: string;
  candidateCount: number;
  latencyMs: number;
  error: string | null;
}

export interface ComponentProvenance {
  sourceType: FoodSourceType | null;
  sourceId: string | null;
  sourceName: string | null;
  /** `true` only when a real `sourceId` was found and used -- a numeric result with this `false`
   * is a provenance defect (spec §6.8 "keine unbelegte Zahl als autoritatives Ergebnis"). */
  sourceGrounded: boolean;
}

/** Documented, non-invented gram-equivalent assumption for a piece/household-measure/portion
 * quantity (spec: "verwende vorhandene verlässliche Portionshinweise ... dokumentiere die
 * Annahme ... erfinde keine universellen Gewichte ohne Provenienz"). */
export interface QuantityAssumption {
  reasonCode: string;
  note: string;
  gramsPerUnit?: number;
}

export type VariantCComponentResolverStatus =
  | 'fast_path_accepted'
  | 'accepted'
  | 'ambiguous'
  | 'rejected'
  | 'not_searched';

export interface ScaledNutrients {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
}

/** Per-100g macros straight from a chosen source-adapter candidate -- always fully numeric,
 * because `CanonicalFood.macrosPer100g` itself guarantees finite numbers (BLS/OFF/USDA records
 * never carry a partial macro set). Kept as its own type distinct from `ScaledNutrients` (whose
 * fields CAN be individually `null`) so a candidate's per-100g values are never confused with a
 * possibly-partial scaled/summed result. */
export interface CandidateMacros100g {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface VariantCComponentResult {
  componentId: string;
  originalSegment: string;
  interpretedName: string;
  quantity: InterpretedQuantity;
  quantityAssumptions: QuantityAssumption[];
  /** Search-plan execution trace -- every source type actually queried for this component, per
   * spec's "Search Planning muss tatsächlich genutzt werden" requirement. Empty when the fast
   * path resolved the component and no AI-planned search ever ran. */
  sourceTraces: ComponentSourceTrace[];
  suitableSourceTypesPlanned: FoodSourceType[];
  excludedSourceTypesPlanned: FoodSourceType[];
  expectedResolutionKind: ExpectedResolutionKind | null;
  candidateCount: number;
  chosenCandidateName: string | null;
  resolverStatus: VariantCComponentResolverStatus;
  /** `ScoreCalculator.finalScore` of the chosen candidate -- Variant C's own native score, never
   * normalized against Variant A/B's scales here (RESOLVER-V3-006's job). `null` when nothing was
   * chosen (rejected/not_searched). */
  nativeScore: number | null;
  provenance: ComponentProvenance;
  /** Per-100g macros of the chosen candidate, straight from the source adapter -- never AI-
   * authored. `null` when no candidate was chosen. */
  macrosPer100g: CandidateMacros100g | null;
  /** Deterministically scaled to `quantity` via `resolvePortionGrams`/`computeTotals` (existing
   * production portion model, reused unchanged). `null` when quantity could not be responsibly
   * converted to grams (see `quantityAssumptions`/`warnings`) -- never silently `0`. */
  scaledNutrients: ScaledNutrients | null;
  gramsUsed: number | null;
  warnings: string[];
  errors: string[];
  /** R1-min execution evidence; null for R0 and for components that were not searched. */
  retrievalExecution?: {
    stopReason: 'authoritative_accepted' | 'tiers_exhausted';
    avoidedSourceTypes: FoodSourceType[];
    calledSourceTypes: FoodSourceType[];
    candidateCountsByTier: { sourceType: FoodSourceType; candidateCount: number }[];
  } | null;
}

// ---------------------------------------------------------------------------------------------
// Meal-level outcome taxonomy (spec-required minimum, reusing existing benchmark vocabulary where
// it already fits rather than inventing a third parallel taxonomy)
// ---------------------------------------------------------------------------------------------

export type VariantCMealOutcome =
  | 'resolved'
  | 'resolved_with_assumptions'
  | 'partially_resolved'
  | 'clarification_required'
  | 'multiple_candidates'
  | 'abstained'
  | 'not_interpretable'
  | 'unavailable'
  | 'invalid_response'
  | 'error';

export interface VariantCClarificationRequest {
  componentId?: string;
  missingInformation: string;
  clarificationKind: ClarificationKind;
}

export interface VariantCFastPathInfo {
  used: boolean;
  reason: string;
  /** Number of AI calls this fast-path resolution avoided (0 or 1 at the current, single-request-
   * per-case scope of this spike). */
  avoidedAiCalls: number;
}

export interface VariantCAiInterpretationSummary {
  called: boolean;
  /** The raw `AiInterpretationResult.outcome` value, or `null` when no AI call was made
   * (fast path). */
  outcome: string | null;
  interpreterVersion: string | null;
  contractVersion: string | null;
  latencyMs: number | null;
}

export interface VariantCCostMetadata {
  /** `null` when no AI call was made (fast path) or the provider does not report usage --
   * distinguished from a real `0` (spec: "keine Kosten als 0 behaupten, wenn Preise unbekannt
   * sind"). */
  costUsd: number | null;
  pricingStatus: 'known' | 'estimated' | 'unknown' | 'not_applicable';
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens?: number | null;
  cacheReadTokens?: number | null;
  httpStatus?: number | null;
  providerLatencyMs?: number | null;
}

export interface VariantCMealResult {
  outcome: VariantCMealOutcome;
  components: VariantCComponentResult[];
  /** Deterministic sum of every resolved component's `scaledNutrients` -- `null` for a nutrient as
   * soon as ANY contributing component is missing that nutrient (never silently treated as 0).
   * `null` entirely when no component could be scaled at all. */
  totals: ScaledNutrients | null;
  /** componentIds that could not be resolved to a source-grounded candidate at all. */
  unresolvedComponentIds: string[];
  assumptions: string[];
  uncertainties: string[];
  clarificationRequests: VariantCClarificationRequest[];
  fastPath: VariantCFastPathInfo;
  aiInterpretation: VariantCAiInterpretationSummary;
  /** Count of source-adapter calls actually made (BLS/OFF/USDA), across all components. */
  externalRequestCount: number;
  latencyMs: {
    fastPathMs: number;
    aiInterpretationMs: number;
    retrievalMs: number;
    totalMs: number;
  };
  cost: VariantCCostMetadata;
  warnings: string[];
  errors: string[];
}

export interface VariantCRawCaseResult {
  caseId: string;
  traceId: string;
  mealResult: VariantCMealResult;
}

// ---------------------------------------------------------------------------------------------
// AI interpreter dependency: wraps the unmodified `AiInterpretationProvider` port with run-only
// cost/token metadata, kept OUTSIDE `AiInterpretationResult` itself -- mirrors RESOLVER-V3-004's
// own "cost/provider metadata lives only in run metadata, never the food-facing result" rule.
// `AiInterpretationProvider`/`AiInterpretationResult`/`AiInterpretationRequest` are reused
// completely unmodified; this interface is a benchmark-local composition, not an extension of
// that port.
// ---------------------------------------------------------------------------------------------

export interface VariantCAiCallMetadata {
  costUsd: number | null;
  pricingStatus: 'known' | 'estimated' | 'unknown';
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens?: number | null;
  cacheReadTokens?: number | null;
  httpStatus?: number | null;
  providerLatencyMs?: number | null;
  /** Closed failure taxonomy for untrusted provider boundaries. Historical artifacts may omit it. */
  failureKind?: VariantCProviderFailureKind | null;
  retryable?: boolean;
  runIdentity?: VariantCRunIdentity;
}

/** Closed, immutable identity for one V3-047 candidate/pricing configuration. */
export interface VariantCRunIdentity {
  readonly candidateId: 'H0' | 'H1' | 'H2';
  readonly candidateVersion: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly routingVersion: string;
  readonly modelId: string;
  readonly pricingVersion: string;
}

export type VariantCParserFailureKind = Extract<
  VariantCProviderFailureKind,
  'missing_text_block' | 'text_block_json_error' | 'schema_contract_error' | 'internal_parser_error'
>;
export interface VariantCParserDiagnostic {
  result: AiInterpretationResult;
  failureKind: VariantCParserFailureKind | null;
}

export type VariantCProviderFailureKind =
  | 'transport_error'
  | 'timeout_abort'
  | 'wall_clock_ceiling'
  | 'http_error'
  | 'http_envelope_json_error'
  | 'http_envelope_contract_error'
  | 'missing_text_block'
  | 'text_block_json_error'
  | 'schema_contract_error'
  | 'internal_parser_error'
  | 'budget_config_error';

export interface VariantCAiInterpretationCall {
  result: AiInterpretationResult;
  runMeta: VariantCAiCallMetadata;
}

export interface VariantCAiInterpreter {
  readonly runIdentity?: VariantCRunIdentity;
  interpret(
    request: AiInterpretationRequest,
    signal?: AbortSignal,
  ): Promise<VariantCAiInterpretationCall>;
}
