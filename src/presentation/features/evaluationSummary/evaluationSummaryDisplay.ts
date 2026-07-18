import type { AssessmentDetail, DimensionDeviation } from '../../../features/evaluation';

/**
 * DI-002 / GE-010: presentation-only label translations — purely display formatting, no
 * evaluation logic (that stays in `features/evaluation`). The screen consumes the
 * domain-computed `AssessmentDetail`; this module only turns it into user-facing German.
 * User-facing wording uses „Zielbereich"; „Korridor" stays internal domain language.
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

// GE-010: accepted per-dimension wording (calories use „Tagesziel"; macros use „Zielbereich").
const DIMENSION_PHRASES: Record<string, { under: string; over: string }> = {
  calories: { under: 'Kalorien unter dem Tagesziel', over: 'Kalorien über dem Tagesziel' },
  protein: { under: 'Protein unter dem Zielbereich', over: 'Protein über dem Zielbereich' },
  carbs: {
    under: 'Kohlenhydrate unter dem Zielbereich',
    over: 'Kohlenhydrate über dem Zielbereich',
  },
  fat: { under: 'Fett unter dem Zielbereich', over: 'Fett über dem Zielbereich' },
};

function deviationPhrase(deviation: DimensionDeviation): string {
  const phrases = DIMENSION_PHRASES[deviation.label];
  if (!phrases) return formatGoalProgressLabel(deviation.label);
  return deviation.direction === 'over' ? phrases.over : phrases.under;
}

export interface AssessmentSummary {
  /** The single leading statement for „Heutige Bewertung". */
  primary: string;
  /** Remaining mixed-state context + „Ziel nicht gesetzt" notes; never collapsed away. */
  secondary: string[];
  /** Primary + secondary joined — the screen-reader announcement. */
  announcement: string;
}

function summary(primary: string, secondary: string[]): AssessmentSummary {
  return { primary, secondary, announcement: [primary, ...secondary].join('. ') };
}

/**
 * GE-010: format the domain-computed `AssessmentDetail` into a nutrient-specific summary. No
 * status is re-derived here (that would duplicate rule logic) — this only maps facts to
 * approved German wording. A mixed day keeps every deviation visible; no over/below collapse.
 */
export function buildAssessmentSummary(detail: AssessmentDetail): AssessmentSummary {
  const unavailableNotes = detail.unavailableDimensions.map(
    (label) => `${formatGoalProgressLabel(label)}: Ziel nicht gesetzt`,
  );

  switch (detail.orientation) {
    case 'no-data':
      return summary('Noch nichts protokolliert', [
        'Sobald du etwas einträgst, erscheint hier deine Auswertung.',
      ]);
    case 'target-unavailable':
      return summary('Für diese Auswertung fehlen Zielwerte.', unavailableNotes);
    case 'on-track':
      return summary('Im Zielbereich', unavailableNotes);
    default: {
      const primary = detail.primary ? deviationPhrase(detail.primary) : 'Im Zielbereich';
      const others = detail.deviations
        .filter((d) => !detail.primary || d.label !== detail.primary.label)
        .map(deviationPhrase);
      return summary(primary, [...others, ...unavailableNotes]);
    }
  }
}
