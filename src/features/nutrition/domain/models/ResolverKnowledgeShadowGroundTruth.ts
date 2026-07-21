import type { ResolverStatus } from './ResolverDecision';

/**
 * Discriminated, versioned ground-truth contract (RESOLVER-V3-029 §5), replacing the untyped
 * `fixtureExpectedStatus?: ResolverStatus` field. Distinguishes fixture-derived expectations from
 * genuinely measured evidence (a type that exists for honesty even though no code path in this
 * repository currently produces it — there is no production telemetry source), from evidence that is
 * simply absent, and from evidence the current contract cannot express at all.
 */
export const RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION =
  'resolver-knowledge-shadow-ground-truth-v1' as const;

export type ResolverKnowledgeShadowGroundTruthEvidenceClass =
  | 'fixture-derived'
  | 'measured'
  | 'unknown'
  | 'not_evaluable';

interface ResolverKnowledgeShadowGroundTruthBase {
  evidenceVersion: typeof RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION;
}

/**
 * Ground truth sourced from a versioned test/benchmark corpus fixture, never from production
 * telemetry. Carries only stable, non-personal corpus metadata — no raw query, food payload, source
 * ID, or personal data.
 */
export interface ResolverKnowledgeShadowFixtureGroundTruth extends ResolverKnowledgeShadowGroundTruthBase {
  evidenceClass: 'fixture-derived';
  expectedStatus: ResolverStatus;
  corpusRegistryVersion: string;
  corpusCaseId: string;
}

/**
 * Genuinely measured evidence (e.g. a confirmed real-world outcome), kept structurally distinct from
 * `fixture-derived` so fixture data can never be mislabeled as production-measured evidence. No
 * caller in this codebase can currently construct this variant — there is no measured evidence
 * source yet.
 */
export interface ResolverKnowledgeShadowMeasuredGroundTruth extends ResolverKnowledgeShadowGroundTruthBase {
  evidenceClass: 'measured';
  expectedStatus: ResolverStatus;
  corpusRegistryVersion: string;
  corpusCaseId: string;
}

/** Evidence is absent for this case but the ground-truth concept is otherwise computable. */
export interface ResolverKnowledgeShadowUnknownGroundTruth extends ResolverKnowledgeShadowGroundTruthBase {
  evidenceClass: 'unknown';
}

/** The current contract cannot validly express ground truth for this case. */
export interface ResolverKnowledgeShadowNotEvaluableGroundTruth extends ResolverKnowledgeShadowGroundTruthBase {
  evidenceClass: 'not_evaluable';
  reasonCode: 'GROUND_TRUTH_NOT_SUPPORTED_BY_CONTRACT';
}

export type ResolverKnowledgeShadowGroundTruth =
  | ResolverKnowledgeShadowFixtureGroundTruth
  | ResolverKnowledgeShadowMeasuredGroundTruth
  | ResolverKnowledgeShadowUnknownGroundTruth
  | ResolverKnowledgeShadowNotEvaluableGroundTruth;

/** A case has "usable" ground truth only when it carries an actual expected status. */
export function hasUsableExpectedStatus(
  groundTruth: ResolverKnowledgeShadowGroundTruth,
): groundTruth is
  | ResolverKnowledgeShadowFixtureGroundTruth
  | ResolverKnowledgeShadowMeasuredGroundTruth {
  return (
    groundTruth.evidenceClass === 'fixture-derived' || groundTruth.evidenceClass === 'measured'
  );
}
