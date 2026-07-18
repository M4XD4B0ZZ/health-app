import { AssessmentDetail, AssessmentOrientation, DimensionDeviation } from '../domain/models';

/**
 * GE-010: the established progress-card display order. `primary` and `deviations` follow this
 * order — a presentation ordering, NOT a medical severity ranking. No single dimension may
 * dominate the overall orientation (calories are not prioritized ahead of, nor behind, the
 * macros for the *orientation* itself — orientation stays `mixed` when directions differ).
 */
export const ASSESSMENT_DIMENSION_ORDER = ['calories', 'protein', 'carbs', 'fat'] as const;

export interface AssessmentDimensionInput {
  label: string;
  target: number;
  status: 'under' | 'ontrack' | 'over';
}

/** A target is evaluable only when it is a finite, positive number (GE-010 decision 3). */
export function isTargetAvailable(target: number): boolean {
  return Number.isFinite(target) && target > 0;
}

function displayOrderIndex(label: string): number {
  const index = (ASSESSMENT_DIMENSION_ORDER as readonly string[]).indexOf(label);
  return index === -1 ? ASSESSMENT_DIMENSION_ORDER.length : index;
}

function orientationForDeviations(deviations: DimensionDeviation[]): AssessmentOrientation {
  if (deviations.length === 0) return 'on-track';
  const hasUnder = deviations.some((d) => d.direction === 'under');
  const hasOver = deviations.some((d) => d.direction === 'over');
  if (hasUnder && hasOver) return 'mixed';
  return hasOver ? 'above' : 'below';
}

const NO_DATA_DETAIL: AssessmentDetail = {
  orientation: 'no-data',
  deviations: [],
  primary: null,
  unavailableDimensions: [],
};

/**
 * GE-010: deterministically derive the structured daily assessment from the per-dimension
 * corridor states (no new thresholds — `status` is the existing ±5 % corridor result).
 *
 * - no entries logged → `no-data`;
 * - targets that are missing/≤0/non-finite are excluded and listed in `unavailableDimensions`;
 * - no evaluable dimension left → `target-unavailable`;
 * - every evaluable dimension in-corridor → `on-track`;
 * - deviations all one way → `below`/`above`, both ways → `mixed`;
 * - `primary` = the first deviation in the established display order (never dominates the
 *   orientation, only names which dimension leads the summary).
 */
export function buildAssessmentDetail(
  dimensions: AssessmentDimensionInput[],
  hasEntries: boolean,
): AssessmentDetail {
  if (!hasEntries) return { ...NO_DATA_DETAIL };

  const ordered = [...dimensions].sort(
    (a, b) => displayOrderIndex(a.label) - displayOrderIndex(b.label),
  );

  const unavailableDimensions = ordered
    .filter((d) => !isTargetAvailable(d.target))
    .map((d) => d.label);
  const evaluable = ordered.filter((d) => isTargetAvailable(d.target));

  if (evaluable.length === 0) {
    return {
      orientation: 'target-unavailable',
      deviations: [],
      primary: null,
      unavailableDimensions,
    };
  }

  const deviations: DimensionDeviation[] = evaluable
    .filter((d) => d.status !== 'ontrack')
    .map((d) => ({ label: d.label, direction: d.status === 'over' ? 'over' : 'under' }));

  return {
    orientation: orientationForDeviations(deviations),
    deviations,
    primary: deviations[0] ?? null,
    unavailableDimensions,
  };
}

/**
 * GE-010: aggregate several rules' assessment details into one. Today every profile has a
 * single rule, so the common path is pass-through; the union path is defined for future
 * multi-rule profiles (dedupe deviations by label in display order, recompute orientation).
 */
export function mergeAssessmentDetails(details: AssessmentDetail[]): AssessmentDetail {
  if (details.length === 0) return { ...NO_DATA_DETAIL };
  if (details.length === 1) return details[0];
  if (details.every((d) => d.orientation === 'no-data')) return { ...NO_DATA_DETAIL };

  const seen = new Set<string>();
  const deviations = details
    .flatMap((d) => d.deviations)
    .sort((a, b) => displayOrderIndex(a.label) - displayOrderIndex(b.label))
    .filter((d) => (seen.has(d.label) ? false : (seen.add(d.label), true)));
  const unavailableDimensions = [...new Set(details.flatMap((d) => d.unavailableDimensions))];

  const anyEvaluable = details.some(
    (d) => d.orientation !== 'target-unavailable' && d.orientation !== 'no-data',
  );
  const orientation = anyEvaluable ? orientationForDeviations(deviations) : 'target-unavailable';

  return { orientation, deviations, primary: deviations[0] ?? null, unavailableDimensions };
}
