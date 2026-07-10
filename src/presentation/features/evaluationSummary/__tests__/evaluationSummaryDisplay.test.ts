import { formatGoalProgressLabel, formatAssessment } from '../evaluationSummaryDisplay';

describe('evaluationSummaryDisplay (DI-002)', () => {
  it('translates known goal progress labels to German', () => {
    expect(formatGoalProgressLabel('calories')).toBe('Kalorien');
    expect(formatGoalProgressLabel('protein')).toBe('Protein');
    expect(formatGoalProgressLabel('carbs')).toBe('Kohlenhydrate');
    expect(formatGoalProgressLabel('fat')).toBe('Fett');
  });

  it('falls back to the raw label for an unknown value', () => {
    expect(formatGoalProgressLabel('fiber')).toBe('fiber');
  });

  it('translates known assessment values to German', () => {
    expect(formatAssessment('on-track')).toBe('Im Zielkorridor');
    expect(formatAssessment('over')).toBe('Über dem Ziel');
    expect(formatAssessment('no-data')).toBe('Keine Daten');
  });

  it('falls back to the raw assessment for an unknown value', () => {
    expect(formatAssessment('under')).toBe('under');
  });
});
