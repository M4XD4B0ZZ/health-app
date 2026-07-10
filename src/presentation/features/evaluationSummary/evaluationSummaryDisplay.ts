/**
 * DI-002: presentation-only label translations for `EvaluationGoalProgress.label`/
 * `EvaluationOutput.assessment` — purely display formatting, no evaluation logic (that
 * stays in `features/evaluation`).
 */
const GOAL_PROGRESS_LABELS: Record<string, string> = {
  calories: 'Kalorien',
  protein: 'Protein',
  carbs: 'Kohlenhydrate',
  fat: 'Fett',
};

export function formatGoalProgressLabel(label: string): string {
  return GOAL_PROGRESS_LABELS[label] ?? label;
}

const ASSESSMENT_LABELS: Record<string, string> = {
  'on-track': 'Im Zielkorridor',
  over: 'Über dem Ziel',
  'no-data': 'Keine Daten',
};

export function formatAssessment(assessment: string): string {
  return ASSESSMENT_LABELS[assessment] ?? assessment;
}
