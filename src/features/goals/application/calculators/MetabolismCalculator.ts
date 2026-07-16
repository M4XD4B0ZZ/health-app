import { MetabolismProfile, MetabolismBreakdownStep } from '../../domain/models/MetabolismTypes';

export type BmrFormula = 'mifflin_st_jeor';

/**
 * Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor formula
 * Male: 10*w + 6.25*h - 5*a + 5
 * Female: 10*w + 6.25*h - 5*a - 161
 */
export function calculateBmr(profile: MetabolismProfile): {
  bmr: number;
  steps: MetabolismBreakdownStep[];
} {
  const { weightKg, heightCm, ageYears, sex } = profile;

  const w = weightKg;
  const h = heightCm;
  const a = ageYears;

  const steps: MetabolismBreakdownStep[] = [];

  // Step 1: Formula
  const formula =
    sex === 'male'
      ? '10 × weight + 6.25 × height - 5 × age + 5'
      : '10 × weight + 6.25 × height - 5 × age - 161';

  steps.push({
    key: 'bmr_formula',
    title: 'BMR Formula (Mifflin-St Jeor)',
    formula,
    substituted: formula,
    // No result yet — this step only states the formula, values are substituted in the next step.
  });

  // Step 2: Substitution
  const sexConstant = sex === 'male' ? 5 : -161;
  const bmrRaw = 10 * w + 6.25 * h - 5 * a + sexConstant;
  const bmr = Math.round(bmrRaw);

  const substituted =
    sex === 'male'
      ? `10 × ${w} + 6.25 × ${h} - 5 × ${a} + 5`
      : `10 × ${w} + 6.25 × ${h} - 5 × ${a} - 161`;

  steps.push({
    key: 'bmr_substitution',
    title: 'BMR Calculation',
    formula,
    substituted,
    result: bmr,
  });

  return { bmr, steps };
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure) from BMR and activity level
 */
export function calculateTdee(
  profile: MetabolismProfile,
  bmr: number,
): { tdee: number; steps: MetabolismBreakdownStep[] } {
  const { activityLevel } = profile;

  // Activity multipliers
  const multipliers: Record<typeof activityLevel, number> = {
    low: 1.2,
    moderate: 1.55,
    high: 1.725,
  };

  const multiplier = multipliers[activityLevel];
  const tdeeRaw = bmr * multiplier;
  const tdee = Math.round(tdeeRaw);

  const steps: MetabolismBreakdownStep[] = [];

  // Step 3: Activity multiplier
  steps.push({
    key: 'activity_multiplier',
    title: 'Activity Multiplier',
    formula: `BMR × ${multiplier}`,
    substituted: `${bmr} × ${multiplier}`,
    result: tdee,
  });

  // Step 4: TDEE result
  steps.push({
    key: 'tdee_result',
    title: 'Total Daily Energy Expenditure',
    formula: 'BMR × Activity Factor',
    substituted: `${bmr} × ${multiplier}`,
    result: tdee,
  });

  return { tdee, steps };
}
