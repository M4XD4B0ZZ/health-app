import { normalizeText } from '../../application/utils/normalizeText';

/**
 * RESOLVER-V2-010: bare, unqualified „Speck" spans three materially distinct BLS nutrient
 * clusters (raw fatback ~660-746 kcal, cured/smoked Bauchspeck/Frühstücksspeck bacon-style
 * ~287-337 kcal, lean Schinkenspeck ham-style ~121-167 kcal — up to 6.2x apart; see
 * plans/RESOLVER-V2-010_SPECK_DISAMBIGUATION_DECISION_PLAN.md §1). Silently persisting one of
 * these (today: the raw-fatback winner) is confidently wrong most of the time. This module is
 * the narrowly-scoped, food-specific ambiguity policy approved for Act: detect *only* the bare
 * generic concept, never a qualified term, and offer three real, already-deterministic choices —
 * never a generic ResolverDecision.status/score-gap framework (the plan proved that would
 * misfire on "Bauchspeck"/"Frühstücksspeck", which must stay deterministic).
 */

/**
 * Detects the bare, unqualified generic „Speck" concept — and *only* that. Uses the same
 * canonical-normalized-token comparison the rest of the resolver pipeline already relies on
 * (`normalizeText`), not brittle raw-string equality, so case/whitespace/umlaut variants of the
 * exact bare word are still recognized. Any qualifier — "Bauchspeck", "Frühstücksspeck", "Bacon",
 * "Schinkenspeck", "Rückenspeck", or a descriptive multi-word phrase like "geräucherter Speck" —
 * normalizes to something other than the single token "speck" and is left completely untouched,
 * flowing through the existing, unmodified resolver path (proven deterministic in the plan for
 * the qualified single-word terms; multi-word descriptive phrases already return zero candidates
 * via the existing compound guard, independent of this check).
 */
export function isGenericSpeckQuery(parsedName: string): boolean {
  return normalizeText(parsedName) === 'speck';
}

export interface SpeckClarificationChoiceDefinition {
  /** Stable identifier for this choice (used as the React key / selection callback argument). */
  id: string;
  /** User-facing choice label — plain German, never a raw BLS name. */
  label: string;
  /** Short supporting description shown under the label. */
  description: string;
  /**
   * The real, qualified query re-submitted on selection. Every value here is a single-word
   * German term proven, by direct resolver inspection, to resolve deterministically today
   * (RESOLVER-V2-010 Act diagnostic — see the branch's implementation notes in ROADMAP.md):
   * "bauchspeck" -> W411300 (304 kcal), "rueckenspeck" -> U605000 (746 kcal), "schinkenspeck" ->
   * a Schinkenspeck-cluster record (121-167 kcal). Never guessed from the label.
   */
  query: string;
}

/**
 * Approved product decision (2026-07-18): three choices, not two — a Schinkenspeck-only
 * misclassification would otherwise remain silently wrong just like the original fatback
 * default, so the third, materially different lean-ham cluster is included.
 */
export const SPECK_CLARIFICATION_CHOICES: readonly SpeckClarificationChoiceDefinition[] = [
  {
    id: 'bacon_bauchspeck',
    label: 'Bacon / Bauchspeck',
    description: 'Durchwachsen, typischerweise zum Braten',
    query: 'bauchspeck',
  },
  {
    id: 'fettspeck_rueckenspeck',
    label: 'Fettspeck / Rückenspeck',
    description: 'Sehr fettreich, häufig zum Auslassen',
    query: 'rueckenspeck',
  },
  {
    id: 'schinkenspeck',
    label: 'Schinkenspeck',
    description: 'Magerer, aufschnittartiger Speck',
    query: 'schinkenspeck',
  },
];

export const SPECK_CLARIFICATION_HEADING = 'Welche Art von Speck meinst du?';
export const SPECK_CLARIFICATION_EXPLANATION =
  'Speck kann je nach Art sehr unterschiedliche Nährwerte haben. Wähle die Variante, die am besten passt.';
export const SPECK_NOT_SURE_LABEL = 'Nicht sicher';
/** Shown after "Nicht sicher" — concise, and only names terms proven to resolve (never a
 * descriptive multi-word phrase, which the plan proved returns zero candidates today). */
export const SPECK_NOT_SURE_SUGGESTION =
  'Bitte gib eine genauere Speck-Art an, zum Beispiel Bacon, Rückenspeck oder Schinkenspeck.';

/** One clarification choice with its resolved preview calories (null if resolution unexpectedly failed). */
export interface SpeckClarificationChoicePreview extends SpeckClarificationChoiceDefinition {
  previewCalories: number | null;
}

export interface SpeckClarificationItem {
  type: 'speck_clarification';
  /** The original per-item raw text (e.g. "100 g Speck") — preserved so quantity/context stays visible. */
  rawInput: string;
  /** 0 when no explicit grams were present in the original input. */
  quantityGrams: number;
  /** Whether the original input carried explicit grams (vs. a bare/count-only/no-quantity term). */
  hasExplicitQuantity: boolean;
  heading: string;
  explanation: string;
  choices: readonly SpeckClarificationChoicePreview[];
  notSureLabel: string;
  notSureSuggestion: string;
}

export function buildSpeckClarificationItem(args: {
  rawInput: string;
  quantityGrams: number;
  hasExplicitQuantity: boolean;
  choices: readonly SpeckClarificationChoicePreview[];
}): SpeckClarificationItem {
  return {
    type: 'speck_clarification',
    rawInput: args.rawInput,
    quantityGrams: args.quantityGrams,
    hasExplicitQuantity: args.hasExplicitQuantity,
    heading: SPECK_CLARIFICATION_HEADING,
    explanation: SPECK_CLARIFICATION_EXPLANATION,
    choices: args.choices,
    notSureLabel: SPECK_NOT_SURE_LABEL,
    notSureSuggestion: SPECK_NOT_SURE_SUGGESTION,
  };
}

/**
 * The exact re-submission text used to resolve a selected choice — reuses the existing full
 * parse/resolve/persist pipeline (`logResolvedNutritionInput`) exactly as if the user had typed
 * the qualified term directly, which is proven deterministic (plan §4). No new resolver
 * plumbing: this is the *only* place a choice's `query` is turned into resolver input.
 *
 * Replaces the bare word "Speck" in the *original* raw text with the chosen qualified term,
 * leaving everything else — explicit grams ("100 g Speck" -> "100 g bauchspeck"), a count/unit
 * ("3 Scheiben Speck" -> "3 Scheiben bauchspeck"), or nothing at all ("Speck" -> "bauchspeck") —
 * untouched. This preserves whatever quantity phrasing the user actually typed without this
 * module needing to understand or reconstruct it, and without parsing the quantity a second
 * time from scratch. Safe as a word-boundary replacement specifically because
 * `isGenericSpeckQuery` already guarantees the parsed food name is the bare, standalone word
 * "speck" (never part of a compound like "Speckknödel") before this function is ever called.
 */
export function buildSpeckChoiceResubmissionText(
  rawInput: string,
  choice: Pick<SpeckClarificationChoiceDefinition, 'query'>,
): string {
  return rawInput.replace(/\bspeck\b/i, choice.query);
}
