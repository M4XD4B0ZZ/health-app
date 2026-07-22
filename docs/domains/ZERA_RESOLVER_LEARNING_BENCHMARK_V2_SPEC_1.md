# Zera Resolver Learning Benchmark V2 — Specification 1

**Status:** `accepted` (2026-07-22). **Task:** RESOLVER-V3-023. **Corpus contract:**
`resolver-learning-benchmark-v2-corpus-1.0.0`. **Registry contract:**
`resolver-learning-benchmark-v2-registry-v1`. **Harness version:** `1.0.0`.

**Authority:** Level 2 canonical domain authority for the Learning Benchmark V2 corpus/harness only.
It implements, but does not amend, the `ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md` §10
requirements, the `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` case schema, the
`ZERA_PERSONAL_RESOLUTION_MEMORY_*` contracts, the `ZERA_RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_1.md`,
the `ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md`, and the `ZERA_RESOLVER_KNOWLEDGE_SHADOW_MODE_CONTRACT_1.md`.

## 1. Purpose

RESOLVER-V3-023 is an **evidence-generation task**, not a mandate to make the learning system pass.
It answers, honestly and reproducibly: does the currently implemented resolution-learning
architecture actually behave the way the accepted decision records say it should, across five
evidence domains (resolution/decomposition, personal memory, global candidate/review/shadow,
privacy/deletion, economics)? A `NOT_PASSED` or `PARTIALLY_EVALUABLE` system verdict is a legitimate,
complete outcome of this task.

## 2. Corpus contract

Location: `src/features/nutrition/benchmark/learningV2/LearningBenchmarkV2Types.ts`.

A closed, data-only discriminated union, `LearningBenchmarkV2Scenario`, with five members:

- `resolution_decomposition` — wraps the existing, accepted `BenchmarkCase` schema
  (`BenchmarkCaseTypes.ts`) unchanged, per the binding requirement to reuse rather than reinvent
  the food-resolution benchmark vocabulary.
- `personal_memory_sequence` — Sequences A (`exact_confirmed_repeat`), B (`near_repeat`), C
  (`later_contradiction_invalidation`) as a list of typed, data-only steps (`read`/`record`/
  `invalidate`).
- `global_candidate_sequence` — ledger/review/shadow scenarios as a list of typed steps
  (`record_contribution`/`review_decision`/`retract_contributions`/`assert_replay_summary`/
  `shadow_evaluate`).
- `privacy_deletion_sequence` — Sequences D (`cross_user_isolation`) and E (`deletion`), plus
  global-ledger owner-deletion privacy scenarios.
- `economics_sequence` — reuses the personal-memory step vocabulary; reports actual operation
  counts (avoided calls, reads, writes, invalidations) rather than eligibility correctness.

Every scenario carries: `scenarioId`, `corpusVersion`, `partition`, `scenarioType`, `difficulty`,
`groundTruthClass` (`measured`/`fixture-derived`/`unknown`/`not_evaluable`), `personalDataFree: true`,
`expectedInvariantOutcomes`, `reproducibilityNotes`, `tags`, `fixtureVersionsUsed`. Scenario IDs are
immutable and never reused. `LearningBenchmarkV2Validator.ts` closes every root/nested field set and
fails on any unknown scenario type, evidence class, or step kind.

## 3. Registry

`LearningBenchmarkV2Registry.ts` mirrors the RESOLVER-V3-029
`ResolverKnowledgeShadowCorpusRegistry` pattern exactly: an immutable manifest
(`{registryVersion, entries: {scenarioId, partition}[]}`), fail-closed on an unknown registry
version or a scenario ID assigned to more than one partition. The harness
(`runLearningBenchmarkV2.ts`) cross-checks every corpus scenario's own declared `partition` against
the registry's authoritative answer and throws on any mismatch before running anything.

## 4. Corpus size and coverage (2026-07-22 freeze)

41 scenarios total: 32 development, 9 holdout (~22%). All five scenario classes and at least one
hard/adversarial case appear in holdout. Historical 14-case Variant A smoke corpus (`resolverV3VariantASmokeCorpus.ts`)
is **not** imported into this corpus, is **not** pooled into any V2 metric, and is independently
rerun via the pre-existing `scripts/benchmark-resolver-v3-variant-a.mjs` as a separately labeled
historical regression check.

Resolution/decomposition (20 scenarios: 16 dev, 4 holdout) covers every category absent from the
historical corpus (`BRANDED`, `COMPOSED`, `HOMEMADE`, `RESTAURANT`, `VAGUE`, `PREPARATION`,
`NEGATION_MODIFIER`, `UNRELIABLE`), an English cross-locale case, and an explicit
`resolution_with_assumption` case, run through the real, unmodified `SequentialFoodCatalogResolver`
(zero AI). A deterministic fixture `off` source (`FixtureFoodCatalogSource`) supplies two guaranteed-
matchable branded fixtures; every other case's expected-behavior label is a best-effort prediction,
not independently re-verified against a second BLS lookup — a real mismatch is recorded honestly,
never suppressed (this is a documented limitation relative to the historical corpus's fully
reproduced-evidence discipline).

Personal-memory (4 scenarios), global-candidate (10), privacy (4), and economics (3) scenarios are
described in the corresponding corpus files
(`LearningBenchmarkV2{PersonalMemory,GlobalCandidate,Privacy,Economics}Corpus.ts`).

This size is sufficient for **Benchmark V2 iteration evidence** (real production code exercised
across every required invariant, both partitions populated for every scenario class) but is **not**
equivalent to a broad production corpus, and a source-controlled holdout is not a truly external
blind benchmark — both limitations are recorded in the canonical report.

## 5. Harness architecture

`runLearningBenchmarkV2.ts` loads the registry, validates the corpus, selects the requested
partition(s), and runs every scenario type through its own evaluator:

- `evaluateLearningBenchmarkV2ResolutionScenario.ts` — reuses `buildVariantAResolver`/
  `runVariantACase`/`evaluateVariantACase` verbatim.
- `LearningBenchmarkV2PersonalMemoryEngine.ts` — real use cases over a new benchmark-only in-memory
  fixture repository (`LearningBenchmarkV2PersonalMemoryFixtureRepository.ts`, since no production
  in-memory adapter exists for the write/read personal-memory ports) plus the real
  `InMemoryPersonalResolutionMemoryInvalidationRepository`.
- `LearningBenchmarkV2GlobalCandidateAdapter.ts` — the sole file authorized to reference the
  RESOLVER-V3-031/032 in-memory reference implementations directly (see the allowlist additions to
  `ResolverKnowledgeAggregationV2Isolation.test.ts` / `ResolverKnowledgeContributionLedgerIsolation.test.ts`,
  mirroring the existing RESOLVER-V3-032 precedent); wraps the real recording planner, terminal-chain
  resolver, replay-summary calculator, `ResolverKnowledgeReviewService`, and
  `ResolverKnowledgeShadowEvaluator` behind a plain-data facade so every other benchmark file only
  ever sees generic outcome types.
- `evaluateLearningBenchmarkV2PrivacyScenario.ts` / `evaluateLearningBenchmarkV2EconomicsScenario.ts`
  — reuse the personal-memory engine and (for owner-deletion) the global-candidate adapter.

Fresh, isolated state is constructed per scenario (a new `LearningBenchmarkV2PersonalMemoryFixtureRepository`/
`InMemoryPersonalResolutionMemoryInvalidationRepository`/`GlobalCandidateWorld` instance every call —
no shared mutable module state). Deterministic clocks (`LearningBenchmarkV2DeterministicClock.ts`)
replace `Date.now()`/random IDs everywhere a canonical semantic result is produced; a separate real
wall-clock duration (`benchmarkRuntimeMeasuredMs`) is reported as diagnostic-only,
benchmark-runtime-measured information, never as a production latency claim.

`evaluateLearningBenchmarkV2Invariants.ts` computes the closed 20-invariant verdict table by
filtering on generic scenario **tags** and generic step properties (`action`, `forcedContradiction`,
`forcedIndependentUserEvidence`, `decisionId`) — never a hardcoded `scenarioId`/`stepId` literal — so
invariant evaluation is scenario-agnostic and cannot silently stop working if a scenario ID changes.

## 6. Zero-network, fixture provider

`LearningBenchmarkV2FixtureInterpretationProvider.ts` conforms to the real, provider-neutral
`AiInterpretationProvider` port, returns committed fixture responses keyed by trace ID, fails closed
(`outcome: 'unavailable'`) on any lookup miss, and counts its own invocations — used by the
personal-memory engine to prove avoided-call economics from actual invocation counts. No file under
`learningV2/` imports Supabase, `AnthropicBenchmarkTransport`, `LiveProviderBudgetGate`, or any live
provider adapter (enforced by `LearningBenchmarkV2Isolation.test.ts`, mirroring the RESOLVER-V3-031/032
isolation-test pattern). There is no `--live` flag anywhere in this benchmark.

## 7. Discovered defect: contradiction does not independently block promotion (INV-07)

A fixture-only, clearly-labeled candidate (`GC-DEV-006`, tag `contradiction-gate`) was constructed
with `independentUserEvidence` forced to `independently_confirmed` and nonzero contradiction
evidence, then submitted to the **real, unmodified** `ResolverKnowledgeReviewService.review()` with
`action: 'approve'`. The service's approve branch checks only `candidate.evidence.independentUserEvidence`
and `request.localeRestriction` — it never inspects `contradictionStatus`/`contradictingEvidenceCount`
— so the approval **succeeded** (`'applied'`). This does not imply RESOLVER-V3-035 or any production
independent-user aggregation mechanism exists (the real aggregation pipeline only ever produces
`not_evaluable`, so this exact state cannot occur through any current production path), but the
review-service code path itself has no defense against it. Recorded as invariant `INV-07: failed`.
Production review-policy code was **not** modified by this task; see the new remediation task
recorded in `ROADMAP.md`.

## 8. Reports

Canonical artifacts: `reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md` and
`reports/resolver-v3-learning-v2-benchmark.json`, generated by
`buildLearningBenchmarkV2Reports.ts` from a `--partition=all --final-evaluation` run. Raw harness
output for routine development-partition runs is written to `logs/resolver-v3-learning-v2-benchmark.{json,md}`
(gitignored), mirroring the Variant A/B/C convention.

## 9. Non-goals

This task does not: unblock RESOLVER-V3-010, choose a provider, change ranking/source precedence/
personal-memory eligibility/review policy, add a migration/RPC/Supabase adapter/batch worker, or
begin RESOLVER-V3-024. RESOLVER-V3-024 owns the later representative gate re-decision and is
eligible for separate authorization once this task is merged and reviewed.
