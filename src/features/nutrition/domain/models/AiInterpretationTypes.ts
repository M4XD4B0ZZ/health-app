import { FoodSourceType } from '../catalog/FoodCatalogSource';

/**
 * RESOLVER-V3-002: provider-neutral AI interpretation & search-planning contract.
 *
 * This is a typed contract only -- see Decision Record §4/§5.2
 * (docs/domains/ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md): the AI interprets and plans a
 * search, it never returns a nutrient value or acts as a source of nutritional truth.
 * Nutrient values remain the exclusive responsibility of BLS/OFF/USDA/deterministic
 * calculation (NutritionTypes.ts). No model or provider name appears here or in any
 * implementation of `AiInterpretationProvider` (AGENTS.md "Prohibited").
 */

/** Known context hints the (not-yet-wired) validated fast path could later pass in -- always
 * explicitly typed, never a free-form user profile blob. */
export type KnownUserContextHintType = 'recent_alias' | 'saved_meal_name' | 'preferred_brand';

export interface KnownUserContextHint {
  type: KnownUserContextHintType;
  value: string;
}

export interface AiInterpretationRequest {
  /** The user's original, unmodified input text. */
  rawInput: string;
  /** Already-normalized input, if the caller has one available (e.g. from `normalizeText`). */
  normalizedInput?: string;
  /** Mirrors `FoodSearchQuery.locale` -- the resolver's established DACH-focused vocabulary. */
  locale: 'de' | 'en';
  /** Explicitly typed hints only -- never a generic user-profile object. */
  knownUserContext?: KnownUserContextHint[];
  /** Mirrors `FoodSearchQuery.traceId` / `AiRerankingRequest`'s request-tracking convention. */
  traceId?: string;
}

export type InterpretedQuantityUnit = 'g' | 'ml' | 'piece' | 'portion';

export interface InterpretedQuantity {
  /** Numeric amount in `unit`, absent when no amount could be inferred. */
  value?: number;
  unit?: InterpretedQuantityUnit;
  /** A household measure kept verbatim as phrased, e.g. "2 Scheiben", "1 Handvoll". Never
   * converted to a unit here -- deterministic conversion stays outside AI scope. */
  householdMeasure?: string;
  /** Free-text portion description when neither a numeric quantity nor a household measure
   * could be identified, e.g. "eine Portion", "normal groß". */
  portionDescription?: string;
}

export interface InterpretedFoodComponent {
  /** Stable id within one result, referenced by `ComponentSearchPlan`/`ClarificationRequest`. */
  id: string;
  /** The raw text segment this component was derived from. */
  originalSegment: string;
  interpretedName: string;
  brand?: string;
  /** Zubereitungsform, e.g. "gebraten", "gekocht". */
  preparation?: string;
  quantity: InterpretedQuantity;
  /** Recognized modifiers, e.g. "ohne Zucker", "light", "vegan". */
  modifiers?: string[];
  /** Component-specific confidence, 0..1 -- mirrors the 0..1 convention used throughout the
   * resolver (`FoodCandidate.confidence`, `AiParsedMeal.confidence`). */
  confidence: number;
  /** Assumptions the interpretation had to make (free text, mirrors `ResolverDecision.reasonCodes`'s
   * string[] convention rather than introducing a new enum). */
  assumptions?: string[];
  /** Open uncertainties not resolved by an assumption. */
  uncertainties?: string[];
}

export type ExpectedResolutionKind =
  | 'generic_food'
  | 'branded_product'
  | 'restaurant_product'
  | 'recipe_or_dish'
  | 'reusable_personal_meal'
  | 'unknown';

export interface SourceNativeQuery {
  sourceType: FoodSourceType;
  query: string;
}

export interface ComponentSearchPlan {
  componentId: string;
  /** Ordered by suitability -- first entry is the most-recommended source type for this
   * component, mirroring `SequentialFoodCatalogResolver`'s `SourceRoutingStrategy.sourcePriority`
   * ordered-array convention rather than introducing a separate numeric priority field. */
  suitableSourceTypes: FoodSourceType[];
  nativeQueries: SourceNativeQuery[];
  /** Only populated when excluding a source type is factually necessary. */
  excludedSourceTypes?: FoodSourceType[];
  expectedResolutionKind: ExpectedResolutionKind;
}

export type ClarificationKind =
  | 'missing_quantity'
  | 'ambiguous_food_identity'
  | 'ambiguous_preparation'
  | 'missing_brand'
  | 'other';

export interface ClarificationRequest {
  /** Which recognized component is affected; absent if the whole input is affected. */
  componentId?: string;
  missingInformation: string;
  clarificationKind: ClarificationKind;
}

export interface AiInterpretationMetadata {
  /** Schema version of this contract (independent of any interpreter/provider version). */
  contractVersion: string;
  /** Provider-neutral interpreter identifier -- never a model or provider name. */
  interpreterVersion: string;
  latencyMs: number;
  traceId?: string;
  /** Technical execution status, independent of the business `outcome` below -- lets callers
   * distinguish "ran fine but interpretation was inconclusive" from "the call itself failed". */
  executionStatus: 'completed' | 'failed';
}

interface AiInterpretationResultBase {
  meta: AiInterpretationMetadata;
}

/** Interpretation succeeded; `outcome` distinguishes a fully confident read from one that
 * required assumptions (see each component's own `assumptions`/`uncertainties` for detail). */
export interface AiInterpretationInterpreted extends AiInterpretationResultBase {
  outcome: 'interpreted' | 'interpreted_with_assumptions';
  components: InterpretedFoodComponent[];
  searchPlan: ComponentSearchPlan[];
}

/** A targeted clarification is required before interpretation can continue. */
export interface AiInterpretationClarificationRequired extends AiInterpretationResultBase {
  outcome: 'clarification_required';
  /** Components recognized so far, if any -- may be empty. */
  components: InterpretedFoodComponent[];
  clarification: ClarificationRequest;
}

/** The input could not be meaningfully interpreted at all (not a technical failure). */
export interface AiInterpretationNotInterpretable extends AiInterpretationResultBase {
  outcome: 'not_interpretable';
  reason: string;
}

/** No interpretation provider is available/configured (e.g. the Noop default). */
export interface AiInterpretationUnavailable extends AiInterpretationResultBase {
  outcome: 'unavailable';
  reason: string;
}

/** A genuine technical failure (network, malformed provider response, etc.). */
export interface AiInterpretationError extends AiInterpretationResultBase {
  outcome: 'error';
  message: string;
}

/** Discriminated union on `outcome` -- deliberately not `null`/exceptions/free strings/`any`,
 * per RESOLVER-V3-002's API-design requirement. */
export type AiInterpretationResult =
  | AiInterpretationInterpreted
  | AiInterpretationClarificationRequired
  | AiInterpretationNotInterpretable
  | AiInterpretationUnavailable
  | AiInterpretationError;
