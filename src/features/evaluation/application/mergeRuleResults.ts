import { RuleResult, EvaluationOutput } from '../domain/models';

/**
 * GE-003: assembles a Profile's EvaluationOutput from its Rules' individual RuleResults.
 * Deliberately generic (works for any number of rules, including today's single-rule
 * profiles) rather than assuming exactly one rule per profile.
 */
export function mergeRuleResults(results: RuleResult[]): EvaluationOutput {
  if (results.length === 0) {
    return { assessment: 'no-data', insights: [], warnings: [], recommendations: [], goalProgress: [] };
  }

  const assessment = results.some((r) => r.assessment === 'over')
    ? 'over'
    : results.every((r) => r.assessment === 'on-track')
      ? 'on-track'
      : results[0].assessment;

  return {
    assessment,
    insights: results.flatMap((r) => r.insights),
    warnings: results.flatMap((r) => r.warnings),
    recommendations: results.flatMap((r) => r.recommendations),
    goalProgress: results.flatMap((r) => r.goalProgress),
  };
}
