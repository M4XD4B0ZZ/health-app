# Zera Resolver Learning Benchmark V3 — Successor Corpus and Harness Specification 1

**Status:** `accepted` (2026-07-22). **Task:** RESOLVER-V3-038. **Corpus contract:**
`resolver-learning-benchmark-v3-corpus-1.0.0`. **Registry contract:**
`resolver-learning-benchmark-v3-registry-v1`.

## Purpose and authority

This is the immutable successor-design to Learning Benchmark V2. It implements the benchmark
requirements in the Resolution Knowledge-Growth Decision Record §10 and resolves only the gaps
identified by RESOLVER-V3-024. It does not revise the frozen V2 corpus, registry, hash, historical
report, or verdict. V2 remains historical evidence; V3 metrics must never pool V2 and V3 cases.

## Corpus and partition contract

The executable, data-only corpus is `src/features/nutrition/benchmark/learningV3/`. Every scenario
has an immutable ID, source-controlled development/holdout partition, reproducibility note, tags,
and `personalDataFree: true`. `LearningBenchmarkV3Registry` is authoritative for partition lookup;
it rejects unknown registry versions and duplicate assignments. The validator rejects wrong corpus
versions, malformed scenarios, and any resolution case that does not state `requiresLiveHybrid: true`.

V3 has twelve Hybrid-C resolution/decomposition cases. It covers SIMPLE, HOUSEHOLD, DACH, BRANDED,
COMPOSED, HOMEMADE, RESTAURANT, VAGUE, PREPARATION, NEGATION_MODIFIER, and UNRELIABLE inputs across
German and English, with development and holdout partitions. These fixtures contain no user data and
state no authoritative nutrient value: nutrition truth stays source-grounded and deterministic.

## Independent review fixtures

The V2 `LBV2-GC-DEV-006` coupling is not copied. V3 declares two separate fixtures: one proves that
contradiction blocks approval, while the other covers rollback of a legitimately approved,
contradiction-free candidate. A failure of either is reported independently; neither scenario's
outcome is inferred from the other.

## Harness boundary and live-run protocol

`prepareLearningBenchmarkV3Run()` validates and selects the corpus but deliberately cannot execute
it. `runLearningBenchmarkV3()` fail-closes with `LEARNING_BENCHMARK_V3_LIVE_EXECUTOR_NOT_AUTHORIZED`.
There is no fixture/default fallback, provider import, credential access, provider call, or production
wiring in this task. RESOLVER-V3-039 alone must add the pinned provider/model/prompt/schema executor,
explicit budget gate, per-case provenance/cost/latency/retry/error capture, and declared development/
holdout protocol. RESOLVER-V3-040 must first supply the accepted cost/latency policy.

## Non-goals

No live provider call, production resolver change, feature flag, migration, global-knowledge
activation, review-policy change, or V2 modification is authorized. This contract is a necessary
benchmark substrate, not evidence that Hybrid C is acceptable or that RESOLVER-V3-010 may unblock.
