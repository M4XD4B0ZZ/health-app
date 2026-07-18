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

    const result = dailyProgressToEvaluationOutput(
      progress,
      goals,
      'Kalorienziel überschritten.',
      input.journalReadsForPeriod.length > 0,
    );

    // DI-003: real Insights & Recommendations content, not just progress numbers.
    const caloriesProgress = result.goalProgress.find((g) => g.label === 'calories')!;
    const proteinProgress = result.goalProgress.find((g) => g.label === 'protein')!;

    const insights = [...result.insights];
    if (proteinProgress.status === 'under' && proteinProgress.remaining > 0) {
      insights.push(
        `Noch ${Math.round(proteinProgress.remaining)} g Protein übrig, um das Tagesziel zu erreichen.`,
      );
    }

    const recommendations = [...result.recommendations];
    if (caloriesProgress.status === 'under' && proteinProgress.status !== 'under') {
      recommendations.push(
        'Kalorienziel ist noch nicht erreicht, Proteinziel aber schon — eine ausgewogene, kalorienreichere Mahlzeit ist möglich.',
      );
    }

    return { ...result, insights, recommendations };
  },
};
