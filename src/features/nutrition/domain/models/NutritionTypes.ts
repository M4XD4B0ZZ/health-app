import { AssumptionTag } from './AssumptionTag';
import { DecisionMeta } from './DecisionMeta';
import { ResolverDecisionSummary } from './ResolverDecisionSummary';
import { FoodSourceType } from '../catalog/FoodCatalogSource';
import { SyncStatus } from '../../../../infrastructure/sync/SyncStatus';

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
  /**
   * J-003 / Journal Decision Record 1 Entscheidung 1: tombstone timestamp. Set instead of
   * physically removing the entry on delete. Repositories filter tombstoned entries out of
   * their normal read paths (listEntriesForDate/listByDateRange/getEntryById).
   */
  deletedAt?: Date;
  /**
   * ACC-004: local sync-readiness fields — reserved schema room for Phase 2's sync engine,
   * added alongside ACC-002/ACC-003 rather than as a third separate local migration. All
   * three stay `undefined` on every record created or migrated by this task; nothing here
   * populates them. `revision` mirrors the server-assigned monotonic counter from the
   * ACC-001 plan's conflict-resolution model (§9); `userId` is the eventual owning account
   * (§7); `syncStatus` is the local sync-status UI state (§20, see `SyncStatus`).
   */
  revision?: number;
  userId?: string;
  syncStatus?: SyncStatus;
}

/**
 * J-003 / Journal Decision Record 1 Entscheidung 1: append-only audit record written on
 * every edit and delete. Internal only — not exposed in any UI-facing read path.
 */
export interface CorrectionLogEntry {
  timestamp: Date;
  previousValues: FoodEntry;
  triggeredBy: 'user' | 'system';
}

/**
 * J-005 / Journal Decision Record 1 Entscheidung 2: transient signal attached to a logging
 * use case's return value when the just-persisted entry was silently merged into a recent
 * same-food entry (auto-merge), so the caller can surface a visible, undoable notification.
 * Never persisted — repositories only serialize the fields they know about.
 */
export interface AutoMergeInfo {
  previousValues: FoodEntry;
  correctionLogTimestamp: Date;
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
