import {
  buildAssessmentDetail,
  mergeAssessmentDetails,
  AssessmentDimensionInput,
} from '../application/assessmentDetail';
import { AssessmentDetail } from '../domain/models';

const dim = (
  label: string,
  status: 'under' | 'ontrack' | 'over',
  target = 100,
): AssessmentDimensionInput => ({ label, target, status });

const allDims = (
  cal: 'under' | 'ontrack' | 'over',
  protein: 'under' | 'ontrack' | 'over',
  carbs: 'under' | 'ontrack' | 'over',
  fat: 'under' | 'ontrack' | 'over',
): AssessmentDimensionInput[] => [
  dim('calories', cal),
  dim('protein', protein),
  dim('carbs', carbs),
  dim('fat', fat),
];

describe('GE-010 buildAssessmentDetail', () => {
  it('1. no journal entries → no-data (never on-track/below/above)', () => {
    const detail = buildAssessmentDetail(allDims('under', 'under', 'under', 'under'), false);
    expect(detail.orientation).toBe('no-data');
    expect(detail.deviations).toEqual([]);
    expect(detail.primary).toBeNull();
  });

  it('2. all evaluable dimensions in corridor → on-track', () => {
    const detail = buildAssessmentDetail(allDims('ontrack', 'ontrack', 'ontrack', 'ontrack'), true);
    expect(detail.orientation).toBe('on-track');
    expect(detail.deviations).toEqual([]);
  });

  it('3. native mixed case (cal/protein/carbs under, fat over) → mixed, calories-led', () => {
    const detail = buildAssessmentDetail(allDims('under', 'under', 'under', 'over'), true);
    expect(detail.orientation).toBe('mixed');
    expect(detail.primary).toEqual({ label: 'calories', direction: 'under' });
    expect(detail.deviations).toEqual([
      { label: 'calories', direction: 'under' },
      { label: 'protein', direction: 'under' },
      { label: 'carbs', direction: 'under' },
      { label: 'fat', direction: 'over' },
    ]);
  });

  it('4. calories above, macros within → above, calories primary', () => {
    const detail = buildAssessmentDetail(allDims('over', 'ontrack', 'ontrack', 'ontrack'), true);
    expect(detail.orientation).toBe('above');
    expect(detail.primary).toEqual({ label: 'calories', direction: 'over' });
  });

  it('5. protein below, others within → below, protein primary', () => {
    const detail = buildAssessmentDetail(allDims('ontrack', 'under', 'ontrack', 'ontrack'), true);
    expect(detail.orientation).toBe('below');
    expect(detail.primary).toEqual({ label: 'protein', direction: 'under' });
  });

  it('6. several dimensions above → above', () => {
    const detail = buildAssessmentDetail(allDims('over', 'ontrack', 'over', 'over'), true);
    expect(detail.orientation).toBe('above');
    expect(detail.primary).toEqual({ label: 'calories', direction: 'over' });
  });

  it('7. calories and several macros below → below', () => {
    const detail = buildAssessmentDetail(allDims('under', 'under', 'under', 'ontrack'), true);
    expect(detail.orientation).toBe('below');
  });

  it('8. calories above and protein below → mixed, both directions retained, calories primary', () => {
    const detail = buildAssessmentDetail(allDims('over', 'under', 'ontrack', 'ontrack'), true);
    expect(detail.orientation).toBe('mixed');
    expect(detail.primary).toEqual({ label: 'calories', direction: 'over' });
    expect(detail.deviations).toEqual([
      { label: 'calories', direction: 'over' },
      { label: 'protein', direction: 'under' },
    ]);
  });

  it('9/10. a single deviation carries direction only — no magnitude concept exists', () => {
    const slight = buildAssessmentDetail(allDims('ontrack', 'ontrack', 'ontrack', 'over'), true);
    const far = buildAssessmentDetail(allDims('ontrack', 'ontrack', 'ontrack', 'over'), true);
    expect(slight.primary).toEqual({ label: 'fat', direction: 'over' });
    expect(far).toEqual(slight);
    expect(Object.keys(slight.primary!)).toEqual(['label', 'direction']); // no magnitude field
  });

  it('11. a missing target is excluded from below/above; other dimensions still evaluated', () => {
    const dims: AssessmentDimensionInput[] = [
      dim('calories', 'under', 2000),
      { label: 'protein', target: 0, status: 'under' }, // target unavailable
      dim('carbs', 'ontrack', 200),
      dim('fat', 'over', 70),
    ];
    const detail = buildAssessmentDetail(dims, true);
    expect(detail.unavailableDimensions).toEqual(['protein']);
    expect(detail.deviations.map((d) => d.label)).toEqual(['calories', 'fat']); // protein excluded
    expect(detail.orientation).toBe('mixed'); // calories under + fat over
  });

  it('12. all targets unavailable → target-unavailable', () => {
    const dims: AssessmentDimensionInput[] = [
      { label: 'calories', target: 0, status: 'under' },
      { label: 'protein', target: Number.NaN, status: 'under' },
      { label: 'carbs', target: -5, status: 'under' },
      { label: 'fat', target: Number.POSITIVE_INFINITY, status: 'under' },
    ];
    const detail = buildAssessmentDetail(dims, true);
    expect(detail.orientation).toBe('target-unavailable');
    expect(detail.unavailableDimensions).toEqual(['calories', 'protein', 'carbs', 'fat']);
    expect(detail.deviations).toEqual([]);
  });

  it('20. primary is deterministic in the established display order regardless of input order', () => {
    const shuffled: AssessmentDimensionInput[] = [
      dim('fat', 'over'),
      dim('carbs', 'under'),
      dim('calories', 'under'),
      dim('protein', 'under'),
    ];
    const detail = buildAssessmentDetail(shuffled, true);
    expect(detail.primary).toEqual({ label: 'calories', direction: 'under' });
    expect(detail.deviations.map((d) => d.label)).toEqual(['calories', 'protein', 'carbs', 'fat']);
  });
});

describe('GE-010 mergeAssessmentDetails', () => {
  const below: AssessmentDetail = {
    orientation: 'below',
    deviations: [{ label: 'calories', direction: 'under' }],
    primary: { label: 'calories', direction: 'under' },
    unavailableDimensions: [],
  };

  it('empty → no-data', () => {
    expect(mergeAssessmentDetails([]).orientation).toBe('no-data');
  });

  it('single detail passes through unchanged', () => {
    expect(mergeAssessmentDetails([below])).toBe(below);
  });

  it('all no-data → no-data', () => {
    const noData: AssessmentDetail = {
      orientation: 'no-data',
      deviations: [],
      primary: null,
      unavailableDimensions: [],
    };
    expect(mergeAssessmentDetails([noData, noData]).orientation).toBe('no-data');
  });

  it('unions deviations across rules and recomputes orientation (mixed) in display order', () => {
    const over: AssessmentDetail = {
      orientation: 'above',
      deviations: [{ label: 'fat', direction: 'over' }],
      primary: { label: 'fat', direction: 'over' },
      unavailableDimensions: [],
    };
    const merged = mergeAssessmentDetails([below, over]);
    expect(merged.orientation).toBe('mixed');
    expect(merged.deviations).toEqual([
      { label: 'calories', direction: 'under' },
      { label: 'fat', direction: 'over' },
    ]);
    expect(merged.primary).toEqual({ label: 'calories', direction: 'under' });
  });
});
