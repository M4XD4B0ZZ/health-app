import { Rule, RuleResult, EvaluationInput } from '../../domain/models';
import { calculateDailyProgress } from '../../../goals/application/calculators/ProgressCalculator';
import { suggestDailyGoals } from '../../../goals/application/calculators/GoalsSuggestionCalculator';
import { aggregateConsumed } from '../../../journal/application/calculators/ConsumedMacrosCalculator';
import { dailyProgressToEvaluationOutput } from './dailyProgressToEvaluationOutput';

/**
 * GE-004: this Rule's `profileSettings` shape — TDEE is computed asynchronously elsewhere
 * (`ComputeMetabolismResultUseCase`, unchanged) and passed in as a plain number, since
 * `Rule.evaluate` is synchronous by contract (GE-001).
 */
export interface ProteinPreservingDeficitSettings {
  tdee: number;
}

/** Product Bible §5 "Weight Loss": Kaloriendefizit — 20% below maintenance (TDEE). */
export const WEIGHT_LOSS_DEFICIT_MULTIPLIER = 0.8;

/**
 * GE-004 / Product Bible §5 "Weight Loss": Kaloriendefizit + Proteinerhalt zum
 * Muskelschutz. Reuses the existing (unmodified) `suggestDailyGoals`'s `'high_protein'`
 * macro split against a deficit-adjusted calorie target, rather than introducing new macro
 * math — the same deficit-adjusted `DailyGoals` are then evaluated with the same
 * `calculateDailyProgress` GE-002's rule uses, proving the contract composes for a second,
 * genuinely different Preset.
 */
export const ProteinPreservingDeficitRule: Rule = {
  id: 'protein-preserving-deficit',
  name: 'Kaloriendefizit mit Proteinerhalt',
  description:
    'Bewertet Tagesmakros gegen einen Kaloriendefizit-Korridor (20% unter TDEE) mit proteinbetonter Makroverteilung, um Muskelmasse während der Gewichtsabnahme zu erhalten.',
  evaluate(input: EvaluationInput): RuleResult {
    const { tdee } = input.profileSettings as unknown as ProteinPreservingDeficitSettings;
    const deficitCalories = tdee * WEIGHT_LOSS_DEFICIT_MULTIPLIER;
    const goals = suggestDailyGoals(deficitCalories, 'high_protein');

    const consumed = aggregateConsumed(input.journalReadsForPeriod);
    const progress = calculateDailyProgress(consumed, goals);

    return dailyProgressToEvaluationOutput(
      progress,
      goals,
      'Kaloriendefizit-Ziel überschritten.',
    );
  },
};
