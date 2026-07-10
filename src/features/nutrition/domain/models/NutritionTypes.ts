import { AssumptionTag } from './AssumptionTag';
import { DecisionMeta } from './DecisionMeta';
import { ResolverDecisionSummary } from './ResolverDecisionSummary';
import { FoodSourceType } from '../catalog/FoodCatalogSource';

export type NutritionSourceType = 'user' | 'cache' | 'branded' | 'generic' | 'ai';

export interface FoodEntry {
  id: string;
  rawInput: string;
  parsedName: string;
  quantityGrams: number;
  grams?: number | null;
  servingMultiplier?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidenceScore: number; // 0..1
  sourceType: NutritionSourceType;
  createdAt: Date;
  explanation?: string;
  calcBreakdown?: {
    per100g: NutritionPer100g;
    gramsUsed: number;
    multiplier: number;
  };
  editNote?: string;
  resolverDecisionSummary?: ResolverDecisionSummary;
  logDecision?: DecisionMeta;
  lastEditDecision?: DecisionMeta;
  assumptions?: AssumptionTag[];
  confidenceReason?: string;
  lastModifiedAt?: Date;
  /** P1-003C: shared id linking this entry to sibling entries under the same composite-dish label. */
  groupId?: string;
  /** P1-003C: the composite-dish head text (e.g. "Fruchtsalat"), never resolved as a standalone entry itself. */
  groupLabel?: string;
  /**
   * J-002 / Journal Decision Record 1 Entscheidung 3: explicit grouping of the frozen
   * macro snapshot (same numbers as the top-level calories/protein/carbs/fat fields,
   * which remain the source of truth for now — no read site is migrated by this task).
   */
  nutritionSnapshot?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /**
   * J-002 / Journal Decision Record 1 Entscheidung 3: reference to the Food Catalog row
   * the resolver actually matched, if any (absent for pure AI fallback or unmatched manual
   * input). Points at a stable identity, not a Food Catalog version. Not yet populated by
   * any write path — wiring belongs to J-004 (Food References).
   */
  foodCatalogRef?: {
    source: FoodSourceType;
    sourceId: string;
    displayName: string;
    confidence: number;
  };
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
export const CONFIDENCE_RULES: readonly ConfidenceRule[] = [
  { sourceType: 'branded', score: 1.0, label: 'exact', warning: false },
  { sourceType: 'cache', score: 0.8, label: 'high', warning: false },
  { sourceType: 'generic', score: 0.6, label: 'medium', warning: false },
  { sourceType: 'ai', score: 0.4, label: 'estimated', warning: false },
  { sourceType: 'user', score: 0.3, label: 'low', warning: true },
];

export const LOW_CONFIDENCE_THRESHOLD = 0.4;
