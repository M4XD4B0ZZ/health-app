# Latest Handoff

## RESOLVER-V3-040 — Cost/Latency Acceptance Policy

- **Session context:** continuation of the same unattended, user-authorized in-flight session as the
  RESOLVER-V3-038 entry below. After reconciling with the parallel session's already-merged
  RESOLVER-V3-038 (see that entry's parallel-session note), this session also attempted RESOLVER-V3
  UT-001's `A0` technical baseline pass and found it genuinely blocked (no Supabase credentials
  available in this execution environment — see the UT-001 ROADMAP.md entry's "Attempted A0 run,
  blocked" note; no code was changed by that attempt). It then picked up RESOLVER-V3-040 as the next
  unblocked, non-colliding, credential-free task (`git fetch origin chore/clean-arch-structure`
  confirmed no new commits landed there in the meantime).
- **Produced:** `docs/domains/ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md`. Full detail is
  in the RESOLVER-V3-040 ROADMAP.md entry's "Implementation notes" and the document itself.
- **Method:** grounded entirely in the two existing accepted evidence reports (RESOLVER-V3-007's
  cost/latency formula framework; RESOLVER-V3-013's one real controlled live-provider run), reusing
  RESOLVER-V3-007's own measured/fixture-only/assumed/derived/unknown evidence-labeling convention
  rather than inventing numbers. Every numeric threshold traces to a measured value plus a stated,
  explicit safety margin; every value that would require unmeasured production telemetry (`F`, `C`,
  `N`, `e`, `v`, `k`) or a genuine business decision (product-tier pricing) is left explicitly
  deferred rather than guessed, with the reason stated inline.
- **Verification:** documentation-only change (Category 1 per `VERIFY.md`); `git --no-pager status
--short` / `--diff --stat` confirm the change is limited to `ROADMAP.md`, this handoff entry, and
  the one new policy document.
- **Effect on RESOLVER-V3-039:** its RESOLVER-V3-038/040 dependency is now fully satisfied (both
  `done`); RESOLVER-V3-039 itself remains `todo`, not started, not authorized here — it is
  credential-gated live-provider work requiring separate explicit authorization, which this
  unattended session did not have standing permission to grant itself even under the user's broad
  "keep working" instruction (spending real provider budget is exactly the kind of consequential,
  side-effecting action that instruction did not cover).
- **Branch/PR status:** committed to this session's designated branch,
  `claude/autonomous-tasks-flight-hdewii`; no PR opened (none was requested).

---

## RESOLVER-V3-038 — Representative Hybrid Benchmark Successor Corpus & Harness

**Parallel-session note (this session, `claude/autonomous-tasks-flight-hdewii`):** this task was
picked up unattended, on the user's explicit standing authorization while they were offline
in-flight, and independently implemented as a smaller design/corpus-authoring-only module
(`src/features/nutrition/benchmark/representativeHybrid/`, contract
`resolver-representative-hybrid-benchmark-corpus-1.0.0`, `git` commit `871d734`). Before opening a
PR, `git fetch origin chore/clean-arch-structure` (per `AGENTS.md`'s "Git Branch Sync After Push/
Pull" rule) revealed that a separate, parallel session had already implemented, reviewed, and merged
a materially more complete version of the same task as PR #132 (below): a genuine three-arm A/B/C
harness (reconciled against the accepted G2-B false-confidence criterion, which this session's own
version missed — it only ever specified Hybrid C, not A **and** B), 114 scenarios across all 11
taxonomy categories plus a repeat/paraphrase overlay, a source-snapshot manifest, and a readiness
report. This session's own smaller implementation was discarded (not merged, not PR'd) in favor of
the merged version below, per this repository's documented "no duplicate PRs of the same task"
incident-avoidance rule; this session then merged `origin/chore/clean-arch-structure` (PR #132's
merge commit) into its own branch and moved on to the next available ROADMAP task instead of
resubmitting redundant work.

---

- **Basis and scope:** Branch `claude/resolver-v3-038-representative-hybrid-benchmark-a9csqu`,
  created directly from `origin/chore/clean-arch-structure` at
  `a37312b211232ead4ac1e288bbb42f7fbcda0035` (merge of PR #131, the RESOLVER-V3-024 gate
  re-decision). A real benchmark implementation task: new successor corpus/registry/harness under
  `src/features/nutrition/benchmark/representativeHybridV1/`. `learningV2/**` (RESOLVER-V3-023) is
  unmodified. No production resolver, feature flag, migration, RPC, Supabase adapter, DI
  registration, or package/dependency change was made; no live provider or source-network call
  occurred at any point.
- **Mandatory reading:** all governance files (`SSOK.md`, `AGENTS.md`, `.governance/*`), the food-
  resolution authority set (Decision Record, Benchmark Spec §§2–11, Three-Variant Comparison, Cost/
  Latency/Cache Analysis, V3-013 Live Evidence Report, V3-024 Re-decision Report), the learning/
  governance authority set (Knowledge-Growth Decision Record, Learning Benchmark V2 Spec, V3-023
  report + JSON, V3-037 remediation report, Review/Contribution-Ledger/Shadow-Mode contracts), and
  the complete existing A/B/C and Learning Benchmark V2 implementation (adapters, evaluators,
  retrieval, quantity scaling, budget gate, provider usage, CLIs, corpus/registry/manifest files,
  all `learningV2/**` source files) — delegated to three parallel research passes, each read the
  real source files directly rather than summarizing from memory.
- **Mandatory A/B/C / G2-B decision:** confirmed the accepted Benchmark Spec §11 G2 false-
  confidence dimension requires C strictly better than **both** A and B, and no binding authority
  removes B from scope (RESOLVER-V3-024 §9/§338 restates the identical requirement). Built a
  genuine three-arm A/B/C harness boundary accordingly — the existing ROADMAP wording (which
  mentioned only A/C) was reconciled and updated.
- **Corpus-freeze commit:** `639e940ed22a30d1146ba295b898569ffabec589`. Corpus hash
  `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a`. Source-manifest hash
  `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52`. Harness/evaluators/CLI/tests/
  docs implemented in a separate commit on top of the frozen corpus.
- **Delivered:** 114 total scenarios (86 development / 28 holdout) — 88 resolution base cases (8
  per category across all 11 taxonomy categories, in both partitions), 16 repeat/paraphrase overlay
  cases (~18.2%), 10 governance-fixture scenarios (2 personal-memory, 4 global-candidate, 2
  privacy, 2 economics). Holdout is 25.0% of the resolution base. Contradiction-gate
  (`RH-GC-DEV-CONTRA-001`) and rollback (`RH-GC-DEV-ROLLBACK-001`) scenarios are independent, each
  with its own candidate, closing the RESOLVER-V3-024 §24 `LBV2-GC-DEV-006` coupling finding
  structurally. `RH-RES-DACH-DEV-006` reproduces the real, historically-documented RV3-0011 false-
  confidence defect end-to-end through the new harness. Source-snapshot manifest with 6 committed
  manufacturer-label/official-restaurant-data snapshots. Three-arm harness
  (`RepresentativeHybridV1ThreeArmRunner.ts`) reuses the real, unmodified Variant A/B/C adapters and
  evaluators verbatim. Six-case harness-conformance fixture set, structurally excluded from
  representative-quality metrics. Canonical CLI:
  `scripts/benchmark-resolver-v3-representative-hybrid.mjs` (`--validate`, `--coverage`,
  `--partition`, `--conformance`, `--final-evaluation`; no `--live` flag exists).
- **Documented deviation:** corpus is 88 base cases (spec floor: 8/category), not the 150–200
  target, due to session time constraints on responsibly authoring verified ground truth. Every
  minimum condition the spec allows a deviation under is met except DACH weighting (14.8% vs.
  25–30% target) — disclosed, not claimed as met. Full detail in
  `docs/domains/ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md` §5.2/§17 and the readiness report.
- **Tests/verification:** 87 new tests added, all passing (versioning/preservation, exact-key
  schema validation, registry/freeze/hash-determinism, A/B/C execution boundary + fast-path
  inheritance + provenance, contradiction/rollback separation, isolation/zero-network, holdout-
  leakage prevention, report-schema/fixture-labeling, generated coverage/counts, full-corpus
  smoke). Full existing suite (2158 tests, 219 suites) remains green. Historical regressions run
  clean in fixture mode: `benchmark-resolver-v3-variant-{a,b,c}.mjs`,
  `benchmark-resolver-v3-learning-v2.mjs` (unchanged `NOT_PASSED` verdict, matching the documented
  post-V3-037 state). `npm run verify` (typecheck + lint + format:check + test) passes clean.
- **Produced:** `docs/domains/ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md` (canonical successor
  spec) and
  `reports/RESOLVER_V3_038_REPRESENTATIVE_HYBRID_BENCHMARK_READINESS_REPORT.md` (readiness report
  with exact hashes/counts/matrices).
- **Status:** RESOLVER-V3-038 → `done`. RESOLVER-V3-039 remains `todo`, scope updated to require
  collecting both live B and live C evidence on this successor corpus (G2-B reconciliation) — not
  started. RESOLVER-V3-040 remains `todo`, unaffected. RESOLVER-V3-010 remains `blocked`,
  unaffected. No live provider call, source-network call, production resolver change, feature flag,
  migration, RPC, Supabase adapter, package/dependency change, V3-023 rewrite, or canonical
  historical-report rewrite occurred.

## RESOLVER-V3-024 — Representative Learning/Hybrid Gate Re-decision

- **Basis and scope:** Branch `claude/resolver-v3-024-representative-gate-redecision`, created
  directly from `origin/chore/clean-arch-structure` at
  `34178e87e6222f22510acafa99c19d8cba72913d` (merge of PR #130, the RESOLVER-V3-037 documentation
  follow-up). This is a documentation and evidence-synthesis task only: no resolver behavior,
  review behavior, benchmark corpus, canonical historical report, or production wiring was
  changed.
- **Mandatory reading completed before drafting the decision:** `SSOK.md`, `AGENTS.md`,
  `ROADMAP.md`, `VERIFY.md`, `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Food
  Resolution Decision Record and Benchmark Spec, the V3-006/V3-007/V3-013 reports, the
  Resolution Knowledge-Growth Decision Record, the Learning Benchmark V2 Spec, the V3-023
  canonical report and its JSON companion, the V3-037 remediation report, the review/personal-
  memory-recording/personal-memory-invalidation/personal-memory-read/contribution-ledger/shadow-
  mode contracts, and the complete current ROADMAP entries for RESOLVER-V3-006/007/010/013/019/
  023/024/037.
- **Pre-implementation inventory:** delegated to three parallel research passes (V3-006/007/013
  report facts; V3-023/037/contract facts; code-level executable-evidence verification), each
  cross-checked directly — in particular, independently re-read `container.ts` (`resolverSources`
  is exactly `[userAliasSource, blsSource, offSource, usdaSource]`, no `'ai'`-typed source
  registered), `evaluateLearningBenchmarkV2ResolutionScenario.ts` (confirms real, unmodified
  `SequentialFoodCatalogResolver`/zero-AI execution for all Learning Benchmark V2
  resolution/decomposition scenarios, not live Hybrid C), `ResolverKnowledgeReviewService.ts`
  (confirms the RESOLVER-V3-037 `blocked_contradiction` gate is implemented and runs before the
  independent-user-evidence check), and `ResolverKnowledgeCandidateAggregator.ts`/
  `ResolverKnowledgeCandidate.ts` (confirms `independentUserEvidence` is hard-coded to
  `'not_evaluable'` in production with no other writer, so RESOLVER-V3-035 remaining blocked keeps
  the global-candidate pipeline architecturally inert regardless of this task's outcome). Also
  independently counted `reports/resolver-v3-learning-v2-benchmark.json`'s scenario arrays and the
  five Learning Benchmark V2 corpus source files' `scenarioId:` occurrences (both total 39 — 30
  development, 9 holdout — versus the spec/implementation-notes' narrated "41 (32 dev, 9
  holdout)"); recorded as a disclosed, non-corrected documentation-inventory discrepancy that does
  not affect the gate decision.
- **Produced:** the canonical re-decision report
  [`reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md`](../reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md)
  containing all 29 required sections: the complete 38-question pre-decision inventory, a temporal
  evidence timeline across RESOLVER-V3-006/007/013/023/037, a full G2 gate matrix, a
  learning/governance invariant matrix, a G3 prerequisite matrix, and the explicit overall verdict.
- **Gate verdict:** **`NOT_PASSED`**. G2: two dimensions `failed` (G2-A representative quality —
  live Hybrid C underperformed Variant A, 58.3% vs 75.0% identification, on the only corpus it has
  ever been executed against, which itself lacks COMPOSED/HOMEMADE/RESTAURANT coverage; G2-B false
  confidence — live C retained the identical critical false-confidence case A already has,
  `RV3-0011`, inherited rather than resolved), four `not_evaluable` (G2-C friction, G2-D latency,
  G2-E cost, G2-G consistency — each blocked by missing representative-corpus evidence or the
  explicit absence of an accepted threshold per RESOLVER-V3-007), one `passed` (G2-F provenance/
  nutrient authority — zero unbacked authoritative numeric results across every executed evidence
  source). G3: `NOT_PASSED` as a direct consequence (prerequisites 1 and 4 fail; prerequisites 2
  and 3 are independently satisfied but cannot compensate, per the binding rule).
- **Frozen-fixture coupling (INV-10/INV-11):** treated exactly as RESOLVER-V3-037's own report
  discloses it — a diagnostic artifact of `LBV2-GC-DEV-006` combining contradiction-gate and
  rollback concerns in one scenario, not a newly discovered rollback defect; the frozen V3-023
  corpus/report are unmodified; legitimate rollback/revocation remains independently proven by the
  dedicated `ResolverKnowledgeReview.test.ts` suite.
- **Follow-up tasks added (none started):** RESOLVER-V3-038 (Representative Hybrid Benchmark
  Successor Corpus & Harness), RESOLVER-V3-039 (Controlled Representative Live Hybrid Evidence,
  depends on RESOLVER-V3-038/040 — not authorized or executed here), RESOLVER-V3-040 (Cost/Latency
  Acceptance Policy). Repository-wide search confirmed all three IDs were unused before this
  addition.
- **Effect on RESOLVER-V3-010:** its gate dependency on this task is **not satisfied**;
  **RESOLVER-V3-010 remains `blocked`**. Its ROADMAP entry's blocked rationale was updated to cite
  this report directly.
- **Verification:** documentation-only change (Category 1/2 per `VERIFY.md`). Canonical zero-
  network benchmark regressions
  (`scripts/benchmark-resolver-v3-variant-{a,b,c}.mjs`, fixture/default modes only), the focused
  `ResolverKnowledgeReview.test.ts` suite, and the Learning Benchmark V2 test suites were rerun to
  confirm the historical V3-023 report remains unchanged, the RESOLVER-V3-037 contradiction gate
  remains fixed, and the frozen-fixture coupling remains documented rather than hidden. `git
--no-pager status --short` / `--diff --stat` / `--diff --name-only` / `diff --check` confirm
  changes are limited to the new report, `ROADMAP.md`, and this handoff entry. Exact command
  output is recorded in the RESOLVER-V3-024 ROADMAP.md entry's "Verification" note.
- **No production effect:** no resolver behavior, review behavior, benchmark corpus/registry,
  canonical historical report, feature flag, migration, RPC, Supabase adapter, package/dependency,
  or provider call was changed or made. RESOLVER-V3-038/039/040 were not started.
- **Branch/PR status:** to be recorded after push/PR/merge (this entry is written before that step
  completes; see the ROADMAP.md RESOLVER-V3-024 entry and the final task report for the eventual
  PR number and merge commit once available).

---

## RESOLVER-V3-037 — Contradiction-Aware Review Approval Gate

- **Basis and scope:** Branch `claude/resolver-v3-037-contradiction-gate-sxo59r`, created directly
  from `origin/chore/clean-arch-structure` at `d85d6f6c6f88b6f5a779ae5d1544e0bdfca4f0e6` (merge of
  PR #128, the RESOLVER-V3-023 post-merge documentation follow-up). Read `SSOK.md`, `AGENTS.md`,
  `ROADMAP.md`, `VERIFY.md`, `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the review
  contract doc, the RESOLVER-V3-023 report/JSON evidence and its ROADMAP entry, and the complete
  current implementation of `ResolverKnowledgeReview.ts`, `ResolverKnowledgeCandidate.ts`,
  `ResolverKnowledgeReviewService.ts`, `ResolverKnowledgeCandidateValidator.ts`,
  `ResolverKnowledgeReviewPorts.ts`, `InMemoryResolverKnowledgeReviewRepository.ts`, and
  `ResolverKnowledgeReview.test.ts` before writing anything.
- **Pre-implementation inventory confirmed directly from source:** the `approve` branch checked only
  `independentUserEvidence`/`localeRestriction`, never `contradictionStatus`/
  `contradictingEvidenceCount`; the service does not call
  `ResolverKnowledgeCandidateValidator.validateResolverKnowledgeCandidate` (which throws rather than
  returning a closed result, so unsuitable to reuse directly); the review-event `result` column
  (`supabase/migrations/20260721120000_create_resolver_knowledge_reviews.sql`) is `text not null`
  with no enumerated check constraint, so no migration is required to add a result value; a blocked
  pre-persistence result already returns before `applyDecision` for every existing block
  (`blocked_unauthorized`/`blocked_privacy`/`invalid_transition`/`validation_failed`), so the same
  pattern extends cleanly to the new gate; zero production callers of
  `ResolverKnowledgeReviewService` exist anywhere in `src/` (confirmed by grep).
- **Implemented:** added `blocked_contradiction` to `ResolverKnowledgeReviewResult`
  (`src/features/nutrition/domain/models/ResolverKnowledgeReview.ts`); added a runtime-validated
  contradiction gate to the `approve` branch of `ResolverKnowledgeReviewService.review()`
  (`src/features/nutrition/application/knowledge/ResolverKnowledgeReviewService.ts`), running before
  the independent-user-evidence check. See the RESOLVER-V3-037 ROADMAP.md entry's "Implementation
  notes" for the exact gate table, ordering rationale, and zero-mutation proof, and
  `docs/domains/ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md` §"Amendment (RESOLVER-V3-037)" for the
  full contract amendment.
- **Tests:** 29 new tests added to `ResolverKnowledgeReview.test.ts` (63 total in that file, all
  green) covering exact defect reproduction, gate ordering, zero-threshold behavior, all seven
  runtime-coherence cases (valid/blocked/invalid, including adversarial runtime casts), all five
  candidate types, non-approve-action preservation, and idempotency. Two RESOLVER-V3-023 benchmark
  tests that encoded the discovered defect as current behavior were updated to assert the real,
  fixed service's behavior instead (`LearningBenchmarkV2GlobalCandidateAdapter.test.ts`); one new
  test was added to `runLearningBenchmarkV2.test.ts` documenting that INV-07 now passes while
  INV-10/INV-11 newly fail against the same frozen fixture (a disclosed historical-fixture
  consequence, not a rollback-logic regression — see the remediation report and ROADMAP entry for
  full detail). One narrow pre-existing reporting bug this consequence exposed was fixed in
  `buildLearningBenchmarkV2Reports.ts` (its "Discovered defects" narrative no longer falsely claims
  zero failures when a non-INV-07 invariant fails).
- **Did not touch:** the frozen Learning Benchmark V2 corpus/registry/hash, the canonical
  `reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md`/`reports/resolver-v3-learning-v2-benchmark.json`
  (both remain historical evidence of the pre-fix state, unmodified), any migration, any Supabase
  adapter, `src/infrastructure/di/container.ts`, package/lockfile, environment file, or any
  journal/UI file. RESOLVER-V3-024, RESOLVER-V3-033..036, and RESOLVER-V3-010 were not started.
- **Verification:** `npm run verify` (typecheck + lint + format:check + test) — green, 0 type
  errors, 0 lint errors, 0 format violations. Focused suites also run directly and green: the full
  `ResolverKnowledgeReview.test.ts` (63 tests) and all 12 Learning Benchmark V2 suites under
  `src/features/nutrition/benchmark/learningV2/` (89 tests).
- **Final status:** RESOLVER-V3-037 `done`. Focused `INV-07` remediation verdict: `PASSED` (see
  `reports/RESOLVER_V3_037_CONTRADICTION_APPROVAL_GATE_REMEDIATION_REPORT.md`) — this does not mean
  the original V3-023 report is retroactively `PASSED`, that the full benchmark was rerun, or that
  any production resolver effect now exists. RESOLVER-V3-024's dependency list is updated to add
  RESOLVER-V3-037; RESOLVER-V3-024 itself remains `todo` and was not started. RESOLVER-V3-010
  remains `blocked`.
- **Branch/PR status:** implemented directly on the harness-designated branch
  `claude/resolver-v3-037-contradiction-gate-sxo59r` (this task's branch coincided with a
  pre-existing empty branch of the same name, already in sync with
  `origin/chore/clean-arch-structure` at the time this task began — no rebase, reset, or history
  repair was performed). Merged as **PR #129**, merge commit
  `27db42338af7f6f2bfe68026e581ee63149eb006`. CI (`verify`) was green with no review comments.
  **Independent post-merge review** confirmed the merge commit's tree is byte-identical to the
  pre-merge branch tip (zero-line diff) and that exactly the 10 expected files changed against the
  pre-PR base, with zero forbidden-path changes (migrations, Supabase functions, package/lockfile,
  environment, DI/container, UI/journal, or Learning Benchmark V2 corpus/registry/canonical-report
  files) — see the RESOLVER-V3-037 ROADMAP.md entry's "Branch/PR status" note for full detail. No
  defects found; no follow-up code fix required. This documentation-only follow-up restarts the same
  branch name from the new merged tip via a fast-forward reset. Remote deletion of the merged branch
  was not attempted (per `AGENTS.md`'s documented git-proxy HTTP 403 incident); left for an
  authorized cleanup channel.

---

## RESOLVER-V3-023 — Learning Benchmark V2

- **Basis and scope:** Branch `claude/resolver-v3-023-learning-benchmark-v2-f11n1l`, based on
  `origin/chore/clean-arch-structure` at `69f0a91f58853866a37419decf7d62c56a977ee3` (merge of PR
  #126). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`,
  `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Knowledge-Growth Decision Record, the
  Food Resolution Decision Record/Benchmark Spec, the Personal-Memory contracts, the
  Contribution-Ledger/Candidate/Review/Shadow-Mode contracts, the accepted operational-boundary
  design, the three-variant comparison and cost/latency reports, and the ROADMAP entries for
  RESOLVER-V3-001..036 before writing anything. This is an evidence-generation task: a `NOT_PASSED`
  system verdict is a legitimate, complete outcome and is exactly what this run produced.
- **Pre-implementation inventory:** delegated to three parallel research passes (existing
  benchmark-harness conventions; personal-memory production code; global-candidate/ledger/review/
  shadow production code), each independently cross-checked by direct file reads. Key finding used
  directly: no production in-memory adapter exists for the personal-memory write/read ports (only
  Supabase adapters and inline test fakes); the RESOLVER-V3-031/032 in-memory reference
  implementations have zero production callers today (confirmed by grep and by the two existing
  isolation tests' own source); and — read directly from `ResolverKnowledgeReviewService.ts` — the
  real `approve` branch never inspects `contradictionStatus`/`contradictingEvidenceCount`, only
  `independentUserEvidence` and `localeRestriction`.
- **Implemented:** the closed Learning Benchmark V2 corpus contract
  (`resolver-learning-benchmark-v2-corpus-1.0.0`), an immutable dev/holdout registry mirroring the
  RESOLVER-V3-029 shadow-corpus-registry pattern, and a canonical harness/CLI under
  `src/features/nutrition/benchmark/learningV2/` (18 source files, 12 test files) plus
  `scripts/benchmark-resolver-v3-learning-v2.mjs`. 41 scenarios (32 development, 9 holdout, ~22%)
  across all five required scenario classes. See `docs/domains/ZERA_RESOLVER_LEARNING_BENCHMARK_V2_SPEC_1.md`
  and the RESOLVER-V3-023 ROADMAP.md entry's "Implementation notes" for full detail.
- **Reuses real production logic throughout** (never reimplemented): the real, unmodified
  `SequentialFoodCatalogResolver` for resolution/decomposition; the real
  `RecordPersonalResolutionMemoryUseCase`/`ReadPersonalResolutionMemoryUseCase`/
  `InvalidatePersonalResolutionMemoryUseCase` (the last over its real in-memory repository) for
  personal-memory sequences; the real RESOLVER-V3-031/032 contribution-recording planner,
  terminal-chain resolver, replay-summary calculator, `ResolverKnowledgeReviewService`, and
  `ResolverKnowledgeShadowEvaluator` for global-candidate/review/shadow sequences, all behind one
  dedicated adapter file (`LearningBenchmarkV2GlobalCandidateAdapter.ts`) added as the sole
  authorized consumer to the two existing isolation tests' allowlists
  (`ResolverKnowledgeAggregationV2Isolation.test.ts`, `ResolverKnowledgeContributionLedgerIsolation.test.ts`),
  mirroring the existing RESOLVER-V3-032 precedent exactly.
- **Discovered a real defect, did not fix it:** a fixture-only candidate with
  `independentUserEvidence` forced to `independently_confirmed` and nonzero contradiction evidence
  was approved by the real review service (`INV-07: failed`). This does not imply any production
  candidate can currently reach this state. Recorded honestly in the canonical report; a narrowly
  scoped remediation task, **RESOLVER-V3-037: Contradiction-Aware Review Approval Gate**, was added
  (`todo`) rather than fixing production review-policy code inside this task.
- **Corpus freeze:** committed corpus/registry/validator/corpus-fixture files in a dedicated commit
  before implementing the harness/evaluators; holdout scenario inputs/expected outcomes were not
  modified after that commit.
- **Verification:** `npm run verify` — 209 suites / 2041 tests, 0 type errors, 0 lint errors, 0
  format violations (baseline before this task: 197 suites / 1953 tests, per RESOLVER-V3-032's own
  verified count). Historical Variant A/B/C fixture-mode regressions rerun clean and byte-identical
  to their previously recorded results (Variant A: 14 cases, 75% identification accuracy, 1 critical
  false-confidence failure). Final holdout evaluation run once via
  `node scripts/benchmark-resolver-v3-learning-v2.mjs --partition=all --final-evaluation`.
  `git diff --name-only` against `origin/chore/clean-arch-structure` touches only new
  `learningV2/**` files, the new CLI script, the two isolation tests' allowlist additions, one new
  domain spec doc, two new canonical report artifacts, and this `ROADMAP.md`/handoff entry — zero
  changes to `supabase/migrations/**`, `supabase/functions/**`, `package.json`,
  `package-lock.json`, any environment file, `src/infrastructure/di/container.ts`, or any
  journal/UI file.
- **Final status:** RESOLVER-V3-023 `done` (task completion); system verdict `NOT_PASSED` (19/20
  invariants passed, `INV-07` failed as described above) — these are explicitly distinct per this
  task's own binding interpretation. RESOLVER-V3-024 is now eligible for separate authorization
  (not begun). RESOLVER-V3-010 remains blocked, unaffected. RESOLVER-V3-037 added as `todo`.
- **Branch/PR status:** merged as **PR #127**, merge commit `10bcc4d69fc811dd599837410f3de20f6377ffc8`.
  CI (`verify`) green. Independent post-merge review confirmed the merge commit's tree is
  byte-identical to the pre-merge branch tip (44 files changed against the pre-PR base, zero
  forbidden-path changes), and `npm run verify` was independently rerun against the actual merged
  tree (209 suites / 2041 tests, all green) rather than only the pre-merge branch. No defects found;
  no follow-up code fix required. Remote deletion of the merged
  `claude/resolver-v3-023-learning-benchmark-v2-f11n1l` branch was not attempted (per `AGENTS.md`'s
  documented git-proxy HTTP 403 incident for merged branches); left for an authorized cleanup
  channel.

---

## RESOLVER-V3-032 — Private Contribution Ledger, Rejection Suppression, Duplicate/Supersession, and Deletion/Retraction Recomputation

- **Basis and scope:** Branch `claude/resolver-v3-032-contribution-ledger-nvdqus` was already present
  locally and on `origin`, sitting exactly at `origin/chore/clean-arch-structure`'s tip
  (`133584933154cf72c79aed6fd11ceab20a0e99bf`, merge of PR #124), clean working tree. Read `SSOK.md`,
  `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the
  Knowledge-Growth Decision Record, the Candidate/Review contracts, the Shadow Mode contract, the
  accepted operational-boundary design (especially §6, §8-§16), and the ROADMAP entries for
  RESOLVER-V3-020/023/028/030/031/032/033/035 before writing anything. Only RESOLVER-V3-032's own
  scope (in-memory, deterministic ledger/rejection-suppression/duplicate-supersession/retraction
  logic) was implemented; RESOLVER-V3-033 through -036, RESOLVER-V3-023/024/010, and any production
  wiring were not started.
- **Pre-implementation inventory (verified by direct code reading, delegated to a research pass and
  independently spot-checked):** confirmed `InMemoryResolverKnowledgeCandidateRepository.upsertInactive`
  additively sums evidence counters on fingerprint match with no idempotency key (a retry can double-
  count); confirmed no per-contribution immutable record exists anywhere in the codebase; confirmed
  `duplicateOfCandidateId`/`supersededByCandidateId` are set by the review service but never read/
  chain-walked anywhere; confirmed `ResolverKnowledgeCandidateValidator` fails closed on `status:
'approved'` (only the review service's `applyDecision` may legally set it); confirmed zero
  `contributorToken`/independent-user-count code exists anywhere; confirmed no Supabase migration,
  RPC, or batch worker touches this domain beyond the three existing V3-020/021/028 migrations.
- **Implemented (13 new source files, 6 new test files, zero existing production files touched
  besides one isolation test's authorized-consumer allowlist — see below):**
  - Domain: `ResolverKnowledgeContributionLedger.ts` (contribution/retraction-event/retraction-
    request types, closed reason/selector-kind sets), `ResolverKnowledgeContributionReplaySummary.ts`,
    `ResolverKnowledgeCandidateTerminalChain.ts`.
  - Application: `ResolverKnowledgeContributionIdCalculator.ts` (deterministic private contribution/
    retraction-event IDs), `ResolverKnowledgeContributionLedgerValidator.ts` (closed runtime
    validation), `ResolverKnowledgeContributionLedgerEquality.ts` (idempotency-comparison helper),
    `ResolverKnowledgeCandidateFingerprintV2IdentityMapper.ts` (deterministic `rkc-v2:` candidate ID
    from the versioned V2 fingerprint — new RESOLVER-V3-032 logic, kept out of the untouched
    RESOLVER-V3-031 fingerprint files), `ResolverKnowledgeCandidateTerminalChainResolver.ts` (pure
    duplicate/supersession chain walk with 9 closed failure codes), `ResolverKnowledgeContribution
ReplaySummaryCalculator.ts` (pure summary derivation + legacy-evidence mapping),
    `ResolverKnowledgeContributionRecordingPlanner.ts` / `...RetractionPlanner.ts` (pure planning
    functions returning closed plan objects, consumed by the repository).
  - Ports/infrastructure: `ResolverKnowledgeContributionLedgerRepository.ts` (port),
    `InMemoryResolverKnowledgeContributionLedgerRepository.ts` (reference adapter — staged/snapshot-
    restore atomicity for both `recordContribution` and `retractContributions`, sharing candidate
    state with the existing candidate/review repositories through the same typed shared-store
    boundary pattern, never a divergent copy).
  - One pre-existing test file, `ResolverKnowledgeAggregationV2Isolation.test.ts`, was updated to add
    6 new RESOLVER-V3-032 files to its "authorized consumer" allowlist — its strict "no file
    anywhere references a V2 symbol" check predates this task and would otherwise contradict the
    explicit binding requirement to consume the V3-031 classifier/fingerprint calculator as a
    dependency rather than reimplementing it. The DI-container and Supabase/resolver-execution/
    provider-import checks in that file were left unchanged.
- **Append-only/retraction resolution:** contributions are fully immutable (no status field);
  retraction is a separate, immutable, append-only event keyed by contribution ID; effective state
  is derived, never mutated; no reactivation operation exists. Full rationale in the new contract
  doc §4.
- **Contribution identity:** `sha256Hex(canonicalJson([idFormatVersion, ledgerContractVersion,
observationId, resolverRunId, fingerprintVersion, digest]))` — keyed by the **original** matched
  candidate's fingerprint, never a mutable terminal-target identity, so chain changes never
  manufacture a second contribution and routing can change during replay without mutating identity.
- **Rejection suppression / duplicate-supersession / retraction:** implemented exactly per the
  contract doc's §12-§17; the pure terminal-chain resolver never mutates candidates and never
  guesses on cycles/missing targets/link-status corruption; replay always recomputes relation
  against the _current_ terminal payload rather than trusting a contribution's stored relation.
- **Tests:** 103 new tests across 6 new suites (contract/privacy validator, contribution-ID
  determinism, terminal-chain resolver, replay-summary calculator, the large in-memory-repository
  integration suite covering recording/idempotency/rejection-suppression/relation-handling/
  duplicate-supersession-routing/retraction/correction/failure-injected-atomicity, and a static
  isolation/regression suite).
- **Verification:** focused new suites run first (all green), then full `npm run verify` (typecheck +
  lint + format:check + test) — **green: 197 suites / 1953 tests**, 0 type/lint/format errors.
  `npm install --ignore-scripts` was required first to restore missing `node_modules` (same
  environment-level Supabase-CLI-postinstall network block already documented in the RESOLVER-V3-031
  handoff entry below — unrelated to this task).
- **Git readbacks:** `git --no-pager status --short` / `--diff --stat` / `--diff --name-only` /
  `diff --check` confirm only the new source/test files, the one isolation-test allowlist update, the
  new contract doc, and `ROADMAP.md`/this handoff/the operational-boundary doc changed — zero changes
  to `supabase/migrations/**`, `supabase/functions/**`, `package.json`, `package-lock.json`, any
  environment file, `src/infrastructure/di/container.ts`, or any journal/UI file.
- **Non-effect confirmation:** no persistence, RPC, batch worker, migration, AI/provider call, or
  production resolver-effect was introduced; `independentUserEvidence` remains `not_evaluable`
  everywhere; RESOLVER-V3-033 through RESOLVER-V3-036, RESOLVER-V3-023, RESOLVER-V3-024, and
  RESOLVER-V3-010 were not started.
- **Branch/PR status:** implemented on `claude/resolver-v3-032-contribution-ledger-nvdqus` (based on
  `origin/chore/clean-arch-structure` at `133584933154cf72c79aed6fd11ceab20a0e99bf`); merged as **PR
  #125**, merge commit `7c108f05f3fe0b011cfe1963861030e2e723349a`. CI failed once on the first push
  (a `prettier -c .` violation on two hand-written markdown files not run through `prettier -w`),
  fixed in a same-PR follow-up commit, then green with no review comments. Independent post-merge
  review of the actual merged diff found no defects (full detail in `ROADMAP.md`'s RESOLVER-V3-032
  entry). **RESOLVER-V3-023 changed from `blocked` to `todo`** — both explicit blockers
  (RESOLVER-V3-031, RESOLVER-V3-032) are now satisfied; it is eligible for separate authorization,
  not completed or begun. RESOLVER-V3-010 remains `blocked`.

## RESOLVER-V3-031 — Aggregation Projection V2, Fingerprint Versioning, and Closed Support/Contradiction Classification

- **Basis and scope:** The harness-designated branch
  `claude/resolver-v3-031-projection-fingerprint-da2zyh` was already present locally and on `origin`, sitting
  exactly at `origin/chore/clean-arch-structure`'s tip (`af842de3f7e4e37e4615d4d27a8900f978305e67`, merge of
  PR #122), clean working tree, no divergence. Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`,
  `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Knowledge-Growth Decision Record, the Candidate/
  Review contracts, the accepted operational-boundary design
  (`docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`, especially §6/§7/
  §9/§10), the post-implementation review, and the ROADMAP entries for RESOLVER-V3-020/023/030/031/032
  before writing anything. Only RESOLVER-V3-031's own scope (pure V2 projection/fingerprint/classifier logic)
  was implemented; RESOLVER-V3-032 through -036, RESOLVER-V3-023/024/010, and any production wiring were not
  started.
- **Pre-implementation inventory (verified by direct code reading):** confirmed
  `ResolverObservationPrivacyEnforcer.project()` is the sole V1 producer with no production caller; confirmed
  V1's projection has no independent `projectionVersion` field and still types `selectedSource` as
  `{type, id}` even though the aggregator only ever reads `.type`; confirmed V1's `fingerprintFor` is 32-bit
  FNV-1a over `JSON.stringify(payload)` with no privacy property, and V1's own runtime validators
  (`ResolverObservationValidator`, the V1 enforcer) do not runtime-check `locale`/`provenanceStatus`/latency
  values against their closed sets (only structural key checks and `outcome`); confirmed the closed
  candidate-type/source-type/reason-code allowlists; confirmed `expo-crypto` is the only crypto dependency
  already present (`digestStringAsync`, async, client-side/Expo-native) and no Node-crypto import exists in
  any app-reachable source outside `test-setup.ts`'s Jest-only mock; confirmed no production caller invokes
  aggregation anywhere in `src/`.
- **Implemented (new files only, zero existing files touched besides `ROADMAP.md`/docs):** an explicit
  `ResolverObservationAggregationProjectionV2` contract and a dedicated producer that structurally cannot
  carry a source ID; a recursive closed-allowlist runtime validator for it; a versioned canonical-input
  builder plus a real SHA-256 `resolver-knowledge-fingerprint-v2` digest (via an injected hasher port and a
  concrete, currently-unwired `node:crypto` adapter — deliberately not `expo-crypto`, since the fingerprint's
  real execution boundary is the future server-only aggregation worker, never the Expo app); a dedicated
  fingerprint/payload validator (not the full candidate validator, to avoid coupling to lifecycle/evidence);
  and a pure, closed `support`/`contradiction`/`orthogonal`/`not_evaluable` relation classifier implementing
  the design's §10 matrix exactly, with no invented rule. Full details, exact field lists, blocked-result
  codes, the canonical-serialization format, the golden SHA-256 vector, and the complete relation matrix are
  recorded in `ROADMAP.md`'s RESOLVER-V3-031 entry (not duplicated here).
- **V1 preservation:** verified byte-for-byte — no existing source file was modified; the full pre-existing
  observation-privacy/candidate/review test suites remain green unmodified; a new test asserts the V1
  fingerprint for a fixture payload equals a hard-coded literal computed once, independently.
- **Tests:** 144 new tests across 5 new suites (V2 producer, V2 validator, fingerprint/canonical
  serialization + golden vector, relation-matrix classifier, and a static isolation/regression suite that
  greps for Supabase/resolver-execution/provider imports and confirms no V2 symbol is referenced by the DI
  container or by any file outside its own source/tests).
- **Verification:** focused new suites plus the full pre-existing Resolver observation/candidate/review
  suites run first (207 tests, zero regressions), then `npm run verify` (typecheck + lint + format:check +
  test) — **green: 191 suites / 1850 tests**, 0 type/lint/format errors. `npm install --ignore-scripts` was
  required first to restore missing `node_modules` (the `supabase` package's own postinstall CLI-binary
  download is blocked by this environment's proxy — unrelated to this task, and `verify`/`test`/`typecheck`/
  `lint` do not depend on that CLI).
- **Git readbacks:** `git --no-pager status --short` / `--diff --stat` / `--diff --name-only` / `diff --check`
  all confirm only the 10 new source/test files plus `ROADMAP.md` and the two docs above changed — zero
  changes to `supabase/migrations/**`, `supabase/functions/**`, `package.json`, `package-lock.json`, any
  environment file, `src/infrastructure/di/container.ts`, or any journal/UI file.
- **Non-effect confirmation:** no persistence, contribution ledger, batch worker, migration, RPC, AI/provider
  call, or production resolver-effect was introduced; `independentUserEvidence` remains `not_evaluable` in
  the unchanged V1 aggregator; RESOLVER-V3-032 through RESOLVER-V3-036, RESOLVER-V3-023, RESOLVER-V3-024, and
  RESOLVER-V3-010 were not started. RESOLVER-V3-023 remains `blocked` (still needs RESOLVER-V3-032).
- **Branch/PR status:** implemented on `claude/resolver-v3-031-projection-fingerprint-da2zyh` (based on
  `origin/chore/clean-arch-structure` at `af842de3...`); merged as **PR #123**, merge commit
  `330deb37473b1030e0feb5718a9c7f0a6c0ef4a7`. CI (`verify`) green on the first run, no review comments.
  Independent post-merge review of the actual merged diff found no defects — see `ROADMAP.md`'s
  RESOLVER-V3-031 entry for the detailed post-merge review notes. This documentation-only follow-up (recording
  the merged/reviewed state, per the RESOLVER-V3-030/031 precedent) restarts the same harness-designated
  branch name from the new `origin/chore/clean-arch-structure` tip (`330deb3`). Pre-existing local branches
  were left untouched. Remote branch deletion for the merged
  `claude/resolver-v3-031-projection-fingerprint-da2zyh` ref was not attempted in this session — per
  `AGENTS.md`'s documented incident, this environment's git proxy has previously rejected
  `git push origin --delete` with HTTP 403 for merged branches, and no workaround was to be attempted; it is
  left for an authorized cleanup channel.

## RESOLVER-V3-030 — Candidate Aggregation Operational Boundary

- **Basis and scope:** The harness-designated branch `claude/resolver-v3-030-operational-boundary-hs0dve`
  was already present locally and on `origin`, sitting exactly at `origin/chore/clean-arch-structure`'s tip
  (`7c886d7e55c71d30e047758657b3963ba5c0b14f`, merge of PR #120), clean working tree, no divergence, no
  existing PR for this branch. Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`,
  `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Knowledge-Growth Decision Record, the Candidate/
  Review/Shadow-Mode contracts, and
  `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md` before writing anything. Only
  RESOLVER-V3-030's own scope (documentation/architecture/governance) was changed; RESOLVER-V3-023/024/010
  and every candidate-aggregation implementation follow-up were not started.
- **Pre-design inventory (verified by direct code reading, not assumed):** confirmed
  `ResolverObservationPrivacyEnforcer.project()` is the sole producer of
  `ResolverObservationAggregationProjectionV1` and has no production caller (grep across `src/` found only
  test imports and each other); confirmed the current projection still carries
  `selectedSource: {type, id}` — the source ID is present in the projection object even though
  `ResolverKnowledgeCandidateAggregator.payloadFor()` only ever reads `.type`; confirmed the aggregator
  hard-codes `supportingEvidenceCount: 1`/`contradictingEvidenceCount: 0`/`independentUserEvidence:
'not_evaluable'` for every candidate and never derives contradictions itself; confirmed
  `InMemoryResolverKnowledgeCandidateRepository.upsertInactive()` additively merges evidence counters with
  no idempotency key (a literal retry double-counts) and keeps no per-contribution ledger, so summaries
  cannot be reconstructed from anything but themselves; confirmed `duplicateOfCandidateId`/
  `supersededByCandidateId` exist on the schema/type but are never populated by any code path; confirmed no
  production Supabase candidate-repository adapter, no aggregation batch job, no scheduling/cursor/retry/
  quarantine mechanism, and no RPC/stored-function precedent exist anywhere in this codebase (grep across
  `supabase/migrations` and `src` for `create function`/`.rpc(`); confirmed the five
  candidate/review/candidate-event/approved-knowledge/review-event tables all enable RLS and revoke every
  `anon`/`authenticated` grant, with no view or trigger; confirmed no live Supabase migration is claimed
  applied by this task (this session did not query a live project).
- **Design produced:** a new, distinct canonical document,
  [`docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`](../docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md)
  (it does not rewrite or amend the RESOLVER-V3-020 Candidate Contract). Summary: a 22-point verified
  present-state inventory; a private-aggregation-zone vs. global-candidate-zone trust boundary and
  data-flow sequence; a versioned V2 aggregation-projection contract decision (V1 is not reinterpreted;
  unknown/mixed versions fail closed, mirroring the RESOLVER-V3-029 shadow-projection fail-closed pattern);
  a private, append-only contribution-ledger model from which global evidence summaries must always be
  re-derivable (never a mutable additive counter); a closed support/contradiction/orthogonal/not_evaluable
  relation matrix per candidate-type pairing, with unenumerated pairs defaulting to `not_evaluable`, never
  guessed; a fingerprint-versioning decision (V1 FNV-1a stays exactly as merged, confirmed deduplication-only
  and unchanged; a versioned SHA-256-class V2 digest is decided — not implemented — as the operational
  successor, because an operational fingerprint is also an idempotency/durable-identity key where collisions
  have a real correctness cost); an independent-user pseudonymous-contributor-token design that remains
  fail-closed to `not_evaluable` until a separately accepted sufficiency policy exists (RESOLVER-V3-035);
  rejection-suppression rules (a candidate's fingerprint is its durable identity; matching post-rejection
  contributions attach to the retained candidate, never spawn a new ID; reconsideration requires an
  explicit developer/review action or a genuinely different, differently-fingerprinted payload); duplicate/
  supersession terminal-chain resolution with explicit self-reference/cycle/missing-target prohibitions;
  a deletion/retraction table covering every named trigger (owner deletion, observation invalidation,
  unsafe-contract revocation, source-update invalidation, correction-as-new-contradictory-evidence,
  privacy-policy revocation); an atomic single-Postgres-RPC boundary decision — explicitly the first RPC/
  stored-function precedent this codebase would ever have, chosen only after confirming no existing
  transaction precedent exists (every prior "atomic" write in this repo is either a single-table insert with
  a `23505`-duplicate catch, or an in-memory snapshot/restore simulation) — not implemented here; a full
  batch-execution model (server-only run lease, deterministic cursor, quarantine/poison-row handling,
  dry-run, crash recovery, a scheduling-substrate comparison against this repo's only two existing
  server-side-process precedents, both found unsuitable as-is); privacy-safe operational metrics and cost-
  bound categories with no numeric value invented; a benchmark-interface section that critically assesses
  and concludes this design **alone does not** unblock RESOLVER-V3-023 (the benchmark's required
  classification/duplicate/supersession logic does not exist as callable code yet); and a conflict-analysis
  section explicitly reconciling `.governance/SAFETY.md`'s absolute "no git push" language with
  `AGENTS.md`'s Ralph-Loop-scoped Dual Governance rule (this is a product task, not a `RALPH-XXX` task, so
  the push/PR/merge workflow precedent set by RESOLVER-V3-025 through -029 applies) — reported explicitly,
  not treated as blocking.
- **Follow-up decomposition:** six new tasks added to `ROADMAP.md`
  (RESOLVER-V3-031 through RESOLVER-V3-036 — projection V2/fingerprint/classification logic; private
  contribution ledger and rejection/duplicate/deletion logic; server-side atomic persistence adapter;
  supervised batch worker; independent-user evidence policy decision; operational smoke verification), each
  with a stable ID, status, dependencies, goal, exact scope, non-goals, risks, tests/verification, and
  acceptance criteria. None is started. `RESOLVER-V3-023`'s dependency list gained explicit new entries for
  RESOLVER-V3-031 and RESOLVER-V3-032 (the benchmark needs their classification/lifecycle logic to exist as
  real code, not just a design), while RESOLVER-V3-033/034/035 were deliberately **not** added as benchmark
  blockers (live infrastructure and an independent-user threshold are outside the benchmark's fixture/
  dev-holdout scope).
- **Verification:** documentation-only change (Category 1/2 per `VERIFY.md`) —
  `git --no-pager status --short`, `git --no-pager diff --stat`, `git --no-pager diff --name-only`, and
  `git diff --check` all run and recorded in `ROADMAP.md`'s RESOLVER-V3-030 entry. `npm run verify` was not
  required by `VERIFY.md` for this documentation-only change and was not run; repository searches confirmed
  no `src/`, test, migration, `package.json`/`package-lock.json`, or environment file changed, no task was
  silently marked unblocked beyond the explicit RESOLVER-V3-030 `done` status itself, and no implementation
  task was started.
- **Non-effect:** no product code, migration, live database, production resolver behavior, package,
  dependency, or environment state changed. RESOLVER-V3-023, RESOLVER-V3-024, RESOLVER-V3-010, and every
  candidate-aggregation implementation follow-up were not started.
- **Branch/PR status:** implemented on `claude/resolver-v3-030-operational-boundary-hs0dve` (the
  harness-designated branch, based on `origin/chore/clean-arch-structure` at `7c886d7e...`); merged as
  **PR #121**, merge commit `5ca0d6c35dfff617523db28fecab58da668d0ddc`. The first CI run (`b1ee2b1`) failed
  `npm run verify`'s `format:check` (`prettier -c .`) on the two touched markdown files — a pure
  line-wrapping issue with no content change — fixed by running `prettier --write` on exactly those two
  files (commit `a771432`), re-verified locally, and the second CI run was green with no review comments.
  Independent post-merge review of the actual merged diff
  (`git diff 7c886d7e...5ca0d6c...`) found no defects — see `ROADMAP.md`'s RESOLVER-V3-030 entry for the
  detailed post-merge review notes (file-scope, section-completeness, task-ID-uniqueness, dependency-
  resolution, no-silent-unblocking, and no-invented-threshold checks). This documentation-only follow-up
  (recording the merged/reviewed state, per the RESOLVER-V3-028/029 precedent) restarts the same
  harness-designated branch name from the new `origin/chore/clean-arch-structure` tip (`5ca0d6c`), per this
  repository's rule for reusing a designated branch after its PR merges. Pre-existing local branches were
  left untouched. Remote branch deletion for the merged
  `claude/resolver-v3-030-operational-boundary-hs0dve` ref was not attempted in this session — per
  `AGENTS.md`'s documented incident, this environment's git proxy has previously rejected
  `git push origin --delete` with HTTP 403 for merged branches, and no workaround was to be attempted; it is
  left for an authorized cleanup channel.

## RESOLVER-V3-029 — Privacy-Safe Shadow Projection and Real Metrics

- **Basis and scope:** Started from `origin/chore/clean-arch-structure` at `5c2db19` (merge of PR
  #118), which is also where the pre-existing local `claude/resolver-v3-029-shadow-privacy-c20zyh`
  branch already sat, clean working tree, no divergence. Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`,
  `VERIFY.md`, `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Knowledge-Growth Decision
  Record, the Resolver Knowledge Shadow Mode Contract, and
  `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md` before touching code. Only
  RESOLVER-V3-029's own scope was changed; RESOLVER-V3-030/023/024/010 were not started.
- **Pre-implementation inventory (verified by direct code reading):** `ResolverDecision` carried
  `normalizedQuery` (raw/normalized query), `status`, `reasonCodes: string[]` (open, not closed —
  real call sites use at least 14 distinct literal codes across `ResolverDecisionPolicy`,
  `SequentialFoodCatalogResolver`, `FusionCandidateResolver`, `FusionResolverAdapter`), the full
  `candidates: ResolvedFoodCandidate[]` (each with `id`, `source`, `food: CanonicalFood` —
  `id`/`name`/`normalizedName`/`macrosPer100g`/`source`/`sourceId` — `score`, and
  `breakdown.notes: string[]` free text), `best`/`secondBest` (same candidate shape), `createdAt`, and
  `inputConfidence` (`level`, free-text `reason`, `assumptions?: string[]`).
  `ResolverKnowledgeShadowEvaluationRequest`/`...Result.productionDecision` were typed as this **full**
  `ResolverDecision` — confirmed by direct read, matching the post-implementation review's finding. The
  V1 privacy check (`ResolverKnowledgeShadowEvaluator.ts` pre-change) only inspected
  `Object.keys(request.candidate)`/`Object.keys(request.candidate.payload)` against a 7-entry top-level
  `privateKeys` array — it never touched `productionDecision`, did not recurse into nested
  objects/arrays, and the only file importing any shadow-evaluator symbol anywhere in `src/` was the
  test file itself (grep-confirmed; no production/benchmark caller exists). Shadow candidate payloads
  (`ResolverKnowledgeCandidatePayload`, RESOLVER-V3-020/028) were already a closed 5-variant
  discriminated union (`source-routing-pattern`/`abstention-policy-signal`/
  `clarification-policy-signal`/`provenance-gap`/`negative-source-routing-rule`), each with `locale`,
  `inputType: string` (open, not closed at that layer), and type-specific `sourceType`/`reasonCode`
  enums — no aliases, free decomposition, or independent-user data, consistent with the shadow contract
  doc. `fixtureExpectedStatus?: ResolverStatus` existed on both request and result types but was never
  read inside `aggregateResolverKnowledgeShadowMetrics` — confirmed by direct read; `identificationAccuracy`/
  `abstentionPrecision`/`clarificationRate` were the literal `'unknown'` and
  `falseConfidenceRegressionCount`/`falseConfidenceImprovementCount`/`regressionCount` were hard-coded
  `0`, both unconditionally. Development/holdout separation was a single `Set<string>` scoped to one
  `evaluateShadowCorpus` call, offering no protection across separate calls or process runs — the
  in-memory evaluator/aggregator had no resolver, provider, network, source, or persistence dependency
  of any kind (confirmed by the existing source-scan test and by direct read).
- **Implementation:** See `ROADMAP.md`'s RESOLVER-V3-029 entry and
  `docs/domains/ZERA_RESOLVER_KNOWLEDGE_SHADOW_MODE_CONTRACT_1.md` §"Amendment (RESOLVER-V3-029)" for
  full detail (projection field table, privacy-validation design, ground-truth contract, exact metric
  formulas/denominators/evidence-class rules, corpus-registry design). Summary: a new
  `ResolverProductionDecisionProjectionV1` (`resolver-production-decision-projection-v1`) is the only
  representation of a production decision the contract can carry; a new closed contract version
  `resolver-knowledge-shadow-evaluation-v2` fails closed on `v1`/unknown/mixed versions with no
  reconstruction fallback; a recursive allowlist-based schema validator
  (`ResolverKnowledgeShadowPrivacyValidator.ts`) replaced the top-level-only denylist as the primary
  privacy guarantee (a small recursive denylist remains only as defense in depth); a discriminated,
  versioned `ResolverKnowledgeShadowGroundTruth` replaced `fixtureExpectedStatus`; every metric formula
  in the roadmap Scope is implemented with typed `measured`/`fixture-derived`/`unknown`/`not_evaluable`
  evidence classes and closed reason codes, never a bare `0` for missing evidence; a versioned, immutable
  `ResolverKnowledgeShadowCorpusRegistry` manifest replaced the one-call `Set`, with `evaluate` now
  resolving each case's partition from the registry and failing closed on an unregistered case or a
  partition claim that disagrees with the registry.
- **Tests added/rewritten:** `ResolverProductionDecisionProjection.test.ts` (10 tests — closed field
  set, exclusion of every named private field, determinism, non-mutation, unclassified-reason-code
  fallback, provenance classification for AI/non-AI/absent-selection, candidate count, unknown input
  confidence); `ResolverKnowledgeShadowPrivacyValidator.test.ts` (18 tests — valid-shape acceptance for
  every schema, unknown top-level keys, nested private fields in objects and arrays, unknown
  discriminants on both candidate payload and ground truth, snake_case bypass rejection, valid-top-level/
  unsafe-nested-content rejection, unsupported ground-truth evidence version, and direct
  `containsDenylistedField` recursion tests); `ResolverKnowledgeShadowCorpusRegistry.test.ts` (9 tests —
  cross-instance partition stability, duplicate-case-ID rejection within and across partitions, unknown
  registry version rejection, determinism from a shared manifest, unregistered-case reporting, exposed
  version, manifest non-mutation); rewritten `ResolverKnowledgeShadowEvaluator.test.ts` (41 tests —
  contract-shape/version fail-closed behavior, privacy blocking, every candidate rule, registry
  integration including partition-move rejection, and every metric formula's positive and negative
  cases including zero-denominator `null` outcomes, plus the no-production-effect source-scan and
  no-mutation-on-throw tests).
- **Verification:** focused suites — `npx jest --testPathPattern="ResolverKnowledgeShadow|ResolverProductionDecisionProjection"`
  → 4 suites, 78 tests, all green. Full `npm run verify` (typecheck + lint + format:check + full test
  suite) → 186 suites, 1706 tests, all green, no regressions. `node_modules` was missing at session
  start; restored via `npm install` (the `supabase` CLI postinstall binary download failed with a
  network 403 inside this environment's proxy, so `--ignore-scripts` was used on the retry — this
  affects only the optional `supabase` CLI binary fetch, not any package used by
  typecheck/lint/format/test).
- **No-production-effect confirmation:** the evaluator, registry, and privacy validator remain pure,
  deterministic, and read-only — no resolver, AI/model-backend, network, source, persistence, ranking,
  query, fast-path, approval, or feature-flag dependency (source-scan test); no production object is
  mutated on any evaluated or thrown path (dedicated tests); RESOLVER-V3-029 wires shadow mode into no
  user-visible flow.
- **Residual limitations:** no measured (non-fixture) ground-truth source exists yet — the `measured`
  evidence-class variant is structurally available but currently unreachable by any code path; no
  representative Learning Benchmark V2 corpus exists yet (RESOLVER-V3-023's scope, still blocked on
  RESOLVER-V3-030 in addition to this task); accuracy/regression/false-confidence metrics remain
  expected-status agreement, not proof of correct food identity; RESOLVER-V3-010 remains blocked and
  RESOLVER-V3-013's gate remains NOT PASSED — nothing here changes either.
- **Not started (as instructed):** RESOLVER-V3-030, RESOLVER-V3-023, RESOLVER-V3-024, RESOLVER-V3-010,
  and no production shadow wiring was added.
- **Branch/PR status:** implemented on `claude/resolver-v3-029-shadow-privacy-c20zyh` (the
  harness-designated branch, based on `origin/chore/clean-arch-structure` at `5c2db19`); merged as
  **PR #119**, merge commit `95d5d643872872e22a0fbe5504ac043c55452d66` — CI ("verify" check) green,
  no review comments. Independent post-merge review of the actual merged diff (empty diff between the
  merged commit and the pre-merge working tree, confirmed) found no defects — see `ROADMAP.md`'s
  RESOLVER-V3-029 entry for the detailed post-merge review notes. This documentation-only follow-up
  (recording the merged/reviewed state, per the RESOLVER-V3-028 precedent) restarts the same
  harness-designated branch name from the new `origin/chore/clean-arch-structure` tip
  (`95d5d64`), per this repository's rule for reusing a designated branch after its PR merges.
  Pre-existing local branches, including all retained V3-028 branches, were left untouched. Remote
  branch deletion for the merged `claude/resolver-v3-029-shadow-privacy-c20zyh` ref was not attempted
  in this session — per `AGENTS.md`'s documented incident, this environment's git proxy has previously
  rejected `git push origin --delete` with HTTP 403 for merged branches, and no workaround was to be
  attempted; it is left for an authorized cleanup channel.

## RESOLVER-V3-028 — Developer Review Governance and Atomic Promotion

- **Basis and scope:** Started from `chore/clean-arch-structure` HEAD (`339a982`, merge of PR
  #116), clean working tree, no divergence from origin. Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`,
  `VERIFY.md`, `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Knowledge-Growth Decision
  Record, the Resolver Knowledge Review Contract, and
  `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md` before touching code.
  Only RESOLVER-V3-028's own scope was changed; RESOLVER-V3-029/030/023 were not started.
- **Pre-implementation inventory (verified by direct code reading, not assumed):**
  `independentUserEvidence` was typed as the single literal `'not_evaluable'` (not even a union),
  and the validator threw unless it was exactly that value — i.e. it was structurally impossible
  to represent any other evidence state. The review service's approval condition
  (`candidate.evidence.independentUserEvidence !== 'not_evaluable'` → `blocked_privacy`) meant
  `not_evaluable` was the _passing_ condition, backwards from "insufficient evidence must not
  approve" — though since `not_evaluable` was the only value that could ever exist, this gate
  never actually blocked anything in practice. All 8 actions were accepted by the service, but
  only `approve`/`revoke_approval`/`rollback` did anything beyond appending an event;
  `reject`/`needs_more_evidence`/`quarantine` fell through to the same `appendEvent` call with no
  candidate-state mutation, and `mark_duplicate`/`supersede` had no target field at all and no
  distinct handling. The service held only a read-only `ResolverKnowledgeReviewCandidateReader`
  (`getById` only) — it had no port capable of mutating candidate lifecycle state at all, so
  reject/etc. could not have transitioned candidate status even if the logic had wanted to.
  `saveApproved`/`appendEvent` were two separate non-transactional repository calls inside one
  `try`. No Supabase review repository or production caller exists anywhere in `src/` (grep
  confirmed only the in-memory adapter and test imports). The RESOLVER-V3-021 migration created
  3 tables with RLS enabled and no `anon`/`authenticated` grants, but no reviewer/version/reason/
  snapshot/risk/restriction columns, and its `resolver_knowledge_candidates.status` /
  `resolver_knowledge_candidate_events.next_status` check constraints excluded `'approved'`
  entirely — consistent with the domain type's own `Exclude<ResolverKnowledgeCandidateStatus,
'approved'>` on `ResolverKnowledgeCandidate.status`, which forced an `as never` cast at
  `ResolverKnowledgeReviewService.ts:56` to compare a value the type system said could never occur
  — the exact "cast/exclusion hiding an illegal lifecycle state" pattern the task asked to verify.
  Duplicate/supersession targets were represented on the candidate domain model
  (`duplicateOfCandidateId`/`supersededByCandidateId`) but never populated by any code path.
- **Implementation:** `independentUserEvidence` is now a closed two-value type
  (`RESOLVER_KNOWLEDGE_INDEPENDENT_USER_EVIDENCE_STATUSES`: `not_evaluable` |
  `independently_confirmed`); the aggregator still only emits `not_evaluable`, so no candidate can
  reach `approved` today — intentional fail-closed behavior, no candidate-type exemption
  implemented (none is authorized by an accepted source). `ResolverKnowledgeCandidate.status` was
  widened to the full closed status set including `approved`, removing the type-level exclusion
  and the `as never` cast it forced (the aggregation/`upsertInactive` path still runtime-rejects
  `approved` candidates via the existing validator, now without the redundant `as string` cast).
  `ResolverKnowledgeReviewRequest` is now a discriminated union keyed on `action`, requiring
  `targetCandidateId` only for `mark_duplicate`/`supersede`; self-reference and missing targets
  fail closed (`validation_failed`/`candidate_not_found`) before persistence. Every request also
  carries `reviewContractVersion`, `privacyPolicyVersion`, `candidateVersionAtDecision` (checked
  against the freshly-fetched candidate's `updatedAt` — a stale value fails closed),
  `riskDecision` (must equal the candidate's own risk), a closed `localeRestriction`
  (`not_applicable`/`restricted_to_candidate_locale`/`unknown` — no invented region taxonomy;
  `unknown` fails closed for `approve`), and a closed `reasonCode` legal-per-action via
  `RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS`. The reviewer identity comes only from
  `ResolverKnowledgeReviewAuthorizer.authorizeDeveloperReview()`'s trusted result, never from
  request input. `ResolverKnowledgeReviewRepository` now exposes a single atomic
  `applyDecision(plan)` method (no more separate `saveApproved`/`appendEvent`); `plan` is a
  fully-computed `ResolverKnowledgeReviewDecisionPlan` built by the service (candidate transition,
  approved-payload value, finished event) so the adapter makes no business decisions of its own.
  The reference `InMemoryResolverKnowledgeReviewRepository` snapshots the candidate row, the
  candidate's own lifecycle-event log, the approved-payload table, and the review-event table
  before mutating, and restores all four completely if any internal step throws — proven by tests
  injecting a failure at each of the three stages (candidate/payload/event). `approve` now
  transitions `pending_review → approved` together with creating the active payload;
  `reject`/`needs_more_evidence`/`quarantine`/`mark_duplicate`/`supersede` all transition
  persisted candidate lifecycle state (previously none did); `revoke_approval`/`rollback`
  atomically flip only the payload's own status (`active→revoked`/`rolled_back`) without changing
  `candidate.status` (which stays `approved` as a permanent historical record) or deleting the
  payload. Every persisted `ResolverKnowledgeReviewEvent` now carries reviewer identity,
  review-contract/privacy-policy versions, the exact candidate version reviewed, a closed decision
  reason, risk decision, locale/region restriction, an optional duplicate/supersession target, and
  an immutable `reviewMaterialSnapshot` built by the service from the fetched candidate (never
  trusted verbatim from caller input). Private/linkable fields are now rejected via a recursive
  key-name walk over the entire candidate object at any nesting depth
  (`containsPrivateField`), not only a top-level check. A decisionId already recorded is compared
  field-by-field against the incoming request: an exact match returns `already_applied` with zero
  mutation; any difference returns the new closed result `conflict` instead of a false
  `already_applied`.
- **Migration:** one additive migration,
  `supabase/migrations/20260721160000_extend_resolver_knowledge_review_governance.sql` — widens
  the `resolver_knowledge_candidates.status` and `resolver_knowledge_candidate_events.next_status`/
  `reason_code` check constraints to allow `approved`/`APPROVED_BY_REVIEW`, and adds the new audit
  columns to `resolver_knowledge_review_events`. No historical migration file is edited (verified:
  the two RESOLVER-V3-020/021 migration files are untouched; their own pre-existing migration
  tests still pass unmodified). No new `anon`/`authenticated` grant, no view, no trigger. **This
  migration has not been applied to any live Supabase project as part of this task** — no
  production Supabase adapter for this port exists (in-memory only), so this remains a
  server/admin-only schema definition, not operational, production-wired, or live-migrated
  infrastructure. Its correctness (in particular the assumption that Postgres auto-names an
  unnamed single-column `CHECK` constraint as `<table>_<column>_check`, which is standard
  documented Postgres behavior but was never executed against a live database in this task) is a
  residual, explicitly unverified risk.
- **Contract doc:** updated
  [`docs/domains/ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md`](../docs/domains/ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md)
  with a new "Amendment (RESOLVER-V3-028)" section documenting the evidence-gating fix, the
  discriminated command/lifecycle-transition table, the atomic decision operation, the persisted
  audit fields, semantic idempotency, and the additive migration.
- **Non-effect:** no app-facing (`anon`/`authenticated`) grant; no application view or resolver
  trigger; no resolver read effect; no feature flag or production resolver integration; no
  automatic promotion; no live Supabase deployment; no dependency/`package.json` change; no
  unrelated refactor. RESOLVER-V3-029/030/023 were not started.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test`
  all green via `npm run verify` — 183 test suites, 1636 tests, no regressions (up from 182
  suites/1602 tests). Focused suites:
  `ResolverKnowledgeReview.test.ts` (rewritten — evidence gating incl. no-numeric-threshold check,
  unauthorized zero-mutation, all 8 actions' legal transitions, invalid-transition zero-mutation,
  duplicate/supersede target validation incl. self-reference and missing-target, atomicity via
  deterministic failure injection at each of 3 stages for `approve` and for `reject`, literal-retry
  idempotency, conflicting-decisionId-reuse rejection, full audit-field assertions, recursive
  private-field rejection, unknown-version/enum fail-closed cases, stale-candidate-version
  rejection, and a source-scan proving no dependency on the production resolver decision path),
  `ResolverKnowledgeReviewGovernanceMigration.test.ts` (new — additive-only, no historical-migration
  edit, constraint/column presence, no grant/view/trigger), plus unmodified
  `ResolverKnowledgeCandidate(Migration).test.ts` and `ResolverKnowledgeReviewMigration.test.ts`
  (V3-020/021 baseline) still pass unchanged. Full `resolver`-pattern suite (283 tests) and the
  complete suite both pass with no regressions.
- **Known/residual limits (explicit, not claimed complete):** no candidate can currently reach
  `approved` in production because the only evidence-producing pipeline (RESOLVER-V3-020's
  aggregator) never emits `independently_confirmed` — this is correct fail-closed behavior per the
  Decision Record, not a bug, but it means approval remains untestable end-to-end outside unit
  tests that construct a candidate directly. The additive migration's constraint-renaming
  assumption is unexecuted against a live database (see above). No production Supabase adapter for
  review exists at all — the atomic contract is enforced by the port shape and proven by the
  in-memory reference adapter's tests, not by a real transactional adapter.
- **PR/merge:** PR #117, CI green (`verify` check: typecheck+lint+format+full test suite), no
  review comments, merged as `7814fe0784dca5de93c5208e31d749042186b278`.
- **Post-merge review (same run, after PR #117 merged):** independently re-read the actual merged
  diff (`git diff 339a982..7814fe0`) against RESOLVER-V3-028's acceptance criteria, the
  Knowledge-Growth Decision Record, atomicity, lifecycle correctness, privacy, audit completeness,
  and idempotency. Specifically traced through: the `already_applied`/`conflict` idempotency
  comparison deliberately excludes the review-material snapshot from the byte-equivalence check,
  but this is provably safe — `candidate.updatedAt` only ever advances together with an append to
  the candidate's own lifecycle-event log (both mutations are gated by the same single
  `if (plan.candidateTransition)` block inside `InMemoryResolverKnowledgeReviewRepository.applyDecision`),
  so two requests sharing the same `candidateVersionAtDecision` are guaranteed to have produced an
  identical snapshot — not a shortcut that reintroduces a gap. The atomic rollback path was traced
  for all three failure-injection stages and correctly restores all four affected stores (candidate
  fields, candidate lifecycle-event log, approved-payload table, review-event table). No other call
  site in the repository depended on the removed `saveApproved`/`appendEvent` methods (confirmed by
  the full green `npm run verify` run at merge time — 183 suites/1636 tests, no regressions). No
  defects were found; no follow-up code PR is required. This section itself was added via a
  documentation-only follow-up PR, per this repository's established RESOLVER-V3-02x pattern.

## RESOLVER-V3-019 — Personal Cache/Memory Read Path

- **Basis and scope:** Started from `chore/clean-arch-structure` HEAD (`8af09c24ea6c618a65add9bf8784d9def6a33718`,
  merge of PR #113). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, this handoff, the
  Knowledge-Growth Decision Record, and the Personal Resolution Memory / Invalidation / Recording
  contract docs before touching code. Only this task's own scope (a read contract, eligibility
  policy, read port/use case/Supabase adapter, telemetry port/adapter, a new resolver-decorator
  service, one `container.ts` composition-root wiring change, focused tests, a new read contract
  doc, an addendum to the invalidation contract doc, `ROADMAP.md`, and this handoff) was changed.
- **Technical inventory (pre-implementation):** confirmed by direct code reading (see the
  `ROADMAP.md` entry for the full list) that `personal_resolution_memories.scope_key` is keyed on
  the **resolved food identity**, not raw query text; that no AI `FoodCatalogSource` is composed
  into any production resolver (`RESOLVER-V3-010` remains genuinely blocked, unrelated to this
  task); that `personal_resolution_memories` already grants `authenticated` `select` (no migration
  needed); and that `LogFoodFromRawInputUseCase`/`LogMealFromRawInputUseCase` gate acceptance on
  `resolved.score >= 0.7` / `status === 'accepted'` respectively — both had to be satisfied for a
  memory-confirmed override to actually take effect downstream.
- **Implementation:** Added the closed `personal-resolution-memory-read-v1` contract (exact-match
  `{sourceType, sourceId}` targets, identical scope-key shape to the write path),
  `PersonalResolutionMemoryReadEligibilityPolicy` (P2_confirmed → deterministic reuse + preferred;
  P1_provisional → preferred only, never a forced override; P0_observed → neither — Decision
  Record §6 verbatim), the `PersonalResolutionMemoryReadRepository` port (owner-scoped,
  `active`-status-only, fails closed), `ReadPersonalResolutionMemoryUseCase`, and
  `SupabasePersonalResolutionMemoryReadRepository` (single read-only `select`, no new grant).
  Resolver integration is `PersonalResolutionMemoryAwareFoodCatalogResolver`, a decorator around
  any `FoodCatalogResolver` — deliberately not a change inside `SequentialFoodCatalogResolver`
  itself. It excludes `'user'`-sourced candidates, fails open (returns the exact original decision
  object) on no owner/no candidates/no match/any error, and on a `P2_confirmed` match
  deterministically selects that candidate as `best` (`status: 'accepted'`, fixed `0.95` score,
  `PERSONAL_MEMORY_P2_CONFIRMED_AVOIDED_AI` reason code) or, for `P1_provisional` only, appends
  `PERSONAL_MEMORY_P1_PREFERRED` without touching `best`/`status`. `PersonalResolutionMemoryReadTelemetry`
  records real per-lookup counts plus an honest `avoided` flag (only true when the override
  actually changed the outcome). The production telemetry adapter,
  `ConsolePersonalResolutionMemoryReadTelemetry`, is dependency-free and gated behind
  `isDebugLoggingEnabled()`. `container.ts` now wraps the previously-direct
  `SequentialFoodCatalogResolver` instance in this decorator; both consuming use cases already
  depended on the `FoodCatalogResolver` interface, so no other call site changed.
- **Migration:** none. `personal_resolution_memories` already grants `authenticated` `select`
  under RESOLVER-V3-017's owner-scoped `for all` RLS policy; the new adapter filters `owner_id` in
  the query itself and RLS enforces the same scope again independently.
- **Contract doc:** added
  [`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_1.md`](../docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_1.md);
  added a dated update note to the invalidation contract doc pointing at it.
- **Non-effect:** no resolver read effect on any input the deterministic sources did not already
  independently resolve as a candidate; no cross-user data; no global candidate path; no change to
  RESOLVER-V3-017/018/026/027's own contracts, migrations, or adapters; no live Supabase migration
  or provider/network/AI call was made.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test`
  were run full-suite via `npm run verify` — 182 test suites, 1601 tests, all green, no regressions
  (up from 178 suites/1571 tests). New/focused suites:
  `PersonalResolutionMemoryReadEligibilityPolicy.test.ts`,
  `ReadPersonalResolutionMemoryUseCase.test.ts`,
  `SupabasePersonalResolutionMemoryReadRepository.test.ts`, and
  `PersonalResolutionMemoryAwareFoodCatalogResolver.test.ts` (fail-open proven via reference
  identity, `'user'`-source exclusion, deterministic override from both `ambiguous` and `rejected`
  base status, no redundant override/avoided-flag when already accepted as the same candidate, P1
  annotate-only behavior, P0 fully ignored, query pass-through unchanged). All 178 pre-existing
  suites still pass unmodified.
- **Known/residual limits (explicit, not claimed complete):** this decorator's added reason codes
  are not persisted into the pre-existing `ResolverRunLogger`/`ResolverObservationWriter` telemetry
  sinks (those fire inside `SequentialFoodCatalogResolver.resolve()`, before this decorator sees
  the decision, and correctly record the base/pre-override decision) — a future task may unify the
  channels. No near-match/fuzzy transfer exists (exact scope-key match only, by design). No
  AI/hybrid production wiring was added — RESOLVER-V3-010 remains blocked and unrelated.
- **Post-merge review (same run, after PR #114 merged):** independent self-review found that
  `SupabasePersonalResolutionMemoryReadRepository`'s query has no `ORDER BY`, so
  `PersonalResolutionMemoryAwareFoodCatalogResolver`'s original `result.matches.find(...)` picked
  the winner among multiple active matches by unspecified Postgres row order, not a deterministic
  rule. Fixed in follow-up PR #115 (merged, `738740d`): the decorator now walks `eligibleCandidates`
  in the base resolver's own already-deterministic, score-sorted order instead. Added a regression
  test for the exact two-match, reversed-row-order scenario. No other defects were found; `npm run
verify` stayed green (182 suites/1602 tests) after the fix. No other findings required action.

## RESOLVER-V3-026 — Personal Memory Write Integration and Audit Hardening

- **Basis and scope:** Started from `chore/clean-arch-structure` HEAD
  (`18ba596edfbb369e4178288fead4a10660d598cd`, PR #112 merged). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`,
  `VERIFY.md`, this handoff, the Knowledge-Growth Decision Record, the Personal Resolution Memory
  Invalidation Contract, and the RESOLVER-V3-017/018/020/021/022 post-implementation review before
  touching code. Only RESOLVER-V3-026's own scope (a production `record` use case, its Supabase adapter,
  one additive migration, the three real production call sites identified below, focused tests, a new
  recording contract doc, `ROADMAP.md`, and this handoff) was changed.
- **Technical inventory (pre-implementation):** dispatched a dedicated research pass over the codebase
  before writing any code, per this task's explicit prerequisite not to invent signals. Findings: (1)
  `PersonalResolutionMemoryRepository` had zero implementations and zero call sites anywhere in `src/`
  — completely unused outside the port definition itself; (2) the only real, wired journal-logging
  pipeline is `logResolvedNutritionInput` → `resolvePreparedNutritionInputs` →
  `LogFoodFromRawInputUseCase`, used by `InputBar.tsx` and `JournalScreen.tsx`'s normal submit — this is
  where "unchanged logging" (P0) genuinely happens; (3) `ResolverDecision.candidates` is produced
  internally but never surfaced to any general candidate-picker UI — the only real "deliberate candidate
  selection" (P1) signal anywhere in the product is the narrow Speck-disambiguation resubmission in
  `JournalScreen.tsx`'s `handleSelectSpeckChoice`; (4) `CreateSavedMealFromDateUseCase` (reachable from
  `SavedMealsScreen.tsx`'s "create from today" action) is a genuine, deliberate, named user action that
  matches the Decision Record's `deliberately_saved_personal_meal` (P2) evidence type exactly; (5) no
  "confirm this food" UI exists anywhere (the post-submit panel is passive display; `confirmUserPrivateHint`
  confirms a different domain object, a portion hint) — `explicit_confirmation` has no real signal; (6)
  `EditFoodEntryFromNaturalLanguageUseCase`/`ApplyNaturalLanguageEditUseCase` only ever correct
  quantity/portion, never `foodCatalogRef`/food identity, and the latter has no caller anywhere in the UI
  — `explicit_correction` has no real identity-correction signal either; (7) the
  RESOLVER-V3-017 migration grants `authenticated` `update`/`delete` on `personal_resolution_memory_events`
  under a single `for all` policy, confirming the audit-append-only gap named in the post-implementation
  review; (8) the closest existing production adapter precedent for an owner-scoped, no-read-API write
  port is `SupabaseResolverObservationWriter` (plain sequential inserts, duplicate detection via Postgres
  `23505`, no RPC/transaction) — there is no RPC/stored-function precedent anywhere in this codebase, same
  finding as RESOLVER-V3-027 made for the sibling invalidation port.
- **Implementation:** Added `RecordPersonalResolutionMemoryUseCase` (RESOLVER-V3-017's port's first
  production caller), which derives `memoryId = actionId` and every event ID from `actionId` deterministically
  (idempotent-by-construction — a literal retry re-derives byte-identical rows, absorbed by the tables'
  unique constraints), reuses the existing `promotionForEvidence` mapping unchanged, and enforces correction
  precedence structurally: `explicit_correction` is rejected with `correction_requires_prior_memory_id`
  unless the caller names the specific prior memory it overrides, and naming one always produces a
  `PersonalResolutionNegativeEvidence` event against it. Added `SupabasePersonalResolutionMemoryRepository`
  (the port's first production adapter), inserting into `personal_resolution_memories` then each event row
  in `personal_resolution_memory_events`, mapping `23505` to `duplicate` and any other error to `failed`
  (even after a partial write, so a caller never mistakes an incomplete action for a complete one). Wired
  exactly the three real signals found above, each fire-and-forget and owner-gated (silently skip without
  an authenticated owner or without a `foodCatalogRef` target, never blocking or failing the user-visible
  action they observe): P0 in `resolvePreparedNutritionInputs.ts` right after a persisted entry; P1 via a
  new optional `evidenceType` parameter threaded through `logResolvedNutritionInput`/
  `resolvePreparedNutritionInputs`, set by `JournalScreen.tsx`'s Speck resubmission; P2 in
  `CreateSavedMealFromDateUseCase` for each saved item with a `foodCatalogRef`. `explicit_confirmation` and
  `explicit_correction` remain fully implemented and directly unit-tested in the use case (so correction
  precedence is provably enforced) but have no production caller — stated explicitly in the new contract
  doc, the same pattern RESOLVER-V3-018/027 used for its own uncalled invalidation port.
- **Migration:** one additive migration,
  `supabase/migrations/20260721150000_harden_personal_resolution_memory_audit_append_only.sql`, revokes
  `update`/`delete` on `personal_resolution_memory_events` from `authenticated`. RLS policies are evaluated
  only after the table-level privilege check, so this alone makes the table genuinely append-only; no RLS,
  policy, or historical-migration change, and `personal_resolution_memories`' own `update` grant (still
  needed for invalidation/state transitions) is untouched.
- **Contract doc:** added
  [`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_1.md`](../docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_1.md);
  added a dated update note to the existing invalidation contract doc correcting its "no production
  personal-memory writer" statement now that one exists (while confirming it is still not wired into
  correction/deletion/source-update flows, since none of those carry a real memory-ID/action mapping yet).
- **Non-effect:** no resolver read path, ranking/query effect, candidate effect, or AI-avoidance behavior
  was introduced. The RESOLVER-V3-018/027 invalidation port, its migrations, and its own (still uncalled)
  production adapter boundary are unchanged. No live Supabase migration was applied or attempted; no
  provider/network call was made.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test` were
  run full-suite via `npm run verify` — 178 test suites, 1571 tests, all green, no regressions in any
  pre-existing suite. New/focused suites: `RecordPersonalResolutionMemoryUseCase.test.ts` (10 tests:
  evidence-level correctness for every evidence type, actionId-retry idempotence, cross-owner isolation,
  correction-requires-prior-memory rejection, correction-precedence negative-evidence enforcement, closed
  invalid-request error codes, repository-failure and repository-throw surfacing);
  `SupabasePersonalResolutionMemoryRepository.test.ts` (6 tests: multi-table insert sequencing, duplicate-key
  mapping, non-duplicate-failure mapping including after a partial write, owner-required fail-closed);
  `PersonalResolutionMemoryAuditAppendOnlyMigration.test.ts` (5 tests: reserved unique migration prefix,
  exact revoke statement, no RLS/policy/grant/anon touch, additive-only, prior migration file unchanged);
  `CreateSavedMealFromDateUseCasePersonalMemory.test.ts` (5 tests: P2 recording per source-grounded item, no
  owner ⇒ no recording, template creation unaffected when recording is unwired or throws, no target ⇒ no
  recording). Pre-existing `resolvePreparedNutritionInputs`/`logResolvedNutritionInput`/`SavedMeals`/
  `PersonalResolutionMemory*`/`JournalScreen` suites (117 tests) all still pass unmodified, confirming the
  new fire-and-forget hooks are safe no-ops in test env (no authenticated owner ⇒ they skip immediately).
- **Known/residual limits (explicit, not claimed complete):** `explicit_confirmation`/`explicit_correction`
  have no production caller (no real signal exists yet — see the contract doc's signal table);
  `SupabasePersonalResolutionMemoryRepository` performs sequential inserts, not a single cross-table
  transaction (safety instead comes from actionId-derived deterministic IDs and unique-constraint
  absorption, documented explicitly); RESOLVER-V3-019 (personal-memory read path) is now unblocked in
  `ROADMAP.md` but starting it is out of scope for this task and left for a separate run.

---

## RESOLVER-V3-027 — Atomic and Correct Memory Invalidation

- **Basis and scope:** Started from the canonical merge commit of PR #111
  (`4e4c11196514899359e1d92064cbde45acc73251`, `chore/clean-arch-structure`). Read `SSOK.md`, `AGENTS.md`,
  `ROADMAP.md`, `VERIFY.md`, `README.md`, `.governance/SYSTEM.md`/`RULES.md`/`SAFETY.md`/`REVIEW_POLICY.md`,
  this handoff, `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`, the Knowledge-Growth
  Decision Record, the Personal Resolution Memory Contract, and the Invalidation Contract before touching
  code. Only RESOLVER-V3-027's own scope (invalidation use case, its port, its in-memory adapter, one
  additive migration, focused tests, the invalidation contract doc, `ROADMAP.md`, this handoff) was changed.
- **Technical inventory (pre-implementation):** (1) `PersonalResolutionMemoryInvalidationRepository` is the
  only invalidation port; (2) its only implementation is
  `InMemoryPersonalResolutionMemoryInvalidationRepository` — **no production Supabase adapter for this port
  exists anywhere in `src/`**, confirmed by grep across the repo; (3) consequently there was and is no live
  persistence implementation to make atomic; (4) the pre-existing in-memory adapter mutated a `Map` directly
  inside the use case's BFS loop, once per iteration, with no staging/rollback; (5) the only idempotency
  boundary was per-node event-ID dedup (`actionId:memoryId`), not a whole-action ledger, which could not
  reproduce a consistent result on retry against already-mutated state; (6) `personal_resolution_memories`
  (state) and `personal_resolution_memory_events` (audit) tables and RLS already existed from RESOLVER-V3-017;
  `personal_resolution_memory_dependencies` (edges) existed from RESOLVER-V3-018 with **no foreign key** to
  the memories table; (7) no RPC/stored-function/`security definer` pattern exists anywhere in this codebase
  (verified by grep over `src/` and `supabase/migrations/`) — every real Supabase write path in the repo is a
  plain client-side `.from(...).insert()/.update()` call, so there is no existing atomic-transaction adapter
  pattern to extend for a production adapter; (8) `personal_resolution_memories` already has a
  `unique(owner_id, memory_id)` constraint, which is what makes a composite foreign key from the dependency
  table possible; (9) the request/result/event contract shape from RESOLVER-V3-018 could remain unchanged —
  only the internal planning/commit mechanics and the repository port needed to change; (10) true all-or-
  nothing semantics required replacing the immediate-write BFS with a read-only planning phase and a single
  atomic commit method on the port, plus a whole-action idempotency ledger separate from per-node event dedup.
- **Implementation:** Rewrote `InvalidatePersonalResolutionMemoryUseCase` as a strict two-phase
  plan-then-commit: Phase 1 is a pure, read-only pre-order DFS with explicit `visiting`/`done` node coloring
  (true cycle = revisit while `visiting`; diamond revisit = revisit while `done`, planned once, no duplicate
  event; already-inactive nodes are classified `noop` but their dependents are still traversed; the 100-node
  traversal limit is checked as each new node is first discovered, before any write is planned) that produces
  a single immutable `PersonalResolutionMemoryInvalidationPlan`. Phase 2 is the repository port's only write
  method, `applyInvalidationPlanAtomically`, which the in-memory adapter implements by staging all writes
  against copies of its internal maps and swapping them into live state only after the entire plan applies
  without error — proven via a test-only `injectCommitFailureAtWriteIndex` hook that forces a throw at the
  first, a middle, and the last planned write, in every case leaving both state and event history unchanged.
  Idempotence is enforced _before_ planning via a new `findCommittedAction(ownerId, actionId)` port method: a
  repeated action ID returns the exact previously committed result without re-touching the graph, which
  matters because re-planning from already-mutated current state would otherwise compute a different (though
  individually correct) all-noop result on a literal retry. Added `invalid_dependency` (a dangling or
  cross-owner dependency edge — checked in the use case itself as defense in depth, not only enforced by the
  migration) and `atomic_commit_failed` (Phase 2 failure) to the closed error-code set.
- **Migration:** One additive migration,
  `supabase/migrations/20260721140000_harden_personal_resolution_memory_invalidation.sql`, adds a composite
  foreign key from both `personal_resolution_memory_dependencies` edge sides
  (`(owner_id, memory_id)` and `(owner_id, depends_on_memory_id)`) to
  `personal_resolution_memories(owner_id, memory_id)` with `on delete cascade`. Because both foreign keys
  force the _same_ `owner_id` column value to resolve to a real memory row, cross-owner edges become
  structurally impossible, not just application-checked. No RLS, grant, or historical-migration change; the
  RESOLVER-V3-018 migration file is untouched (verified in a dedicated migration test and by `git diff`).
- **Non-effect:** No resolver read path, AI avoidance, catalog mutation, candidate effect, ranking/query
  effect, or new invalidation reason type was introduced. No production Supabase adapter was built for this
  port — the contract doc now states explicitly that only the in-memory adapter exists, and that a future
  production adapter would need a `security definer` Postgres function (no precedent for this exists yet in
  the repo) to get the same atomicity guarantee across multiple tables from client-side Supabase calls. No
  live Supabase migration was applied or attempted; no provider/network call was made.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test` were run
  full-suite via `npm run verify`. Focused suite: `PersonalResolutionMemoryInvalidation.test.ts` — 32 tests
  (9 pre-existing behavior-preserving + 23 new: diamond/cycle graph correctness, atomicity via failure
  injection at first/middle/last write, already-inactive-node propagation to active dependents, idempotence
  including post-commit-failure retry and cross-action-ID safety on an already-inactive graph, and owner
  isolation including a corrupted-edge fake-repository test for `invalid_dependency`). New
  `PersonalResolutionMemoryInvalidationHardening.test.ts` — 7 tests on the new migration (reserved prefix,
  composite FK, cascade count, no anon/grant/view, no RLS/authenticated-grant change, additive-only, prior
  migration file unchanged). Pre-existing `PersonalResolutionMemoryInvalidationMigration.test.ts` (V3-018) and
  `PersonalResolutionMemoryPromotionPolicy.test.ts` (V3-017, confirmed unaffected — it only imports
  `promotionForEvidence` and has no dependency on the invalidation use case/repository) both still pass
  unmodified. Exact full-suite/CI numbers are recorded in the PR; see the git history for the merge commit.
- **Known/residual limits (explicit, not claimed complete):** no production Supabase adapter exists for
  invalidation (unchanged limit, now explicitly documented rather than implied); RESOLVER-V3-026 (production
  write integration) remains fully separate, `todo`, and still blocks RESOLVER-V3-019 on its own; the audit
  event table's mutability hardening remains RESOLVER-V3-026's scope, not touched here.

## RESOLVER-V3-025 — Documentation and Status Reconciliation (post-implementation review)

- **Basis and scope:** Reviewed the canonical branch at `df4accd02c7d79c44a0cb4d6f57f599c1809b458` (HEAD
  of `chore/clean-arch-structure` at review time, per `git log --oneline -15`; no further commits were
  found on top of it). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, the Knowledge-Growth
  Decision Record, and this handoff, then independently re-derived the RESOLVER-V3-017/018/020/021/022
  findings by reading the actual merged code rather than trusting prior status text.
- **What was reconciled:** `ROADMAP.md` had RESOLVER-V3-022 stuck on `todo` despite PR #110 being merged
  as `HEAD`, and RESOLVER-V3-018 simultaneously marked `done` and "(in progress)". Both are corrected.
  RESOLVER-V3-017/-018/-020/-021/-022 each now carry an inline "Post-implementation findings" note.
  RESOLVER-V3-019 and RESOLVER-V3-023 are changed from `todo` to `blocked`, with explicit new dependencies
  on the remediation tasks below. This handoff gained the missing RESOLVER-V3-021 and RESOLVER-V3-022
  sections (see below).
- **New remediation series:** RESOLVER-V3-025 (this task) through RESOLVER-V3-030 were added to
  `ROADMAP.md` to close the gaps found — personal-memory write integration/audit hardening (026),
  atomic/correct invalidation (027), review governance/atomic promotion (028), privacy-safe shadow
  projection/real metrics (029), and candidate-aggregation operational boundary (030).
- **Full findings:** see `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`.
- **Non-effect:** documentation-only change. No product code, migration, or dependency was touched. No
  live Supabase migration was applied or attempted (Supabase MCP access was unauthorized in this session,
  so live-database state is reported as carried over from the source review, not independently
  re-confirmed). No further live provider run was performed or authorized.
- **Verification:** documentation-only per `VERIFY.md` — `git --no-pager status --short`,
  `git --no-pager diff --stat`, `git diff --check` were run against the touched files.

## RESOLVER-V3-021 — Developer Review and Global Promotion

- **Basis and scope:** Implemented from `34fa3a1b42e637e75fb00d932166a31a24e4e2d7`, merged twice by
  process error as PR #108 (`codex/implementiere-developer-review-vertrag`) and PR #109
  (`codex/implementiere-developer-review-vertrag-rqhv0v`); `git diff` between the two merge commits is
  empty, confirming identical content and no conflicting logic — only a duplicate-merge history.
- **Inventory:** No developer-review, approval, or global-activation mechanism existed before this task;
  candidates were inactive-only per RESOLVER-V3-020.
- **Implemented contract:** `resolver-knowledge-review-v1` with actions `approve`, `reject`,
  `needs_more_evidence`, `quarantine`, `mark_duplicate`, `supersede`, `revoke_approval`, `rollback`; a
  server-side authorization port, candidate reader port, review repository port, and
  `ResolverKnowledgeReviewService`; an in-memory review repository; Supabase tables
  `resolver_knowledge_reviews`, `approved_resolver_knowledge`, `resolver_knowledge_review_events` with RLS
  and no `anon`/`authenticated` grants.
- **Known gaps (see post-implementation review):** the service currently requires
  `independentUserEvidence === 'not_evaluable'` to allow approval, effectively treating "not evaluated" as
  passing evidence rather than blocking on it; `saveApproved`/`appendEvent` are non-atomic; `reject`/
  `needs_more_evidence`/`quarantine` do not transition candidate lifecycle state; the review event omits
  reviewer identity, decision reason, contract/candidate/privacy versions, and a material snapshot.
  Tracked as RESOLVER-V3-028.
- **Non-effect:** no app-facing grants, no resolver-effect wiring, no automatic approval.

## RESOLVER-V3-022 — Shadow Mode for Global Candidates

- **Basis and scope:** Implemented from the RESOLVER-V3-021 merge state on
  `codex/implementiere-shadow-mode-fur-globale-kandidaten`, merged as PR #110
  (`df4accd02c7d79c44a0cb4d6f57f599c1809b458`).
- **Implemented:** `resolver-knowledge-shadow-evaluation-v1` contract; a pure
  `ResolverKnowledgeShadowEvaluator` with no external ports, no network/provider calls, and no resolver
  mutation; development/holdout partitioning (duplicate case-ID rejection within one evaluation call);
  candidate-type/locale/input-type checks; delta categories (`no_change`, `hypothetical_source_change`,
  `hypothetical_abstention`, `hypothetical_clarification`, `hypothetical_provenance_warning`,
  `blocked_locale`, `not_evaluable`, `invalid_candidate`, `privacy_blocked`); an aggregate-metrics helper.
- **Known gaps (see post-implementation review):** `productionDecision` is typed as the full
  `ResolverDecision` (including `normalizedQuery`, candidates, source data), and the privacy check only
  inspects top-level keys of `candidate`/`candidate.payload` — it never inspects `productionDecision`, so
  private/linkable resolver data currently passes through shadow requests/results unfiltered.
  `falseConfidenceRegressionCount`, `falseConfidenceImprovementCount`, and `regressionCount` are hard-coded
  to `0`; `identificationAccuracy`, `abstentionPrecision`, and `clarificationRate` are always `'unknown'`;
  `fixtureExpectedStatus` is carried in the contract but never used to compute any of them. Holdout
  separation does not persist across runs. Tracked as RESOLVER-V3-029.
- **Non-effect:** confirmed no external ports, no network calls, no provider calls, no resolver mutation.

## RESOLVER-V3-018 — Personal Memory Invalidation

- **Basis and scope:** Started from the required `4c960d0b6a3abf78906661a660ea4fbde7963958` and created `codex/resolver-v3-018-personal-memory-invalidation`. Only the V3-018 private-memory contract, one authorized additive migration, focused tests, canonical documentation, roadmap status, and this handoff changed.
- **Inventory:** The actual implementation before this task consisted of the `personal-resolution-memory-v1` domain contract (P0/P1/P2; active/superseded/contradicted/deleted), promotion policy, write-only `record` port, and private state/event tables. There was no production writer, Supabase adapter, in-memory memory adapter, resolver read path, candidate link, source-update signal, or stored dependency edge. Correction logs and journal soft-delete/restore flows exist, but none carries an attributable personal-memory ID or action mapping. Alias/portion-hint deletion is likewise not connectable safely. Account cascade existed on state/events; source supersession, source unavailability, and source identity change therefore remain explicit-port-only signals.
- **Implementation:** Added the closed `personal-resolution-memory-invalidation-v1` request/result/event contract with nine closed reasons and closed failure codes. The use case is owner-scoped and fail-closed, preserves historical evidence through append-only events, turns P1 source-unavailability into P0 weakening, and can deactivate P2. The in-memory private adapter makes action/event retries idempotent and supports direct dependency storage. It neither logs raw inputs/owners/source user text nor imports resolver, AI, catalog, or candidates.
- **Dependencies and persistence:** One reserved-prefix migration adds same-owner direct dependency edges with account cascade, RLS, authenticated-only grants, no anon access, and a constrained `invalidation` event type. Traversal is bounded at 100 entries, detects cycles, and propagates via `dependency_invalidated`; cross-owner links are not traversed. There is no global view/function, generic metadata store, dummy owner, or real Supabase/network call.
- **Integration/non-effect:** No correction/journal action was wired because invalidation failure must not change a successful journal action and no safe memory identity signal exists. No resolver read, AI avoidance, ranking/query/fast path, candidate creation, source call, or catalog mutation was added. V3-019 receives only the inactive-state contract and must add its own exact private read policy.
- **Verification:** Focused invalidation/migration suites: 2 suites, 11 tests passed; personal-memory, correction, and journal regressions: 3 suites, 16 tests passed. Typecheck and lint were invoked without reported errors; touched-file Prettier check passed. `git diff --check`, no dependency drift, migration timestamp uniqueness, and secret-safe diff checks passed. No UI file changed, so no manual UI gap entry applies. PR #107 subsequently merged with green CI (`bd5bd7f2281e7aade99d05bcf7a1bfec401e9ff0`).
- **Post-implementation findings (RESOLVER-V3-025, 2026-07-21):** independent code review after merge found the traversal writes each transition immediately rather than planning fully first (no atomicity/rollback on later failure), the "detects cycles" behavior above is a false positive on diamond dependency graphs (a node reached via two valid paths is wrongly reported as a cycle), an already-inactive node's dependents are never enqueued for propagation, and `personal_resolution_memory_dependencies` has no foreign key to `personal_resolution_memories`. None of this was exercised by the test suite above. Full detail in `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`; tracked for remediation as RESOLVER-V3-027. RESOLVER-V3-019 must not build on this path until that remediation lands.

## RESOLVER-V3-020 — Privacy-Safe Knowledge Candidate Aggregation

- **Basis and scope:** Implemented from `34fa3a1b42e637e75fb00d932166a31a24e4e2d7` on branch `feat/resolver-v3-020-knowledge-candidates`. This task does not change personal memory, resolver composition, provider wiring, dependencies, or the V3-017 scope.
- **Inventory:** The current privacy projection contains privacy/observation contract versions, locale, input type, outcome, candidate count, selected BLS/OFF/USDA source type and ID, provenance, resolver version, latency, and closed reason codes. V1 consequently supports only structured route, abstention, clarification, provenance-gap and negative-source-routing signals. It cannot derive aliases, terms, typo/locale mappings, meal names, searches, free-text templates, or independent-user counts; that status is always `not_evaluable`.
- **Implementation:** Added closed `resolver-knowledge-candidate-v1` model, fail-closed projection aggregator, deterministic safe-payload fingerprint deduplication, contradiction and negative-evidence preservation, and an in-memory server-boundary repository limited to inactive lifecycle transitions. `approved` is reserved and rejected. The aggregator has no import or read path for `resolver_observations`; source IDs are discarded before payload/fingerprint creation.
- **Persistence:** Added one additive migration defining `resolver_knowledge_candidates` and append-only `resolver_knowledge_candidate_events`, both RLS-enabled and fully revoked from `anon` and `authenticated`. It has no grants, app/global/resolver view, trigger, candidate activation, or curated-knowledge path. Existing observations, resolver runs, cache results, aliases, catalog and personal-memory structures remain untouched.
- **Documentation and follow-up:** `docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md` records the candidate inventory, contract, lifecycle, persistence boundary and V3-021/V3-022 handoff. Developer review/promotion belongs to V3-021; shadow evaluation belongs to V3-022. RESOLVER-V3-017 remains unchanged.
- **Verification:** Focused candidate/privacy/migration suites: 3 suites, 22 tests passed. `npm run typecheck` and `npm run lint` passed. The full prettier/verify commands were invoked but the command runner ended after starting their repository-wide formatting stages without printing a completion footer; rerun `npm run format:check` and `npm run verify` in CI before merge. No live Supabase, provider, network or AI call was performed.

## RESOLVER-V3-017 — Personal Memory Promotion and Correction Precedence

- **Basis:** `34fa3a1b42e637e75fb00d932166a31a24e4e2d7`.
- **Inventory:** logging is an implicit weak action; correction logs distinguish user/system edits; saved meals exist as personal templates; aliases, portion hints, resolver observations and journal snapshots are not reused as memory. Canonical catalog references are source-grounded; `user` source records are personal/manual. A dedicated private boundary is required.
- **Implemented contract:** `personal-resolution-memory-v1` defines closed P0/P1/P2, status, target references, evidence, transitions, and private correction negative evidence. The policy fails closed for unknown evidence/version and intentionally has no repetition threshold.
- **Storage:** one additive owner-scoped Supabase migration creates state/events tables with account cascade, RLS, no anon grant, and no views/aggregation.
- **Non-effect:** no resolver read/fast path/ranking/AI avoidance/global candidate path was added. V3-018 remains responsible for dependency invalidation and V3-019 for reads; V3-020 must not consume private memory.

## RESOLVER-V3-016 — Privacy Boundary Enforcement

- **Basiscommit:** `e67fb043e21796a937f5585475d80549ff2167ed` on expected base content; task branch `codex/resolver-v3-016-privacy-boundary`.
- **Policy:** `resolver-observation-privacy-v1`; executable field catalogs cover private storage columns and every V1 nested contract field. `owner_id`, row/observation/run IDs, and exact timestamps were corrected/treated as private or linkable exclusions, not operational projection fields.
- **Inventory:** raw/normalized inputs are free text; owner and IDs are direct/linkable; source `user` and its IDs are private; reason codes are only projectable from a closed allowlist. Structured V1 fields allowed in the in-memory-only projection are policy/contract version, locale, input type, outcome, candidate count, approved BLS/OFF/USDA source pair, provenance, resolver version, latency, and safe reason codes.
- **Excluded:** owner, raw/normalized text, all IDs/timestamps, journal/food-entry/correction links, metadata, provider data, prompts, secrets, headers, and stack traces. Normalized text remains blocked pending an explicit later policy/process; no hash or threshold is claimed as anonymization.
- **Deletion/retention/access:** deletion obtains the current owner through the canonical provider and deletes only that owner's private rows; missing owner fails closed. Existing account cascade and owner RLS remain unchanged. No automatic retention duration/job is introduced; no automatic candidate/global transfer exists.
- **Logging:** unconditional resolver logs containing raw or normalized query were converted to explicit debug-gated logs without input values. Observation errors log only closed codes; full Supabase response and owner are not logged.
- **Open questions:** future semantic alias/term aggregation, retention duration, and any controlled server path require a separate accepted policy. RESOLVER-V3-017 and V3-020 may begin in parallel on separate branches; V3-020 cannot read private rows as global candidates.
