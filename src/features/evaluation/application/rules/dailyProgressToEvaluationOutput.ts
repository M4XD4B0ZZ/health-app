import { DailyProgress } from '../../../goals/domain/models/ProgressTypes';
import { DailyGoals } from '../../../goals/domain/models/GoalsTypes';
import { RuleResult, EvaluationGoalProgress } from '../../domain/models';
import { buildAssessmentDetail } from '../assessmentDetail';

/**
 * GE-004: shared reshaping logic extracted from GE-002's CalorieMacroCorridorRule (no
 * behavior change there) so WeightLossProfile's ProteinPreservingDeficitRule doesn't
 * duplicate it. Turns an existing `features/goals` DailyProgress/DailyGoals pair into a
 * GE-001 RuleResult.
 */
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

export function dailyProgressToEvaluationOutput(
  progress: DailyProgress,
  goals: DailyGoals,
  overCaloriesWarning: string,
  hasEntries: boolean,
): RuleResult {
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
    warnings.push(overCaloriesWarning);
  }

  // GE-010: nutrient-specific structured assessment — no more `some(over) ? 'over' : 'on-track'`
  // collapse. Derived deterministically from the same per-dimension corridor statuses.
  const assessmentDetail = buildAssessmentDetail(
    goalProgress.map((g) => ({ label: g.label, target: g.target, status: g.status })),
    hasEntries,
  );

  return {
    assessment: assessmentDetail.orientation,
    assessmentDetail,
    insights: [],
    warnings,
    recommendations: [],
    goalProgress,
  };
}
