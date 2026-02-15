import { NutritionSourceType } from './NutritionTypes';

export interface ConfidenceMetadata {
  score: number;
  reason: string;
  sourceType: NutritionSourceType;
}
