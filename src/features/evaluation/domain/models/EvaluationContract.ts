import { FoodEntry } from '../../../nutrition/domain/models/NutritionTypes';
import { CanonicalFood } from '../../../nutrition/domain/catalog/FoodCatalogSource';

/**
 * GE-001 / Product Bible §4: the stateless Ein-/Ausgabe-Formel every EvaluationProfile and
 * every Rule follows —
 *
 *   Food Catalog + Journal + Benutzerprofil + Profileinstellungen
 *                             |
 *                             v
 *   Bewertung + Insights + Warnungen + Empfehlungen + Zielerreichung
 *
 * Deliberately self-contained (no dependency on `features/goals`' internal types): the
 * Evaluation Engine is conceptually the layer `features/goals` will eventually be adapted
 * behind (GE-002), not the other way round.
 */

/**
 * §4 "Zielerreichung (Ziel-Fortschritt für Goals-Anzeige)" — one tracked quantity's
 * progress against its target (e.g. calories, protein).
 */
export interface EvaluationGoalProgress {
  label: string;
  consumed: number;
  target: number;
  remaining: number;
  status: 'under' | 'ontrack' | 'over';
}

/**
 * §4 "Eingaben, die ein Profile erhalten darf" — all reads, never writes.
 */
export interface EvaluationInput {
  /** Food-Catalog-Daten der referenzierten Lebensmittel (nur lesend). */
  foodCatalogReads: CanonicalFood[];
  /** Journaldaten des betrachteten Zeitraums (nur lesend). */
  journalReadsForPeriod: FoodEntry[];
  /** Benutzerprofil-Basisdaten, sofern relevant (z. B. Gewicht, Aktivitätslevel). */
  userProfileBasics?: Record<string, unknown>;
  /** Die aktive Regelauswahl plus deren Parameter. */
  profileSettings: Record<string, unknown>;
}

/**
 * GE-010: the whole-day orientation. Deliberately not collapsed to a single over/under —
 * a mixed day (some dimensions below, some above their corridor) stays `mixed`, and no single
 * dimension dominates the overall state.
 *
 * - `no-data`: nothing logged yet.
 * - `on-track`: every evaluable dimension is inside its corridor.
 * - `below` / `above`: every deviation points the same way.
 * - `mixed`: deviations point both ways.
 * - `target-unavailable`: no dimension can be evaluated (all targets missing/≤0/non-finite).
 */
export type AssessmentOrientation =
  | 'no-data'
  | 'on-track'
  | 'below'
  | 'above'
  | 'mixed'
  | 'target-unavailable';

export type DeviationDirection = 'under' | 'over';

/** GE-010: one evaluable dimension that is outside its corridor. */
export interface DimensionDeviation {
  label: string;
  direction: DeviationDirection;
}

/**
 * GE-010: structured, domain-computed daily assessment. Derived deterministically from the
 * existing `goalProgress` and the existing ±5 % corridor — no new thresholds. The presentation
 * only formats this; it never re-derives status. `deviations`/`primary` follow the established
 * progress-card display order (calories, protein, carbs, fat); `primary` is presentation order,
 * not medical severity.
 */
export interface AssessmentDetail {
  orientation: AssessmentOrientation;
  deviations: DimensionDeviation[];
  primary: DimensionDeviation | null;
  /** Dimensions excluded from evaluation because their target is missing/≤0/non-finite. */
  unavailableDimensions: string[];
}

/**
 * §4 "Ausgaben, die ein Profile liefern muss".
 */
export interface EvaluationOutput {
  /** GE-010: kept for back-compat; carries the `AssessmentDetail.orientation` code. */
  assessment: string;
  /** GE-010: the authoritative structured assessment the summary/recommendations read from. */
  assessmentDetail: AssessmentDetail;
  insights: string[];
  warnings: string[];
  recommendations: string[];
  goalProgress: EvaluationGoalProgress[];
}
