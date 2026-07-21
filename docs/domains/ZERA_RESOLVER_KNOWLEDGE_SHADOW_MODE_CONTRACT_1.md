# Zera Resolver Knowledge Shadow Mode Contract 1

**Task:** RESOLVER-V3-022. **Contract (historical, defective):**
`resolver-knowledge-shadow-evaluation-v1`. **Superseded by:** RESOLVER-V3-029's
`resolver-knowledge-shadow-evaluation-v2` — see "Amendment (RESOLVER-V3-029)" below. The body of
this document below the amendment describes the **original V1 design intent**, which the V1
implementation did not actually meet; it is retained as historical context, not current contract
truth.

## No-effect boundary

The evaluator is a pure, in-memory/benchmark function: `shadowResult = evaluator.evaluate(productionResult, candidateSnapshot, ...)`. Production is already completed and remains the sole user result. The evaluator has no resolver, provider, network, source, persistence, ranking, query, fast-path, or approval dependency. Errors fail closed to a shadow-only result (or reject an unknown evaluation version); callers must never retry the resolver.

## Request, privacy and eligibility

A request contains only stable case ID, locale, input type, production `ResolverDecision`, privacy-safe candidate/approved-payload snapshot, candidate/resolver versions, and `development` or `holdout`. It excludes owner, observation/run IDs, personal source IDs, raw/normalized inputs, and private observations. Private fields produce `privacy_blocked`; unknown versions fail closed.

The V3-020 payload inventory permits deterministic hypothetical evaluation of source-routing, abstention, clarification, provenance-gap, and negative-source-routing rules. Current payloads have no aliases, typo/term/query, meal-name, free decomposition, or independent-user data; those effects are `not_evaluable`, never guessed. Candidate status alone activates nothing.

## Corpus and delta

Partitions are closed and disjoint: a stable case ID appears in exactly one of `development` or `holdout`; aggregation is separate. Development cannot consume Holdout results and no automatic retuning is available. Results contain the partition, original production decision, separate hypothetical status, candidate ID/fingerprint, reason codes, risk, and delta: `no_change`, source change, abstention, clarification, provenance warning, locale blocked, not evaluable, invalid candidate, or privacy blocked.

## Metrics and evidence

Metrics provide case/change/abstention/clarification/source/provenance/locale/not-evaluable/invalid counts separately per partition. Identification accuracy, abstention precision, clarification rate, and false-confidence improvement/regression remain `unknown` unless fixture ground truth is explicitly supplied; fixture values are never provider latency or production telemetry. There is no persistence requirement: local JSON/report artifacts and test/benchmark memory suffice; no migration is introduced.

## False confidence, locale, and follow-up

Fixture truth may identify whether a hypothetical status would prevent or create false confidence, but no production metric is inferred. Candidate locale and input type must match the case or evaluation is blocked. V3-023 owns a representative separated Learning Benchmark V2; V3-024 owns gate re-decision. This contract does not unblock V3-010, and V3-013 remains NOT PASSED.

---

## Amendment (RESOLVER-V3-029): V1 defect and V2 correction

### The V1 defect

The post-implementation review
(`reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`) found that despite the
design intent documented above, the actual `resolver-knowledge-shadow-evaluation-v1` implementation:

- typed `ResolverKnowledgeShadowEvaluationRequest.productionDecision`/`...Result.productionDecision`
  as the **full** `ResolverDecision` — `normalizedQuery`, the complete `candidates` array (each with
  `food.name`, `food.sourceId`, nutrient payload, and free-text `breakdown.notes`), `best`/
  `secondBest` candidate objects, and `inputConfidence.assumptions` — so raw query text, food
  payloads, and source IDs flowed into every shadow request/result unfiltered;
- only inspected the **top-level keys** of `candidate`/`candidate.payload` for privacy, never
  touching `productionDecision` at all, so no denylist check could have caught the leak above;
- hard-coded `falseConfidenceRegressionCount`/`falseConfidenceImprovementCount`/`regressionCount` to
  `0` and `identificationAccuracy`/`abstentionPrecision`/`clarificationRate` to the literal
  `'unknown'`, never reading the `fixtureExpectedStatus` field threaded through the contract for
  exactly this purpose;
- protected development/holdout separation with only a `Set` scoped to a single
  `evaluateShadowCorpus` call, providing no protection across separate calls or process runs.

### The V2 correction

`resolver-knowledge-shadow-evaluation-v2` is a new, closed contract version. `v1` objects, unknown
versions, and any mixture are never reinterpreted — `ResolverKnowledgeShadowEvaluator.evaluate` throws
`SHADOW_UNKNOWN_EVALUATION_VERSION` for anything except the exact current version string. There is no
fallback path that reconstructs a full production decision from an old request.

**Production-decision projection boundary.** `src/features/nutrition/domain/models/ResolverProductionDecisionProjection.ts`
defines `ResolverProductionDecisionProjectionV1` (`resolver-production-decision-projection-v1`) — the
only representation of a production `ResolverDecision` permitted anywhere in the shadow request,
result, aggregated metrics, or corpus registry. Its closed field set:

| Field                      | Type                                                   | Notes                                                                   |
| -------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `projectionVersion`        | literal `resolver-production-decision-projection-v1`   | fails closed on any other value                                         |
| `status`                   | `ResolverStatus` (`accepted`\|`ambiguous`\|`rejected`) | already closed                                                          |
| `reasonCodes`              | closed safe-reason-code enum array                     | unrecognized codes map to `UNCLASSIFIED_REASON_CODE`, never raw text    |
| `candidateCount`           | `number`                                               | count only                                                              |
| `selectedSourceType`       | `bls`\|`off`\|`usda`\|`user`\|`ai`\|`none`             | classification only, never a source or candidate ID                     |
| `provenanceClassification` | `source_grounded`\|`ai_suggested`\|`not_evaluable`     | derived only from `selectedSourceType`, never from food-payload content |
| `inputConfidenceLevel`     | `high`\|`medium`\|`low`\|`unknown`                     | drops the free-text `reason`/`assumptions` fields entirely              |

`projectResolverDecisionForShadowEvaluation(decision)` is the sole, deterministic, side-effect-free
projection function; it never mutates its input. It is total (never throws): unrecognized reason codes
and source values fail closed to `UNCLASSIFIED_REASON_CODE`/`none`/`not_evaluable`/`unknown` rather
than guessing or passing through payload content. Deliberately excluded, with no nested-field
exception: `normalizedQuery`, raw input, food names/payloads, `candidates`, `best`/`secondBest`,
source IDs, owner/observation/run IDs, notes, and assumptions.

**Runtime privacy validation strategy.** `src/features/nutrition/application/shadow/ResolverKnowledgeShadowPrivacyValidator.ts`
implements a minimal recursive, allowlist-based schema validator (not a denylist): every validated
object shape declares a closed set of allowed keys; unknown keys fail closed at every nesting depth;
arrays validate every element; candidate payloads and ground truth are discriminated unions validated
against their exact variant schema (an unrecognized discriminant fails closed). This is the _primary_
privacy guarantee, applied to the production-decision projection, the candidate snapshot (including its
nested `payload`), and the ground-truth object. A small recursive key-name denylist
(`containsDenylistedField`) is retained only as defense in depth, exactly as required — never the
primary check, and never `JSON.stringify(...).includes(...)`. `candidateType`/`candidateVersion` are
deliberately left as opaque-string checks in the schema (not enum/literal-gated there) because the
evaluator's own dedicated checks already fail those closed with the more specific `not_evaluable`/
`invalid_candidate` delta categories, which are more informative than folding every such mismatch into
a generic `privacy_blocked`.

**Ground-truth contract.** `src/features/nutrition/domain/models/ResolverKnowledgeShadowGroundTruth.ts`
replaces the untyped `fixtureExpectedStatus?: ResolverStatus` with a discriminated, versioned
`ResolverKnowledgeShadowGroundTruth` (`resolver-knowledge-shadow-ground-truth-v1`), one of:
`fixture-derived` (expected status sourced from a versioned test/benchmark corpus, carrying
`corpusRegistryVersion`/`corpusCaseId` for audit — no raw query, food payload, source ID, or personal
data), `measured` (structurally distinct from `fixture-derived` so fixture data can never be mislabeled
as production-measured evidence — **no code path in this repository can currently construct this
variant; there is no measured/production-telemetry evidence source yet**), `unknown` (evidence absent
but the concept is computable), or `not_evaluable` (the contract cannot express ground truth for this
case). Unknown evidence versions fail closed via the same schema validator.

**Metric formulas and evidence classes.** `ResolverKnowledgeShadowMetrics` fields are one of
`ResolverKnowledgeShadowCountMetric` (`{ value, evidenceClass: 'measured' }`) or
`ResolverKnowledgeShadowRateMetric` (`{ value, numerator, denominator, evidenceClass, reasonCode }`,
all three of `value`/`numerator`/`denominator` `null` together exactly when unavailable — never `0` for
"unknown"). "Measured" means measured within this deterministic shadow run, never production
telemetry.

- **Count metrics** (`evaluatedCaseCount`, `evaluableCaseCount`, `noChangeCount`,
  `changedDecisionCount`, `abstentionDeltaCount`, `clarificationDeltaCount`,
  `sourceRoutingDeltaCount`, `provenanceGapCount`, `localeBlockedCount`, `privacyBlockedCount`,
  `invalidCandidateCount`, `notEvaluableCount`, `usableGroundTruthCaseCount`) are tallied directly
  from the supplied results; all tagged `measured`. "Evaluable" excludes
  `privacy_blocked`/`invalid_candidate`/`blocked_locale`/`not_evaluable` deltas. "Usable ground truth"
  additionally requires the case be evaluable **and** carry `fixture-derived`/`measured` ground truth.
- **`identificationAccuracy`** = (usable-ground-truth cases where `hypotheticalShadowStatus ===
groundTruth.expectedStatus`) / (usable-ground-truth case count). Computed only over usable-ground-truth
  cases; `null`/`unknown`/`NO_USABLE_GROUND_TRUTH_CASES` when that denominator is zero. **This measures
  agreement with an expected resolution status, not proof of correct food identity** — no stronger
  typed identity evidence exists in this contract, and this metric must never be documented or read as
  nutrient/identity accuracy.
- **`falseConfidenceRegressionCount`** = count, over usable-ground-truth cases, where
  `productionDecisionProjection.status !== 'accepted'` AND `hypotheticalShadowStatus === 'accepted'`
  AND `groundTruth.expectedStatus !== 'accepted'`. Denominator = usable-ground-truth case count;
  `null`/`unknown` when that is zero.
- **`falseConfidenceImprovementCount`** = count, over usable-ground-truth cases, where
  `productionDecisionProjection.status === 'accepted'` AND `groundTruth.expectedStatus !== 'accepted'`
  AND `hypotheticalShadowStatus !== 'accepted'`. Same denominator/null rule.
- **`regressionCount`** (status regression, not necessarily food-identity regression) = count, over
  usable-ground-truth cases, where `productionDecisionProjection.status === groundTruth.expectedStatus`
  AND `hypotheticalShadowStatus !== groundTruth.expectedStatus`. Same denominator/null rule.
- **`abstentionPrecision`** = (usable-ground-truth abstentions — `hypotheticalShadowStatus ===
'rejected'` — where `groundTruth.expectedStatus === 'rejected'`) / (usable-ground-truth abstention
  count). `null`/`NO_HYPOTHETICAL_ABSTENTIONS` (never `0`) when there are no such abstentions.
- **`clarificationRate`** = (evaluable cases with `delta.category === 'hypothetical_clarification'`) /
  (evaluable case count). **Not** ground-truth dependent — tagged `measured` when computed.
  Privacy-blocked/invalid/locale-blocked/not-evaluable cases are excluded from both numerator and
  denominator by construction (they are excluded from "evaluable"). `null`/`not_evaluable`/
  `NO_ELIGIBLE_CLARIFICATION_CASES` when the evaluable count is zero — `not_evaluable` rather than
  `unknown` because this is a structural "nothing to compute for this corpus" limit, distinct from
  `unknown`'s "ground-truth evidence is absent" meaning used by the other rate metrics.
- Every rate metric contributed to by at least one `fixture-derived` ground-truth case is itself tagged
  `fixture-derived`, never `measured` — fixture data can never silently present as production-measured
  evidence.

**Corpus registry.** `src/features/nutrition/domain/models/ResolverKnowledgeShadowCorpusRegistry.ts`
(manifest/version types) and `src/features/nutrition/application/shadow/ResolverKnowledgeShadowCorpusRegistry.ts`
(the `ResolverKnowledgeShadowCorpusRegistry` class) replace the V1 in-call-only `Set`. A registry is
built from an immutable manifest — `{ registryVersion: 'resolver-knowledge-shadow-corpus-registry-v1',
entries: readonly { caseId, partition }[] }` — plain, source-controlled data, not mutable module-global
state. Construction fails closed on an unknown `registryVersion` or on any case ID appearing more than
once across the manifest (`SHADOW_REGISTRY_UNKNOWN_VERSION`/
`SHADOW_REGISTRY_CASE_IN_MULTIPLE_PARTITIONS`). `evaluate(request, registry)` now looks up the case's
**authoritative** partition from the registry rather than trusting `request.corpusPartition` alone: an
unregistered case ID fails closed (`SHADOW_REGISTRY_UNKNOWN_CASE_ID`), and a request claiming a
different partition than the registry's own answer fails closed
(`SHADOW_REGISTRY_PARTITION_MISMATCH`) — a case cannot be moved between partitions by a later call.
Because the manifest is durable, source-controlled data, reconstructing a registry from the same
manifest in a separate call, test, or process run always yields identical partition assignments;
`evaluateShadowCorpus` still separately rejects a duplicate case ID within one request batch
(`SHADOW_DUPLICATE_CASE_ID_IN_REQUEST_BATCH`). Every result and the aggregated metrics object carry the
registry version used. This task builds the registry _mechanism_ only — it does not implement the
representative Learning Benchmark V2 corpus (RESOLVER-V3-023's scope) or any database persistence.

**No-production-effect guarantees (unchanged from V1 design intent, re-verified for V2).** The
evaluator, registry, and privacy validator remain pure/deterministic/read-only, with no resolver,
AI/model-backend, network, source, persistence, ranking, query, fast-path, approval, or feature-flag
dependency (enforced by a source-scan test, as in V1). `registry` is a plain in-memory value object
constructed from caller-supplied data, not a persistence adapter. Evaluation failures produce only a
shadow-side result or a thrown `Error` for contract-shape violations — never a retry, mutation, or
alteration of the production decision that was passed in for projection. RESOLVER-V3-029 does not wire
shadow mode into any user-visible flow.

**Residual limitations.** No measured (non-fixture) ground-truth source exists yet — the `measured`
evidence-class variant is a structurally-available but currently unreachable type, present for honesty
rather than active use. No representative Learning Benchmark V2 corpus exists yet (RESOLVER-V3-023).
Accuracy/regression/false-confidence metrics remain expected-status agreement, not proof of correct
food identity, by design and by the underlying fixture evidence's own limits. RESOLVER-V3-010 remains
blocked and RESOLVER-V3-013's gate remains NOT PASSED; nothing in this amendment changes either.
