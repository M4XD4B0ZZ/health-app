# ZERA Representative Hybrid Benchmark Spec 1 (RESOLVER-V3-038)

## 1. Authority and status

This document is the canonical specification for the RESOLVER-V3-038 successor benchmark
("Representative Hybrid Benchmark v1", namespace `representativeHybridV1`). It is a **successor**
to, not a replacement of, `docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` (the original
Resolver V3 A/B/C benchmark spec) and `docs/domains/ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md`
(RESOLVER-V3-023). Where this document is silent, the original Benchmark Spec's §3–§11 remain
binding for taxonomy, ground-truth hierarchy, metrics, and gates.

This spec was authored as part of RESOLVER-V3-038, itself the required concrete follow-up from
RESOLVER-V3-024's `NOT_PASSED` gate verdict (see
`reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` §26/§27 and
`ROADMAP.md`'s "RESOLVER-V3-038 .. RESOLVER-V3-040" section).

## 2. Predecessor preservation

`src/features/nutrition/benchmark/learningV2/**` (RESOLVER-V3-023's corpus, registry, manifest,
evaluators, and reports) is **not modified** by this task. This successor lives entirely under
`src/features/nutrition/benchmark/representativeHybridV1/`, a new, independent directory. Where a
successor scenario is motivated by a specific predecessor scenario (most notably the contradiction/
rollback split, see §11), it records `predecessorScenarioId` for provenance — it never reuses the
predecessor's scenario ID for changed content.

## 3. Versions (five distinct axes)

| Axis                             | Value                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| Corpus contract                  | `resolver-representative-hybrid-benchmark-corpus-1.0.0`       |
| Registry contract                | `resolver-representative-hybrid-benchmark-registry-v1`        |
| Harness version                  | `1.0.0`                                                       |
| Report schema version            | `resolver-representative-hybrid-benchmark-report-v1`          |
| Source-snapshot manifest version | `resolver-representative-hybrid-benchmark-source-manifest-v1` |

Every resolution scenario's inner `BenchmarkCase.corpusVersion` additionally carries the numeric
SemVer axis `1.0.0` (validated by the reused `validateBenchmarkCase`), distinct from the scenario
envelope's long-form corpus-contract string above. None of these literals collides with any
RESOLVER-V3-023 version literal (see `RepresentativeHybridV1Versioning.test.ts`).

## 4. Scenario union (closed, data-only)

`RepresentativeHybridV1Scenario` (`RepresentativeHybridV1Types.ts`) is a closed discriminated union
over five scenario types, mirroring `learningV2`'s domain split:

- `resolution_decomposition` — wraps a reused, unmodified `BenchmarkCase` (RESOLVER-V3-003 schema),
  plus `sourceSnapshotRefs` and an optional `repeatOverlay`.
- `personal_memory_sequence`
- `global_candidate_sequence`
- `privacy_deletion_sequence`
- `economics_sequence`

No scenario carries executable callbacks, provider functions, evaluator functions, arbitrary
metadata bags, or free-form expected-result objects — every field is closed, versioned data. Exact-
key runtime validation (`RepresentativeHybridV1Validator.ts`) rejects unknown root fields, unknown
nested fields (including inside the reused `BenchmarkCase`), unknown scenario types, unknown
partitions, unknown ground-truth classes, and invalid repeat-overlay shapes — types alone are not
trusted.

The governance-fixture step vocabularies (`RepresentativeHybridV1PersonalMemoryStep`,
`RepresentativeHybridV1GlobalCandidateStep`) are this successor's **own** types, not a type-level
import of `learningV2`'s equivalents. This is a deliberate choice, not an oversight: `learningV2`'s
`GlobalCandidateStep.expectedResult` union predates RESOLVER-V3-037 and is missing the real
`blocked_contradiction` result the production `ResolverKnowledgeReviewService` has returned since
that task. Reusing it verbatim would make this successor's contradiction-gate fixture (which must
assert `blocked_contradiction`) untypeable. This module instead reuses the real, authoritative
`ResolverKnowledgeReviewResult` domain type directly for `expectedResult`. The real execution
_engines_ (`LearningBenchmarkV2PersonalMemoryEngine.ts`, `LearningBenchmarkV2GlobalCandidateAdapter.ts`)
are still reused unmodified at the runner/test layer via a structural adapter cast (the engines never
read `expectedResult`, so the cast is safe) — policy logic is reused, not copied; only the step
_type_ is independently owned.

## 5. Corpus size and distribution

### 5.1 Achieved counts (generated, not narrated)

All counts below are computed at runtime by `RepresentativeHybridV1CoverageReport.ts` from the
frozen corpus — never hand-maintained (closing the RESOLVER-V3-023 "41 vs. 39" class of drift; see
`RepresentativeHybridV1CoverageReport.test.ts` and `RepresentativeHybridV1Versioning.test.ts`).

- Total scenarios: **114** (86 development / 28 holdout)
- Resolution base cases: **88** (66 development / 22 holdout)
- Repeat/paraphrase overlay cases: **16** (≈18.2% of base — within the 15–20% target corridor)
- Governance-fixture scenarios: **10** (2 personal-memory, 4 global-candidate, 2 privacy, 2 economics)
- Holdout share of the resolution base: **25.0%** (exceeds the ≥20% floor)
- Every taxonomy category: **exactly 8 base cases** (6 development / 2 holdout)

### 5.2 Documented deviation from the accepted 150–200 corridor

The accepted Benchmark Spec §4 target is 150–200 base cases (~8–12/category), ~20% DACH+complex-
meal-weighted at 25–30%. This successor's 88-case base corpus is a **documented, evidence-based
deviation**, made under the following constraints and justifications:

- **Reason for the deviation:** RESOLVER-V3-038 was executed as a single, time-boxed authoring
  session. Authoring each numeric case responsibly (real BLS `sourceId` verification, hand-derived
  deterministic multi-component totals, committed source snapshots) is materially slower than
  writing placeholder data, and placeholder/fabricated ground truth is exactly what this benchmark
  exists to prevent (requirement 9). 88 cases at the spec's _minimum per-category floor_ (8/category)
  was judged the responsible ceiling achievable with real, verified ground truth in the time
  available, rather than a token corpus.
- **Every minimum condition the spec allows a deviation under is still met:**
  - Every taxonomy category has **at least 8** base cases. ✅ (all exactly 8)
  - Every mandatory G2 category (`DACH`, `COMPOSED`, `RESTAURANT`) appears in **both** development
    and holdout. ✅
  - Every expected behavior (`direct_resolution`, `resolution_with_assumption`,
    `clarification_required`, `multiple_candidates_acceptable`, `abstention_expected`) appears in
    **both** partitions. ✅
  - Every difficulty (`easy`/`medium`/`hard`/`adversarial`) appears in **both** partitions. ✅
  - Holdout is **≥20%** of the resolution base (achieved 25.0%). ✅
  - Complex-meal weighting (`COMPOSED`+`HOMEMADE`+`RESTAURANT`) is **27.3%**, consistent with the
    accepted spec's ~30% target. ✅
  - **DACH weighting is 14.8%** (13 of 88: 8 `DACH`-category cases + 2 DACH-flavored `HOMEMADE`
    cases + 3 `RESTAURANT`/`regional_independent` cases) — **below** the accepted 25–30% target.
    This is disclosed here and in the readiness report as an honest shortfall, not claimed as met.
  - No claim stronger than the achieved coverage is made anywhere in the reports (fixture-only
    labeling, explicit "no live quality evidence" statements — see §9).

A future amendment (a new, explicitly reviewed corpus version) should extend the corpus toward the
150–200 target and close the DACH-weighting gap before this benchmark is used as a G2 acceptance
input; V3-038 itself never claims G2/G3 passage (see §14).

## 6. Development/holdout registry and freeze protocol

`RepresentativeHybridV1Registry.ts` is an immutable dev/holdout registry over every scenario ID,
mirroring `learningV2`'s pattern. It fails closed on:

- an unknown registry version,
- a scenario ID assigned to more than one partition,
- an overlay whose own `partition` differs from its base scenario's registered partition
  (`assertNoOverlayPartitionDrift`) — this is what prevents a repeat/paraphrase overlay from
  silently moving partitions independently of its base case (requirement 8).

**Freeze protocol followed:**

1. Contracts/validators defined (`RepresentativeHybridV1Types.ts`, `RepresentativeHybridV1Validator.ts`).
2. Complete development/holdout corpus authored (11 category files + repeat-overlay file +
   governance-fixture file).
3. Source-snapshot manifest authored (`RepresentativeHybridV1SourceSnapshotManifest.ts`).
4. All cases validated (`assertValidRepresentativeHybridV1Corpus`).
5. Counts/coverage generated (`RepresentativeHybridV1CoverageReport.ts`).
6. Corpus and source-manifest hashes computed (`computeRepresentativeHybridV1CorpusHash`,
   `computeRepresentativeHybridV1SourceManifestHash`).
7. A dedicated corpus-freeze commit was made — see the RESOLVER-V3-038 readiness report for the
   exact commit SHA and hashes.
8. The harness (runner/evaluators/aggregator/report builder/CLI/tests) was implemented after the
   freeze commit, in a separate commit.
9. Holdout case inputs, expectations, source snapshots, and partition assignments are not modified
   after the freeze commit — verified by `git diff` against the freeze SHA in the readiness report.

## 7. Ground-truth hierarchy

Reused unmodified from the accepted Benchmark Spec §5 (`GroundTruthSource` type,
`BenchmarkCaseTypes.ts`): `manufacturer_label` > `official_restaurant_data` > `bls_generic` >
`documented_recipe` > `other_verified_database` > `curated_reference_range` >
`no_numeric_ground_truth`. Missing values are always `null`, never `0` — enforced by the reused
`validateBenchmarkCase` and this successor's own nested-key validation.

`COMPOSED`/`HOMEMADE` numeric cases record `documented_recipe` ground truth as a hand-derived,
component-by-component deterministic total (each component's real BLS `sourceId`, gram quantity,
and per-100g macros are quoted in `groundTruthProvenance`, with the exact arithmetic shown) — never
an unexplained meal-level number.

## 8. Source-snapshot model

`RepresentativeHybridV1SourceSnapshotManifest.ts` is the frozen, versioned manifest for every non-
BLS external ground-truth/retrieval-catalog fixture (`manufacturer_label` and
`official_restaurant_data` snapshots — Nutella, Coca-Cola, Coca-Cola Zero, Milka Alpenmilch,
McDonald's Cheeseburger DE, Subway Veggie Delite DE). Each entry records a snapshot ID, source type,
external reference description, retrieval date, content hash, locale/region, covered case IDs, and a
license note. BLS itself is not re-declared here — it is the existing, separately-committed
`bls-runtime-compact.v1.json` artifact, read unmodified via the real `BlsStaticSource`.

**Honesty note (residual limitation):** the manufacturer-label and official-restaurant-data snapshot
values are reconstructed from general, widely-published nutrition-label knowledge current as of
authoring (2026-07-22), not independently re-verified via a live fetch during this task (the task
forbids runtime network access). They are minimal, structured, versioned factual snapshots — never
full copyrighted webpages — and are explicitly labeled as reconstructed rather than presented as
freshly re-scraped. `RepresentativeHybridV1BenchmarkSourceAdapters.ts` serves these snapshots as a
real, zero-network `FoodCatalogSource` (`type: 'off'`) — a reusable catalog queryable by product
name, never a case-ID-keyed answer map (requirement 13).

## 9. A/B/C arm design and provider injection

`RepresentativeHybridV1ThreeArmRunner.ts` is the one canonical runner. For every resolution
scenario, it runs:

- **A** — the real, unmodified `buildVariantAResolver()`/`runVariantACase()`/`evaluateVariantACase()`
  (RESOLVER-V3-003), BLS-only, zero AI.
- **B** — the real `runVariantBCase()`/`evaluateVariantBCase()` (RESOLVER-V3-004) against an
  injected `VariantBProvider`, defaulting to `NoopVariantBProvider` (deterministic `error`, zero
  network, zero cost) when the caller injects nothing.
- **C** — the real `runVariantCCase()`/`evaluateVariantCCase()` (RESOLVER-V3-005) against an
  injected `VariantCAiInterpreter`, defaulting to `FixtureCostAiInterpreter(new
NoopAiInterpretationProvider())` (deterministic `unavailable`, zero network, zero cost).

All three arms receive the exact same `BenchmarkCase` (same `caseId`, `rawInput`, `locale`, ground
truth, partition) — no arm-specific case wording exists anywhere in the corpus. No ranking,
retrieval, decision, or evaluation logic is reimplemented in this successor; every arm reuses its
real RESOLVER-V3-003/004/005 adapter/evaluator pair verbatim.

**Provider injection boundary (requirement 17):** every dependency on `RepresentativeHybridV1RunnerDependencies`
is optional; none is ever constructed as a live provider, none reads a credential, none imports a
provider-specific transport. V3-039 injects its own live `VariantBProvider`/`VariantCAiInterpreter`
implementations through this exact same interface — no change to this harness's code is required.

**A documented architecture finding from authoring:** Variant A's fast path
(`ResolverV3VariantAAdapter.ts` → `normalizeText` → `SequentialFoodCatalogResolver` →
`BlsStaticSource`) does not strip a leading quantity/article token before searching BLS (verified
empirically: `"100g Reis roh"` and `"Ein Ei"` both return `NO_CANDIDATES`, while bare `"Reis"`/`"Ei"`
resolve directly). This is consistent with `ResolverV3VariantAAdapter.ts`'s own documented scope
("quantity parsing lives in a separate layer not exercised here") and with the historical 14-case
smoke corpus's exclusively bare-food-name convention. The successor corpus deliberately keeps
natural "quantity + food" phrasing where the taxonomy/behavioral coverage requires it (explicit
quantity, household measure, etc.) — Variant A's fast path failing on such input and falling through
to Variant C's AI-interpretation branch is itself a real, disclosed, and valuable signal (Hybrid C's
value proposition over bare A), not a corpus defect.

## 10. Fast-path visibility

Every C-case records (`VariantCMealResult.fastPath`/`aiInterpretation`): whether the fast path was
attempted, whether it was accepted, whether AI was called, avoided-call count, and (via
`evaluateVariantCCase`) whether the resulting identification/false-confidence judgment is
attributable to the fast path or the AI branch. `RH-RES-DACH-DEV-006` ("Brötchen") is a deliberate
regression fixture reproducing the real, historically-documented RV3-0011 false-confidence defect
(RESOLVER-V3-024 §10/§24): Variant A's fast path confidently (and wrongly) accepts BLS `D771900`
("Brötchen (Blätterteig)", a puff-pastry roll) for the bare word "Brötchen"; Variant C's fast path is
literally Variant A's resolver, so it inherits this false confidence unchanged
(`RepresentativeHybridV1ThreeArmBoundary.test.ts` proves this end-to-end against the real harness).

## 11. Contradiction/rollback separation

RESOLVER-V3-024 §24 found that the predecessor's single frozen fixture `LBV2-GC-DEV-006` coupled a
`single-user-block` check, a `contradiction-gate` check, and a `review-rollback` check into one
scenario and one candidate chain — fixing the contradiction gate (RESOLVER-V3-037) made the
rollback steps on that _same_ candidate newly unreachable (`invalid_transition`), even though
rollback itself was never broken.

This successor closes that structurally, not by discipline: three independent scenarios, each with
its own candidate and no shared decision-ID namespace:

- `RH-GC-DEV-PRIVACY-001` (`single-user-block` tag only) — single-user evidence, no forced
  independent confirmation, expects `blocked_privacy`.
- `RH-GC-DEV-CONTRA-001` (`contradiction-gate` tag only, `predecessorScenarioId: LBV2-GC-DEV-006`)
  — independent-user evidence hypothetically satisfied, contradiction forced, expects
  `blocked_contradiction` (the _current_, already-fixed production result — not the predecessor's
  stale pre-fix `applied` literal). No rollback steps at all.
- `RH-GC-DEV-ROLLBACK-001` (`review-rollback` tag only, `predecessorScenarioId: LBV2-GC-DEV-006`) —
  a legitimately, contradiction-free approved candidate, then rollback, an idempotent retry
  (`already_applied`), and a conflicting-decision-ID reuse (`conflict`). No contradiction-forcing
  step at all.

`RepresentativeHybridV1Governance.test.ts` proves tag/fixture separation and that a failure in the
contradiction fixture cannot make the rollback fixture unreachable.

## 12. Privacy

Every scenario declares `personalDataFree: true`. Governance-fixture owner/observation/candidate IDs
are fictional, deterministic strings (`owner-fixture-rh-*`), never a real user identifier, real
journal input, or production telemetry.

## 13. No-live/no-production boundary

There is deliberately **no `--live` flag** anywhere in this benchmark (CLI, harness entry, or runner
dependencies) — the successor is zero-network and zero-provider-credential by construction, not by a
runtime-blocked flag. `RepresentativeHybridV1Isolation.test.ts` proves: no live-transport import, no
`fetch()` call, no provider-credential env var read, no DI/container reference, no migration/RPC/
Supabase reference, no package/lockfile reference, no feature-flag reference.

## 14. V3-039 handoff and G2-B treatment

**Mandatory A/B/C comparability finding (from the required inventory):** the accepted Benchmark Spec
§11 G2 false-confidence dimension requires Hybrid C to be **strictly better than both Variant A and
Variant B** ("streng niedriger als A und B (hartes, nicht-vorläufiges Kriterium)"). No binding
authority anywhere removes Variant B from G2 scope. RESOLVER-V3-024 §9/§338 restates this
identically ("Requirement: C strictly better than A and B"). Therefore this successor implements the
harness as a genuine **three-arm boundary (A/B/C)**, not an A/C-only harness — this is what makes
G2-B structurally evaluable in the first place.

**V3-039's scope** (RESOLVER-V3-039, `todo`, not started by this task) is confirmed/updated as:
collect controlled, representative **live B and C** evidence on this successor corpus, under the
same pinned provider/model, injecting live implementations of `VariantBProvider`/
`VariantCAiInterpreter` through the exact `RepresentativeHybridV1RunnerDependencies` interface this
harness already exposes, plus a shared budget gate and pinned provider/model run-protocol metadata.
V3-039 must not modify this successor's corpus after its protocol is declared, must avoid holdout
until a predeclared final-evaluation gate, and must never fall back from live to fixture silently.

## 15. Metrics and reporting

Report schema `resolver-representative-hybrid-benchmark-report-v1`
(`RepresentativeHybridV1ReportBuilder.ts`) reports development/holdout/combined metrics separately
per arm (`RepresentativeHybridV1MetricsAggregator.ts`) — case count, evaluable count, identification
breakdown, expected-behavior agreement, false-confidence count/rate, critical-failure count,
technical-error count, category/difficulty/locale breakdowns, plus C-specific fast-path/AI-call
counts and provenance rates. Every report is stamped `runMode: 'fixture'`, `fixtureOnly: true`,
`noLiveQualityEvidence: true`, `noProductionEffect: true` and the Markdown report opens with an
explicit fixture-only banner — no live quality winner is ever declared by this task's output
(`RepresentativeHybridV1ReportBuilder.test.ts`).

## 16. Conformance fixtures vs. evaluation corpus

`RepresentativeHybridV1ConformanceFixtures.ts` is a small, separate, six-case fixture set
(`RH-CONF-*`, own corpus-version literal `1.0.0` under its own namespace, never registered in the
main registry) exercising every provider/result branch (multi-component search planning,
clarification, abstention, invalid response, technical error, source retrieval + deterministic
calculation). Every record produced from it is labeled `isFixtureOnly: true` in the report and is
structurally excluded from representative-quality metrics
(`aggregateRepresentativeHybridV1Metrics` skips `isFixtureOnly` records). Its fixture AI/B responses
are hand-authored independently of the representative corpus's expected answers — never seeded from
holdout ground truth.

## 17. Residual limitations

1. Corpus size is 88 base cases (spec floor), not the 150–200 target — see §5.2's disclosed
   deviation.
2. DACH weighting is 14.8%, below the 25–30% target — disclosed, not claimed as met.
3. Manufacturer-label/official-restaurant-data snapshots are reconstructed from general knowledge,
   not independently re-verified via a live fetch in this task (zero-network constraint) — see §8.
4. Variant A's fast path does not parse quantity-prefixed natural language (a real, pre-existing
   architecture characteristic, not introduced by this task) — see §9.
5. This corpus/harness produces **no live quality evidence**. RESOLVER-V3-039 remains required
   before any G2/G3 gate judgment; RESOLVER-V3-040 remains required before judging cost/latency;
   RESOLVER-V3-010 remains blocked.
