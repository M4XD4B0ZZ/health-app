import { Rule, RuleResult, EvaluationInput } from '../../domain/models';
import { DailyGoals } from '../../../goals/domain/models/GoalsTypes';
import { calculateDailyProgress } from '../../../goals/application/calculators/ProgressCalculator';
import { aggregateConsumed } from '../../../journal/application/calculators/ConsumedMacrosCalculator';
import { dailyProgressToEvaluationOutput } from './dailyProgressToEvaluationOutput';

/**
 * GE-002: this Rule's `profileSettings` shape — the Evidence-based Standard's only
 * per-profile parameter is the (already-computed) daily macro targets.
 */
export interface CalorieMacroCorridorSettings {
  goals: DailyGoals;
}

/**
 * GE-002: wraps the existing, already screen-wired
 * `features/goals/application/calculators/ProgressCalculator.calculateDailyProgress` as a
 * GE-001 `Rule` — same consumed/target/remaining numbers `ComputeProgressForDateUseCase`
 * already produces today, just reshaped into an `EvaluationOutput`.
 */
export const CalorieMacroCorridorRule: Rule = {
  id: 'calorie-macro-corridor',
  name: 'Kalorien-/Makro-Korridor',
  description:
    'Bewertet die Tagesmakros gegen einen Kalorien-/Makro-Zielkorridor (Evidence-based Standard, keine aggressive Restriktion).',
  evaluate(input: EvaluationInput): RuleResult {
    const { goals } = input.profileSettings as unknown as CalorieMacroCorridorSettings;
    const consumed = aggregateConsumed(input.journalReadsForPeriod);
    const progress = calculateDailyProgress(consumed, goals);

    return dailyProgressToEvaluationOutput(progress, goals, 'Kalorienziel überschritten.');
  },
};
