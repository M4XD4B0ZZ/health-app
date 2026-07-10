/**
 * GE-001 / Product Bible §4 "Evaluation Profile — Konzeptvertrag".
 *
 * An EvaluationProfile is a named bundle of Rules, never an algorithm of its own
 * (§4a: "Ein Profile ist ein benanntes Bündel von Regeln, kein eigener Algorithmus").
 * Pure metadata + composition — no `evaluate` method here; evaluation logic lives on
 * each `Rule` (see Rule.ts).
 */

/**
 * §4 "Origin (Herkunft)": Preset (Zera-curated), User (formerly "Custom"), plus the
 * reserved-but-not-yet-implemented Professional/Community/AI origin categories.
 */
export type EvaluationProfileOrigin = 'preset' | 'user' | 'professional' | 'community' | 'ai';

/**
 * §4 "Reifegrad" — maturity of a profile, independent of its Origin.
 */
export type EvaluationProfileMaturity = 'candidate' | 'mvp' | 'complete';

export interface EvaluationProfileMetadata {
  /** §4 "Zielgruppenbeschreibung/Motivation (aus Founding Brief Abschnitt 6 abgeleitet)". */
  motivation?: string;
  /** §4 "Reifegrad". */
  maturity?: EvaluationProfileMaturity;
}

export interface EvaluationProfile {
  id: string;
  name: string;
  origin: EvaluationProfileOrigin;
  /** §4a: "Zusammensetzung: welche Regeln dieses Profile aktiviert". */
  ruleIds: string[];
  metadata: EvaluationProfileMetadata;
}
