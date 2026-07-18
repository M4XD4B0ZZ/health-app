import {
  MetabolismProfile,
  MetabolismBreakdownStepKey,
  ActivityLevel,
  Sex,
} from '../../../features/goals';

/**
 * GE-011: presentation-only mapping for the „Körperdaten & Energiebedarf" section. The metabolism
 * math (BMR/TDEE, activity factors, formula, rounding) is unchanged — this module only decides the
 * user-facing hierarchy, plain-German copy and the German labels for the collapsed calculation
 * detail. It never recalculates: every number comes from the existing `MetabolismResult`/profile.
 */

export const ENERGY_SECTION_TITLE = 'Körperdaten & Energiebedarf';

// Primary (most prominent) value: the estimated maintenance need (TDEE).
export const MAINTENANCE_LABEL = 'Geschätzter Erhaltungsbedarf';
export const MAINTENANCE_EXPLANATION =
  'Ungefähr diese Energiemenge hält dein aktuelles Gewicht bei deinem gewählten Aktivitätsniveau.';

// Secondary value: the basal metabolic rate (BMR) — explicitly not a recommended daily target.
export const BASAL_LABEL = 'Grundumsatz';
export const BASAL_EXPLANATION =
  'Geschätzter Energiebedarf deines Körpers bei vollständiger Ruhe. Das ist kein empfohlenes Tagesziel.';

// Collapsed-by-default progressive disclosure holding the full formula/calculation path.
export const CALCULATION_DISCLOSURE_LABEL = 'So wurden die Werte berechnet';
export const INPUTS_HEADING = 'Eingaben';

export function formatKcalPerDay(value: number): string {
  return `${Math.round(value)} kcal pro Tag`;
}

const SEX_LABEL_DE: Record<Sex, string> = {
  male: 'Männlich',
  female: 'Weiblich',
};

const ACTIVITY_LABEL_DE: Record<ActivityLevel, string> = {
  low: 'Niedrig (wenig Bewegung)',
  moderate: 'Moderat (1–3× / Woche Sport)',
  high: 'Hoch (4–7× / Woche Sport)',
};

/**
 * German titles for the technical calculation steps (their built-in titles are English). Shown
 * only inside the expanded disclosure — mirrors the suggested „Formel · Grundumsatz ·
 * Aktivitätsfaktor · Erhaltungsbedarf" breakdown. Falls back to the raw key defensively, but
 * every current key is mapped.
 */
const STEP_TITLE_DE: Record<MetabolismBreakdownStepKey, string> = {
  bmr_formula: 'Formel (Mifflin-St-Jeor)',
  bmr_substitution: 'Grundumsatz',
  activity_multiplier: 'Aktivitätsfaktor',
  tdee_result: 'Erhaltungsbedarf',
};

export function germanStepTitle(key: MetabolismBreakdownStepKey): string {
  return STEP_TITLE_DE[key] ?? key;
}

export interface EnergyInputRow {
  label: string;
  value: string;
}

/**
 * The stored body-data inputs, as clear German label/value rows for the „Eingaben" block of the
 * disclosure. Reads the persisted profile as-is (no recomputation, no enum leakage).
 */
export function buildEnergyInputRows(profile: MetabolismProfile): EnergyInputRow[] {
  return [
    { label: 'Gewicht', value: `${profile.weightKg} kg` },
    { label: 'Größe', value: `${profile.heightCm} cm` },
    { label: 'Alter', value: `${profile.ageYears} Jahre` },
    { label: 'Geschlecht', value: SEX_LABEL_DE[profile.sex] },
    { label: 'Aktivitätsniveau', value: ACTIVITY_LABEL_DE[profile.activityLevel] },
  ];
}
