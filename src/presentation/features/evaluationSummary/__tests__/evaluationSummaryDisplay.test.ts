import { formatGoalProgressLabel, buildAssessmentSummary } from '../evaluationSummaryDisplay';
import type { AssessmentDetail } from '../../../../features/evaluation';

const detail = (over: Partial<AssessmentDetail>): AssessmentDetail => ({
  orientation: 'on-track',
  deviations: [],
  primary: null,
  unavailableDimensions: [],
  ...over,
});

describe('evaluationSummaryDisplay (DI-002 / GE-010)', () => {
  it('translates known goal progress labels to German', () => {
    expect(formatGoalProgressLabel('calories')).toBe('Kalorien');
    expect(formatGoalProgressLabel('protein')).toBe('Protein');
    expect(formatGoalProgressLabel('carbs')).toBe('Kohlenhydrate');
    expect(formatGoalProgressLabel('fat')).toBe('Fett');
  });

  it('falls back to the raw label for an unknown value', () => {
    expect(formatGoalProgressLabel('fiber')).toBe('fiber');
  });

  it('no-data → „Noch nichts protokolliert" with the guidance line', () => {
    const summary = buildAssessmentSummary(detail({ orientation: 'no-data' }));
    expect(summary.primary).toBe('Noch nichts protokolliert');
    expect(summary.secondary).toEqual([
      'Sobald du etwas einträgst, erscheint hier deine Auswertung.',
    ]);
  });

  it('on-track → „Im Zielbereich"', () => {
    expect(buildAssessmentSummary(detail({ orientation: 'on-track' })).primary).toBe(
      'Im Zielbereich',
    );
  });

  it('target-unavailable → „Für diese Auswertung fehlen Zielwerte." + per-dimension notes', () => {
    const summary = buildAssessmentSummary(
      detail({ orientation: 'target-unavailable', unavailableDimensions: ['calories', 'fat'] }),
    );
    expect(summary.primary).toBe('Für diese Auswertung fehlen Zielwerte.');
    expect(summary.secondary).toEqual(['Kalorien: Ziel nicht gesetzt', 'Fett: Ziel nicht gesetzt']);
  });

  it('native mixed case → calories-led primary, fat as secondary, no global „Über dem Ziel"', () => {
    const summary = buildAssessmentSummary(
      detail({
        orientation: 'mixed',
        deviations: [
          { label: 'calories', direction: 'under' },
          { label: 'protein', direction: 'under' },
          { label: 'carbs', direction: 'under' },
          { label: 'fat', direction: 'over' },
        ],
        primary: { label: 'calories', direction: 'under' },
      }),
    );
    expect(summary.primary).toBe('Kalorien unter dem Tagesziel');
    expect(summary.secondary).toEqual([
      'Protein unter dem Zielbereich',
      'Kohlenhydrate unter dem Zielbereich',
      'Fett über dem Zielbereich',
    ]);
    expect(summary.announcement).not.toContain('Über dem Ziel');
    expect(summary.announcement).toContain('Kalorien unter dem Tagesziel');
    expect(summary.announcement).toContain('Fett über dem Zielbereich');
  });

  it('single below deviation → that dimension, no magnitude adjective', () => {
    const summary = buildAssessmentSummary(
      detail({
        orientation: 'below',
        deviations: [{ label: 'protein', direction: 'under' }],
        primary: { label: 'protein', direction: 'under' },
      }),
    );
    expect(summary.primary).toBe('Protein unter dem Zielbereich');
    expect(summary.secondary).toEqual([]);
    for (const word of ['leicht', 'deutlich', 'stark', 'knapp']) {
      expect(summary.announcement).not.toContain(word);
    }
  });

  it('above orientation with calories over → „Kalorien über dem Tagesziel"', () => {
    expect(
      buildAssessmentSummary(
        detail({
          orientation: 'above',
          deviations: [{ label: 'calories', direction: 'over' }],
          primary: { label: 'calories', direction: 'over' },
        }),
      ).primary,
    ).toBe('Kalorien über dem Tagesziel');
  });
});
