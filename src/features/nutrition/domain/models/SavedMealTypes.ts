import { FoodSourceType } from '../catalog/FoodCatalogSource';
import { NutritionPer100g } from './NutritionTypes';
import { SyncStatus } from '../../../../infrastructure/sync/SyncStatus';

/**
 * SavedMealTemplate Domain Model
 * Repräsentiert eine gespeicherte Mahlzeit mit mehreren Food Items.
 */
export interface SavedMealTemplate {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: Date;
  updatedAt: Date;
  /**
   * ACC-002: tombstone timestamp, set instead of physically removing the template on
   * delete — mirrors `FoodEntry.deletedAt` (J-003). Repositories filter tombstoned
   * templates out of their normal read paths (`list`/`getById`); only the explicit
   * `listIncludingDeleted`/`getByIdIncludingDeleted` queries can see them.
   */
  deletedAt?: Date;
  /**
   * ACC-004: local sync-readiness fields — see `FoodEntry`'s identical fields for the full
   * rationale (ACC-001 plan §7/§9/§20). Always `undefined` until Phase 2 exists.
   */
  revision?: number;
  userId?: string;
  syncStatus?: SyncStatus;
}

/**
 * Ein einzelnes Item innerhalb einer SavedMeal-Vorlage.
 */
export interface SavedMealItem {
  parsedName: string;
  quantityGrams: number;
  /**
   * SM-001: reference to the Food Catalog entry the source FoodEntry was matched to at
   * template-creation time (same shape as FoodEntry.foodCatalogRef), so logging this item
   * later can reuse the exact same identity instead of re-resolving by name. Absent when
   * the source entry had none (e.g. pure AI fallback or pre-J-004 entries).
   */
  foodCatalogRef?: {
    source: FoodSourceType;
    sourceId: string;
    displayName: string;
    confidence: number;
  };
  /**
   * SM-002: frozen per-100g macro snapshot derived from the source FoodEntry at
   * template-creation time (`entry macros * 100 / entry.quantityGrams`). Lets logging this
   * item later (SM-002) compute macros deterministically without re-resolving the food by
   * name or depending on any Food Catalog source still being queryable by `foodCatalogRef` —
   * mirrors the Journal Model's frozen-snapshot philosophy (`FoodEntry.nutritionSnapshot`).
   * Absent only for templates created before this field existed.
   */
  per100g?: NutritionPer100g;
}
