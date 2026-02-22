import { ActivityLevel } from './ActivityLevel';

export interface UserGoals {
  caloriesTargetKcal: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  activityLevel: ActivityLevel;
  updatedAt: string;
  source: 'manual' | 'calculated';
}
