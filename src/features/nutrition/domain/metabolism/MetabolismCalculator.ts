import { ActivityLevel } from '../goals/ActivityLevel';
import { MetabolismInputs } from './MetabolismInputs';
import { MetabolismBreakdown } from './MetabolismBreakdown';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  low: 1.2,
  moderate: 1.55,
  high: 1.725,
};

export function getActivityFactor(level: ActivityLevel): number {
  return ACTIVITY_FACTORS[level];
}

export function calculateBmrMifflinStJeor(inputs: MetabolismInputs): number {
  const sexOffset = inputs.sex === 'male' ? 5 : -161;
  const bmr = 10 * inputs.weightKg + 6.25 * inputs.heightCm - 5 * inputs.ageYears + sexOffset;
  return Math.round(bmr);
}

export function calculateMetabolismBreakdown(inputs: MetabolismInputs): MetabolismBreakdown {
  const bmrKcal = calculateBmrMifflinStJeor(inputs);
  const activityFactor = getActivityFactor(inputs.activityLevel);
  const tdeeKcal = Math.round(bmrKcal * activityFactor);

  return {
    bmrKcal,
    tdeeKcal,
    activityFactor,
    formula: 'mifflin_st_jeor',
    explanationDe: `Grundumsatz nach Mifflin-St Jeor berechnet, dann mit Aktivitätsfaktor ${activityFactor} multipliziert.`,
    detailLinesDe: [
      `BMR: ${bmrKcal} kcal (Mifflin-St Jeor).`,
      `Aktivitätslevel: ${inputs.activityLevel} (${activityFactor}).`,
      `TDEE: ${bmrKcal} x ${activityFactor} = ${tdeeKcal} kcal.`,
    ],
  };
}
