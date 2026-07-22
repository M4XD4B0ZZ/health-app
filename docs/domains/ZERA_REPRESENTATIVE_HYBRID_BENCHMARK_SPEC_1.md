# Zera Representative Hybrid Benchmark — Specification 1

**Status:** `accepted` (2026-07-22). **Task:** RESOLVER-V3-038. **Corpus contract:**
`resolver-representative-hybrid-benchmark-corpus-1.0.0`. **Registry contract:**
`resolver-representative-hybrid-benchmark-registry-v1`. **Harness contract version:** `1.0.0`.

**Authority:** Level 2 canonical domain authority for the RESOLVER-V3-038 successor corpus/harness-
contract only. It is the required concrete follow-up to RESOLVER-V3-024's `NOT_PASSED` gate verdict
(see `reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` §26/§27) and does
not amend `ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md`, `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md`,
`ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md`, or `ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md`.

## 1. Purpose

RESOLVER-V3-024 found that `resolver-learning-benchmark-v2-corpus-1.0.0`'s resolution/decomposition
scenarios only ever exercised Variant A (zero AI, zero network) — no representative Hybrid C evidence
has ever been collected across a corpus with real category breadth (`DACH`/`COMPOSED`/`HOMEMADE`/
`RESTAURANT`/`SIMPLE`/`HOUSEHOLD`/vague/clarification/abstention coverage). It also found that the V1
corpus's one contradiction-gate fixture (`LBV2-GC-DEV-006`) coupled a forced-contradiction approval
attempt with a rollback of the _same_ candidate in a single scenario, so RESOLVER-V3-037's later
contradiction-gate fix silently changed that fixture's outcome on an axis (rollback) it was never
meant to test.

RESOLVER-V3-038 is a **design/corpus-authoring task**: it defines the successor contract that closes
both gaps and authors an initial corpus against it, but it does **not** execute anything live and
does **not** wire anything into production. Collecting the actual live Hybrid C evidence is
RESOLVER-V3-039's job, gated on this task and on RESOLVER-V3-040 (the cost/latency acceptance
policy).

## 2. Relationship to `resolver-learning-benchmark-v2-corpus-1.0.0`

This is a wholly separate, additive contract. It does not import, edit, extend, or re-execute any
`../learningV2/*Corpus.ts` file — that corpus remains frozen, immutable history per RESOLVER-V3-023's
corpus-freeze protocol. Only two genuinely shared, data-only vocabulary pieces are reused (a type
import has no effect on frozen data): `BenchmarkCase` (already shared across Variant A/B/C and
Learning Benchmark V2) and `LearningBenchmarkV2FixtureObservationInput` (the observation-fixture
shape). Candidate-lifecycle steps use a **new**, locally-defined step type built directly from the
real, current `ResolverKnowledgeReviewAction`/`ResolverKnowledgeReviewResult` domain types
(`src/features/nutrition/domain/models/ResolverKnowledgeReview.ts`), not V1's
`LearningBenchmarkV2GlobalCandidateStep` — that V1 type's `expectedResult` union predates
RESOLVER-V3-037 and does not include `'blocked_contradiction'`, so reusing it would make it
impossible to correctly express the very gate this corpus exists to exercise.

## 3. Corpus contract

Location: `src/features/nutrition/benchmark/representativeHybrid/RepresentativeHybridBenchmarkTypes.ts`.

A closed, data-only discriminated union, `RepresentativeHybridBenchmarkScenario`, with three members:

- `resolution_decomposition_hybrid_c` — wraps the existing, accepted `BenchmarkCase` schema
  unchanged, plus a fixed `executionEngine: 'hybrid_c'` literal. This is a deliberate, one-time design
  decision, not a per-scenario choice: this contract has no "run against Variant A" option, so a
  future task cannot quietly default back to Variant A the way RESOLVER-V3-023 did.
- `contradiction_gate_sequence` — candidate/review steps up to and including approve/reject/
  quarantine/mark_duplicate/supersede, explicitly **excluding** `rollback`/`revoke_approval`.
- `rollback_sequence` — rollback/revoke_approval/idempotent-retry steps against a candidate that
  reached its state through **contradiction-free** evidence only (no `forceContradiction: true` step
  anywhere in this scenario type).

Every scenario carries the same binding field set already accepted for Learning Benchmark V2:
`scenarioId`, `corpusVersion`, `partition`, `scenarioType`, `difficulty`, `groundTruthClass`,
`personalDataFree: true`, `expectedInvariantOutcomes`, `reproducibilityNotes`, `tags`,
`fixtureVersionsUsed`. Scenario IDs (`RHB-RES-*`, `RHB-CG-*`, `RHB-RB-*`) are immutable and never
reused, and are disjoint from every `LBV2-*` ID.

## 4. The contradiction/rollback split (RESOLVER-V3-024 §24 fix)

`RepresentativeHybridBenchmarkValidator.ts` enforces the split at the contract level, not just by
convention, on the raw steps array (so a malformed/adversarial fixture cannot bypass it):

- A `contradiction_gate_sequence` scenario fails validation if any `review_decision` step's `action`
  is `rollback` or `revoke_approval`.
- A `rollback_sequence` scenario fails validation if any `review_decision` step sets
  `forceContradiction: true`.

This guarantees a rollback outcome in this corpus can never again be entangled with a
contradiction-gate outcome in the same fixture, closing the exact coupling RESOLVER-V3-024 §24
documented in `LBV2-GC-DEV-006`.

`expectedResult` values for contradiction-gate scenarios reflect the real, current (post-
RESOLVER-V3-037) `ResolverKnowledgeReviewService.review()` behavior, read directly from source: a
forced-contradiction approve attempt (`contradictionStatus: 'present'`, nonzero
`contradictingEvidenceCount`) returns `blocked_contradiction` unconditionally, with no risk-level
threshold; a default (`not_evaluable`) independent-user-evidence approve attempt returns
`blocked_privacy`.

## 5. Registry

`RepresentativeHybridBenchmarkRegistry.ts` mirrors `LearningBenchmarkV2Registry.ts`/
`ResolverKnowledgeShadowCorpusRegistry` exactly: an immutable manifest
(`{registryVersion, entries: {scenarioId, partition}[]}`), fail-closed on an unknown registry version
or a scenario ID assigned to more than one partition.

## 6. Corpus size and coverage (2026-07-22, RESOLVER-V3-038 authoring)

18 scenarios total: 12 development, 6 holdout (33%).

- **Resolution/decomposition** (12: 8 dev, 4 holdout) covers every required category
  (`DACH`, `COMPOSED`, `HOMEMADE`, `RESTAURANT`, `SIMPLE`, `HOUSEHOLD`) plus a `VAGUE`
  clarification-required case and two abstention-required cross-locale (English) cases, all present
  in the `development` partition alone; `holdout` adds four independent hard/adversarial cases
  (not a re-import of the development cases) across a subset of the same categories.
- **Contradiction-gate** (3: 2 dev, 1 holdout) covers the default-block case, the forced-contradiction
  block case, and a high-risk variant proving no risk-level threshold exists.
- **Rollback** (3: 2 dev, 1 holdout) covers rollback + idempotent retry, and the distinct
  `revoke_approval` action, all against contradiction-free candidates.

**Ground-truth honesty note:** `SIMPLE`/`DACH`/`HOUSEHOLD` resolution cases use `bls_generic` with
well-known, commonly published approximate macro figures — no specific BLS `sourceId` is invented
anywhere in this corpus (unlike some Variant A/Learning-Benchmark-V2 cases, none of these values were
independently re-verified against the BLS database by this task). `COMPOSED`/`HOMEMADE`/`RESTAURANT`/
`VAGUE`/cross-locale cases use `no_numeric_ground_truth` rather than inventing a recipe or "official
restaurant data" figure that was never verified.

**Execution status honesty note:** no scenario in this corpus has been run against live Hybrid C or
the real `ResolverKnowledgeReviewService` by this task. `groundTruthClass` is `unknown`/`not_evaluable`
throughout (never `fixture-derived`/`measured`) and every `reproducibilityNotes` field says so
explicitly. `expectedResult`/`expectedBehavior` values are forward-looking specifications of what the
real, current code should produce, derived by reading the real source directly (§4), not by running
it.

## 7. Harness contract

`RepresentativeHybridBenchmarkHarnessContract.ts` defines the interfaces a future live-execution
harness must implement (RESOLVER-V3-039 for Hybrid C; a corresponding review-service adapter mirroring
`LearningBenchmarkV2GlobalCandidateAdapter.ts` for contradiction-gate/rollback steps), and provides
exactly one concrete function today: `selfCheckRepresentativeHybridBenchmarkCorpus()` — a pure,
synchronous, zero-I/O structural self-test that validates the frozen corpus and cross-checks every
scenario's declared partition against the registry. It executes no scenario and calls no resolver, AI
provider, or review service.

## 8. Zero-network, zero-production-wiring

No file under `representativeHybrid/` imports Supabase, `AnthropicBenchmarkTransport`,
`LiveProviderBudgetGate`, `VariantCLiveInterpretationProvider`, `VariantBLiveProvider`, calls
`fetch`/`XMLHttpRequest`/`node-fetch`, adds a `--live` flag, or reads a provider credential env var
(enforced by `RepresentativeHybridBenchmarkIsolation.test.ts`, mirroring the RESOLVER-V3-023/031/032
isolation-test pattern). No file is referenced by `src/infrastructure/di/container.ts`. No migration,
edge function, or RPC was added.

## 9. Non-goals

This task does not: execute any scenario against live Hybrid C or the real review service; choose a
provider; change ranking/source precedence/personal-memory eligibility/review policy; add a
migration/RPC/Supabase adapter/batch worker; modify any RESOLVER-V3-023 v1 corpus/registry/hash/
canonical-report file; unblock RESOLVER-V3-010; or begin RESOLVER-V3-039/040. RESOLVER-V3-039 owns
live evidence collection against this corpus and is eligible for separate authorization once
RESOLVER-V3-038 and RESOLVER-V3-040 are both merged.
