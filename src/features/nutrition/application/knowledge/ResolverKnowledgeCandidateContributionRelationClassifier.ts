import { validateResolverKnowledgeCandidatePayloadForFingerprint } from './ResolverKnowledgeFingerprintPayloadValidator';
import { buildResolverKnowledgeCandidateCanonicalInputV2 } from '../../domain/models/ResolverKnowledgeCandidateFingerprintV2';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidatePayload,
} from '../../domain/models/ResolverKnowledgeCandidate';
import type { ResolverKnowledgeCandidateContributionRelation } from '../../domain/models/ResolverKnowledgeCandidateContributionRelation';

const ROUTING_TYPE = 'source-routing-pattern' as const;
const NEGATIVE_ROUTING_TYPE = 'negative-source-routing-rule' as const;
const NON_ROUTING_CROSS_TYPES = new Set<string>([
  'abstention-policy-signal',
  'clarification-policy-signal',
  'provenance-gap',
]);

type SourceTypePayload = Extract<
  ResolverKnowledgeCandidatePayload,
  { sourceType: 'bls' | 'off' | 'usda' }
>;

function hasSourceType(payload: ResolverKnowledgeCandidatePayload): payload is SourceTypePayload {
  return payload.type === ROUTING_TYPE || payload.type === NEGATIVE_ROUTING_TYPE;
}

function isIdenticalPayload(
  a: ResolverKnowledgeCandidatePayload,
  b: ResolverKnowledgeCandidatePayload,
): boolean {
  return (
    buildResolverKnowledgeCandidateCanonicalInputV2(
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
      a,
    ) ===
    buildResolverKnowledgeCandidateCanonicalInputV2(
      RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
      b,
    )
  );
}

/**
 * Closed support/contradiction/orthogonal/not_evaluable classifier (RESOLVER-V3-030 design §10,
 * RESOLVER-V3-031 binding requirement §9-11). Pure and side-effect free: never mutates either
 * payload, never accumulates evidence, never touches a candidate/repository/ledger — it only
 * returns a relation. Both payloads are validated first (the same fingerprint-input validator
 * used for hashing), so a malformed/unsafe payload throws rather than silently classifying as
 * `not_evaluable` — `not_evaluable` is reserved for valid-but-unclassified relationships.
 *
 * Implements the accepted matrix exactly, with no invented rule:
 * - `support`: identical type and canonically-identical payload, for all five candidate types.
 * - `contradiction`: only the mirrored `source-routing-pattern` / `negative-source-routing-rule`
 *   pair, when locale, input type, and source type all match (both directions).
 * - `orthogonal`: two same-type routing/negative-routing payloads with a differing scope; a
 *   routing/negative-routing pair with a non-matching scope; or a `source-routing-pattern` and an
 *   `abstention-policy-signal`/`clarification-policy-signal`/`provenance-gap` sharing the same
 *   locale/input-type scope (explicitly authorized by the design's §10 Orthogonal column — "a
 *   routing signal and a clarification/abstention/provenance signal for the same closed
 *   locale/input-type scope are distinct signals and not contradictions").
 * - `not_evaluable`: every other valid pairing, including two candidates of the same non-routing
 *   type that differ (e.g. two `abstention-policy-signal`s with different reason codes), and any
 *   cross-type pairing not explicitly authorized above (e.g. clarification vs. abstention,
 *   clarification vs. provenance-gap, or a `negative-source-routing-rule` against a non-routing
 *   type) — never guessed into `orthogonal` or `contradiction`.
 */
export function classifyResolverKnowledgeCandidateContributionRelation(
  existingPayload: unknown,
  incomingPayload: unknown,
  candidateContractVersion: unknown = RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
): ResolverKnowledgeCandidateContributionRelation {
  validateResolverKnowledgeCandidatePayloadForFingerprint(
    candidateContractVersion,
    existingPayload,
  );
  validateResolverKnowledgeCandidatePayloadForFingerprint(
    candidateContractVersion,
    incomingPayload,
  );

  if (
    existingPayload.type === incomingPayload.type &&
    isIdenticalPayload(existingPayload, incomingPayload)
  )
    return 'support';

  const isRoutingContradictionPair =
    (existingPayload.type === ROUTING_TYPE && incomingPayload.type === NEGATIVE_ROUTING_TYPE) ||
    (existingPayload.type === NEGATIVE_ROUTING_TYPE && incomingPayload.type === ROUTING_TYPE);
  if (
    isRoutingContradictionPair &&
    hasSourceType(existingPayload) &&
    hasSourceType(incomingPayload)
  ) {
    const sameScope =
      existingPayload.locale === incomingPayload.locale &&
      existingPayload.inputType === incomingPayload.inputType &&
      existingPayload.sourceType === incomingPayload.sourceType;
    return sameScope ? 'contradiction' : 'orthogonal';
  }

  if (existingPayload.type === ROUTING_TYPE && incomingPayload.type === ROUTING_TYPE) {
    // Reached only when not identical (the support check above already handled equality).
    return 'orthogonal';
  }

  if (
    existingPayload.type === NEGATIVE_ROUTING_TYPE &&
    incomingPayload.type === NEGATIVE_ROUTING_TYPE &&
    hasSourceType(existingPayload) &&
    hasSourceType(incomingPayload)
  ) {
    const sameScope =
      existingPayload.locale === incomingPayload.locale &&
      existingPayload.inputType === incomingPayload.inputType &&
      existingPayload.sourceType === incomingPayload.sourceType;
    // Same scope here means only the reason code differs (support already excluded equality) —
    // that difference is not one of the closed identity fields the design's orthogonal rule
    // names, so it is not_evaluable rather than guessed into orthogonal.
    return sameScope ? 'not_evaluable' : 'orthogonal';
  }

  const isRoutingVsNonRoutingCross =
    (existingPayload.type === ROUTING_TYPE && NON_ROUTING_CROSS_TYPES.has(incomingPayload.type)) ||
    (incomingPayload.type === ROUTING_TYPE && NON_ROUTING_CROSS_TYPES.has(existingPayload.type));
  if (isRoutingVsNonRoutingCross) {
    const routing = existingPayload.type === ROUTING_TYPE ? existingPayload : incomingPayload;
    const other = existingPayload.type === ROUTING_TYPE ? incomingPayload : existingPayload;
    const sameScope = routing.locale === other.locale && routing.inputType === other.inputType;
    return sameScope ? 'orthogonal' : 'not_evaluable';
  }

  return 'not_evaluable';
}
