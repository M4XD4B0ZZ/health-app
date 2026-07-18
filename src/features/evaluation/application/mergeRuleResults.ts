import { RuleResult, EvaluationOutput } from '../domain/models';
import { mergeAssessmentDetails } from './assessmentDetail';

/**
 * GE-003: assembles a Profile's EvaluationOutput from its Rules' individual RuleResults.
 * Deliberately generic (works for any number of rules, including today's single-rule
 * profiles) rather than assuming exactly one rule per profile.
 *
 * GE-010: the assessment is the nutrient-specific structured orientation (via
 * `mergeAssessmentDetails`), not the old `some(over) ? 'over' : 'on-track'` collapse.
 */
export function mergeRuleResults(results: RuleResult[]): EvaluationOutput {
  if (results.length === 0) {
    return {
      assessment: 'no-data',
      assessmentDetail: {
        orientation: 'no-data',
        deviations: [],
        primary: null,
        unavailableDimensions: [],
      },
      insights: [],
      warnings: [],
      recommendations: [],
      goalProgress: [],
    };
  }

  const assessmentDetail = mergeAssessmentDetails(results.map((r) => r.assessmentDetail));

  return {
    assessment: assessmentDetail.orientation,
    assessmentDetail,
    insights: results.flatMap((r) => r.insights),
    warnings: results.flatMap((r) => r.warnings),
    recommendations: results.flatMap((r) => r.recommendations),
    goalProgress: results.flatMap((r) => r.goalProgress),
  };
}
