# Zera Resolver Knowledge Shadow Mode Contract 1

**Task:** RESOLVER-V3-022. **Contract:** `resolver-knowledge-shadow-evaluation-v1`.

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
