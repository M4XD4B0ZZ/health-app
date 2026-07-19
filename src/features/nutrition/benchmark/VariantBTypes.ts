import { BenchmarkLocale } from './BenchmarkCaseTypes';
import { ClarificationKind, InterpretedQuantityUnit } from '../domain/models/AiInterpretationTypes';

/**
 * RESOLVER-V3-004: benchmark-local request/response contract for Variant B (direct AI-only
 * nutrition estimation, no source grounding).
 *
 * This is deliberately a *separate*, benchmark-scoped contract, not an extension of
 * `AiInterpretationProvider`/`AiInterpretationTypes.ts` (RESOLVER-V3-002). That contract is typed
 * for interpretation + source-native search planning only -- it never returns a nutrient value,
 * by design (Decision Record §4/§5.2, `AGENTS.md` "deterministic logic is not replaced by AI").
 * Variant B needs the AI to *also* emit macros, directly, as its own (non-authoritative) estimate
 * -- adding that to the production port would silently turn a "what to look for" contract into a
 * nutrient source. Locale/quantity-unit/clarification-kind vocabulary is still reused verbatim
 * from `AiInterpretationTypes.ts` where the semantics genuinely match (ROADMAP.md RESOLVER-V3-004
 * instruction: "Nutze bestehende Interpretationstypen dort, wo ihre Semantik passt").
 *
 * Every `VariantBEstimationResult` is explicitly `ai_estimate` provenance -- never a BLS/OFF/USDA
 * `sourceId`, never written to the journal, never treated as Zera nutrient truth (see
 * `ResolverV3VariantBAdapter.ts`/ROADMAP.md's non-goals for this task).
 */

export const VARIANT_B_CONTRACT_VERSION = '1';

/** A single benchmark request: one AI-only estimation call for one benchmark case (one run). */
export interface VariantBRequest {
  /** The benchmark case this request was built from -- never mutated after construction. */
  caseId: string;
  rawInput: string;
  locale: BenchmarkLocale;
  regionalContext?: string;
  /** Distinguishes repeated runs of the identical input for the same case (spec §6.7 same-input
   * consistency sampling) from a single primary run. 0-indexed. */
  runIndex: number;
  traceId: string;
  promptVersion: string;
  schemaVersion: string;
}

export type VariantBQuantityUnit = InterpretedQuantityUnit;

export interface VariantBQuantity {
  value?: number;
  unit?: VariantBQuantityUnit;
  householdMeasure?: string;
  portionDescription?: string;
}

/** One AI-estimated meal component. Macros are `number | null` -- `null` means "the AI did not
 * provide this value", never coerced to `0` (ROADMAP.md RESOLVER-V3-004: "Fehlende Werte bleiben
 * fehlend"). */
export interface VariantBComponentEstimate {
  componentId: string;
  name: string;
  brand?: string;
  preparation?: string;
  quantity: VariantBQuantity;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  /** Further nutrients, only when the model actually provided them (never defaulted). */
  fiber_g?: number | null;
  sugar_g?: number | null;
  salt_g?: number | null;
  assumptions: string[];
  uncertainties: string[];
  /** Component-level native confidence, 0..1, kept in Variant B's own raw scale -- never
   * normalized against Variant A/C here (that is RESOLVER-V3-006's job, per spec §6.6/§13). */
  confidence: number;
}

/** Meal-level totals as separately asserted by the AI (not silently derived by summing
 * components) -- kept alongside the component list so a mismatch is visible, not overwritten
 * (ROADMAP.md: "überschreibe sie nicht still"). `null` fields mean the model did not assert that
 * total. */
export interface VariantBMealTotals {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
}

export interface VariantBMealEstimate {
  components: VariantBComponentEstimate[];
  /** The AI's own asserted meal-level totals, or `null` if it did not assert any. */
  totals: VariantBMealTotals | null;
  overallConfidence: number | null;
  assumptions: string[];
  uncertainties: string[];
}

export interface VariantBClarification {
  componentId?: string;
  missingInformation: string;
  clarificationKind: ClarificationKind;
}

export interface VariantBResultMetadata {
  contractVersion: string;
  promptVersion: string;
  schemaVersion: string;
  /** Provider-neutral, mirrors `AiInterpretationMetadata.interpreterVersion` -- never a model or
   * provider name (AGENTS.md "Prohibited"; provider/model identity lives only in the infra-layer
   * `VariantBRunMetadata`, never in this food-facing result). */
  estimatorVersion: string;
  latencyMs: number;
  traceId?: string;
  executionStatus: 'completed' | 'failed';
}

interface VariantBResultBase {
  meta: VariantBResultMetadata;
}

/** A successful, direct AI nutrition estimate -- Variant B's core, deliberately non-source-
 * grounded outcome. */
export interface VariantBEstimated extends VariantBResultBase {
  outcome: 'estimated';
  meal: VariantBMealEstimate;
}

/** The AI determined it needs more information before it can estimate responsibly. */
export interface VariantBClarificationRequired extends VariantBResultBase {
  outcome: 'clarification_required';
  components: VariantBComponentEstimate[];
  clarification: VariantBClarification;
}

/** The AI understood the input as a real food/meal, but explicitly declines to give a numeric
 * estimate (no fabricated number) because it has no reliable basis -- distinct from
 * `not_interpretable` (input not understood at all) and from `clarification_required` (a
 * *targeted* follow-up question would resolve it). Maps to the corpus's `abstention_expected`
 * ground truth (e.g. Zwiebelrostbraten) -- an explicit, justified addition beyond the ROADMAP's
 * "mindestens" outcome list, since none of the other outcomes correctly express "understood, but
 * honestly won't guess". */
export interface VariantBAbstained extends VariantBResultBase {
  outcome: 'abstained';
  components: VariantBComponentEstimate[];
  reason: string;
}

/** The raw input could not be meaningfully interpreted as food-log text at all. */
export interface VariantBNotInterpretable extends VariantBResultBase {
  outcome: 'not_interpretable';
  reason: string;
}

/** No estimator provider is configured (mirrors `NoopAiInterpretationProvider`). */
export interface VariantBUnavailable extends VariantBResultBase {
  outcome: 'unavailable';
  reason: string;
}

/** The provider responded, but the response failed schema validation -- produced by the
 * normalization layer (`validateVariantBResponse.ts`), not by the AI itself. Carries every
 * validation issue found, never silently accepted as a partial success. */
export interface VariantBInvalidResponse extends VariantBResultBase {
  outcome: 'invalid_response';
  validationIssues: string[];
  /** First ~500 chars of the raw response, for debugging -- never the full raw text (avoids
   * bloating reports with large malformed payloads). */
  rawResponseExcerpt: string | null;
}

/** A genuine technical failure calling the provider (network, HTTP error, timeout). */
export interface VariantBError extends VariantBResultBase {
  outcome: 'error';
  message: string;
}

/** Discriminated union on `outcome` -- no `any`, no unvalidated JSON blob, no silently-accepted
 * partial response (ROADMAP.md RESOLVER-V3-004 requirement). */
export type VariantBEstimationResult =
  | VariantBEstimated
  | VariantBClarificationRequired
  | VariantBAbstained
  | VariantBNotInterpretable
  | VariantBUnavailable
  | VariantBInvalidResponse
  | VariantBError;

/** Infra-layer run metadata: cost/latency/provider/model identity. Deliberately kept *outside*
 * `VariantBEstimationResult`/`VariantBMealEstimate` (the food-facing model) -- ROADMAP.md:
 * "Währung bzw. monetäre Kostenmetadaten nur im Run-Metadatenbereich, nicht im Food-Ergebnis" /
 * "Laufzeit- und Provider-Metadaten außerhalb des fachlichen Food-Modells". Pricing is explicitly
 * tri-state (`known` uses a pinned $/token rate, `estimated` is a best-effort snapshot,
 * `unknown` when no rate is configured) -- never silently `0`. */
export type VariantBPricingStatus = 'known' | 'estimated' | 'unknown';

export interface VariantBRunMetadata {
  /** Infra-only identifiers -- never surfaced in the food-facing result above, per
   * AGENTS.md "no model/provider names in domain or application layer code" (this is
   * benchmark/infrastructure, not domain/application, but the same discipline is kept here so it
   * cannot leak upward by accident). */
  providerId: string;
  modelId: string;
  runMode: 'fixture' | 'live';
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  pricingStatus: VariantBPricingStatus;
  httpError: string | null;
}

export interface VariantBRawCaseResult {
  request: VariantBRequest;
  result: VariantBEstimationResult;
  runMeta: VariantBRunMetadata;
}
