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
 * §4 "Ausgaben, die ein Profile liefern muss".
 */
export interface EvaluationOutput {
  assessment: string;
  insights: string[];
  warnings: string[];
  recommendations: string[];
  goalProgress: EvaluationGoalProgress[];
}
