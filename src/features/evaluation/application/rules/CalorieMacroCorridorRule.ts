import { Rule, RuleResult, EvaluationInput, EvaluationGoalProgress } from '../../domain/models';
import { DailyGoals } from '../../../goals/domain/models/GoalsTypes';
import { calculateDailyProgress } from '../../../goals/application/calculators/ProgressCalculator';
import { aggregateConsumed } from '../../../journal/application/calculators/ConsumedMacrosCalculator';

/**
 * GE-002: this Rule's `profileSettings` shape — the Evidence-based Standard's only
 * per-profile parameter is the (already-computed) daily macro targets.
 */
export interface CalorieMacroCorridorSettings {
  goals: DailyGoals;
}

function statusFor(consumed: number, target: number): 'under' | 'ontrack' | 'over' {
  if (target <= 0) {
    return 'under';
  }
  if (consumed > target * 1.05) {
    return 'over';
  }
  if (consumed >= target * 0.95) {
    return 'ontrack';
  }
  return 'under';
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

    const goalProgress: EvaluationGoalProgress[] = [
      {
        label: 'calories',
        consumed: progress.consumedCalories,
        target: goals.calories,
        remaining: progress.remainingCalories,
        status: statusFor(progress.consumedCalories, goals.calories),
      },
      {
        label: 'protein',
        consumed: progress.proteinConsumed,
        target: goals.protein,
        remaining: progress.proteinRemaining,
        status: statusFor(progress.proteinConsumed, goals.protein),
      },
      {
        label: 'carbs',
        consumed: progress.carbsConsumed,
        target: goals.carbs,
        remaining: progress.carbsRemaining,
        status: statusFor(progress.carbsConsumed, goals.carbs),
      },
      {
        label: 'fat',
        consumed: progress.fatConsumed,
        target: goals.fat,
        remaining: progress.fatRemaining,
        status: statusFor(progress.fatConsumed, goals.fat),
      },
    ];

    const warnings: string[] = [];
    if (progress.isOverCalories) {
      warnings.push('Kalorienziel überschritten.');
    }

    return {
      assessment: goalProgress.some((g) => g.status === 'over') ? 'over' : 'on-track',
      insights: [],
      warnings,
      recommendations: [],
      goalProgress,
    };
  },
};
