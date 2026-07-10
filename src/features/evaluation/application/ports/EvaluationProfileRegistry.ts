import { EvaluationProfile } from '../../domain/models';

/**
 * GE-003: exposes the known EvaluationProfiles (code-defined Presets, per Product Bible
 * §4/§5 — not user data) and persists which one is currently active. Switching the active
 * profile is a pure read-context change (§2a Variante B) — this port has no method that
 * could ever write Journal or Food Catalog data.
 */
export interface EvaluationProfileRegistry {
  list(): EvaluationProfile[];
  getActiveProfileId(): Promise<string>;
  setActiveProfileId(id: string): Promise<void>;
}
