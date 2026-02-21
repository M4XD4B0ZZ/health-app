export type Sex = 'male' | 'female';
export type ActivityLevel = 'low' | 'moderate' | 'high';
export type ActivityLevelSource = 'manual' | 'auto';

export interface MetabolismProfile {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  activityLevelSource?: ActivityLevelSource;
}

export type MetabolismBreakdownStepKey =
  | 'bmr_formula'
  | 'bmr_substitution'
  | 'activity_multiplier'
  | 'tdee_result';

export interface MetabolismBreakdownStep {
  key: MetabolismBreakdownStepKey;
  title: string;
  formula: string;
  substituted: string;
  result: number;
}

export interface MetabolismResult {
  bmr: number;
  tdee: number;
  steps: MetabolismBreakdownStep[];
}
