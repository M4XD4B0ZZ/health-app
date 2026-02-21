export type NutritionSourceType = 'user' | 'cache' | 'branded' | 'generic' | 'ai';

export interface FoodEntry {
  id: string;
  rawInput: string;
  parsedName: string;
  quantityGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidenceScore: number; // 0..1
  sourceType: NutritionSourceType;
  createdAt: Date;
  explanation?: string;
  confidenceReason?: string;
  lastModifiedAt?: Date;
}

export interface DailyNutritionSummary {
  date: string; // ISO (YYYY-MM-DD)
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entries: FoodEntry[];
}

export interface ParsedInput {
  rawInput: string;
  parsedName: string;
  quantityGrams: number;
  hasExplicitQuantity: boolean;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ConfidenceRule {
  sourceType: NutritionSourceType;
  score: number;
  label: 'exact' | 'high' | 'medium' | 'estimated' | 'low';
  warning: boolean;
}

/**
 * Deterministische Confidence-Regeln.
 * AI sollte nur dann in die Pipeline gehen, wenn die Unsicherheit hoch ist.
 */
export const CONFIDENCE_RULES: ReadonlyArray<ConfidenceRule> = [
  { sourceType: 'branded', score: 1.0, label: 'exact', warning: false },
  { sourceType: 'cache', score: 0.8, label: 'high', warning: false },
  { sourceType: 'generic', score: 0.6, label: 'medium', warning: false },
  { sourceType: 'ai', score: 0.4, label: 'estimated', warning: false },
  { sourceType: 'user', score: 0.3, label: 'low', warning: true },
];

export const LOW_CONFIDENCE_THRESHOLD = 0.4;
