import { EvaluationInput, EvaluationOutput } from './EvaluationContract';

/**
 * GE-001 / Product Bible §4a "Regel — Konzeptvertrag".
 *
 * A Rule's result is shaped exactly like an EvaluationOutput — a Profile's own
 * EvaluationOutput is the merge of its Rules' RuleResults (merge logic is implementation,
 * not part of this contract-only task).
 */
export type RuleResult = EvaluationOutput;

/**
 * The atomic, reusable evaluation unit (§4a: "Die Regel ist die atomare, wiederverwendbare
 * Bewertungseinheit — nicht das Profile"). Independent of any specific Profile; the same
 * Rule id can appear in multiple Profiles regardless of their Origin.
 *
 * `evaluate` is a pure, synchronous function: all reads (Food Catalog, Journal, profile
 * settings) happen before a Rule ever runs, when `EvaluationInput` is assembled — matching
 * §4a's "rein lesend, reproduzierbar, kein eigener Speicher".
 */
export interface Rule {
  id: string;
  name: string;
  /** Kurze, nachvollziehbare Bewertungslogik-Beschreibung. */
  description: string;
  /**
   * §4a: "deklariert ihren Datenbedarf über die Journal-Basisdaten hinaus, sofern
   * vorhanden" — e.g. `['fiber']` for a net-carbs rule. Optional; absent means no
   * additional Food Catalog data beyond macros is required.
   */
  dataRequirements?: string[];
  evaluate(input: EvaluationInput): RuleResult;
}
