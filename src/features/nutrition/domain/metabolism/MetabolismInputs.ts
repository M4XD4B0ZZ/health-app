import { ActivityLevel } from '../goals/ActivityLevel';

export interface MetabolismInputs {
  sex: 'male' | 'female';
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}
