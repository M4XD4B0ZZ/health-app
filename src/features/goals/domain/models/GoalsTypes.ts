import { SyncStatus } from '../../../../infrastructure/sync/SyncStatus';

export type GoalsMode = 'suggested' | 'manual';

export interface DailyGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GoalsSuggestion {
  goals: DailyGoals;
  rationale: string;
  macroStrategy: string;
  createdAt: string; // ISO
}

export interface EffectiveGoals {
  mode: GoalsMode;
  goals: DailyGoals;
  // Snapshot must be stored so suggested goals do not change when MetabolismProfile changes later
  suggestionSnapshot?: GoalsSuggestion;
  /**
   * ACC-004: local sync-readiness fields — see `FoodEntry`'s identical fields for the full
   * rationale (ACC-001 plan §7/§9/§20). Always `undefined` until Phase 2 exists. Unlike the
   * other three domain models, `EffectiveGoals` has no local `id` at all (a singleton, one
   * row per install) — its eventual server-side identity is the owning `userId` itself
   * (ACC-001 plan §15's `user_goal_settings` table uses `user_id` as its primary key).
   */
  revision?: number;
  userId?: string;
  syncStatus?: SyncStatus;
}
