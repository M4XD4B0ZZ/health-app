# RESOLVER-V3-024 — Representative Learning/Hybrid Gate Re-decision

Status: `done` (task completion) — **overall gate verdict: `NOT_PASSED`**
Evidence cut-off commit: `34178e87e6222f22510acafa99c19d8cba72913d` (`origin/chore/clean-arch-structure`, merge of PR #130)
Task type: documentation and evidence-synthesis only — no resolver behavior, review behavior, benchmark
corpus, canonical historical report, or production wiring is changed by this document.

---

## 1. Executive decision

**Overall gate verdict: `NOT_PASSED`.**

Every mandatory G2 dimension must be `passed` for the overall gate to pass. Of the seven G2
dimensions evaluated below, **two are `failed`** (G2-A representative quality, G2-B false
confidence) and **four are `not_evaluable`** (G2-C user friction, G2-D latency, G2-E cost, G2-G
consistency); only G2-F (provenance/nutrient authority) is `passed`. Per the binding decision
rule, a single `failed` or `not_evaluable` mandatory dimension is sufficient to keep the gate
`NOT_PASSED` — this report has six such dimensions, not one.

This verdict is caused by **both** directly adverse evidence and insufficient representative
evidence, not by either cause alone:

- **Directly adverse:** on the only corpus in which live Hybrid Variant C was actually executed
  (RESOLVER-V3-013's 14-case smoke corpus), live C underperformed Variant A on identification
  (58.3% vs. 75.0%) and retained the same critical false-confidence case A already has
  (`RV3-0011`, "Brötchen"), rather than resolving it more safely.
- **Insufficient representative evidence:** no corpus containing `COMPOSED`, `HOMEMADE`, or
  `RESTAURANT` cases — the categories the Decision Record and Benchmark Spec identify as the
  ones Hybrid C must actually differentiate on (G2-A) — has ever been run through live Hybrid C.
  Learning Benchmark V2 (RESOLVER-V3-023), despite adding exactly those categories to its
  resolution/decomposition corpus, executes them through the real, unmodified, zero-AI
  `SequentialFoodCatalogResolver` (Variant A), not live Hybrid C. No accepted production p95
  latency budget or cost ceiling exists (RESOLVER-V3-007), so G2-D/G2-E cannot be evaluated at
  all without inventing a threshold, which this task is forbidden to do.

**RESOLVER-V3-010's gate dependency is NOT satisfied. RESOLVER-V3-010 remains `blocked`.**

---

## 2. Task completion versus gate outcome

These are explicitly distinct, per the same binding interpretation RESOLVER-V3-023 and
RESOLVER-V3-037 established and applied to themselves:

- **Task completion:** `complete`. The mandatory pre-decision inventory (§7 below, all 38
  questions), the temporal evidence timeline (§8), the G2 matrix (§9), the learning/governance
  invariant matrix (§10), the G3 matrix (§11), and the required analyses (§§12–21) were all
  produced from the currently accepted evidence, with no invented threshold and no corpus/report
  rewrite.
- **Gate outcome:** `NOT_PASSED`. A documentation task can be, and here is, fully complete while
  concluding `NOT_PASSED` — this is the explicit, expected, evidence-consistent outcome given the
  state described in the task's own binding framing, confirmed rather than assumed by this
  report's independent code-level verification (§6).

---

## 3. Authority and scope

This report is subordinate to, and does not amend, override, or reinterpret:

- `SSOK.md` / `AGENTS.md` (Level 1 governance constitution)
- `ROADMAP.md` / `VERIFY.md` / `.governance/*` (Level 2 canonical domain authorities)
- `docs/domains/ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md` and
  `docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` (food-resolution authority; defines G1–G4
  and the accepted three-variant benchmark protocol)
- `docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md` (learning/governance
  authority; defines the four knowledge layers, personal-memory tiers, review/shadow/privacy
  invariants, and already records the historical V3-013 gate as `NOT PASSED`)

This report performs exactly one function: re-evaluating the representative Learning/Hybrid gate
against the currently accepted evidence, and recording the result. It does not change resolver
behavior, review behavior, corpora, canonical historical reports, or production wiring (§29).

---

## 4. Evidence cut-off commit

`34178e87e6222f22510acafa99c19d8cba72913d` — the tip of `origin/chore/clean-arch-structure` at
task start, merge commit of PR #130 (RESOLVER-V3-037's documentation follow-up). This is also the
commit this task's branch (`claude/resolver-v3-024-representative-gate-redecision`) was created
directly from. No evidence generated after this commit is used; no evidence before it that was
superseded by it (e.g. earlier partial V3-013 protocol attempts) is treated as authoritative.

---

## 5. Source inventory

All sources listed in the task's "Mandatory source reading" section were read in full before this
report was drafted:

**Governance:** `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, `.governance/SYSTEM.md`,
`.governance/RULES.md`, `.governance/SAFETY.md`, `.governance/REVIEW_POLICY.md`.

**Food-resolution authority:** `docs/domains/ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md`,
`docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md`,
`reports/RESOLVER_V3_THREE_VARIANT_COMPARISON_REPORT.md`,
`reports/RESOLVER_V3_COST_LATENCY_CACHE_ANALYSIS.md`,
`reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`.

**Learning and governance authority:**
`docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md`,
`docs/domains/ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md`,
`reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md`,
`reports/resolver-v3-learning-v2-benchmark.json`,
`reports/RESOLVER_V3_037_CONTRADICTION_APPROVAL_GATE_REMEDIATION_REPORT.md`,
`docs/domains/ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md`,
`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_1.md`,
`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_1.md`,
`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_1.md` (the accepted personal-memory
read-path contract),
`docs/domains/ZERA_RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_1.md`,
`docs/domains/ZERA_RESOLVER_KNOWLEDGE_SHADOW_MODE_CONTRACT_1.md`.

**Roadmap entries:** RESOLVER-V3-006, -007, -010, -013, -019, -023, -024, -037 (complete current
entries), plus the surrounding RESOLVER-V3-025..036 remediation series for context on what is and
is not production-wired.

**Executable evidence (code-level, independently verified — see §6):**
`scripts/benchmark-resolver-v3-variant-{a,b,c}.mjs`,
`src/features/nutrition/benchmark/ResolverV3VariantAAdapter.ts`,
`src/features/nutrition/benchmark/runResolverV3Variant{A,B,C}Benchmark.ts`,
`scripts/benchmark-resolver-v3-learning-v2.mjs`,
`src/features/nutrition/benchmark/learningV2/evaluateLearningBenchmarkV2ResolutionScenario.ts`,
`src/features/nutrition/benchmark/learningV2/LearningBenchmarkV2PersonalMemoryEngine.ts`,
`src/features/nutrition/benchmark/learningV2/LearningBenchmarkV2GlobalCandidateAdapter.ts`,
`src/features/nutrition/application/knowledge/ResolverKnowledgeReviewService.ts`,
`src/features/nutrition/application/knowledge/ResolverKnowledgeCandidateAggregator.ts`,
`src/features/nutrition/domain/models/ResolverKnowledgeCandidate.ts`,
`src/features/nutrition/application/services/PersonalResolutionMemoryAwareFoodCatalogResolver.ts`,
`src/infrastructure/di/container.ts`,
`src/features/nutrition/domain/catalog/FoodCatalogSource.ts`.

---

## 6. Evidence-class definitions

Reused verbatim from the existing accepted reports, not reinvented:

- **Real / measured** — an actual execution of the named code path was observed and its output
  recorded (e.g. Variant A's real resolver run; V3-013's live provider telemetry).
- **Fixture-only** — a deterministic, hand-authored test double stood in for a live dependency;
  its output demonstrates the harness/contract, not the real dependency's quality
  (RESOLVER-V3-006 §, applied identically here).
- **Assumed** — a scenario input asserted for modeling purposes, not observed (RESOLVER-V3-007).
- **Derived** — a formula result computed from other evidence-classed inputs (RESOLVER-V3-007).
- **Unknown** — absent; no numeric claim is permitted from it (RESOLVER-V3-007).
- **Architectural fact** — a property guaranteed by code structure itself (e.g. "no `'ai'` source
  is registered in `container.ts`"), independent of any benchmark run, and independently
  re-verified by this task's own code reading rather than taken from a report's claim.

This report does **not** introduce a new evidence class; every fact below is tagged with one of
the five above, or explicitly marked "architectural fact, independently re-verified."

---

## 7. Pre-decision inventory (all 38 questions, evidence-class tagged)

1. **V3-006 evidence class for Variant A:** _Real/measured._ "Variant A is a real, reproducible
   baseline measurement of the current resolver plus the committed BLS artifact"
   (`RESOLVER_V3_THREE_VARIANT_COMPARISON_REPORT.md`).
2. **V3-006 evidence class for fixture B/C:** _Fixture-only._ "Variants B and C ran in
   deterministic fixture mode. Their numerical scores demonstrate their respective harnesses and
   contracts, not a live AI provider's quality" (same report).
3. **V3-013 evidence class for live B/C:** _Real/measured._ The only report in the corpus
   containing actual live-provider telemetry (real tokens, real cost, real latency, real
   accuracy) — confirmed by direct reading of `RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`.
4. **V3-013 corpus:** The same 14-case smoke corpus (`RV3-0001`..`RV3-0014`) used by V3-006,
   pinned provider/model (`claude-haiku-4-5`)/prompt/schema versions.
5. **Representative categories absent from V3-013's corpus:** `COMPOSED`, `HOMEMADE`,
   `RESTAURANT` — stated explicitly in the report: "The common corpus contains only 14 cases and
   lacks COMPOSED, HOMEMADE, and RESTAURANT coverage."
6. **A and live C identification results:** A baseline 9/12 = **75.0%**; live C 7/12 = **58.3%**
   (live B 2/12 = 16.7%, for context). "Neither live B (16.7%) nor live C (58.3%) surpasses A's
   75.0% baseline identification on this corpus."
7. **Live C false-confidence case:** Yes — `RV3-0011` ("Brötchen"), the same fast-path case A's
   real baseline already flags, inherited rather than resolved by C.
8. **Live C unbacked authoritative numeric value:** No — 0 unbacked numeric results recorded for C
   (and for A); B is "not source-grounded by design" and separately excluded from this claim.
9. **Live C provenance coverage:** sourceId present in **83.3%** of cases (vs. A's 100%) — an
   explicit, disclosed shortfall, not a silent one.
10. **Live C latency (all-case / AI-routed):** all-case p50 300.696 ms / p95 7,430.044 ms;
    AI-routed-only p50 5,152.507 ms / p95 7,430.044 ms (n=7 each).
11. **Actual token usage and estimated cost:** combined (final authorized protocol) 54,728 input +
    8,046 output tokens, **USD 0.094958** estimated provider cost under the pinned snapshot; C
    alone: 11,352 input / 2,988 output tokens, USD 0.026292.
12. **Cost inputs remaining unknown:** C's HTTP-status field (unknown for all 7 successful calls)
    and C's cache-creation/cache-read token fields (not delivered, retained as unknown rather than
    inferred).
13. **Production traffic/cache assumptions remaining unknown:** all of them — V3-007 explicitly
    states production cost/latency bounds, cache-hit-rate projection, and traffic-distribution
    scenarios are "not derivable" without live production data; V3-013 does not resolve this (it
    is a 14-case smoke experiment, explicitly "not a production-quality estimate").
14. **Does V3-007 define an accepted latency threshold?** **No.** "Production p95 budget | not
    derivable"; the only latency treatment is a "provisional [variable] model," never an accepted
    number.
15. **Does V3-007 define an accepted cost ceiling?** **No.** "Production cost per log/monthly
    ceiling | not derivable"; the cost formula is explicitly symbolic (`N_low`/`N_base`/`N_high`),
    and its scenario table is labeled "planning comparison only" / "sensitivity stress only," not
    an accepted bound.
16. **Which resolver executes Learning Benchmark V2 resolution/decomposition scenarios:** the
    real, unmodified `SequentialFoodCatalogResolver` (Variant A adapter), **zero AI** — stated
    explicitly in `ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md` and independently confirmed by
    direct code reading of
    `evaluateLearningBenchmarkV2ResolutionScenario.ts` (imports and calls
    `buildVariantAResolver`/`runVariantACase` verbatim; its own header comment states "zero AI,
    zero network, source-grounded BLS data only").
17. **Does Learning Benchmark V2 execute live Hybrid C?** **No**, anywhere, for any of its five
    scenario classes. Resolution/decomposition uses Variant A (Q16); personal-memory sequences
    drive real production use cases with a fixture repository, not an AI call; global-candidate
    sequences drive real review/shadow/ledger application code with in-memory repositories, not a
    resolver call at all. `scripts/benchmark-resolver-v3-learning-v2.mjs` states: "There is
    deliberately no `--live` flag anywhere in this benchmark: it is zero-network and
    zero-provider-credential by construction."
18. **Which Learning Benchmark V2 dimensions remain representative despite this limitation:**
    learning architecture (private memory tiers, invalidation, deletion), governance/review
    lifecycle mechanics, privacy separation, shadow no-effect isolation, and fixture-level
    economics (avoided-call counting) — all evaluated against real production application code,
    just not against live Hybrid C quality.
19. **Historical V3-023 system verdict:** `NOT_PASSED` — 19 of 20 required invariants passed;
    `INV-07` failed.
20. **Which invariant failed:** `INV-07` — "Once independent-user evidence is hypothetically
    satisfied, contradiction still prevents promotion," reason code
    `APPROVAL_SUCCEEDED_DESPITE_CONTRADICTION`, scenario `LBV2-GC-DEV-006`.
21. **What V3-037 explicitly remediated:** exactly `INV-07` — added a `blocked_contradiction`
    result to `ResolverKnowledgeReviewService.review()`'s `approve` branch, checked before the
    independent-user-evidence check, with no numeric threshold (a contradiction count of 1 and of
    1,000,000 are refused identically). Confirmed live in code:
    `ResolverKnowledgeReviewService.ts`'s `review()` method now short-circuits to
    `blocked_contradiction` for `contradictionStatus === 'present'` before ever consulting
    `independentUserEvidence`.
22. **What V3-037 explicitly did not remediate:** it does not retroactively pass the historical
    V3-023 report; does not imply the full benchmark was rerun; does not create any production
    resolver effect; `ResolverKnowledgeReviewService` remains unwired (zero production callers,
    independently confirmed by grep — no reference in `container.ts`); RESOLVER-V3-035
    (independent-user evidence policy) remains `blocked`, so no candidate can reach `approved` in
    production regardless of this fix.
23. **Why the historical V3-023 report cannot be rewritten:** it is frozen historical evidence of
    the pre-fix service's actual behavior at the time it was benchmarked; rewriting it would
    misrepresent what was actually observed and destroy the audit trail V3-037's own remediation
    report relies on to prove a genuine before/after fix.
24. **Why V3-037's pass cannot be arithmetically added to claim "20/20 passed":** the historical
    V3-023 report is a point-in-time execution against the pre-fix service; V3-037 is focused,
    narrow regression evidence against the post-fix service using a hand-reproduced fixture state,
    not a full benchmark re-run under a compatible corpus/harness. No task instruction authorizes
    treating focused remediation evidence as equivalent to a full benchmark re-pass.
25. **Frozen-fixture coupling affecting current diagnostic runs:** `LBV2-GC-DEV-006` combines a
    `contradiction-gate`-tagged approval step and `review-rollback`-tagged rollback steps in one
    scenario. Now that the (correctly tightened) gate blocks that scenario's approval, its later
    `rollback`/`rollbackRetry` steps — which require a prior active approval — now return
    `invalid_transition` rather than `applied`/`already_applied`. A live re-run of
    `evaluateLearningBenchmarkV2Invariants` against the current, fixed service therefore reports
    `INV-10` (atomicity/idempotency) and `INV-11` (rollback deactivation) as newly `failed` for
    this one frozen fixture, disclosed explicitly in the V3-037 remediation report as an expected,
    non-regression consequence.
26. **Does dedicated current test evidence still prove legitimate rollback/revocation behavior?**
    **Yes.** The dedicated `ResolverKnowledgeReview.test.ts` unit suite (63 tests, all green)
    independently proves rollback/revocation correctness for a legitimately approved,
    contradiction-free candidate — the frozen `LBV2-GC-DEV-006` fixture's INV-10/INV-11 failure is
    a diagnostic artifact of that one scenario coupling two concerns, not evidence that the
    underlying rollback logic itself regressed.
27. **Is the personal-memory read path implemented?** **Yes**, in production.
    `PersonalResolutionMemoryAwareFoodCatalogResolver` wraps the base resolver in
    `container.ts` (non-test env: `SupabasePersonalResolutionMemoryReadRepository`; test env:
    `NoopPersonalResolutionMemoryReadRepository`), independently confirmed by direct code reading.
28. **Does it provide exact same-user P2 reuse and avoided-call evidence?** **Yes**, but narrowly:
    exact-match only, keyed on the already-resolved `{sourceType, sourceId}` identity (never raw
    query text), `P2_confirmed` only. Learning Benchmark V2's `INV-02` (measured, real use cases):
    2 avoided interpretation calls observed.
29. **Does it provide production traffic-level cache-hit-rate evidence?** **No.** Only benchmark
    fixture-level avoided-call counts exist; no production traffic has ever been observed through
    this path (RESOLVER-V3-010 is blocked, so there is no production hybrid call to avoid in the
    first place).
30. **Does any production global-knowledge read path exist?** **No.** No resolver reads
    `approved_resolver_knowledge` or any candidate/review output in production; confirmed by grep
    — zero references to the review/candidate/ledger machinery in `container.ts`.
31. **Does any production Hybrid C integration exist?** **No.** `container.ts`'s `resolverSources`
    array is exactly `[userAliasSource, blsSource, offSource, usdaSource]` (plus test-only mocks);
    the `'ai'` `FoodSourceType` variant exists in the type union but zero instances of it are
    constructed or registered anywhere in the container — independently re-verified by direct code
    reading, not merely cited from a report.
32. **Does RESOLVER-V3-010 remain blocked in the current ROADMAP?** **Yes** — `Status: blocked`,
    depends on RESOLVER-V3-006 (historical comparison gate), RESOLVER-V3-019, and RESOLVER-V3-024
    (this task).
33. **Which G2 dimensions can be evaluated today?** G2-A (adversely), G2-B (adversely), G2-F
    (favorably, on available narrow evidence). See §9.
34. **Which G2 dimensions fail?** G2-A (representative quality), G2-B (false confidence). See §9.
35. **Which G2 dimensions remain not evaluable?** G2-C (user friction), G2-D (latency), G2-E
    (cost), G2-G (consistency) — each blocked by either missing representative-corpus evidence or
    the explicit absence of an accepted threshold. See §9.
36. **Which G3 prerequisites are independently satisfied?** Prerequisite 2 (cost/latency model
    reviewed — V3-007 exists and was reviewed, even though it produced no accepted numeric bound)
    and prerequisite 3 (safe personal-memory/cache read path exists — RESOLVER-V3-019/026,
    production-wired, fail-open, exact-match only).
37. **Which G3 prerequisite remains unsatisfied?** Prerequisite 1 (G2 passed — it did not) and,
    consequently, prerequisite 4 (this task's own representative-gate decision — `NOT_PASSED`).
38. **What exact evidence would be required for a later passed decision?** A representative
    corpus (including `DACH`/`COMPOSED`/`RESTAURANT`/`SIMPLE`/`HOUSEHOLD` at minimum) actually
    executed through live Hybrid C, with false confidence strictly better than A and B, an
    accepted (pre-declared, not post-hoc) p95 latency budget and cost ceiling against which the
    live results are then judged, and a friction/consistency evaluation on that same
    representative corpus — none of which currently exists. See §26/§27 for the concrete follow-up
    tasks this implies.

---

## 8. Temporal evidence timeline

| Order | Task                          | Evidence produced                                                      | Class                                                                                                                    | Corpus                                                                                                | Verdict recorded                                                                                                        |
| ----- | ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | RESOLVER-V3-006               | Three-variant comparison                                               | A: real: B/C: fixture-only                                                                                               | 14-case smoke                                                                                         | NOT PASSED / decision deferred                                                                                          |
| 2     | RESOLVER-V3-007               | Cost/latency/cache model                                               | assumed/derived/unknown                                                                                                  | n/a (symbolic model)                                                                                  | No production bound derivable                                                                                           |
| 3     | RESOLVER-V3-013               | Controlled live B/C evidence                                           | real/measured                                                                                                            | same 14-case smoke, missing COMPOSED/HOMEMADE/RESTAURANT                                              | **NOT PASSED** (no rerun authorized)                                                                                    |
| 4     | RESOLVER-V3-014..022          | Knowledge-growth architecture, privacy, review, shadow implementations | real production code, zero production callers wired                                                                      | n/a                                                                                                   | governance/architecture only                                                                                            |
| 5     | RESOLVER-V3-023               | Learning Benchmark V2                                                  | real production code (resolution = Variant A, zero AI; memory/review/shadow = real application code, in-memory adapters) | 39 scenarios executed (30 dev / 9 holdout) across five domains — **not** live Hybrid C for any domain | historical system verdict `NOT_PASSED`, 19/20 invariants, INV-07 failed                                                 |
| 6     | RESOLVER-V3-037               | Focused INV-07 remediation                                             | real production code change + dedicated regression tests                                                                 | hand-reproduced `LBV2-GC-DEV-006` fixture state                                                       | focused INV-07 verdict `PASSED`; historical V3-023 report untouched; discloses INV-10/INV-11 frozen-fixture consequence |
| 7     | RESOLVER-V3-024 (this report) | Representative gate re-decision                                        | synthesis of 1–6 plus independent code verification                                                                      | n/a (documentation)                                                                                   | **overall gate NOT_PASSED**                                                                                             |

Note on scenario-count bookkeeping: `ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md` and the
RESOLVER-V3-023 ROADMAP implementation notes narratively state "41 scenarios (32 development, 9
holdout)." Independent counting of `reports/resolver-v3-learning-v2-benchmark.json`'s
`development`/`holdout` arrays and of `scenarioId:` occurrences across the five corpus source
files (`LearningBenchmarkV2{Resolution,PersonalMemory,GlobalCandidate,Privacy,Economics}Corpus.ts`)
both independently total **39** (30 development + 9 holdout), not 41/32. This is a minor,
disclosed documentation-inventory discrepancy in the prose narrative of two already-frozen
artifacts — not a discrepancy this report resolves by editing either frozen document, and not one
that changes any invariant pass/fail count or the system verdict. It is recorded here for
transparency and does not affect this gate decision, since it does not touch Hybrid C
representativeness, false confidence, cost, or latency in any way.

---

## 9. G2 gate matrix

| Dimension                            | Requirement                                                                                                      | Evidence used                                                                                                                                                                                                           | Evidence class                                                       | Observed result                                                                                                                                | Status            | Reason                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| G2-A Representative quality          | C ≥ A in DACH/COMPOSED/RESTAURANT, no regression in SIMPLE/HOUSEHOLD, from a representative corpus run through C | V3-013 live run (only corpus C was ever live-executed on)                                                                                                                                                               | real/measured (but non-representative corpus)                        | C underperforms A on the only executed identification metric (58.3% vs 75.0%); zero COMPOSED/HOMEMADE/RESTAURANT cases ever run through live C | **failed**        | Both directly adverse (C < A where comparable) and no representative-category coverage exists at all                 |
| G2-B False confidence                | C strictly better than A and B                                                                                   | V3-013 live evidence                                                                                                                                                                                                    | real/measured                                                        | Live C retained the identical critical false-confidence case A already has (`RV3-0011`), inherited not resolved                                | **failed**        | Hard criterion; "strictly better" fails when the same critical case persists unchanged                               |
| G2-C User friction                   | Clarification/abstention/multi-candidate behavior representative of intended product categories                  | V3-013 (14-case smoke, no VAGUE-at-scale/no COMPOSED/RESTAURANT)                                                                                                                                                        | insufficient — no representative corpus                              | Not measured at representative scale                                                                                                           | **not_evaluable** | Smoke run lacking representative categories cannot establish a friction profile                                      |
| G2-D Latency                         | p95 within an independently-accepted multiple of A's non-fast-path p95                                           | V3-013 (C AI-routed p95 = 7,430.044 ms, n=7); V3-007 (no accepted multiple exists)                                                                                                                                      | real/measured for the number; unknown for the threshold              | No accepted threshold exists to compare against                                                                                                | **not_evaluable** | V3-007 explicitly leaves the production p95 budget "not derivable"; inventing one now is forbidden                   |
| G2-E Cost                            | Cost per validated log documented and checked against product economics                                          | V3-013 (measured smoke-experiment cost); V3-007 (no accepted ceiling)                                                                                                                                                   | real/measured for smoke cost; unknown for production ceiling/traffic | USD 0.094958 total smoke-experiment cost is not a per-log or monthly production bound                                                          | **not_evaluable** | No accepted cost ceiling exists; traffic/cache assumptions remain unknown                                            |
| G2-F Provenance / nutrient authority | No AI-generated nutrient value becomes authoritative; missing provenance stays visible                           | V3-006 fixture (0 unbacked); V3-013 live (0 unbacked, 83.3% sourceId coverage disclosed); Learning Benchmark V2 INV-19 (measured, passed)                                                                               | real/measured + architectural fact                                   | Zero unbacked authoritative numeric results across every executed evidence source; incompleteness (83.3%) disclosed, not hidden                | **passed**        | Hard requirement consistently upheld across all available evidence, though only on a non-representative smoke corpus |
| G2-G Consistency                     | Repeat/paraphrase agreement not materially worse than A's structurally-near-100%                                 | No repeat/paraphrase protocol was run for live Hybrid C in V3-013 (single authorized pass only); personal-memory reuse is a different question (deterministic exact-match cache hit, not first-time Hybrid consistency) | unknown for live C; real/measured but off-topic for personal memory  | No live-C repeat-consistency evidence exists                                                                                                   | **not_evaluable** | Per binding rule, personal-memory reuse must not be treated as evidence of first-time Hybrid consistency             |

**G2 verdict: NOT PASSED.** Two `failed`, four `not_evaluable`, one `passed`.

---

## 10. Learning/governance invariant matrix

| Invariant (mapped from Learning Benchmark V2 `INV-xx`) | Historical V3-023 result                                | V3-037 focused remediation                                                                                                                                                    | Current dedicated regression evidence                                                                                                 | Representativeness limitation                                                                                                                | Status                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Personal-memory privacy (INV-01)                       | passed                                                  | n/a                                                                                                                                                                           | `ResolverKnowledgeReview*`/personal-memory suites green                                                                               | Fixture repo, not live production traffic                                                                                                    | passed                                                                                                |
| Exact-repeat (P2) reuse (INV-02)                       | passed                                                  | n/a                                                                                                                                                                           | Real use cases, fixture repo, 2 avoided calls observed                                                                                | No production traffic yet (V3-010 blocked, nothing to avoid in production)                                                                   | passed                                                                                                |
| Near-repeat non-overgeneralization (INV-03)            | passed                                                  | n/a                                                                                                                                                                           | Real use case                                                                                                                         | Fixture repo                                                                                                                                 | passed                                                                                                |
| Invalidation/deletion (INV-04/INV-05)                  | passed                                                  | n/a                                                                                                                                                                           | Real `InvalidatePersonalResolutionMemoryUseCase`, RESOLVER-V3-027 atomicity fix                                                       | Fixture repo                                                                                                                                 | passed                                                                                                |
| Single-user globalization block (INV-06)               | passed                                                  | n/a                                                                                                                                                                           | Real `ResolverKnowledgeReviewService` (`blocked_privacy` on `not_evaluable`)                                                          | Aggregator never produces anything else in production, so this path is architecturally, not just behaviorally, safe                          | passed                                                                                                |
| Contradiction-aware approval (INV-07)                  | **failed** (`APPROVAL_SUCCEEDED_DESPITE_CONTRADICTION`) | **PASSED** (`blocked_contradiction` gate added, 63 dedicated tests green)                                                                                                     | `ResolverKnowledgeReview.test.ts` (63 tests) + `runLearningBenchmarkV2.test.ts` regression                                            | Service remains unwired (zero production callers); RESOLVER-V3-035 keeps `independentUserEvidence` permanently `not_evaluable` in production | passed (post-remediation; historical report unchanged and remains `failed` for its own point in time) |
| Review audit completeness (INV-09)                     | passed                                                  | unaffected                                                                                                                                                                    | Real service, append-only event log                                                                                                   | Not production-wired                                                                                                                         | passed                                                                                                |
| Review atomicity/idempotency (INV-10)                  | passed (historical fixture)                             | **frozen-fixture coupling**: would newly report `failed` if the historical scenario were re-run live against the fixed service, because its approval is now correctly blocked | `ResolverKnowledgeReview.test.ts`'s dedicated atomicity/idempotency tests remain green on legitimate (contradiction-free) transitions | Diagnostic artifact of one frozen scenario combining two concerns, not a regression                                                          | passed (via dedicated current tests; frozen-fixture consequence explicitly disclosed, not hidden)     |
| Legitimate rollback/revocation (INV-11)                | passed (historical fixture)                             | same frozen-fixture coupling as INV-10                                                                                                                                        | `ResolverKnowledgeReview.test.ts` proves rollback/revocation correctness for a legitimately approved, contradiction-free candidate    | Same as INV-10                                                                                                                               | passed (via dedicated current tests; frozen-fixture consequence explicitly disclosed)                 |
| Rejection suppression (INV-12)                         | passed                                                  | n/a                                                                                                                                                                           | Real ledger/aggregator logic                                                                                                          | Fixture/in-memory only                                                                                                                       | passed                                                                                                |
| Duplicate/supersession (INV-13)                        | passed                                                  | n/a                                                                                                                                                                           | Real terminal-chain resolver                                                                                                          | Fixture/in-memory only                                                                                                                       | passed                                                                                                |
| Retraction recomputation (INV-14)                      | passed                                                  | n/a                                                                                                                                                                           | Real replay-summary calculator                                                                                                        | Fixture/in-memory only                                                                                                                       | passed                                                                                                |
| Shadow isolation / no-production-effect (INV-08)       | passed                                                  | n/a                                                                                                                                                                           | Real `ResolverKnowledgeShadowEvaluator`, source-scan test proves no external ports                                                    | Not production-wired (which is itself the intended state)                                                                                    | passed                                                                                                |
| Raw/private-data separation (INV-15/INV-16)            | passed                                                  | n/a                                                                                                                                                                           | Recursive privacy validator, structural absence of raw-text field in projections                                                      | Fixture/in-memory only                                                                                                                       | passed                                                                                                |

**Non-goal note:** per this task's own binding instruction, no new full Learning Benchmark system
verdict is manufactured here. The historical V3-023 system verdict (`NOT_PASSED`, 19/20, INV-07
failed) stands unchanged as the record of what was actually observed at that point in time. This
matrix instead layers V3-037's focused, dedicated, currently-green regression evidence on top of
that historical record — it does not arithmetically recombine them into a new "20/20" or any other
new aggregate benchmark score.

---

## 11. G3 prerequisite matrix

| Prerequisite                                   | Requirement                                  | Status     | Reason                                                                                                               |
| ---------------------------------------------- | -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. G2 passed                                   | Every mandatory G2 dimension passed          | **failed** | Two `failed`, four `not_evaluable` (§9)                                                                              |
| 2. Cost/latency model reviewed                 | RESOLVER-V3-007 exists and was reviewed      | **passed** | V3-007 is `done`; it correctly produced no accepted numeric bound rather than inventing one — reviewed, not resolved |
| 3. Safe personal-memory/cache read path exists | RESOLVER-V3-019 read path exists and is safe | **passed** | Production-wired, fail-open, exact-match, owner-scoped (RESOLVER-V3-019/026/027)                                     |
| 4. Representative gate decision passed         | This task's own decision                     | **failed** | This report's own conclusion is `NOT_PASSED`                                                                         |

**G3 verdict: NOT PASSED.** Per the binding rule, satisfied prerequisites 2 and 3 cannot
compensate for failed prerequisites 1 and 4.

---

## 12. A versus live C findings

On the only corpus ever executed against live Hybrid C (RESOLVER-V3-013's 14-case smoke set):

- Identification: A 75.0% (9/12) vs. live C 58.3% (7/12) — C is worse, not better.
- False confidence: both retain a critical case; C's is the identical case A already has
  (`RV3-0011`), inherited via C's fast-path (which itself is the real Variant A resolver — see
  §17), not independently resolved by C's AI-interpretation layer.
- Provenance: A 100% sourceId coverage vs. C 83.3% — C is worse, though the gap is disclosed
  rather than hidden.
- Latency: C's AI-routed calls carry substantial tail latency (p95 ≈ 7.4 s over 7 samples) with no
  accepted budget to judge it against.
- Cost: C's measured smoke cost (USD 0.026292 for 7 cases) is small in absolute terms but is an
  experiment cost, not a production per-log or monthly bound (§9 G2-E).

No aspect of this comparison supports "C outperforming A" on the metrics that matter for the
product, consistent with the Decision Record §7 requirement that no gate be reduced to a single
metric — here, multiple metrics point the same direction.

---

## 13. Representative-corpus limitation

Neither of the two corpora that have ever executed a resolver in this evidence set is
representative in the sense G2-A requires:

- RESOLVER-V3-013's 14-case smoke corpus (the only one ever run through live Hybrid C) explicitly
  lacks `COMPOSED`, `HOMEMADE`, and `RESTAURANT` coverage — exactly the categories the Decision
  Record and Benchmark Spec identify as central to Hybrid C's intended advantage (H2).
- RESOLVER-V3-023's Learning Benchmark V2 corpus does add `BRANDED`, `COMPOSED`, `HOMEMADE`,
  `RESTAURANT`, `VAGUE`, `PREPARATION`, `NEGATION_MODIFIER`, and `UNRELIABLE` coverage to its
  resolution/decomposition scenarios — but runs every one of them through the real, unmodified,
  zero-AI Variant A resolver, not live Hybrid C (§7 Q16/Q17, independently verified in code).

No corpus combining representative category coverage with live Hybrid C execution currently
exists. This is the single largest concrete evidence gap driving the `NOT_PASSED` verdict, and is
the direct basis for the follow-up tasks in §27.

---

## 14. False-confidence analysis

G2-B is a hard, non-averageable criterion per the Benchmark Spec and this task's own binding
framing: a single known critical false-confidence case cannot be offset by unrelated successes
(privacy, provenance, cost, personal-memory reuse). Live C's only executed evidence retains
exactly the critical case (`RV3-0011`) that A's real baseline already has, via C's own fast path
(itself the real Variant A resolver wrapped by C's harness) — meaning C's AI-interpretation layer
never had an opportunity to independently resolve or worsen this case; it simply inherited A's
existing behavior unchanged. This is recorded honestly as inheritance, not improvement, and G2-B
is therefore `failed`, not `not_evaluable` — there is a clear, adverse, measured result, not an
absence of evidence.

---

## 15. User-friction analysis

No representative-scale clarification/abstention/multiple-candidate evidence exists for live
Hybrid C. The 14-case smoke corpus that was executed live contains too few `VAGUE`/`UNRELIABLE`
cases to establish a friction profile, and Learning Benchmark V2's resolution scenarios — which do
include `VAGUE`/`clarification_required` cases — run through Variant A, not live C. G2-C is
therefore `not_evaluable`, per the explicit instruction that a smoke run lacking representative
categories cannot establish an acceptable production-level friction profile.

---

## 16. Cost analysis

Distinguishing measured benchmark cost from production cost, as required:

- **Measured benchmark cost (real):** USD 0.094958 combined B+C for the entire V3-013 smoke
  experiment (54,728 input + 8,046 output tokens); C alone USD 0.026292.
- **Estimated provider cost (real, derived from measured usage + a pinned, dated price snapshot):**
  the same figures above — these are estimates from returned usage against a committed price
  table, not invoices.
- **Production cost (unknown):** V3-007 explicitly leaves per-log, per-validated-log, and monthly
  production cost bounds "not derivable" without live traffic, and this task does not resolve that
  gap or invent a ceiling.
- **Unknown source/database costs:** unresolved, per V3-007.
- **Hypothetical savings from personal-memory/fast-path effects:** real in the sense that 2
  avoided-call events were measured in Learning Benchmark V2's fixture-driven personal-memory
  sequences, but this says nothing about first-time Hybrid-call cost at production traffic volume,
  since RESOLVER-V3-010 is blocked and no production Hybrid traffic has ever existed to avoid.

G2-E is `not_evaluable`: real numbers exist, but no accepted production ceiling exists to compare
them against, and this task is forbidden from inventing one.

---

## 17. Latency analysis

C's AI-routed calls (n=7) show p50 ≈ 5.15 s / p95 ≈ 7.43 s end-to-end; C's fast-path calls (the
real Variant A resolver, n=7) show p50 ≈ 49 ms / p95 ≈ 301 ms — a large, architecturally expected
gap between the deterministic fast path and the AI-routed path. No accepted p95 budget exists
(V3-007), no cold/warm protocol beyond the single authorized live pass was run, and no retry/
timeout tail data exists for a production traffic pattern. G2-D is `not_evaluable` for the same
reason as G2-E: real numbers, no accepted threshold, and none may be invented now.

---

## 18. Provenance/nutrient-authority analysis

This is the one G2 dimension that passes. Across every executed evidence source — V3-006's fixture
comparison, V3-013's live run, and Learning Benchmark V2's `INV-19` (measured, passed: "No
AI-generated nutrient value becomes authoritative") — zero unbacked authoritative numeric results
were ever observed. Live C's incomplete sourceId coverage (83.3%) is a real, disclosed gap in
provenance _completeness_, but is explicitly reported as missing rather than silently inferred,
which is exactly what the hard requirement demands ("missing provenance remains visible rather
than inferred"). This dimension's `passed` status is limited to the narrow, non-representative
evidence available; it does not by itself compensate for G2-A/G2-B (per the binding rule that no
gate is reducible to a single metric).

---

## 19. Consistency analysis

No repeat/paraphrase protocol was executed for live Hybrid C — V3-013's protocol was intentionally
run exactly once, with no rerun authorized. Personal-memory exact-match reuse (Learning Benchmark
V2 `INV-02`) is real and measured, but per the binding rule this must not be treated as evidence of
first-time Hybrid-resolution consistency — it only proves that a second, byte-identical request
for an already-confirmed food identity can be served deterministically from private memory,
independent of whether Hybrid C's own interpretation step is stable across repeated cold-start
calls. G2-G is `not_evaluable`.

---

## 20. Personal-memory/cache analysis

RESOLVER-V3-019/026/027 constitute a real, production-wired, safe personal-memory read/write/
invalidation path — independently confirmed in code (`PersonalResolutionMemoryAwareFoodCatalogResolver`
wired into `container.ts` outside test env). It is exact-match only, keyed on the already-resolved
`{sourceType, sourceId}` identity rather than raw query text, `P2_confirmed`-only for deterministic
reuse, and fails open on any missing owner/lookup/error. This satisfies G3 prerequisite 3 as an
architectural and now production fact. It does **not** provide production traffic-level
cache-hit-rate evidence (there is no production Hybrid traffic yet to measure a hit rate against),
and it does not provide any evidence about first-time Hybrid-call consistency or quality (§19).

---

## 21. Privacy and deletion analysis

Personal-memory privacy (`INV-01`), invalidation/deletion (`INV-04`/`INV-05`), and raw/private-data
separation (`INV-15`/`INV-16`) all show `passed`, measured, real-production-code evidence via
Learning Benchmark V2's dedicated fixture-driven scenarios, layered on top of the already-shipped
RLS/privacy-boundary enforcement from RESOLVER-V3-015/015A/016. No change to any of this is made or
implied by this report.

---

## 22. Review/governance analysis

The single most significant governance fact from this evidence set: RESOLVER-V3-035 (the
independent-user evidence aggregation policy) remains `blocked`, and the production
`ResolverKnowledgeCandidateAggregator` hard-codes `independentUserEvidence: 'not_evaluable'` with
no other writer anywhere in the codebase. Combined with `ResolverKnowledgeReviewService` having
zero production callers, this means the entire global-candidate/review/promotion pipeline is
currently, architecturally inert in production — not merely unused by policy, but structurally
incapable of promoting any candidate to `approved` today. RESOLVER-V3-037's contradiction gate is
real, tested, and correctly closes the one discovered defect in that otherwise-inert pipeline; it
does not, and could not, create any live global-knowledge effect on its own.

---

## 23. V3-037 remediation treatment

Treated exactly as its own report and ROADMAP entry describe it: a focused, narrow, real code
change (verified directly in `ResolverKnowledgeReviewService.ts`) that closes the specific INV-07
gap RESOLVER-V3-023 discovered, backed by 63 dedicated regression tests, with an explicit
disclaimer that it does not retroactively pass the historical V3-023 report, does not imply a full
benchmark rerun, and creates no production effect. This report relies on V3-037 only for the
narrow claim that the contradiction-approval defect is closed in the current codebase — not for
any broader claim about Hybrid C quality, which V3-037 never touched.

---

## 24. Frozen-fixture coupling treatment

Treated per the explicit binding instruction: this is a disclosed frozen-fixture coupling
limitation (`LBV2-GC-DEV-006` combining contradiction-gate and rollback concerns in one scenario),
not a newly discovered rollback production defect, not a reason to rewrite the frozen corpus, and
not a reason to loosen the contradiction gate. The V3-023 canonical report is not retroactively
edited. Legitimate rollback/revocation for a contradiction-free approval remains proven by the
dedicated `ResolverKnowledgeReview.test.ts` suite, independent of this one coupled fixture (§10,
INV-10/INV-11 rows).

**Empirical confirmation (development-only diagnostic, this task):** running
`node scripts/benchmark-resolver-v3-learning-v2.mjs --partition=development` (a permitted
development-only diagnostic per this task's own verification instructions — classified as a
current-state diagnostic, non-canonical, and explicitly not a replacement for the frozen V3-023
final report) against the current, post-V3-037 codebase reproduces exactly the consequence
RESOLVER-V3-037's remediation report predicted: `INV-07` does **not** appear among the failed
invariants (it now passes), while `INV-10` (`IDEMPOTENT_RETRY_MATCH`) and `INV-11`
(`ROLLBACK_APPLIED`) newly report `failed` for the same frozen `LBV2-GC-DEV-006` fixture.
(`INV-17` also reports `not_evaluable` in this run, but only because the `holdout` partition was
not included in this development-only invocation — an artifact of the diagnostic's partial scope,
not a new finding.) This is independent, live confirmation — not merely a citation of the V3-037
report's own prediction — that the frozen-fixture coupling behaves exactly as disclosed, with no
surprise beyond what was already documented. The gitignored diagnostic output
(`logs/resolver-v3-learning-v2-benchmark.{json,md}`) is not committed, per the instruction not to
regenerate or commit a new canonical benchmark artifact; the frozen
`reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md`/`reports/resolver-v3-learning-v2-benchmark.json`
remain byte-for-byte unchanged.

---

## 25. Effect on RESOLVER-V3-010

**RESOLVER-V3-010's gate dependency on RESOLVER-V3-024 is NOT satisfied.** Per its own ROADMAP
entry, "RESOLVER-V3-024 MUST explicitly pass a representative Learning-/Hybrid-Gate before this
task can proceed; V3-013 alone is NOT PASSED." This report's own conclusion is `NOT_PASSED`, so
that condition is not met. **RESOLVER-V3-010 remains `blocked`**, with its blocked rationale now
additionally grounded in this report's specific G2/G3 matrices rather than only in V3-013's
narrower smoke-corpus finding. No feature-flag work, production resolver wiring, or provider
selection is authorized by this report.

---

## 26. Concrete missing evidence

1. A representative corpus (at minimum: `DACH`, `COMPOSED`, `HOMEMADE`, `RESTAURANT`, `SIMPLE`,
   `HOUSEHOLD`, plus `VAGUE`/clarification/abstention cases) actually executed through live Hybrid
   C, with development/holdout separation preserved.
2. A repeat/paraphrase-consistency protocol for live Hybrid C on that same representative corpus.
3. An accepted (pre-declared, not post-hoc) production p95 latency budget and cost ceiling —
   currently nonexistent per V3-007 — against which a future live run's results can be judged
   without inventing thresholds after seeing them.
4. Independent-user evidence policy (RESOLVER-V3-035) remains a separate, unresolved blocker for
   any future _global_-knowledge effect, though it is not itself required for a Hybrid-quality
   gate decision.

---

## 27. Required follow-up tasks

ROADMAP ID inventory was checked before assigning new IDs: the highest existing `RESOLVER-V3-`
task ID in `ROADMAP.md` is `RESOLVER-V3-037`; `RESOLVER-V3-038`, `-039`, and `-040` do not appear
anywhere in the repository (confirmed by repository-wide search) and are therefore unused and safe
to assign.

- **RESOLVER-V3-038 — Representative Hybrid Benchmark Successor Corpus & Harness.** Depends on:
  RESOLVER-V3-024. Creates a successor benchmark contract/corpus version (preserving the V3-023 v1
  corpus as immutable history), separates contradiction-gate and rollback scenarios (so the
  frozen-fixture coupling in §24 cannot recur), specifies that resolution/decomposition scenarios
  run live Hybrid C rather than Variant A, retains development/holdout separation, and includes
  `DACH`/`COMPOSED`/`HOMEMADE`/`RESTAURANT`/`SIMPLE`/`HOUSEHOLD`/vague/clarification/abstention
  coverage. Design/corpus-authoring only — no live provider calls, no production wiring.
- **RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence.** Depends on:
  RESOLVER-V3-038, RESOLVER-V3-040. Uses the successor corpus, pins provider/model/prompt/schema/
  harness, defines an explicit budget before execution, prevents fixture fallback, preserves
  token/cost/latency/retry/error/provenance data, runs development and holdout under a predeclared
  protocol, avoids case-specific tuning, and remains benchmark-only. **Not authorized or executed
  by this task.**
- **RESOLVER-V3-040 — Cost/Latency Acceptance Policy.** Depends on: none (independent policy
  decision). Defines, before any future live run's results are seen: acceptable p50/p95, timeout/
  retry budget, cost per attempted/validated/complex log, monthly volume scenarios, product-tier
  economics, source/database costs, and cache/fast-path assumptions. This must exist before
  RESOLVER-V3-039's results can be judged against G2-D/G2-E without inventing a threshold post hoc.

None of RESOLVER-V3-038, -039, or -040 was started by this task.

---

## 28. Residual limitations

- The scenario-count narrative discrepancy noted in §8 (41/32 claimed vs. 39/30 counted) is
  unresolved in the frozen V3-023 artifacts and is not corrected by this report.
- RESOLVER-V3-035 (independent-user evidence policy) remains blocked, keeping the entire
  global-candidate/review pipeline architecturally inert in production independent of this report's
  outcome.
- No production traffic-level cache-hit-rate, first-time-Hybrid-consistency, or production cost/
  latency evidence exists or is created by this report.

---

## 29. No-production-effect statement

This task changed no resolver behavior, no review behavior, no benchmark corpus, no registry, no
canonical historical report, no production wiring, no feature flag, no Supabase migration/RPC/
adapter, no package/dependency, and made no provider call of any kind. It is a documentation and
evidence-synthesis task only, confined to this report plus the `ROADMAP.md` and
`handoffs/latest-handoff.md` status/handoff updates required to record its outcome.
