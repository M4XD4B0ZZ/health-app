# Handoff — RESOLVER-V3-048 Protocol-v4 Phase A (2026-07-27)

1. **Task ID/status:** RESOLVER-V3-048 — `in_progress — protocol-v4 contract and zero-call preflight complete; live execution not authorized`; basis `d7e15aeaf0c66bab8a94eead266eb14add9e9a12`.
2. **What changed:** Added immutable protocol-v4 plan/tree hashing, candidate selection, category evidence, terminal usage/ledger/count contracts, fail-closed Holdout authorization, adapter metadata preservation, and a 22-scenario zero-network dry-run suite.
3. **Why it changed:** Phase B needs a closed, independently reviewable evidence and budget contract before any paid call; V3-047 did not prove a live winner.
4. **Files changed:** benchmark-local Protocol-v4 implementation/tests; Variant-C metadata projection and V3-047 harness; `LiveProviderUsage`; Phase-A report; `ROADMAP.md`; this handoff.
5. **Verification executed:** protocol/hash/manifest, selection, category, Holdout, usage/cost/cache, telemetry/ledger, timeout/failure, count and V3-047 compatibility tests; typecheck/lint/format/full verify/diff and immutable-path checks.
6. **Verification result:** Typecheck, lint, format, diff checks and 11 focused suites / 197 tests passed. Canonical `npm run verify` passed typecheck/lint/format and advanced through a large passing Jest set but did not terminate locally; it was interrupted after four minutes, so green GitHub Verify remains required. Provider calls 0, provider cost USD 0, credentials not read.
7. **Known issues/blockers/residual risks:** No live quality, reliability, cost, consistency, or p95 evidence exists. Remote tip/push checks are unavailable because this checkout has no configured remote. Budget is proposal-only. G2 remains not passed; V3-010 remains blocked.
8. **Human review/next steps:** Review and merge only after green CI, then independently inspect the merge. Phase B still requires explicit human approval of exact call/token/USD limits and must never auto-continue to Holdout.

# Handoff — RESOLVER-V3-047 final executable evidence closeout (2026-07-27)

1. **Task ID/status:** RESOLVER-V3-047 — `done — executable offline candidate and evidence infrastructure complete; live superiority unverified`; basis `3310752af4c4052c8241c79153e1a6985c56eadf`. No remote is configured, so remote-tip fetch was unavailable.
2. **What changed:** Replaced the provider-only measurement with twelve real async adapter/fast-path/R0/R1-min fake-source scenarios; persisted Variant-C identity through every ledger lifecycle state; enforced no-cache fail-closed cost handling and separated pricing, usage, and actual-cost status.
3. **Why it changed:** PR #187 still lacked executable source/fast-path evidence, self-identifying Variant-C ledger records, and closed cache-cost semantics.
4. **Files changed:** V3-047 harness and candidate/provider/ledger/types tests and implementation; V3-047 report; `ROADMAP.md`; this handoff.
5. **Verification executed:** focused candidate/provider/parser/adapter/retrieval/pricing/budget/usage/telemetry/ledger/timeout and V3-043/044/045/046/049/050/051 regressions; executable harness; typecheck, lint, format check, canonical verify, diff and protected-integrity checks.
6. **Verification result:** Required local checks passed; zero real provider calls and USD 0 real provider cost. See command evidence in the final agent report.
7. **Known issues/blockers/residual risks:** No live effectiveness, reliability, repeat consistency, or p95 evidence was collected. The checkout has no remote, so push and independent remote-tip/open-PR checks are unavailable. V3-048 remains `todo`; V3-010 remains `blocked`; production wiring remains unauthorized.
8. **Human review/next steps:** Review exact call matrix and closed cost/identity contracts; require green GitHub Verify before merge. V3-048 must remain a separate explicitly authorized live-evidence task.

# Handoff — RESOLVER-V3-047 post-merge evidence completeness (2026-07-27)

1. **Task ID/status:** RESOLVER-V3-047 — `in_progress` pending required GitHub CI.
2. **What changed:** Immutable Variant-C identity, exact versioned pricing, typed parser diagnostics, telemetry/ledger persistence, asynchronous fake-transport candidate execution, and R1-min execution evidence.
3. **Why:** PR #186 left snapshot cost unknown, failures anonymous, parser classification message-dependent, the central harness simulated, and tier diagnostics discarded.
4. **Files changed:** Roadmap, handoff/report, benchmark-local candidate/provider/budget/usage/types/adapter/telemetry/ledger/harness, and focused tests.
5. **Verification executed:** typecheck; focused provider/candidate/budget/adapter/retrieval/telemetry/ledger/timeout Jest suite; lint; format check; full verify; diff check.
6. **Verification result:** Typecheck, lint, format, diff check, and 126 focused tests passed. `npm run verify` passed its first three stages and ran a large passing Jest set but did not terminate; it was interrupted. GitHub CI was unavailable locally.
7. **Known issues/risks:** No remote is configured, preventing independent remote-tip verification, push, and GitHub CI. Live superiority/latency/usage remain unknown.
8. **Human review/next steps:** Review and run required CI; mark V3-047 done only after green CI. V3-048 stays todo; V3-010 stays blocked.

---

# Latest Handoff

## RESOLVER-V3-047 — Post-Merge Executable Candidate and Routing Correction (Done)

1. **Task ID/status:** `RESOLVER-V3-047` is `done` for executable offline candidate integration only. Basis `e6615816e7ce066971061e33109ab5b55351258e`; no remote is configured, so remote-tip fetch was unavailable. V3-048 remains `todo`; V3-010 remains `blocked`.
2. **What changed:** closed H0/H1/H2 over parser/model/runtime config; added one candidate-driven request path and version metadata; made S1 clarification fail closed on `reason`; executed H2 R1-min tier-by-tier through the real adapter/scorer/decision path; added a positive-proof H2 fast-path boundary and focused fake-transport/source tests.
3. **Why it changed:** PR #185 described H2 routing and offline call decisions without executing them, hard-coded the live benchmark provider to P0/S0, and silently discarded an incoherent S1 field.
4. **Files changed:** V3-047 candidates/harness, Variant-C provider/types/adapter/retrieval and focused tests; V3-047 report; `ROADMAP.md`; this handoff.
5. **Verification executed:** red-baseline review/assertions; focused candidate/provider/parser/adapter/retrieval suites; V3-043/044/045/046/049/050/051 and timeout/telemetry/ledger regressions; typecheck, lint, format check, canonical verify, diff/integrity checks.
6. **Verification result:** see final command log and report post-merge section. All completion-gate checks passed. Fake transports only; provider calls 0; cost USD 0.
7. **Known issues/blockers/residual risks:** no live quality/latency/cost evidence exists; H1/H2 are executable candidates, not proven winners. Remote-tip/open-PR inspection depends on unavailable remote configuration. Production wiring remains unauthorized.
8. **Human review/next steps:** review candidate closure, fail-closed parser and tier-stop semantics; require green GitHub Verify before merge. V3-048 remains a separate, unstarted live-evidence task.

## RESOLVER-V3-047 — Candidate Integration and Offline Validation (In Progress)

1. **Task ID/status:** `RESOLVER-V3-047` is `in_progress` on basis
   `c2e256df14c29fd2b648e5a6c6c4b78be380f2a3`; the checkout has no configured remote, so the remote
   tip could not be independently fetched. V3-048 remains `todo`; V3-010 remains `blocked`.
2. **What changed:** added closed H0/H1/H2 configurations, P1/S1 with deterministic S1 expansion,
   fail-closed shared S0 hardening, R1-min policy, zero-network measurement harness, and shared outer-
   ceiling abort propagation through Variant B/C transport calls. Added the V3-047 report and planned
   the deferred owner-scoped C1 contract as V3-052.
3. **Why it changed:** the S0 runtime boundary admitted internal sources, unknown fields, invalid
   confidence/quantity and incomplete/incoherent plans, while the outer ceiling did not abort the
   in-flight provider transport. The three candidates must isolate shared hardening, interpretation-
   contract changes and conservative routing without live claims.
4. **Files changed:** benchmark-local candidate/parser/harness/provider/timeout/types and focused tests;
   `reports/RESOLVER_V3_047_HAIKU_OPTIMIZATION_CANDIDATE_INTEGRATION.md`; `ROADMAP.md`; this handoff.
5. **Verification executed:** typecheck, lint, format check; 11 focused prompt/parser/provider/adapter/
   retrieval/confidence/budget/usage/timeout/telemetry/ledger suites; compiled zero-network harness;
   frozen-manifest hashing; `git diff --check`; canonical `npm run verify`.
6. **Verification result:** focused run passed 11 suites/166 tests; separate provider/timeout run passed
   5 suites/86 tests; typecheck/lint/format/diff and seven-artifact hash checks passed. The harness
   parsed all three candidates, created 1 component/1 plan and rejected unknown root data. Full verify
   passed typecheck/lint/format and ran deeply through green Jest suites, but did not terminate and was
   interrupted with exit 130; it is not claimed green. Provider calls 0; cost USD 0.
7. **Known issues/blockers/residual risks:** canonical completion awaits green CI because local full Jest
   has the known non-termination symptom. Live quality, consistency, latency, usage/cost and query/
   clarification quality remain unverified V3-048 questions. The attempted `npx ts-node` harness command
   found no local package and failed before execution; package manifests remained unchanged, and the
   harness was then compiled with the already-declared TypeScript compiler.
8. **Human review/next steps:** inspect H0/H1/H2 boundaries and abort propagation, require green Verify
   CI, then mark V3-047 `done` in the merge follow-up. Do not run V3-048 or authorize production wiring
   from this offline work.

## RESOLVER-V3-046 — Post-Merge Envelope/Usage/Timeout Correction (Done)

1. **Task ID/status:** `RESOLVER-V3-046` remains `done` after correction on basis
   `d62b77b1c5ae7a08474309e3fb9973c0763361c9`; V3-043/V3-045 remain `done`, V3-047/V3-048
   remain `todo`, and V3-010 remains `blocked`.
2. **What changed:** added a closed Anthropic envelope/usage validator, exactly-once reservation
   release via `finally`, and distinct `wall_clock_ceiling` metadata for both outer wrappers.
3. **Why it changed:** valid JSON with malformed structure could throw before release; absent or
   invalid usage became zero cost; an outer race was incorrectly called a proven abort.
4. **Files changed:** Variant-C provider/types/usage and tests; Representative Hybrid telemetry and
   tests; V3-046 report; Roadmap; this handoff.
5. **Verification executed:** failing focused baseline; focused provider, telemetry, ledger and
   timeout suites; typecheck, lint, format check, full canonical verify, diff/integrity checks.
6. **Verification result:** baseline failed 17/37 tests as expected. Corrected focused regression
   run passed 9 suites/188 tests; the narrower contract run passed 4 suites/52 tests. Typecheck,
   lint, format and diff checks passed. `npm run verify` passed its first three stages and advanced
   deep into full Jest, but stopped emitting output and did not terminate after about 126 seconds;
   it was interrupted with exit 130 and is not claimed green. Calls 0; cost USD 0.
7. **Known issues/blockers/residual risks:** no remote is configured, so remote-tip verification and
   push are unavailable in this checkout. Live effectiveness and latency remain exclusively V3-048
   work; no live claims are made.
8. **Human review/next steps:** review the new contract/taxonomy and require green GitHub CI before
   merge. No production authorization is created.

## RESOLVER-V3-046 — Response Reliability and Latency Remediation (Done)

1. **Task ID/status:** `RESOLVER-V3-046` is `done`; deterministic implementation tasks
   `RESOLVER-V3-043` and `RESOLVER-V3-045` are also `done` under the explicit implementation/live-
   proof separation. Basis `8413c668422cee41c61c0e70d6005366e0f8668e`; no configured remote was
   available to independently fetch the remote tip. V3-048 remains `todo`; V3-010 remains `blocked`.
2. **What changed:** completed fail-closed Variant-C response validation; added transport/timeout/
   HTTP/envelope-JSON/text-block/text-JSON/schema-contract/internal-parser/budget-config taxonomy;
   propagated precise class and retryability through metadata, telemetry and ledger; preserved
   usage/cost for HTTP-200 response failures; documented the 16 historical cases and offline latency
   budget.
3. **Why it changed:** optional component fields could pass validation then throw from `.trim()` or
   `.map()`, and the telemetry wrapper labeled every Variant-C error `network_error`, including eight
   HTTP-200, usage-reported and cost-bearing failures.
4. **Files changed:** Variant-C provider, types, validator and tests; live usage, telemetry and ledger
   metadata/tests; `reports/RESOLVER_V3_046_HAIKU_RESPONSE_RELIABILITY_LATENCY_REMEDIATION.md`,
   `ROADMAP.md`, and this handoff.
5. **Verification executed:** failing focused baseline; focused provider/parser/telemetry/ledger
   suites; typecheck, lint, format check, full `npm run verify`, `git diff --check`; evidence hashes
   and protected-path checks.
6. **Verification result:** failing baseline reproduced five malformed optional-field failures (four
   escaping `TypeError`s and one invalid acceptance). Final focused provider/parser/adapter/report/
   ledger/telemetry run passed 7 suites / 85 tests. Typecheck, lint, format check and diff check
   passed. `npm run verify` reached its full-Jest phase but did not terminate (the known local
   runner symptom) and was interrupted; it is not claimed green. Green GitHub CI is required before
   merge. Provider calls 0; cost USD 0; no live Development/Holdout execution.
7. **Known issues/blockers/residual risks:** frozen evidence cannot distinguish JSON/schema/contract
   subcauses for the eight HTTP-200 rows because it persisted no response/parser signal. No new p95
   is measured or claimed; the 12,000 ms limit is unchanged. V3-047 owns candidate evaluation and
   V3-048 exclusively owns new live reliability/latency evidence and any G2 re-decision.
8. **Human-review/next steps:** review taxonomy compatibility and taskgraph separation, require green
   CI, and merge only after confirming remote base currency. No production-wiring authorization.

## CI-VERIFY-001 — Canonical Verify Runtime Analysis (In Progress)

1. **Task ID/status:** `CI-VERIFY-001`, status **`in_progress`**. Basis: PR #181 is merged at
   `b2b7e196ab992b8b7f46f626cbf991fbff8ae304`; supplied GitHub Verify run #325 succeeded, and an
   independent post-merge review reported no further blocking finding. `RESOLVER-V3-045` and its
   umbrella `RESOLVER-V3-043` deliberately remain **`in_progress`** for the already-documented
   evidence reasons.
2. **What changed:** added a standalone CI runtime analysis and canonical Roadmap state. The Verify
   workflow and Jest/package scripts remain byte-for-byte unchanged because no safe material gain
   was proved in this environment.
3. **Why it changed:** authenticated run #323/#325 logs, step timings, branch-protection settings,
   merge-queue settings, and a real PR candidate run are unavailable from this checkout. Local
   experiments also showed severe shard imbalance and reproduced the non-terminating full Jest
   symptom. Accepting a multi-job design without those missing measurements would violate the
   task's runner-cost and branch-protection acceptance gates.
4. **Files changed:** `reports/CI_VERIFY_001_CANONICAL_VERIFY_RUNTIME_ANALYSIS.md`, `ROADMAP.md`, and
   this handoff only.
5. **Verification executed:** governance/readback searches; base-commit check; focused OFF/USDA
   `--detectOpenHandles`; Jest shard 1 and shard 2 experiments; two-worker experiments with and
   without JSON reporting; YAML readback; documentation-only Git status/stat/name and
   `git diff --check` checks.
6. **Verification result:** focused OFF/USDA passed (2 suites / 14 tests / 12.632 s); shard 1 passed
   (123 suites / 1,215 tests / 83.248 s); shard 2 timed out after 600.023 s and is not claimed green;
   two-worker and full in-band observations did not terminate and are not claimed green. No
   production/provider call occurred. GitHub CI is **not available yet** and this task is not done.
7. **Known issues, blockers, or residual risks:** private GitHub telemetry and configuration cannot
   be read because this checkout has no remote, `gh`, credentials, or public Actions API access.
   The local full-suite noncompletion is narrowed away from the isolated OFF/USDA provider tests
   but not root-caused. No documentation-only classifier or aggregator was merged, so there is no
   risk of their hiding a failure; their required tests remain pending if those designs are revived.
8. **Human-review status / next steps:** publish this evidence-only PR if remote access is restored,
   require its normal Verify check, then continue CI-VERIFY-001 on a follow-up candidate branch with
   authenticated baseline and PR timing. Do not merge a workflow split merely from local timing.

## RESOLVER-V3-045 — Post-Merge Evidence and Reference-Integrity Correction (In Progress)

1. **Task ID/status:** `RESOLVER-V3-045`, status **`in_progress`**; `RESOLVER-V3-043` is also
   **`in_progress`** because its umbrella closeout depended on V3-045's unmeasured final owned
   class. Starting point: PR #180 merge commit
   `2710832d2d5505d514d015c32964fc31ad48a970`; GitHub Verify run #323 was green.
2. **What changed:** added baseline/regression coverage that distinguishes an unchanged fixture
   metric from post-hoc record mutation; made clarification component references and duplicate IDs
   fail closed; enforced exactly one search plan per interpreted component; proved the real adapter
   request omits `normalizedInput` because `BenchmarkCase` has no authoritative value; corrected
   the report and Roadmap evidence/status claims.
3. **Why it changed:** PR #180 described a directly mutated 75% counterfactual as offline measured
   improvement, allowed invalid clarification references to disappear during normalization, and
   inferred real-path `normalizedInput` use from an isolated prompt-helper test.
4. **Files changed:** Variant C determinism and adapter tests, Variant C response validator,
   `reports/RESOLVER_V3_045_HAIKU_INTERPRETATION_DETERMINISM_REMEDIATION.md`, `ROADMAP.md`, and this
   handoff.
5. **Verification executed:** pre-fix focused baseline; prompt/provider/parser/adapter suites;
   V3-043/044/049/050/051 and Representative Hybrid consistency regressions; typecheck, lint,
   format check, full `npm run verify`, `git diff --check`, frozen-evidence manifest SHA-256, and
   Git/path integrity checks.
6. **Verification result:** the pre-fix baseline exited 1 with the two expected reference-integrity
   failures (2 failed, 29 passed); the request-path and metric tests reproduced the other findings.
   Final focused prompt/provider/adapter suites passed (3 suites / 36 tests), and the split
   V3-044 policy/quantity run passed (2 suites / 15 tests). The larger 13-suite regression command
   visibly passed V3-043, V3-049, V3-050 call-path, V3-051 generic safety, and Representative
   Hybrid metrics/protocol suites but did not terminate or print a Jest summary; it was interrupted
   with exit 130 and is not represented as wholly green. `npm run typecheck`, `npm run lint`, and
   `npm run format:check` passed. `npm run verify` passed those same three stages; its full Jest run
   continued through many passing suites and repeated OFF/USDA provider logs but did not terminate
   after more than three minutes, so it was interrupted with exit 130 and is not claimed green.
   `git diff --check`, package/base/path integrity, and all seven frozen-evidence SHA-256 checks
   passed. Green GitHub CI remains required. Evidence status: 68.75% is fixture-executed/measured from frozen records; 75.00% is derived counterfactual; prompt
   effectiveness is live-unverified; no measured offline after-rate exists. Provider calls: 0; cost:
   USD 0.
7. **Known issues, blockers, or residual risks:** V3-045's unchanged acceptance criterion is not yet
   satisfied. Temperature/prompt changes may affect a provider but cannot generate semantic
   after-evidence offline. V3-048 owns controlled live proof; V3-046 retains broader contract and
   reliability scope. V3-010 remains `blocked`. No frozen evidence, corpus, ground truth, metric,
   provider/model, production wiring, UI, journal, Supabase, or DI change occurred.
8. **Human-review status / next steps:** require green GitHub CI, review the evidence correction,
   and merge only if the fail-closed behavior and restored task statuses are accepted. Do not treat
   the 75% counterfactual as a release or production-wiring signal.

---

## RESOLVER-V3-045 — Historical PR #180 Handoff (Superseded by Post-Merge Correction)

1. **Historical status (superseded):** PR #180 marked `RESOLVER-V3-045` and `RESOLVER-V3-043`
   `done`; the post-merge correction above restores both to `in_progress` because the final owned
   class lacks measured after-evidence. Basis: `9eb9639721bc8bd9f2c6f4d2885e2a4e8dcfd7ff`. PR #179 is merged at that
   commit, GitHub Verify run #321 succeeded, and V3-044 is complete.
2. **What changed:** pinned the Variant C request to explicit lowest-temperature sampling; versioned
   and tightened vague-quantity/ordering/ID prompt semantics; deterministically consumes
   `normalizedInput` with conservative input/context canonicalization; validates and normalizes
   response IDs, references, whitespace, and non-priority duplicates; added real-fast-path,
   fake-transport, policy, 16-group metric, and representation regressions.
3. **Why it changed:** prompt v1 allowed the same subjective material quantity to become either a
   clarification or an authoritative numeric assumption, while the request left sampling implicit
   and schema-valid responses retained incidental provider representation variance. The frozen
   owned case exhibited exactly that false-confident divergence.
4. **Files changed:** Variant C live provider, prompt, response validator, their tests, Variant C
   adapter tests, `reports/RESOLVER_V3_045_HAIKU_INTERPRETATION_DETERMINISM_REMEDIATION.md`,
   `ROADMAP.md`, and this handoff.
5. **Verification executed:** focused determinism/provider/adapter suites; V3-043, V3-044,
   V3-049/050/051 and Representative Hybrid regressions; typecheck, lint, format check, full
   `npm run verify`, `git diff --check`, manifest SHA-256 verification, and changed-path integrity
   checks.
6. **Verification result:** the failing baseline exited 1 before implementation. Final focused checks passed. `npm run verify` passed typecheck, lint, and format, then its full
   Jest phase did not terminate after 3 minutes 11 seconds; it was interrupted with exit 130 after
   repeated OFF-provider invocation logs and is not represented as green. The OFF/USDA suites then
   passed in isolation (2 suites / 14 tests / 9.142 s). Green GitHub CI is required before merge.
   The unchanged 16-group calculation reproduces 68.75% outcome/identification agreement. The
   formerly described 75.00% and 3/3 clarification result were produced by direct record mutation
   and are derived counterfactuals, not executed offline after-evidence. Provider calls: 0; cost: USD 0.
7. **Known issues, blockers, or residual risks:** no remote is configured and private HTTPS access
   has no credentials, so remote-tip verification beyond the supplied/current matching merge,
   push, open-PR conflict inspection, and GitHub CI cannot be performed locally. Explicit
   temperature plus prompt constraints reduce but cannot prove remote determinism; V3-048 owns that
   live proof. V3-046 remains `todo`; V3-010 remains `blocked`. No new G2 or production verdict.
8. **Human-review status / next steps:** review the commit and require green GitHub CI before merge.
   V3-048 must later run protocol-v4 live re-evidence; do not infer production authorization from
   this offline remediation.

---

## RESOLVER-V3-044 — Formal Post-Merge Closeout (Done)

1. **Task ID/status:** `RESOLVER-V3-044`, status **`done`**. The complete remediation sequence is
   merged through PRs #176, #177, and #178; the final merge commit is
   `8d779f46b9db751916d3c6fbb5edfbc2d8594d87`.
2. **What changed:** documentation now records the final merged behavior and closes the
   fixture-/offline-based remediation scope as `PASSED`. Material quantity, preparation, or brand
   evidence from either `assumptions` or `uncertainties` can request targeted clarification;
   general or non-material identity assumptions still do not trigger blanket clarification.
   Non-authoritatively resolved components expose no selected candidate, provenance, macros,
   scaling, or `accepted` status, and the unsupported global confidence cutoff remains removed.
3. **Why it changed:** PR #178 and its predecessors are merged, GitHub CI passed, and independent
   post-merge review found no remaining blocking or correction-worthy finding, so the prior
   merge/CI/review-pending documentation was stale.
4. **Files changed:** `ROADMAP.md`,
   `reports/RESOLVER_V3_044_CLARIFICATION_ABSTENTION_CONFIDENCE_REMEDIATION.md`, and this handoff.
   No source, test, corpus fixture, or frozen V3-039 evidence file changed.
5. **Verification executed:** merged source/policy and associated policy, adapter, evaluator, and
   aggregation test readback; Markdown formatting; `git diff --check`; documentation-only
   status/stat/name readbacks; explicit `src/**` and frozen-evidence scope checks; `npm run verify`.
6. **Verification result:** GitHub workflow **Verify**, run #319 for the merged implementation,
   passed. The independent post-merge review reported no blocking or correction-worthy finding.
   Local `npm run verify` passed typecheck, lint, and repository-wide format checking. Jest
   continued through the full suite and reported both `SupabaseEdgeUsdaProvider.test.ts` and
   `SupabaseEdgeOffProvider.test.ts` as passing, then emitted no further output or completion for
   more than 30 seconds; it was manually terminated with exit code 130 rather than represented as a
   green local run. The required documentation readbacks and scope checks passed. Provider calls:
   0; no live run and no new live metrics.
7. **Known issues, blockers, or residual risks:** this fixture/offline verdict is not a new G2
   overall verdict and does not establish live effectiveness. That remains exclusively
   RESOLVER-V3-048's responsibility. Production Wiring is not authorized; RESOLVER-V3-010 remains
   `blocked`. RESOLVER-V3-043 remains `in_progress`; RESOLVER-V3-045 and RESOLVER-V3-046 remain
   `todo`.
8. **Human-review status / next steps:** implementation post-merge review is complete without a
   residual finding. Open this documentation-only closeout PR, require its GitHub CI to pass, and
   then merge it. The next content task is **RESOLVER-V3-045 — Haiku Interpretation Determinism and
   Repeat-Consistency Remediation**.

---

## RESOLVER-V3-044 — Assumption-Only Material Evidence (In Progress)

1. **Task ID/status:** `RESOLVER-V3-044`, status **`in_progress`** pending green GitHub CI. Canonical starting commit: PR #177
   merge commit `b6ff38d0226a748af1076acecc961ffa6b256b13`, confirmed as exact `HEAD` before mutation;
   branch `codex/resolver-v3-044-assumption-only-evidence`.
2. **What changed:** Variant C's evidence-bearing component selection now accepts evidence from
   either `uncertainties` or `assumptions`, while reusing the existing combined categorical
   classifier and selecting only material quantity, preparation, or brand evidence. Added policy
   and real-adapter regressions for all requested assumption-only cases and retained a benign
   resolved-with-assumptions control.
3. **Why it changed:** the prior selector required a populated `uncertainties` array, so a material
   interpretation-created assumption stored only in `assumptions` bypassed clarification even
   though the classifier already understood that text. Source identity cannot validate an assumed
   quantity, preparation, or brand.
4. **Files changed:** `VariantCConfidencePolicy.ts`, its policy tests,
   `ResolverV3VariantCAdapter.test.ts`, the V3-044 report, `ROADMAP.md`, and this handoff.
5. **Verification executed:** four-test failing baseline reproduction; focused policy, adapter,
   evaluator, aggregation, V3-043/V3-049/V3-050/V3-051 regressions; all representative Hybrid V1
   fixture/offline tests; full `npm run verify`; `git diff --check`.
6. **Verification result:** baseline failed 4/28 as expected and all post-fix focused checks passed.
   Full verify passed typecheck, lint, and format, but full Jest did not exit after more than ten
   minutes; the last reported OFF/USDA suites passed, and their isolated rerun passed 14/14 in
   6.949 seconds. No tests were skipped. Provider calls: 0. Benchmark cost: USD 0. No live run
   occurred.
7. **Known issues, blockers, or residual risks:** lexical categorical evidence remains narrow by
   design. General identity assumptions remain an explicit residual policy question and do not
   trigger clarification absent a separately documented semantic rule. No new live metrics are
   claimed. RESOLVER-V3-010 remains blocked.
8. **Human-review status / next steps:** review the focused commit and require green GitHub CI
   before setting V3-044 to `done`. RESOLVER-V3-043 remains
   `in_progress` pending RESOLVER-V3-045; V3-045/V3-046 remain `todo`. No PR or merge was performed
   in this task.

---

## RESOLVER-V3-044 — Post-Merge Fail-Closed Correction (In Progress)

1. **Task ID/status:** `RESOLVER-V3-044`, status **`in_progress`** pending merge, green CI, and an
   independent post-merge review. Canonical local base: PR #176 merge commit `22c47409c2b4ee6dcb53d6ee527fe9c1eb03fd14`.
2. **What changed:** added generalized final-result sanitization for every component not authorized
   as resolved, restored a reachable fail-closed `multiple_candidates` outcome, and removed the
   unsupported global interpretation-confidence cutoff. A follow-up audit additionally downgrades
   unauthorized internal `resolverStatus: accepted` to `rejected`.
3. **Why it changed:** the merged post-retrieval clarification path leaked selected candidate name,
   score, BLS source provenance/source ID, and per-100g macros through the public result despite its
   non-resolution outcome. The first correction still retained an authoritative `accepted` status;
   its strengthened boundary regression failed before this follow-up fix. No canonical
   fixture/corpus derivation supported the global `0.5` rule.
4. **Files changed:** Variant C adapter and confidence policy, their boundary/policy tests, the
   existing V3-044 report, `ROADMAP.md`, and this handoff.
5. **Verification executed:** baseline boundary reproduction; focused adapter/policy/evaluator/
   aggregation tests; representative Hybrid V1 offline and V3-043/V3-049/V3-050/V3-051 regressions;
   full `npm run verify`; `git diff --check` (final results recorded after completion).
6. **Verification result:** focused consumer-boundary and required regression suites passed. The first
   full verify reached `format:check` and identified `ROADMAP.md`; Prettier corrected that documentation
   formatting. The final full verify passed typecheck, lint, and format, but its full Jest phase did not complete because pre-existing OFF edge-provider tests repeatedly awaited unavailable network calls; it was terminated after more than ten minutes. Focused required regressions passed and `git diff --check` was clean.
7. **Known issues, blockers, or residual risks:** checkout has no configured `origin`; an HTTPS
   fetch of the private repository was rejected for missing credentials. Remote freshness, push,
   live CI/merge, and post-merge review therefore require a channel with GitHub credentials.
   Provider calls and benchmark cost: 0. No live run or evidence/corpus mutation.
8. **Human-review status / next steps:** complete full verification, commit, prepare the focused PR,
   then merge only after green CI and no actionable comments; independently audit the merged result
   before returning V3-044 to `done`.

---

## RESOLVER-V3-044 — Clarification, Abstention, and Confidence-Policy Remediation (Done)

1. **Task ID/status:** `RESOLVER-V3-044`, status **`done`**; implementation branch
   `codex/resolver-v3-044-confidence-policy`, based on expected commit
   `4d8f2a3bc5637d15e4ec3325ffb49f2fc78e2b20`.
2. **What changed:** added a Variant-C-only confidence policy that uses component confidence and
   explicit unresolved uncertainty evidence to select targeted clarification, and changes fully
   unresolved but recognized retrieval results from blanket abstention to clarification.
3. **Why it changed:** frozen V3-039 observations showed exact source identity was incorrectly used
   to complete quantity assumptions in both task-owned false-confidence cases. Source evidence
   cannot validate AI-inferred cup size or repetition count.
4. **Files changed:** `ResolverV3VariantCAdapter.ts`, new `VariantCConfidencePolicy.ts`, new policy
   fixture tests, the remediation report, `ROADMAP.md`, and this handoff.
5. **Verification executed:** focused policy/Variant-C/RESOLVER-V3-043 regression tests; typecheck;
   canonical `npm run verify`; SHA-256 before/after checks for all seven V3-039 evidence artifacts;
   scope and diff checks.
6. **Verification result:** all required checks green: 244/244 suites and 2,443/2,443 tests passed. Provider calls: 0. Frozen evidence mutations: 0.
7. **Known issues, blockers, or residual risks:** fixture remediation cannot establish live G2-C
   performance; RESOLVER-V3-048 retains that responsibility. Narrow lexical uncertainty
   classification is versioned and intentionally conservative. RESOLVER-V3-010 remains blocked.
8. **Human-review status / next steps:** publish PR targeting `chore/clean-arch-structure`, allow CI,
   merge only when green, then review the actual merged diff.

---

## RESOLVER-V3-051 (post-merge correction) — Guard Also Fires on Ambiguous-With-Populated-Best (Done)

1. **Task ID/status:** `RESOLVER-V3-051` (correction to the merged PR #174), status **`done`**.
   Base: merge commit `b8eb90cc10e7593df794f1f79ee96eb2ff50d847` (chore/clean-arch-structure tip).
2. **What changed:** `guardAgainstBlsGenericSubstringCollision`
   (`SequentialFoodCatalogResolver.ts`) no longer requires `decision.status === 'accepted'`; it now
   runs whenever `decision.best` is BLS-sourced with `score >= 0.7`, regardless of status. Also
   fixed two classification inconsistencies in `resolverV3051SubstringCollisionAudit.ts`'s own
   `classifyMatch` (unrelated to the production fix): `whole_token` now checks `normalizedName`
   instead of `record.tokens`; a new whole-alias-word exemption avoids mislabeling genuine
   documented synonyms (e.g. "mezcal") as risk. Added 10 new permanent regression tests
   (`ResolverV3051GenericBlsSubstringCollisionSafety.test.ts`, "post-merge review finding" block)
   covering five real, empirically-verified exploit cases (`Anis`, `Mate`, `Tee`, `Fleisch`,
   `Erdbeere`) at both the resolver and `LogFoodFromRawInputUseCase` production boundaries.
3. **Why it changed:** an independent post-merge review (required by this task's own workflow)
   found that `ResolverDecisionPolicy.buildResolverDecision` always sets `best = sorted[0]`
   whenever any candidate exists, regardless of computed status — an ordinary `ambiguous`
   (`MULTIPLE_CLOSE_MATCHES`, a real near-tied second candidate, unrelated to this task) still
   carries a populated, often high-scoring `best`. `LogFoodFromRawInputUseCase.execute()` reads
   `decision.best` and persists it whenever `resolved.score >= 0.7`, **never consulting
   `decision.status`** — so any substring-collision candidate with a coincidentally close
   second-place competitor bypassed the original, status-gated guard entirely and remained fully
   exploitable through production. Verified directly against the merged code before fixing.
4. **Files changed:** `src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts`
   (guard condition), `src/features/nutrition/resolverV3051SubstringCollisionAudit.ts` (classifier
   fixes), `src/features/nutrition/__tests__/ResolverV3051GenericBlsSubstringCollisionSafety.test.ts`
   (+10 tests), `src/features/nutrition/__tests__/ResolverV3051SubstringCollisionAudit.test.ts`
   (updated assertion documenting the one deliberate `"ka"` exception), `ROADMAP.md`,
   `handoffs/latest-handoff.md`, `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md`
   (new §14), `reports/resolver-v3-051-generic-bls-substring-collision-safety.json` (corrected
   metrics + `postMergeCorrection` object).
5. **Verification executed:** full BLS/resolver/benchmark related-suite run (89 suites, 1,034 tests
   green); full deterministic substring-collision audit re-run over the same 13,055-query
   population (3 iterations while correcting the audit's own classifier); `npx tsc --noEmit`;
   `npm run verify` (typecheck + lint + format:check + full test suite); `git diff --check`.
6. **Verification result:** all green. Full repository suite: 243/243 suites, 2,438/2,438 tests
   (+10 tests over the first merged version PR #174's 243/2,428, 0 new suites). Corrected audit:
   **85 changed queries (0.651%)**, not the originally reported 11 (0.084%) — zero winner
   `sourceId` swaps, zero new acceptances, zero `rejected` transitions, unchanged. Zero provider
   calls, zero benchmark cost, `ANTHROPIC_API_KEY` never touched, no production wiring beyond the
   already-approved fix's own scope.
7. **Known issues, blockers, or residual risks:** one documented, deliberate residual case: bare
   query `"ka"` against BLS record `U403100` remains conservatively flagged `ambiguous` even though
   it is technically a whole word within a generated alias — retained deliberately since `"ka"` is
   a 2-character commercial-grading-code fragment, not a real synonym a user would type (unlike the
   6-character `"mezcal"` case, which correctly remains `accepted`). Full detail: report §14.
8. **Human-review status / next steps:** shipped as a follow-up PR on top of the already-merged
   PR #174, same verify → commit → push → PR → CI → merge workflow. No further RESOLVER-V3-047/048
   dependency changes needed (already added in the first version). `RESOLVER-V3-010` remains
   `blocked`.

---

## RESOLVER-V3-051 — Generic BLS Substring-Collision Safety Remediation (Done)

1. **Task ID/status:** `RESOLVER-V3-051`, status **`done`**. Canonical starting commit:
   `fd6efb581046b529d5b517ced0ac981b59696379` (PR #173 / RESOLVER-V3-050 merge commit) — confirmed
   identical to the live `origin/chore/clean-arch-structure` tip before any change, no later
   commits to inspect. Branch: `claude/resolver-v3-051-bls-safety-z7ma52`.
2. **What changed:** added `hasBlsGenericSubstringOnlyIdentity` (`BlsLookupEngine.ts`) — a
   categorical, stage-agnostic check that disqualifies a BLS candidate from confident acceptance
   when it has no genuine exact/whole-alias identity for the query, the query is not a whole-token
   match against the candidate's own name, and the query is still a textual substring fragment of
   that name. Applied via a new shared helper, `guardAgainstBlsGenericSubstringCollision`
   (`SequentialFoodCatalogResolver.ts`), at **both** places a BLS candidate can become an `accepted`
   decision — the dedicated BLS generic-truth fast-path gate and the generic multi-source fallback
   decision (a real threshold-bypass gap was found between the two: the gate's own `0.85`
   `ambiguous`-inputType threshold is higher than the fallback's `0.75` accept threshold, so a
   fix applied only inside the gate would have been silently bypassable). New reason code
   `BLS_GENERIC_SUBSTRING_COLLISION_RISK`; extended `ResolverDebugTypes.DecisionInfo`'s reason
   union. Added a full deterministic substring-collision audit module
   (`resolverV3051SubstringCollisionAudit.ts`) and two new permanent test files (37 tests total).
   Updated one stale test in `RepresentativeHybridV1ThreeArmBoundary.test.ts` that had encoded the
   pre-fix defective behavior as expected (same precedent as RESOLVER-V3-043/049/050), with
   historical context preserved in comments.
3. **Why it changed:** RESOLVER-V3-050's own residual-risk finding (§11 of its report) surfaced a
   real, pre-existing production defect: `DeterministicFoodParser` parses `"Ein Snack"` to
   `"snack"`, which the BLS fast path then substring/token-matches against a single, far more
   specific real BLS record (`X5A1030`, "Kichererbsensnack gebacken", 231 kcal) and confidently
   accepts — violating `RH-RES-VAGUE-DEV-004`'s `abstention_expected` ground truth. Root-caused to
   two independent, stage-agnostic mechanisms (`BlsLookupEngine.calculateTokenScore`'s symmetric
   substring partial-match credit, and `findIncludesMatches`'s alias-substring containment one
   stage later — proven a single-stage fix insufficient by direct calculation) plus the resolver
   threshold-bypass gap described above.
4. **Files changed:** `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts`
   (new exported `hasBlsGenericSubstringOnlyIdentity`),
   `src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts` (new shared guard,
   applied at both threshold sites), `src/features/nutrition/application/services/ResolverDebugTypes.ts`
   (extended reason union), `src/features/nutrition/resolverV3051SubstringCollisionAudit.ts` (new —
   audit module), `src/features/nutrition/__tests__/ResolverV3051GenericBlsSubstringCollisionSafety.test.ts`
   (new, 29 tests), `src/features/nutrition/__tests__/ResolverV3051SubstringCollisionAudit.test.ts`
   (new, 8 tests), `src/features/nutrition/benchmark/representativeHybridV1/__tests__/RepresentativeHybridV1ThreeArmBoundary.test.ts`
   (1 stale assertion updated + historical context preserved), `ROADMAP.md`,
   `handoffs/latest-handoff.md`, `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md`,
   `reports/resolver-v3-051-generic-bls-substring-collision-safety.json`. No `logs/resolver-v3-039-*`
   frozen evidence file, no corpus fixture file, no BLS workbook or generated BLS artifact, no
   `DeterministicFoodParser` file touched.
5. **Verification executed:** new regression test files (37 tests); full deterministic
   substring-collision audit over 13,055 unique queries (real BLS population + frozen 104-case
   corpus); full BLS/resolver/benchmark related-suite run (88 suites, 1,016 tests green); `npx tsc
--noEmit`; `npm run verify` (typecheck + lint + format:check + full test suite); `git diff
--check`.
6. **Verification result:** all green. Full repository suite: 243/243 suites, 2,428/2,428 tests
   (baseline at the canonical commit was 241 suites/2,391 tests, per RESOLVER-V3-050's own reported
   final count — this task net-added 2 new suites and 37 new tests). Substring-collision audit over
   13,055 unique queries: exactly 11 changed outcomes (0.084%), all `accepted` → `ambiguous`, zero
   changed to/from `rejected`, zero winner `sourceId` swaps, zero new acceptances anywhere. Zero
   provider calls, zero benchmark cost, `ANTHROPIC_API_KEY` never touched, no Development/Holdout
   rerun, no BLS workbook/generated-artifact/Haiku-model-policy change, no production wiring.
7. **Known issues, blockers, or residual risks:** the safe `sub_token_substring_query_specific`
   direction (380 queries) and `no_relation` matches (479 accepted-before queries) were not
   individually reviewed for unrelated correctness issues — out of this task's declared
   substring-collision-safety scope. The 13,055-query audit population, while large and
   reproducible, is not exhaustive of every possible user phrasing; a future not-yet-identified
   collision could surface, but the fix is general (not a per-case list) so any such instance would
   be caught automatically. Full detail: `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md`
   / `reports/resolver-v3-051-generic-bls-substring-collision-safety.json`.
8. **Human-review status / next steps:** `RESOLVER-V3-047`/`RESOLVER-V3-048`'s `Depends on` lists
   updated to add `RESOLVER-V3-051`. `RESOLVER-V3-043` remains `in_progress` (this task does not
   touch its outstanding RESOLVER-V3-044/045 AI-routed scope). `RESOLVER-V3-044`/`045` remain
   `todo`. `RESOLVER-V3-010` remains `blocked`. PR opened via GitHub MCP for post-merge CI/review.

---

## RESOLVER-V3-050 — Benchmark Production-Call-Path Fidelity (Done)

1. **Task ID/status:** `RESOLVER-V3-050`, status **`done`**. Canonical starting commit:
   `04e742e751b3622901cfe57d474e2fe6c6b9ca84` (PR #172 / RESOLVER-V3-049 merge commit) — confirmed
   identical to the live `origin/chore/clean-arch-structure` tip before any change, no later
   commits to inspect. Worktree/branch: `D:\Workspaces_VSCode\HealthApp-resolver-v3-050`,
   `fix/resolver-v3-050-benchmark-production-call-path-fidelity`.
2. **What changed:** `ResolverV3VariantAAdapter.runVariantACase()` now calls the real, unmodified
   `DeterministicFoodParser.parse(rawInput)` first and sends `normalizeText(parsed.name)` to the
   resolver, instead of `normalizeText(rawInput)` directly — reproducing
   `LogFoodFromRawInputUseCase.resolveCanonicalFood()`'s exact production call order. `raw` and
   `inputType` were already production-faithful and are unchanged. `VariantARawResult` gained two
   new provenance fields (`originalRawInput`, `parserResult`). Added permanent regression tests
   (target case + quantity/count-prefixed inputs + no-op controls) and a complete offline impact
   analysis over the full 104-case frozen representative corpus. Updated two stale tests in
   `RepresentativeHybridV1ThreeArmBoundary.test.ts` that had asserted the old, defective boundary's
   behavior as expected, plus fixed two other test files whose hand-built `VariantARawResult`
   fixtures needed the two new required fields. Reconciled a PR #172/RESOLVER-V3-049 test-count
   documentation discrepancy (see item 5 in that task's own handoff entry below, corrected in
   place).
3. **Why it changed:** RESOLVER-V3-043 Phase A's diagnosis found `RH-RES-SIMPLE-DEV-003` ("Ein
   Apfel") was only false-confident because the benchmark adapter skipped `DeterministicFoodParser`,
   spuriously colliding "ein apfel" with an unrelated BLS pastry record's normalized name
   (`Y845242`, "Apfelküchlein (Apfelringe im Milchbackteig) gebraten",
   `"...kuechl[ein] [apfel]ringe..."`) — a call path production never takes. With the real parser in
   the loop, production correctly resolves an honest `ambiguous`. This task made all future
   benchmark fast-path execution reproduce that real call order.
4. **Files changed:** `src/features/nutrition/benchmark/ResolverV3VariantAAdapter.ts` (the fix),
   `src/features/nutrition/benchmark/resolverV3050OfflineImpactAnalysis.ts` (new — offline impact
   analysis logic), `src/features/nutrition/benchmark/__tests__/ResolverV3050BenchmarkProductionCallPathFidelity.test.ts`
   (new, 16 tests), `src/features/nutrition/benchmark/__tests__/ResolverV3050OfflineImpactAnalysis.test.ts`
   (new, 6 tests), `src/features/nutrition/benchmark/representativeHybridV1/__tests__/RepresentativeHybridV1ThreeArmBoundary.test.ts`
   (2 stale assertions updated + 1 new residual-risk regression test), `src/features/nutrition/benchmark/__tests__/evaluateVariantACase.test.ts`
   and `src/features/nutrition/benchmark/__tests__/buildResolverV3VariantAReports.test.ts` (fixture
   literals updated for the two new `VariantARawResult` fields — type-only fix, no assertion
   changed), `ROADMAP.md`, `handoffs/latest-handoff.md`,
   `reports/RESOLVER_V3_050_BENCHMARK_PRODUCTION_CALL_PATH_FIDELITY.md`,
   `reports/resolver-v3-050-benchmark-production-call-path-fidelity.json`. No `logs/resolver-v3-039-*`
   frozen evidence file, no corpus fixture file, no production `application/**`/`infrastructure/**`
   file touched.
5. **Verification executed:** new regression test files (22 tests); full offline impact analysis (6
   tests, 104 corpus cases); full related-suite run (representativeHybridV1 + Variant A/B/C adapters
   - DeterministicFoodParser + LogFoodFromRawInputUseCase, 361/361 tests green); `npx tsc --noEmit`;
     `npm run verify`; `git diff --check`; `git diff --stat` confirming zero bytes changed under
     `logs/**` or any corpus fixture file; full repository suite (`npm run test`).
6. **Verification result:** all green. Full repository suite: 241/241 suites, 2,391/2,391 tests
   (baseline at the canonical commit was 239 suites/2,368 tests — this task net-added 2 new suites
   and 23 new tests). Offline impact analysis over 104 corpus cases (80 development + 24 holdout):
   44 changed inputs, 13 changed outcomes (1 `accepted`→`ambiguous`, 5 `rejected`→`accepted`, 11
   winner changes, 2 false-confidence changes). Zero provider calls, zero benchmark cost,
   `ANTHROPIC_API_KEY` never touched, no Development/Holdout rerun, no BLS/model-policy/production
   change.
7. **Known issues, blockers, or residual risks:** the corrected boundary newly surfaces a
   pre-existing, previously-invisible BLS fast-path substring-collision false confidence for
   `RH-RES-VAGUE-DEV-004` ("Ein Snack" → "snack" → substring-matches "Kichererbsensnack gebacken",
   confidently accepted despite `abstention_expected` ground truth) — real production behavior
   today, not introduced by this task and not fixed by it (out of scope: no resolver/BLS/parser
   change). Flagged for a future BLS generic fast-path remediation task. Full detail:
   `reports/RESOLVER_V3_050_BENCHMARK_PRODUCTION_CALL_PATH_FIDELITY.md` §11.
8. **Human-review status / next steps:** PR opened via GitHub MCP, CI watched, merged when green,
   independent post-merge review performed (see below for exact PR/merge/review outcome once
   available). RESOLVER-V3-043 remains `in_progress` (RESOLVER-V3-044/045 still outstanding).
   RESOLVER-V3-010 remains `blocked`.

## RESOLVER-V3-049 — BLS Generic Fast-Path Ambiguity Policy Remediation (Done)

1. **Task ID/status:** `RESOLVER-V3-049`, status **`done`**. Canonical starting commit:
   `740af0a6a36ba17d43fc449b1b9d61e760621dab` (PR #171 / RESOLVER-V3-043 Phase A merge commit) —
   confirmed identical to the live `origin/chore/clean-arch-structure` tip before any change.
   Worktree/branch: `D:\Workspaces_VSCode\HealthApp-resolver-v3-049`,
   `fix/resolver-v3-049-bls-fast-path-ambiguity-policy`.
2. **What changed:** Fixed the two independent BLS generic fast-path defects RESOLVER-V3-043 Phase
   A diagnosed but deferred: (a) search-stage visibility — a single Stage-1 exact match no longer
   hides materially plausible, same-family preparation-state siblings
   (`BlsLookupEngine.findFamilyExtensionMatches()`); (b) resolver acceptance — the BLS fast-path no
   longer silently accepts a candidate when competing BLS candidates disagree on preparation state
   and diverge materially in kcal (`hasBlsGenericPreparationStateConflict()`), instead returning an
   honest `ambiguous` decision with `best`/`secondBest` explicitly cleared. Also corrected a
   dependency-cycle governance defect: RESOLVER-V3-049/050 previously declared `Depends on:
RESOLVER-V3-043`, which is circular (V3-043 cannot close until V3-049/050 close); both now
   depend on RESOLVER-V3-041 only, with an explicit "prerequisite implementation baseline" note
   pointing at V3-043 Phase A's merge commit. RESOLVER-V3-043 gained an explicit
   umbrella-completion statement.
3. **Why it changed:** RESOLVER-V3-043 Phase A's diagnosis found three real, production-reachable
   false-confidence cases (`RH-RES-PREPARATION-DEV-002`/`004`, `RH-RES-PREPARATION-HOLD-002` —
   "Haferflocken", "Pommes frites", "Pommes") that reusing the existing `DELTA_THRESHOLD=0.08`
   would not catch (real gaps 0.107/0.095, both exceed it) and that inventing a new,
   case-tuned delta would be a reverse-engineered threshold — explicitly forbidden. This task
   derived a generalized, source-grounded policy instead, per RESOLVER-V3-041's required follow-up
   chain.
4. **Files changed:** `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts`,
   `src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts`,
   `src/features/nutrition/application/services/ResolverDebugTypes.ts` (new debug-reason literal),
   `src/features/nutrition/__tests__/ResolverV3049BlsGenericFastPathAmbiguityPolicy.test.ts` (new,
   45 tests), `src/features/nutrition/__tests__/BlsPlainGenericReachability.test.ts` (1 stale
   assertion updated with historical context, matching RESOLVER-V3-043 Phase A's own precedent),
   `src/features/nutrition/__tests__/ResolverV3043BroetchenFalseConfidenceRemediation.test.ts` (1
   assertion updated to accept the new, more honest outcome for bare "Brötchen"), `ROADMAP.md`,
   `reports/RESOLVER_V3_049_BLS_GENERIC_FAST_PATH_AMBIGUITY_POLICY.md`,
   `reports/resolver-v3-049-bls-generic-fast-path-ambiguity-policy.json`. No BLS workbook, no
   generated BLS runtime artifact, no `logs/resolver-v3-039-*` frozen evidence file touched.
5. **Verification executed:** targeted new test file (45 tests); full existing BLS/resolver test
   suite (originally recorded as `--testPathPattern="Bls|Resolver|resolver"`, 246 suites / 2,377
   tests — **correction, RESOLVER-V3-050, 2026-07-25**: this count is an aggregate of overlapping
   targeted `jest` invocations, not that single command's literal output; re-running the literal
   command at this task's canonical base commit produces 57 suites/719 tests, and the true
   single-command full repository suite at that commit produces 239 suites/2,368 tests — see
   `reports/RESOLVER_V3_050_BENCHMARK_PRODUCTION_CALL_PATH_FIDELITY.md` §13); a reproducible
   14,690-query deterministic offline blast-radius sweep run before and after this task's code
   changes (zero provider calls, OFF/USDA stubbed, no AI source configured); `npx tsc --noEmit`;
   `npm run verify`; `git diff --check`; `git diff --stat` confirming zero bytes changed under
   `logs/**` or the generated BLS artifact.
6. **Verification result:** all green (see item 5's correction note on the exact suite/test count
   labeling). 2 pre-existing
   assertions intentionally updated, not new failures suppressed). Blast radius: exactly 73 of
   14,690 queries (0.50%) changed `accepted` → `ambiguous`; zero changed to/from `rejected`; zero
   winner `sourceId` swaps within `accepted`. All required positive controls verified correct
   (D771900/Brötchen, qualified Brötchen Blätterteig, Quark, Magerquark, Rührei, Eier, bare Speck,
   and RESOLVER-V2-010's qualified Bauchspeck/Schinkenspeck/Rückenspeck sub-terms). Zero provider
   calls, zero benchmark cost, `ANTHROPIC_API_KEY` never touched.
7. **Known issues, blockers, or residual risks:** the materiality floor
   (`MATERIALITY_KCAL_RATIO=1.4`) and the Stage-2-ranked-token-override exclusion are principled but
   necessarily judgment-based boundaries; the materiality safe window `(1.31, 1.65]` is real but not
   wide, and future BLS data changes could produce a new case landing on the wrong side — re-running
   this task's blast-radius sweep after any future BLS artifact update is recommended. 7 of the 73
   changed population queries are single-token artifacts of the sweep's own construction (e.g.
   "the", "fuerst", "pina" — fragments of compound/foreign names), not realistic standalone user
   queries. Full detail in the report's §11.
8. **Human-review status / next steps:** PR opened via GitHub MCP, CI watched, merged when green,
   independent post-merge review performed (see below for exact PR/merge/review outcome once
   available). RESOLVER-V3-043 remains `in_progress` (RESOLVER-V3-044/045/050 still outstanding).
   RESOLVER-V3-010 remains `blocked`.

## RESOLVER-V3-043 — Unsafe Fast-Path and False-Confidence Remediation (Phase A: D771900) (In Progress)

- **Task ID/status:** `RESOLVER-V3-043`, status **`in_progress`** — Phase A (the `RH-RES-DACH-DEV-006`
  / D771900 fix) is complete and merged. Not `done`: the task's own acceptance criterion names all
  8 flagged false-confidence case IDs, and only 1 of the 8 is fixed here — the other 7 have explicit
  successor-task ownership (RESOLVER-V3-044, RESOLVER-V3-045, RESOLVER-V3-049, RESOLVER-V3-050), not
  a silent non-fix.
- **Canonical starting commit:** `271cadca593b339ef12a30b8db6f2efccde340fe` (PR #170 /
  RESOLVER-V3-041 merge commit) — confirmed as the exact live `origin/chore/clean-arch-structure`
  tip before any change.
- **Worktree/branch:** `D:\Workspaces_VSCode\HealthApp-resolver-v3-043`,
  `fix/resolver-v3-043-false-confidence-remediation`, created directly from the explicit remote SHA
  above — never from the noncanonical `claude/resolver-v3-041-haiku-binding-a1glb1` side branch
  (which was left untouched: not reset, rebased, mutated, or deleted).
- **Diagnosis-driven scope correction:** all 8 flagged Variant-C false-confidence case IDs (7
  Development + 1 Holdout, extracted directly from the frozen
  `logs/resolver-v3-039-controlled-representative-live-evidence.json`, not copied from any prior
  report) were independently root-caused against the real, current, merged production code before
  any fix was written. Result: only 4 are genuine BLS-fast-path defects (this task's declared
  subsystem); 3 are purely AI-routed (BLS fast path returns zero candidates, confirmed empirically —
  belong to RESOLVER-V3-044/045); 1 is a benchmark-harness fidelity artifact that does not reproduce
  in real production once `DeterministicFoodParser` runs first (belongs to the new
  RESOLVER-V3-050). Of the 4 genuine fast-path cases, only the one this task's acceptance criterion
  names by ID (`RH-RES-DACH-DEV-006`/D771900) was fixed; the other 3 share a defect class that could
  not be fixed safely within this phase without either an untested, reverse-engineered ambiguity
  threshold or a broad, unreviewed change to `BlsLookupEngine.search()`'s stage short-circuit
  behavior — both explicitly forbidden by this task's own instructions. They are owned by the new
  RESOLVER-V3-049 instead. Full evidence:
  `reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md`.
- **Root cause (D771900):** `BlsCompactRuntimeAdapter.ts`'s `normalizeBlsRuntimeText()` strips all
  parenthetical content, so `D771900` ("Brötchen (Blätterteig)", a puff-pastry roll) falsely claims
  the bare, everyday word "Brötchen" as an exact alias. `BlsLookupEngine.findExactMatches()` returns
  immediately on any exact-alias hit, pre-empting 81 more-plausible "-brötchen" candidates before
  they are ever scored. Removing only the generated exact alias would not have been sufficient
  (independently verified before implementing): the record's own tokens and its qualified
  "broetchen blaetterteig" alias still contain "broetchen" as a component/substring, reachable via
  includes/token matching.
- **Fix implemented:** `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID` (`BlsCompactRuntimeAdapter.ts`),
  a source-ID-scoped negative-compatibility contract mirroring the existing (positive)
  `COMPATIBILITY_ALIASES_BY_SOURCE_ID` mechanism, threaded onto `BlsFoodRecord` as
  `incompatibleGenericQueries` and enforced by `BlsLookupEngine` at every matching stage (exact,
  includes, token, ranked-token) — zero blast radius beyond the one named record.
- **Post-fix behavior (empirically verified):** bare `Brötchen` never returns D771900 as a
  candidate at all (previously `accepted`, `D771900`, score 1); now resolves an honest `ambiguous`
  among several real "-brötchen" records (`MULTIPLE_CLOSE_MATCHES`). Qualified `Brötchen
Blätterteig` / `Brötchen (Blätterteig)` are unaffected — still `accepted`, `D771900`, score 1. The
  historical `RV3-0011` case in the retired 14-case smoke corpus is also fixed end-to-end
  (`falseConfidentCases` no longer contains it). Production-call boundary confirmed: `'Brötchen'`,
  `'Ein Brötchen'`, `'200g Brötchen'` all parse to the same food name via the real, unduplicated
  `DeterministicFoodParser`, and none ever produces a D771900-sourced result.
- **Tests:** 19 new focused tests
  (`src/features/nutrition/__tests__/ResolverV3043BroetchenFalseConfidenceRemediation.test.ts`)
  covering the adapter, BLS lookup, resolver, and production-call boundaries, plus unaffected-record
  regression for `Apfelstrudel`/`Apfeltasche`/`Hörnchen`/`Mohnschnecken (Blätterteig)`. Two
  pre-existing tests that had asserted the _old, defective_ behavior as expected (regression
  fixtures proving the historical defect, not desired-behavior tests) were updated with the
  corrected reality and historical context preserved in comments:
  `RepresentativeHybridV1ThreeArmBoundary.test.ts`, `runResolverV3VariantABenchmark.test.ts`.
- **Verification:** `npm run typecheck` clean; targeted BLS/resolver suite green; full repository
  suite (`npm run test`) 238/238 suites, 2335/2335 tests green — zero regressions beyond the two
  intentionally-updated stale-defect-assertion tests.
- **Successor tasks added:** RESOLVER-V3-049 (BLS Generic Fast-Path Ambiguity Policy Remediation —
  owns `RH-RES-PREPARATION-DEV-002`, `RH-RES-PREPARATION-DEV-004`, `RH-RES-PREPARATION-HOLD-002`),
  RESOLVER-V3-050 (Benchmark Production-Call-Path Fidelity — owns `RH-RES-SIMPLE-DEV-003`); both
  `todo`. RESOLVER-V3-044/045 updated with explicit ownership of their 3 AI-routed case IDs.
  RESOLVER-V3-047/048 dependencies updated to require RESOLVER-V3-049/050.
- **Constraints honored:** zero Anthropic/provider calls; zero benchmark cost; Development/Holdout
  not re-run; no frozen RESOLVER-V3-039 evidence file touched; no BLS source workbook or generated
  artifact modified; no historical V3-024/038/039/041/042 report rewritten; no production
  quantity/article stripping added (production already had it via `DeterministicFoodParser`); no
  RESOLVER-V3-044/045/046/047/048 work started; no production wiring; Haiku-only model policy
  unchanged; `RESOLVER-V3-010` remains `blocked`.
- **Report path:** `reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md` (this
  supersedes the review-only diagnosis of the same name that existed only on the noncanonical,
  unmerged `claude/resolver-v3-041-haiku-binding-a1glb1` branch — that branch was left untouched).
- **Files changed:** `src/features/nutrition/infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter.ts`,
  `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts`,
  `src/features/nutrition/__tests__/ResolverV3043BroetchenFalseConfidenceRemediation.test.ts` (new),
  `src/features/nutrition/benchmark/representativeHybridV1/__tests__/RepresentativeHybridV1ThreeArmBoundary.test.ts`,
  `src/features/nutrition/benchmark/__tests__/runResolverV3VariantABenchmark.test.ts`,
  `reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md` (new), `ROADMAP.md`,
  `handoffs/latest-handoff.md`. No BLS data, feature flag, migration, RPC, Supabase adapter, or
  package/dependency file was changed.

## RESOLVER-V3-041 — Representative Hybrid Gate Re-Decision After Controlled Live Evidence (Done)

- **Task ID/status:** `RESOLVER-V3-041`, status **`done`** — the formal gate re-decision is
  complete. `done` here means only that the re-decision itself is complete; it does **not** mean
  the Hybrid production gate passed.
- **What changed:** produced the formal, evidence-cited G2 gate re-decision required after
  RESOLVER-V3-039 (live evidence) and RESOLVER-V3-042 (evaluator fidelity audit), both `done`;
  updated `ROADMAP.md` (RESOLVER-V3-041 → `done`, six new successor tasks RESOLVER-V3-043 through
  RESOLVER-V3-048 added, RESOLVER-V3-010's dependency list updated); recorded the binding
  Haiku-4.5-only production-model policy.
- **Why it changed:** RESOLVER-V3-039 collected real live evidence but did not itself decide the
  gate; RESOLVER-V3-042 found and fixed four evaluator-fidelity defects (G2-A, G2-C, G2-E, G2-G)
  but explicitly did not perform this re-decision either. This task was the first to weigh the
  complete, corrected evidence against the binding `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11
  gate rule and the predeclared cost/latency policy, and to record an explicit product-owner
  model-selection decision.
- **Canonical starting commit:** `e5a3a24f97ddb8e56fe19f5f98cff6cf90335a65` (PR #169 / RESOLVER-V3-042
  merge commit) — confirmed as the exact live `origin/chore/clean-arch-structure` tip before any
  change; the branch had not advanced.
- **Worktree/branch:** `D:\Workspaces_VSCode\HealthApp-resolver-v3-041`,
  `docs/resolver-v3-041-formal-gate-redecision`, created directly from the explicit remote SHA
  above (never from a local side branch).
- **Formal overall verdict:** **`RESOLVER_V3_G2_NOT_PASSED`**. Per-dimension: G2-A `indeterminate`;
  G2-B `failed` (hard criterion — Development Variant C false-confidence rate 6.48% not strictly
  below Variant A's 5.00%; controlling case `RH-RES-DACH-DEV-006`, "Brötchen"/BLS `D771900`); G2-C
  `requires_human_judgment` (explicit adverse judgment — abstention correctness only ~4.65%/5.88%);
  G2-D `failed` (predeclared policy — Holdout AI-routed p95 12,417.52 ms and all-attempts p95
  12,428.31 ms both exceed the 12,000 ms ceiling); G2-E `not_evaluable` (unchanged after
  RESOLVER-V3-042's partition-scoping fix); G2-F `passed` (zero unbacked numeric results, zero
  AI-nutrient-became-authority); G2-G `requires_human_judgment` (explicit adverse judgment — real
  −31.25pp Variant C repeat-consistency gap vs. Variant A's structural ~100% baseline).
  `productionWiringAuthorized: false`.
- **RESOLVER-V3-010 status:** remains `blocked`. Its `ROADMAP.md` dependency list is updated to add
  RESOLVER-V3-041 and RESOLVER-V3-048; it may only unblock once RESOLVER-V3-048 produces new,
  complete, Haiku-only live evidence that genuinely passes every mandatory G2 dimension.
- **Haiku model policy:** Claude Haiku 4.5 recorded as the sole locked production-model candidate
  (`HAIKU_4_5_LOCKED_AS_PRODUCTION_CANDIDATE`; provider `anthropic`, alias `claude-haiku-4-5`,
  snapshot `claude-haiku-4-5-20251001`) — a product-owner policy decision, not derived from
  benchmark evidence. Sonnet is not in the current critical path; no larger-model fallback is
  authorized; this `NOT_PASSED` verdict is not treated as proof Haiku itself is unsuitable.
- **Successor tasks added:** RESOLVER-V3-043 (Unsafe Fast-Path and False-Confidence Remediation),
  RESOLVER-V3-044 (Clarification, Abstention, and Confidence-Policy Remediation), RESOLVER-V3-045
  (Haiku Interpretation Determinism and Repeat-Consistency Remediation), RESOLVER-V3-046 (Haiku
  Response Contract, Parsing, Reliability, Error Taxonomy, and Latency Remediation),
  RESOLVER-V3-047 (Haiku Optimization Candidate Evaluation), RESOLVER-V3-048 (Protocol-v4 Evidence
  Contract and Controlled Haiku Live Re-Evidence) — all `todo`, none started or implemented by this
  task. Grouped as Hybrid production readiness, project priority **P0**.
- **Evidence integrity:** all seven RESOLVER-V3-039 evidence files confirmed byte-identical
  (canonical Git-blob SHA-256, matching `reports/resolver-v3-039-controlled-live-evidence-manifest.json`
  exactly) both before this task's first edit and immediately before commit — zero mutation.
- **Report paths:** `reports/RESOLVER_V3_041_REPRESENTATIVE_HYBRID_GATE_REDECISION.md` (full
  evidence-cited per-dimension analysis) and
  `reports/resolver-v3-041-representative-hybrid-gate-redecision.json` (machine-readable companion,
  verified to agree with the Markdown exactly).
- **Files changed:** `reports/RESOLVER_V3_041_REPRESENTATIVE_HYBRID_GATE_REDECISION.md` (new),
  `reports/resolver-v3-041-representative-hybrid-gate-redecision.json` (new), `ROADMAP.md`,
  `handoffs/latest-handoff.md`. No `src/**`, BLS data, feature flag, migration, RPC, Supabase
  adapter, or package/dependency file was changed.
- **Verification executed:** documentation-only change (VERIFY.md Category 1/2) —
  `git --no-pager status --short` / `--diff --stat` / `--diff --name-only`; JSON structural
  validation (`node -e "require(...)"`); Markdown/JSON verdict-parity check; evidence SHA-256
  re-verification; `git diff --check`; `npm run verify` additionally run under portable Node
  `v20.20.2` for extra confidence.
- **Verification result:** see the commit's own verification log below this entry for the exact
  `npm run verify` outcome; evidence hashes confirmed unchanged; changed-file list confirmed to
  match exactly the expected set.
- **Provider calls made:** 0. **Additional benchmark cost:** USD 0.00. `ANTHROPIC_API_KEY`
  presence checked as boolean only (absent); never printed, inspected, copied, requested, or
  persisted.
- **Known issues/residual risks:** G2-C/G2-G's `requires_human_judgment` verdicts carry this task's
  own explicit adverse judgment, not a numeric threshold — a future maintainer could reasonably
  weigh the same evidence differently; RESOLVER-V3-048 remains the actual path to a decidable,
  passing re-run. G2-E's `not_evaluable` status rests on the evaluator's strict any-unknown-record
  rule even though the cost policy text allows discretion for a small disclosed minority — this
  task did not exercise that discretion (see report §9) since doing so would require code changes
  out of this task's scope.
- **Human-review status/next steps:** PR opened for CI review; see the PR/merge/post-merge-review
  status recorded below once available. Next work should proceed with RESOLVER-V3-043 through
  RESOLVER-V3-047 (Haiku remediation, no live calls) before RESOLVER-V3-048 (the first task in this
  chain authorized to make live provider calls, under its own separate budget authorization).

---

## RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence Closeout (Done)

- **Task ID/status:** `RESOLVER-V3-039`, status **`done`** — evidence-collection objective complete
  and validated. `done` here means only that; it does **not** mean the Hybrid production gate
  passed (two of seven stored gate dimensions are `failed`, one is `not_evaluable` — see below).
- **Execution commit:** `a67a4d051fd1616cad3a59428b117a717d84f002` (worktree
  `HealthApp-resolver-v3-039-v3-lf`, branch `resolver-v3-039-v3-live-evidence-lf`). Confirmed as
  this closeout's `HEAD` and as the live remote default-branch (`chore/clean-arch-structure`) tip
  before any staging occurred — no drift.
- **Protocol version:** `resolver-representative-hybrid-live-protocol-v3`. `executionTreeHash`
  `9697e45b149ba2a90115e388a5caeca173aab76c8f5f88f31c5bfc1e136e235f`; `corpusHash`
  `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a`; `sourceManifestHash`
  `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52`; `planHash`
  `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e`.
- **Development:** ran exactly once, exit code 0, finished `2026-07-24T15:04:00.4650109Z`; 205
  planned calls (194 completed, 11 terminal failures, 0 indeterminate).
- **Holdout:** ran exactly once, exit code 0, finished `2026-07-24T17:32:10.7873322Z`, only after
  the Development checkpoint existed and was validated; 58 planned calls (53 completed, 5 terminal
  failures, 0 indeterminate).
- **Call totals:** 263 planned paid calls total (108 Variant B Development / 28 Holdout; 97 Variant
  C AI-routed Development / 30 Holdout; 12 Variant C fast-path never billed); 247 completed, 16
  terminal failures, 0 indeterminate, 0 retries; ledger 789 rows = exactly 263 × 3, 0 unknown/
  duplicate call IDs.
- **Evidence paths (all 7 force-added past the repository's blanket `logs/` ignore):**
  `logs/resolver-v3-039-call-ledger.jsonl`,
  `logs/resolver-v3-039-development-checkpoint.json`,
  `logs/resolver-v3-039-development-diagnostic.json`,
  `logs/resolver-v3-039-development-diagnostic.md`,
  `logs/resolver-v3-039-holdout-checkpoint.json`,
  `logs/resolver-v3-039-controlled-representative-live-evidence.json`,
  `logs/resolver-v3-039-controlled-representative-live-evidence.md`.
- **Manifest/report paths:**
  `reports/resolver-v3-039-controlled-live-evidence-manifest.json` (deterministic SHA-256/byte-size/
  role manifest) and `reports/RESOLVER_V3_039_CONTROLLED_LIVE_EVIDENCE_CLOSEOUT.md` (full closeout
  report — protocol v1/v2 invalidation history, terminal-failure classification, complete call
  accounting, credential-handling statement, known limitations).
- **Known-cost subtotal / unknown total-cost status:** provider-reported known-cost subtotal **USD
  0.937166** (461,021 input / 95,229 output tokens across 263 records; 8 records have unknown
  usage/cost, never converted to zero). **Complete provider API cost remains unknown** — no external
  Anthropic Console billing evidence has been supplied for this closeout, and this figure excludes
  any unrelated Claude Code/API spending from earlier development sessions on this repository.
  Cumulative reservation: 263 calls / USD 4.174336 (task ceiling, consumed exactly, 0 remaining,
  `inFlight` 0), within the maintainer's USD 5.00 ceiling.
- **Gate dimensions (stored, not re-decided):** G2-A passed, **G2-B failed**, G2-C passed, **G2-D
  failed**, G2-E not_evaluable, G2-F passed, G2-G passed.
- **Validator result:** independent read-only Node `v20.20.2` re-validation (repository validators
  only — protocol-v3 verification, fresh execution-tree-hash recomputation over the real repository
  tree, ledger schema/sequence/hash-chain integrity via `RepresentativeHybridV1LiveCallLedger.open()`
  run only against an external copy, both checkpoints, the final combined report via
  `assertValidRepresentativeHybridV1LiveReport`, and cumulative-budget reconstruction) returned
  **`FINAL_EVIDENCE_VALID_READY_FOR_RESOLVER_V3_039_CLOSEOUT`**. SHA-256 of all seven evidence files
  was recorded before and after every validation pass in this closeout and found byte-identical each
  time. A temporary, untracked Jest test performed the run and was deleted immediately afterward;
  `git status --short` was clean after cleanup.
- **No-production-effect statement:** this closeout added exactly two new reports (the manifest and
  the closeout report) plus edits to `ROADMAP.md`/`handoffs/latest-handoff.md`, and force-added the
  seven pre-existing evidence files. No production DI registration, feature flag, migration, RPC,
  Supabase adapter, UI/journal file, resolver source file, protocol/harness source file, or
  dependency file was created, modified, or deleted. `ANTHROPIC_API_KEY` presence was checked as a
  boolean only (absent, both at the start of this closeout and at the start of the validation it
  re-confirms); its value was never printed/inspected/hashed/copied/requested/persisted. Zero
  Anthropic API/provider requests occurred during this closeout; zero additional benchmark cost was
  incurred.
- **Successor status:** `RESOLVER-V3-041` remains `todo`, **not started** by this closeout — it is
  responsible for weighing this evidence (including its stored `failed`/`not_evaluable` dimensions)
  and making the production-wiring re-decision; reaching this evidence does not by itself authorize
  any production wiring. `RESOLVER-V3-010` remains `blocked`.
- **PR/merge/branch cleanup — OUTSTANDING, blocked on GitHub access (not on the evidence):** the
  evidence commit `9fff93a7d31aa8a37983a891b2bbd5e6f72b02ce` (11 files: all seven evidence artifacts
  plus the manifest, closeout report, `ROADMAP.md`, and this handoff) is committed and **pushed** to
  `origin/resolver-v3-039-v3-live-evidence-lf`, but **no PR has been opened yet**. Attempted via the
  registered GitHub MCP server (`mcp__github__create_pull_request`), which returned `Authentication
Failed: Bad credentials` — its backing `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable is
  unset in this environment, and no `gh` CLI is installed as a fallback. This is a GitHub-access
  problem in this environment, not a defect in the evidence or in the closeout work itself — see the
  closeout report's "Addendum (2026-07-24): PR/merge outstanding" section for the full explanation
  and step-by-step instructions for whichever agent picks this up next (verify GitHub access first,
  open the PR `resolver-v3-039-v3-live-evidence-lf` → `chore/clean-arch-structure`, let CI complete,
  merge without a pre-merge maintainer review requirement, then run the independent post-merge byte
  verification already specified for this task — do not re-run Development/Holdout, do not modify
  the evidence commit, do not start RESOLVER-V3-041). The local LF worktree
  (`D:\Workspaces_VSCode\HealthApp-resolver-v3-039-v3-lf`) and execution branch are retained as a
  secondary copy — not removed by this task — pending that PR/merge and the subsequent independent
  post-merge byte verification.

## RESOLVER-V3-039 — Zero-Provider-Call Execution-Tree-Hash Remediation (In Progress)

- **Task ID:** `RESOLVER-V3-039` (remediation of the merged protocol-v2 implementation, PR #137,
  branch-tip commit `f688878f7b467975762f25b6bfd27bee64ea214f`, merge commit
  `fd3142fa1596586ea36ca098ed66babed9d7092e`). Status stays `in_progress` — no live evidence
  collected by this task.
- **What changed:** before authorizing any paid request, a zero-network local preflight
  independently re-derived every hash in the frozen protocol-v2 document and found its
  `executionTreeHash` (`9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e`)
  reproduced from neither a canonical LF Git-content computation over the protocol-v2-freeze
  commit's tree (branch tip / merge commit / later canonical base-branch tree all agree on
  `761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646`) nor this Windows
  environment's CRLF working-tree computation
  (`c3d08d49e62b224b61c7ca93013acda2ac2499242a47d1a9bbef24359ead786d`, matching the gitignored
  `logs/resolver-v3-039-preflight.json` preflight artifact exactly). Root cause: the v2 hash
  implementation read working-tree files with no line-ending normalization at all, making it a
  function of `core.autocrlf`/checkout platform rather than logical content; no test ever compared
  a fresh computation against the frozen literal. Implemented a corrected, versioned, cross-
  platform-reproducible protocol v3: `RepresentativeHybridV1LiveExecutionTreeHash.ts` now
  canonicalizes CRLF→LF and fails closed on any lone CR before hashing, tags the hashed payload
  with an explicit algorithm version, tracks 26 files (the prior 20 plus 4 execution-relevant files
  v2 omitted — `RepresentativeHybridV1LiveLedgerProviders.ts`, `RepresentativeHybridV1LiveReportValidator.ts`,
  `LiveProviderUsage.ts`, and the CLI script itself — plus the hash-computation file and a newly
  extracted, directly testable `RepresentativeHybridV1LiveProtocolVerification.ts`, both safe to
  track since neither embeds its own hash literal). New protocol v3 documents
  (`reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL_V3.md` / `.json`) freeze
  `executionTreeHash: 9697e45b149ba2a90115e388a5caeca173aab76c8f5f88f31c5bfc1e136e235f` — corpus/
  source-manifest/plan hashes unchanged. The live CLI/harness now refuse any protocol document
  whose version is not the v3 literal, rejecting v1 and v2 by construction. Protocols v1 and v2
  are preserved byte-identical, unedited, as invalidated pre-execution history.
- **Why:** the frozen protocol-v2 execution-tree hash could never have matched a real computation
  at Development/Holdout time, which would have hard-blocked (or worse, silently drifted around)
  any future live run under protocol v2 — found and fixed before any paid Anthropic request, at
  zero cost.
- **Files changed:** see `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md` §10 for the
  exact list (new: 2 protocol-v3 docs, this remediation report, 1 new source file, 1 new test file;
  modified in place: `RepresentativeHybridV1LiveExecutionTreeHash.ts`,
  `RepresentativeHybridV1LiveVersions.ts`, `runRepresentativeHybridV1Live.harness.ts`,
  `scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`, and the existing execution-tree
  hash test file, extended). No corpus/checkpoint/ledger/cumulative-budget/report-builder/metrics
  file, no `package.json`/`package-lock.json`, no migration, no production DI/resolver code.
- **Verification executed:** `npm run typecheck` (0 errors); `npm run lint` (0 errors); focused
  `npx jest --testPathPattern="representativeHybridV1" --runInBand` (229/229 tests, 27/27 suites);
  full `npx jest --runInBand` (2300/2300 tests, 236/236 suites); `prettier -c` scoped to every
  file this diff creates or modifies (all pass; the repository-wide `npm run verify` run still
  shows ~605 pre-existing formatting warnings unrelated to this diff — a pre-existing Windows
  `core.autocrlf=true` checkout condition, not fixed via mass reformatting, per this task's explicit
  instruction); `git --no-pager diff --check` (exit 0, clean); full changed-file inventory via
  `git status --short`/`--diff --stat`/`--diff --name-only`. Run on Node v22.15.0 (no Node 20
  binary or version manager present on this machine; `.nvmrc`/`engines` request `>=20`/`20`, and 22
  satisfies the `>=20` `engines` constraint — disclosed deviation, not a silent substitution).
- **Verification result:** pass (see `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md`
  §9 for exact totals).
- **Known issues/blockers/residual risks:** none identified beyond the disclosed Node-version
  deviation above. `ANTHROPIC_API_KEY` presence was checked (boolean only) at the start of this
  task and found absent; no repository change was made in response beyond that boolean result.
  Zero provider calls occurred at any point. `Development`/`Holdout` were not run.
- **Human-review status / next steps:** PR #167 (`fix/resolver-v3-039-execution-tree-hash` →
  `chore/clean-arch-structure`) opened, CI (`verify`) green, zero review comments, merged as
  `e82d675472c9e46ff070d502e9faed765d8e2813`; source branch deleted on both remote and local
  (merged, no unique commits kept). Independent post-merge review confirmed the merged diff is
  byte-identical to the pre-merge commit (`e4556a1183d193be10e8cf709dbdbccf60287312`) — no
  conflict-resolution edits, no `package.json`/`package-lock.json`/migration changes snuck in — so
  no follow-up PR was needed. `RESOLVER-V3-039` remains `in_progress` (this remediation collects no
  live evidence); `RESOLVER-V3-041` remains `todo`; `RESOLVER-V3-010` remains `blocked`.

## QUEUE-008 — Multi-Task Smoke Marker, Part 2 (Done)

- **Task ID:** `QUEUE-008` (source issue #161, task 2 of the two-task event-driven multi-task
  smoke test declared in issue #160/QUEUE-007 — dependency `QUEUE-007` had to reach `queue:done`
  before this task could be claimed).
- **What changed:** post-merge review/handoff/completion transition only. PR #166 (adding
  `reports/QUEUE-008_SMOKE_TEST_MARKER.md`) was already merged (merge commit
  `d47735a429837ee750bd5285af95412a1a87b4fc` on `chore/clean-arch-structure`) by a prior
  invocation's CI-green resolve step (auto-merge: risk `safe-autonomous`, merge-authorization
  `yes`, CI green per preflight `ACTION_CI_GREEN`, no unresolved review comments). This invocation
  reconciled current GitHub state (PR merged, issue #161 auto-closed by the `Closes #161`
  keyword, but labels/handoff/`queue:done` had not yet been recorded), confirmed the merge diff's
  scope, and completes the lifecycle: set `queue:done`, removed `queue:waiting-ci`, on issue #161.
- **Why:** QUEUE-008 part 2 is a doc-only marker proving the queue controller
  (`.github/workflows/claude-queue-wake.yml`, QUEUE-005) correctly waited on its declared
  dependency (QUEUE-007) and then picked up the dependent task on its own once a later wake
  observed the dependency's completion, without a manual re-invocation. It has no product value.
- **Files changed:** `reports/QUEUE-008_SMOKE_TEST_MARKER.md` only (confirmed via
  `git diff --stat d47735a^ d47735a` against its parent — 1 file, 19 insertions, no scope creep).
- **Verification executed:** the implementing invocation ran `npm run verify` (235/235 suites,
  2279/2279 tests) before opening PR #166 (per its state-comment note); this completion
  invocation only re-read merged state and re-confirmed the diff scope (no code changed, so no
  re-run required). PR #166 had zero reviews and zero comments at merge time.
- **Verification result:** pass.
- **Known issues/blockers/residual risks:**
  - The remote branch `queue/queue-008-smoke-test-marker` was not confirmed deleted by this
    invocation — a remote branch-existence check (`git ls-remote`/`gh api .../branches/...`)
    required interactive approval unavailable in this unattended run, consistent with the
    AGENTS.md-documented precedent of not building workarounds around a blocked git-proxy/tooling
    restriction. Left for a future cleanup pass (`cleanup-branches` skill, local+remote scope) or
    a human to confirm/remove.
  - This closes out the two-part QUEUE-007/QUEUE-008 event-driven multi-task smoke protocol
    end-to-end: dependency gating, event-driven (not manual) pickup of the dependent task, and
    full claim → implement → wait-ci → resolve/merge → post-merge-review lifecycle were all
    demonstrated on the real repository across both tasks.
- **Human-review status / next steps:** `queue:done` set on issue #161; none — task and the
  two-part smoke protocol are both complete.

## QUEUE-007 — Multi-Task Smoke Marker, Part 1 (Done)

- **Task ID:** `QUEUE-007` (source issue #160, task 1 of the two-task event-driven multi-task
  smoke test — see issue #160 body).
- **What changed:** post-merge review/handoff/completion transition only. PR #162 (adding
  `reports/QUEUE-007_SMOKE_TEST_MARKER.md`) was already merged by the maintainer (squash commit
  `838f774416adeefd0e1a7855e6632ae1095fe412` on `chore/clean-arch-structure`) in a prior
  invocation, after that invocation's CI-green auto-resolve hit the `gh pr checks` GraphQL
  permission gap (see issue #160's state comment thread) and stopped at `queue:needs-human`. This
  invocation reconciled current GitHub state, confirmed the merge diff touches only
  `reports/QUEUE-007_SMOKE_TEST_MARKER.md` (no scope creep), and completes the lifecycle: set
  `queue:done`, removed `queue:running`, on issue #160.
- **Why:** QUEUE-007 part 1 is a doc-only marker proving the QUEUE-005 external-controller path
  (after the QUEUE-005/QUEUE-006 auth-fallback and event-trigger fixes, #154/#156/#158/#159) can
  process an approved task end-to-end via event-driven wakes only; it has no product value.
- **Files changed:** `reports/QUEUE-007_SMOKE_TEST_MARKER.md` only (confirmed via
  `git show --stat 838f774` against its parent).
- **Verification executed:** the implementing invocation ran `npm run verify` (235/235 suites,
  2279/2279 tests) before opening PR #162; this completion invocation only re-read merged state
  (no code changed, so no re-run required).
- **Verification result:** pass.
- **Known issues/blockers/residual risks:**
  - The `gh pr checks`/`statusCheckRollup` GraphQL permission gap that stopped the prior
    invocation was independently fixed in commit `f142a11` (PR #164, already on this branch)
    with a same-workflow-run preflight-script fallback.
  - That same PR #164 fix ("keep closed-but-relevant issues visible") re-surfaced a second,
    related bug: `findLinkedPullRequest()` matched a bare issue-number substring anywhere in a
    PR body, not just after a real GitHub closing keyword. This invocation's own preflight tick
    was affected by it — it mis-associated an unrelated, human-authored PR (#165, "match real
    closing keywords, not bare issue mentions", which only _mentioned_ `#160` in its description
    for context and did not close it) as if it were issue #160's linked PR, reporting
    `ACTION_CI_GREEN` against PR #165's head SHA instead of #162's. This invocation reconciled
    actual state (PR #162 already merged and closes #160; PR #165 had no
    `closingIssuesReferences` and was unrelated) and did **not** act on PR #165 in any way — it
    also touches `scripts/automation/claude-queue-preflight.mjs`, the queue controller script
    itself, which is excluded from `risk:safe-autonomous` autonomous action regardless of any
    preflight signal (per `docs/automation/CLAUDE_QUEUE_CONTRACT.md`'s risk-class exclusions).
    PR #165 (the fix for this mis-association) was merged by the maintainer separately
    (`e198ec2`) while this invocation was in progress — its own diff should prevent this
    particular mis-association from recurring on future ticks.
- **Human-review status / next steps:** `queue:done` set on issue #160; QUEUE-007's second task
  (part 2 of the two-task smoke, not yet created/approved as of this entry) remains for a human
  to author/approve when ready.

## QUEUE-006 — Phase-B Unattended Smoke Test Marker (Done)

- **Task ID:** `QUEUE-006` (source issue #155).
- **What changed:** merged PR #157 (squash commit `bc55e630797189a437e6ff7692eff0fadac88dee` on
  `chore/clean-arch-structure`), adding `reports/QUEUE-006_SMOKE_TEST_MARKER.md`. The marker
  records that the externally triggered unattended path
  (`.github/workflows/claude-queue-wake.yml`, QUEUE-005) picked this task up via a scheduled
  15-minute tick, that the primary `oauth`-mode attempt for the implement phase failed and the
  workflow's runtime fallback (fixed in PR #156) switched to `api` mode to implement/push/open the
  PR, and that this final resolve transition (workflow run `30045774497`) reconciled live GitHub
  state, confirmed CI green + no outstanding reviews, merged, and ran the post-merge scope check.
- **Why:** QUEUE-006 is the QUEUE-005 Phase-B smoke test — its sole purpose is proving the
  external-controller path works end-to-end with real GitHub-configured auth across the full
  claim → implement → wait-ci → resolve → post-merge lifecycle, not product value.
- **Files changed:** `reports/QUEUE-006_SMOKE_TEST_MARKER.md` only (confirmed via
  `git diff --stat` of the squash commit against its parent — no scope creep).
- **Verification executed:** `npm run verify` (235/235 suites, 2279/2279 tests) was run by the
  implementing invocation before opening the PR; this resolve invocation additionally confirmed
  PR #157's `mergeStateStatus` was `CLEAN`/`mergeable` and `reviews`/`comments` were empty before
  merging.
- **Verification result:** pass (verify green pre-PR; PR merge clean; post-merge diff scoped
  correctly).
- **Known issues/blockers/residual risks:** this job's GitHub token cannot read
  `statusCheckRollup`/check-runs via `gh pr checks`/`gh pr view --json statusCheckRollup`
  ("Resource not accessible by integration") — CI-green confirmation relied on the deterministic
  preflight's own properly-scoped, same-workflow-run check-runs read (`ACTION_CI_GREEN`, head SHA
  matching the PR's actual head at merge time) rather than an independent re-read by this job.
  Worth a follow-up if the queue controller is extended, but did not block this task since the
  preflight's reason code is itself the contract's sanctioned CI-state source (see
  `docs/automation/CLAUDE_QUEUE_CONTRACT.md`'s "External-Controller Mode" section) and no newer
  state contradicted it. Also: the merged marker file's "PR: (filled in once opened)" line was
  never backfilled with `#157` by the implementing invocation — cosmetic only, not corrected here
  to avoid expanding this resolve transition's scope beyond the merge/post-merge review.
- **Human-review status / next steps:** `queue:done` set on issue #155; none — task complete. This
  closes out the QUEUE-005 Phase-B smoke protocol end-to-end.

## QUEUE-005 — Zero-Claude Idle Dispatch Proof (Phase A follow-up, In Progress)

- **Task ID:** `QUEUE-005` (Phase A follow-up: post-merge zero-Claude dispatch proof only).
- **What changed:** `reports/QUEUE_005_MINIMAL_EXTERNAL_WAKE_CONTROLLER.md` §13.1 and
  `ROADMAP.md`'s `QUEUE-005` entry updated with real evidence from a manual `workflow_dispatch`
  of the merged `.github/workflows/claude-queue-wake.yml` (PR #152, merge commit
  `f0037eb1d3d2a282e9286580d9bcb828b218f1ec`), run while zero issues carried `queue:approved`:
  the preflight job returned `reason_code=IDLE_NO_APPROVED_TASK`, `should_invoke=false`; its own
  `GITHUB_TOKEN` carried only read permissions; the `claude` job's status was `skipped` with zero
  steps executed — no Claude secret was ever referenced by a running step, no issue/branch/PR/
  comment changed. Run: `https://github.com/M4XD4B0ZZ/health-app/actions/runs/30020861364`.
- **Why:** the task's required sequencing: prove the idle path cannot reach the Claude job on the
  real repository before handing off the human authentication-setup instructions, and before any
  Phase-B smoke may be authorized.
- **Files changed:** `reports/QUEUE_005_MINIMAL_EXTERNAL_WAKE_CONTROLLER.md`, `ROADMAP.md`,
  `handoffs/latest-handoff.md`.
- **Verification:** documentation-only (Category 1) — git readbacks only; no product/runtime code
  touched; this update itself made no Claude API/OAuth request and read no Claude secret.
- **Known issues/risks:** none. No repository mutation occurred during the dispatch being
  documented.
- **Human-review status:** this task now stops at the human setup boundary (report §14) —
  `CLAUDE_QUEUE_AUTH_MODE`, its secret, and `CLAUDE_QUEUE_MODEL` must be configured, and the
  maintainer must explicitly authorize Phase B, before any `QUEUE-005A`/`QUEUE-005B` smoke issue
  is created.
- **Next steps:** await maintainer confirmation of the human setup steps in the report, then
  await explicit authorization before starting the Phase-B smoke protocol (report §15).

## QUEUE-005 — Minimal External Queue Wake Controller (Phase A, In Progress)

- **Task ID:** `QUEUE-005` (Phase A: implementation and zero-Claude verification only).
- **What changed:**
  - New `.github/workflows/claude-queue-wake.yml` — `workflow_dispatch` + 15-minute cron
    controller, two-job split (read-only `preflight` job with no Claude secret access; a
    conditional `claude` job with write permissions gated on `needs.preflight.outputs.should_invoke
== 'true'`), one repository-wide concurrency group (`cancel-in-progress: false`), all
    third-party actions pinned to immutable commit SHAs with version comments
    (`actions/checkout@…` v5.1.0, `actions/setup-node@…` v4.4.0,
    `anthropics/claude-code-action@…` v1.0.181 — retrieved and verified 2026-07-23), 24 max
    turns, 45-minute job timeout, bounded `--allowedTools`.
  - New `scripts/automation/claude-queue-preflight.mjs` — dependency-free, pure decision
    function (`decidePreflight`) implementing the queue contract's task-selection and
    active-task-reconciliation rules deterministically, plus a read-only (`GET`-only) GitHub
    REST fetch layer. Emits `should_invoke`, `reason_code`, `issue_number`, `task_id`, `phase`,
    `pr_number`, `head_sha` via `$GITHUB_OUTPUT`.
  - New `scripts/automation/claude-queue-auth-precheck.mjs` — fails closed before the Claude
    Code Action step on invalid/missing `CLAUDE_QUEUE_AUTH_MODE`, its corresponding secret
    (`CLAUDE_CODE_OAUTH_TOKEN` for `oauth`, `ANTHROPIC_API_KEY` for `api`), or missing
    `CLAUDE_QUEUE_MODEL` — `resolveAuthDecision()`'s signature only accepts secret-presence
    booleans, so it cannot leak a secret value even by accident.
  - New `scripts/automation/__tests__/claude-queue-preflight.test.mjs` — 50 passing `node:test`
    cases covering all 30 required scenarios (idle/actionable decision paths, dependency
    gating, multi-active-task blocking, CI check-run interpretation incl. check-runs-over-legacy-
    status, malformed/ambiguous/duplicate-PR fail-closed cases, stable-output shape, preflight
    purity/no-mutation, auth-precheck fail-closed behavior, and workflow-YAML structural checks
    including pinned SHAs and idle-path unreachability of the Claude job).
  - `docs/automation/CLAUDE_QUEUE_CONTRACT.md` — new "External-Controller Mode (`QUEUE-005`)"
    section: defines "externally triggered unattended" precisely (only a
    `claude-queue-wake.yml`-invoked run may claim it), the one-transition-per-invocation rule,
    "preflight output is a hint, not a fact," and corrects the prior `ANTHROPIC_API_KEY`-only
    framing to include `CLAUDE_CODE_OAUTH_TOKEN` (via `claude setup-token`) without claiming its
    billing/quota behavior in advance.
  - `.claude/skills/queue-run/SKILL.md` — new "External-controller mode (`QUEUE-005`)"
    subsection: re-fetch/reconcile before acting even under this mode, exactly one bounded
    transition then stop (no in-process CI polling, no second issue in the same invocation),
    contrasted with manual semi-attended runs which may loop through multiple tasks.
  - `ROADMAP.md` — `QUEUE-005` moved `todo` → `in_progress` (not `done` — Phase B unattended
    smoke has not run yet); Prerequisites section corrected for the OAuth-token authentication
    option; new "Phase A" subsection records what was delivered and what remains outstanding
    (zero-Claude live dispatch, human auth/model setup, Phase-B smoke).
  - New `reports/QUEUE_005_MINIMAL_EXTERNAL_WAKE_CONTROLLER.md` — full design/decision-table/
    permissions/concurrency/auth/cost/pinning/test-results report; §13.1 and §15 are placeholders
    to be filled in after merge (zero-Claude dispatch) and after maintainer-authorized Phase B.
- **Why:** `QUEUE-004`'s closeout evidence (`GITHUB_ACTIONS_CONTROLLER_JUSTIFIED`) established
  that the queue is only semi-attended without an external trigger; this task builds the smallest
  such trigger, per the task's own explicit "do not build" list (no RALPH-style runtime, no
  committed per-run state, no custom task database, no long-running daemon/VPS service, no
  independent queue engine, no automatic ROADMAP task selection, no parallel execution, no
  product features).
- **Files changed:** `.github/workflows/claude-queue-wake.yml`,
  `scripts/automation/claude-queue-preflight.mjs`,
  `scripts/automation/claude-queue-auth-precheck.mjs`,
  `scripts/automation/__tests__/claude-queue-preflight.test.mjs`,
  `docs/automation/CLAUDE_QUEUE_CONTRACT.md`, `.claude/skills/queue-run/SKILL.md`, `ROADMAP.md`,
  `reports/QUEUE_005_MINIMAL_EXTERNAL_WAKE_CONTROLLER.md`, `handoffs/latest-handoff.md`.
- **Verification:** `node --test scripts/automation/__tests__/claude-queue-preflight.test.mjs`
  (50/50 pass); `npm run verify` (full repository, unaffected product suite green); git
  readbacks (`status --short`, `diff --stat`, `diff --name-only`, `diff --check`) confirmed no
  `src/**`, Supabase/migration, or dependency file changed.
- **Known issues/risks:** a local live read-only dry-run of the preflight script against the
  real repository could not be completed from inside this interactive session (this session's
  `GITHUB_TOKEN` authenticates via `curl` but is rejected by Node's `fetch` from this specific
  sandbox — a session-local quirk, not a script or GitHub Actions defect); the authoritative
  live proof is the post-merge zero-Claude `workflow_dispatch` run required before Phase B, not
  yet performed as of this PR. No Claude secret was read and no Claude API/OAuth request was
  made anywhere in this task's Phase-A work.
- **Human-review status:** implementation-only PR; per the task's explicit sequencing, work stops
  at the human setup boundary (§14 of the report) after the zero-Claude dispatch passes — no
  Phase-B smoke begins without explicit maintainer authorization and confirmed secret/variable
  setup.
- **Next steps:** merge this PR; perform the zero-Claude `workflow_dispatch` proof and record it
  in the report; hand the human setup instructions (§14) to the maintainer; wait for explicit
  Phase-B authorization before creating any `QUEUE-005A`/`QUEUE-005B` smoke issue.

## QUEUE-004 — Smoke Evaluation and Hardening (Closeout, Done)

- **Task ID:** `QUEUE-004` (closeout of the unattended-smoke evaluation).
- **What changed:**
  - New `reports/QUEUE_004_UNATTENDED_SMOKE_CLOSEOUT.md` — full report: Stage A (issue #148,
    PR #150, merge `c652b05`) passed the complete supervised lifecycle; the unattended
    continuation failed before Stage B because no native 15-minute recurring wake exists in this
    environment (Routine minimum interval: one hour; `send_later` fallback not a valid substitute
    for an unattended test); Stage B (issue #149) was never executed and is closed `not planned`;
    verdict `GITHUB_ACTIONS_CONTROLLER_JUSTIFIED`.
  - `docs/automation/CLAUDE_QUEUE_CONTRACT.md` — new "Operational Lessons (from `QUEUE-004`)"
    section: the queue is semi-attended without an external trigger; no task may be described as
    unattended merely because it uses `queue-run`; quiet CI success was again not surfaced by
    subscriptions; fail closed on missing wake mechanisms.
  - `.claude/skills/queue-run/SKILL.md` — no longer describes native scheduled wake-ups as
    sufficient for proven overnight operation; requires distinguishing `semi-attended` vs
    `externally triggered unattended`; fail-closed rule before claiming delayed/dependent tasks;
    stays usable manually and from a future external trigger.
  - `ROADMAP.md` — `QUEUE-004` marked `done` (objective was evaluation/hardening, not a passed
    unattended run — recorded explicitly); new `QUEUE-005 — Minimal External Queue Wake
Controller` added as `todo` (one workflow, deterministic preflight, 15-min schedule +
    `workflow_dispatch`, official Claude Code GitHub Action only on actionable ticks,
    `ANTHROPIC_API_KEY` as human prerequisite with API-cost note). Not started.
- **Why:** The smoke reached a valid terminal result; the evaluation objective is complete and
  the evidence-backed controller decision needed to be recorded before any further queue work.
- **Files changed:** `reports/QUEUE_004_UNATTENDED_SMOKE_CLOSEOUT.md`,
  `docs/automation/CLAUDE_QUEUE_CONTRACT.md`, `.claude/skills/queue-run/SKILL.md`, `ROADMAP.md`,
  `handoffs/latest-handoff.md`.
- **Verification:** documentation-only — git readbacks + `npm run verify` (issue-level
  requirement).
- **Known issues/risks:** remote deletion of the merged Stage A branch
  (`queue/queue-004a-overnight-smoke-stage-a`) remains blocked by the git proxy (HTTP 403) —
  left for an authorized channel per `AGENTS.md`. No API key was read; no workflow was added.
- **Human-review status:** maintainer-directed closeout; merged per instruction after green CI.
- **Next steps:** `QUEUE-005` (not started here); its controller gets fresh smoke issues.

## QUEUE-004A — Overnight Smoke Stage A (In Progress)

- **Task ID:** `QUEUE-004A` (issue #148, part of `QUEUE-004`'s unattended overnight smoke test).
- **What changed:** Added `reports/QUEUE_004_OVERNIGHT_STAGE_A.md`, a synthetic evidence marker
  confirming the first half of a genuinely unattended sequential two-task queue run. No product
  behavior or queue infrastructure changed.
- **Why:** `QUEUE-004`'s own scope requires an actual unattended/overnight run, not just
  documentation hardening (see the prior `QUEUE-004` entry below). This is Stage A of that test;
  Stage B (`QUEUE-004B`, issue #149) is gated on this task reaching `queue:done` and on a
  predeclared release time (`stageBReleaseAtUtc = 2026-07-23T17:29:13Z`) so the test also exercises
  a real multi-hour scheduled-wake gap.
- **Files changed:** `reports/QUEUE_004_OVERNIGHT_STAGE_A.md`, `handoffs/latest-handoff.md`.
- **Verification:** documentation-only (Category 1) — git readbacks; `npm run verify` also run per
  this task's issue-level verify command.
- **Known issues/risks:** none — synthetic, no product surface touched.
- **Human-review status:** `risk:safe-autonomous`, auto-merge authorized by the issue; independent
  post-merge review performed by the worker after merge per the queue contract.
- **Next steps:** once merged and `queue:done`, the queue worker waits for `stageBReleaseAtUtc`
  before claiming `QUEUE-004B`.

## QUEUE-004 — Smoke Evaluation and Hardening (Partial)

- **Task ID:** `QUEUE-004`.
- **What changed:** Acted on `QUEUE-003`'s findings by hardening the contract, the worker skill,
  and the issue template:
  - `docs/automation/CLAUDE_QUEUE_CONTRACT.md` — new "Operational Lessons (from `QUEUE-003`)"
    section; `queue:waiting-ci` label description corrected to say the heartbeat is the primary
    CI-success detection mechanism, not a backup.
  - `.claude/skills/queue-run/SKILL.md` — step 4 reframes the heartbeat as primary; step 2 now
    requires an explicit `origin/<default-branch>` ref for every branch creation, citing the
    stale-local-branch incident; step 3 documents that `queue:approved` does not override this
    environment's own safety classifier, and precisely scopes the narrow DoD/allowed-paths
    exception (not a general escape hatch).
  - `.github/ISSUE_TEMPLATE/queue-task.yml` — DoD field now prompts authors to cross-check
    against Allowed paths.
  - `ROADMAP.md` — `QUEUE-004` set to `in_progress` (not `done`): the hardening above is
    complete, but the task's own scope also requires an actual unattended/overnight test, which
    has **not** been run — everything so far happened within one continuous, supervised session.
    Documented explicitly as outstanding rather than silently dropped.
- **Why:** Turn the real findings from the first live queue run into binding guidance before
  trusting the queue further, per the plan agreed with the user.
- **Files changed:** `docs/automation/CLAUDE_QUEUE_CONTRACT.md`, `.claude/skills/queue-run/SKILL.md`,
  `.github/ISSUE_TEMPLATE/queue-task.yml`, `ROADMAP.md`.
- **Verification:** documentation-only — git readbacks; `npm run verify` also run for confidence.
- **Known issues/risks:** the unattended/overnight test remains the one real gap before the queue
  can be trusted with larger or unsupervised work; the GitHub Actions controller decision stays
  deferred until that test runs.
- **Human-review status:** docs-only update, following this session's established direct-commit
  convention for governance/contract bookkeeping.
- **Next steps:** design and run a genuine overnight/unattended test, then close out `QUEUE-004`
  and revisit the GitHub Actions controller question.

## QUEUE-003 — Two-Task Unattended Smoke Test (Complete)

- **Task ID:** `QUEUE-003` (plus its second sub-task `QUEUE-003B`, issue #143).
- **What changed:** Ran the Claude Queue end-to-end for real, via the `queue-run` skill, across
  two tasks: `RALPH-RETIRE-002` (issue #142, `risk:review-required` — PR #144, human-merged) and
  `QUEUE-003B` (issue #143, `risk:safe-autonomous` — PR #145, auto-merged). Added
  `reports/QUEUE-003_SMOKE_TEST_MARKER.md` as the synthetic proof artifact. Flipped `QUEUE-003`
  to `done` in `ROADMAP.md` with detailed findings; refined `QUEUE-004`'s scope with concrete
  action items derived from those findings (previously generic).
- **Why:** Prove the queue works before trusting it with larger or less-supervised work, per the
  plan agreed with the user.
- **Key findings** (full detail in `ROADMAP.md`'s `QUEUE-003` entry): CI-success webhooks never
  arrived spontaneously in this run (only user-prompted checks and the scheduled fallback
  fired) — the fallback heartbeat should be treated as primary, not backup. Dependency gating and
  the `risk:review-required` vs `risk:safe-autonomous` merge-authorization split both worked
  exactly as designed. Two real incidents surfaced and were resolved safely: a stale local branch
  sharing the canonical branch's name briefly reverted the working tree when checked out by bare
  name (no push occurred; recovered via reset to `origin/<default-branch>`), and this
  environment's own auto-mode safety classifier blocked a bulk `git rm -r` even on a
  `queue:approved` task (resolved by deleting files individually, with the user's explicit
  choice). One issue (`RALPH-RETIRE-002`) had an internal inconsistency between its
  "Allowed paths" and its own DoD, resolved via a narrow, explicitly-flagged exception rather than
  blocking. Genuine unattended/overnight survival was **not** tested — this run stayed within one
  continuous, interactively-supervised session.
- **Files changed:** `reports/QUEUE-003_SMOKE_TEST_MARKER.md` (via PR #145, already merged);
  `ROADMAP.md` (this task).
- **Verification:** documentation-only (Category 1/2) — git readbacks; `npm run verify` also run
  for confidence.
- **Human-review status:** docs-only ROADMAP/handoff update, following this session's established
  direct-commit convention for governance bookkeeping (same pattern as prior RALPH-RETIRE-001/002
  status updates).
- **Next steps:** `QUEUE-004` (todo) — act on the findings above before considering any dedicated
  controller.

## RALPH-RETIRE-002 — Consolidate Governance After RALPH Retirement

- **Task ID:** `RALPH-RETIRE-002`. Run as the first real task through the Claude Queue
  (`queue-run` skill, issue #142, `risk:review-required`).
- **What changed:** Deleted `.governance/**` (4 files) and `.roo/`/`.roomodes` (13 files)
  entirely. Merged `.governance/RULES.md`'s normative handoff schema and
  `.governance/SAFETY.md`'s protected-files list into new `AGENTS.md` sections ("Handoff
  Requirements", "Protected Files") — the latter also corrects `SAFETY.md`'s stale blanket
  "never push" rule, which contradicted the push/PR/merge workflow `AGENTS.md` already
  documents and this session has practiced throughout. Compressed `SSOK.md`'s ~540-line
  Roo-specific historical section to a short note (591 → 69 lines). Corrected two now-dangling
  `.governance/` references in `VERIFY.md` (narrow, explicitly-flagged scope addition beyond the
  originating issue's allowed-paths list, justified by the issue's own DoD). Flipped
  `RALPH-RETIRE-002` to `done` in `ROADMAP.md`.
- **Why:** `.governance/**` still referenced paths RALPH-RETIRE-001 had removed; `.roo/`/
  `.roomodes` had no active-usage evidence and duplicated `AGENTS.md`; "dual governance during
  transition" framing needed to resolve to one unambiguous workflow.
- **Files changed:** `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md`,
  `.governance/REVIEW_POLICY.md` (deleted); `.roomodes`, `.roo/**` (13 files, deleted);
  `AGENTS.md`, `SSOK.md`, `VERIFY.md`, `ROADMAP.md` (edited);
  `reports/RALPH_RETIRE_002_GOVERNANCE_CONSOLIDATION_REPORT.md` (new).
- **Verification:** documentation/governance-only (Category 2) — git readbacks plus `npm run
verify` for extra confidence per the issue's own verify-command field. See PR for the actual
  result.
- **Known residual (documented, not blocking):** `README.md` and
  `plans/ACC-001_LOCAL_FIRST_ACCOUNT_BACKUP_SYNC_PLAN.md` still reference the deleted
  `.governance/SAFETY.md` by path; left unedited as outside this task's allowed-paths scope (see
  the consolidation report §7 for detail).
- **Human-review status:** `risk:review-required` — PR opened, not auto-merged; human merge
  required per the Claude Queue Contract.

## QUEUE-002 — Claude Worker Skill (`queue-run`)

- **Task ID:** `QUEUE-002`.
- **Scope:** Second step of the successor to the retired Ralph-Loop / Overnight Worker, on top
  of the merged `QUEUE-001` contract. Added `.claude/skills/queue-run/SKILL.md` — the reusable
  worker (follows the existing `.claude/skills/cleanup-branches/` convention): claims the next
  eligible `queue:approved` issue, implements within its declared scope, verifies, opens a PR,
  subscribes to PR activity so CI failures and review comments wake the session, merges only
  when explicitly authorized, runs an independent post-merge review + handoff, then proceeds or
  stops cleanly. Enforces "exactly one active task" and the risk-class exclusions from
  `QUEUE-001` regardless of an issue's own wording. Flipped `QUEUE-002` to `done` in
  `ROADMAP.md`.
- **Not done here:** `QUEUE-003` (two-task unattended smoke) and `QUEUE-004` (evaluation/
  hardening) remain `todo`, not started. No queue issue was created or run.
- **Verification:** `npm run verify` green (typecheck, lint, format, full test suite — no
  `src/` change). Git readbacks clean.
- **No-product-effect:** no `src/`, Supabase, dependency, or GitHub Actions workflow change.

## QUEUE-001 — Queue Contract and GitHub Issue Intake

- **Task ID:** `QUEUE-001`.
- **Scope:** First step of the successor to the retired Ralph-Loop / Overnight Worker. Added
  `.github/ISSUE_TEMPLATE/queue-task.yml` (task ID, objective, DoD, dependencies,
  allowed/forbidden paths, verify commands, risk class, merge authorization, max fix attempts,
  stop conditions) and `docs/automation/CLAUDE_QUEUE_CONTRACT.md` (labels, risk-class
  exclusions, lifecycle, merge-authorization rule, fix-attempt limits, explicit relationship to
  `ROADMAP.md`). Added the "Claude Queue" `ROADMAP.md` section listing `QUEUE-001` (done, this
  task) through `QUEUE-004` (todo, not started).
- **Known gap (documented, not blocking):** GitHub labels (`queue:approved` etc.) are not
  created by this task — no label-management tool is available. One-time manual creation via
  GitHub → Settings → Labels is documented in the contract.
- **Not done here:** `QUEUE-002` (worker skill) is a separate task/PR, not started here.
- **Verification:** `npm run verify` green (typecheck, lint, format, full test suite — no `src/`
  change). Git readbacks clean.
- **No-product-effect:** no `src/`, Supabase, dependency, or GitHub Actions workflow change.

## RALPH-RETIRE-001 — Remove Dead RALPH Runtime, Simulators and Historical Noise

- **Task ID:** `RALPH-RETIRE-001`.
- **Scope:** Removed the retired Ralph-Loop / Overnight Worker runtime and historical noise:
  `scripts/agent/**`, `.agent/**`, `tasks/`, `runs/`, `validation/`, `review/`, 6 RALPH planning
  docs under `plans/`, 70 `RALPH-*`/`CLINE-*` reports plus `reports/morning-review.md`, and 3
  RALPH/Cline transition docs under `docs/`. Removed all 13 `agent:*` scripts from
  `package.json`. Compressed `ROADMAP.md`'s "Ralph-Loop Governance / Overnight Worker" section
  from 1,940 lines to a short retirement note plus one new `todo` follow-up task
  (`RALPH-RETIRE-002`, governance consolidation). Repaired the resulting dangling references in
  `AGENTS.md`, `SSOK.md`, `reports/README.md`, and one stale pointer at the top of `ROADMAP.md`.
  Full inventory, evidence, and reasoning: `reports/RALPH_RETIRE_001_DEAD_RUNTIME_CLEANUP.md`.
- **Retained exceptions:** `.governance/**`, `.roo/`, `.roomodes` left untouched (disposition
  deferred to `RALPH-RETIRE-002`, not this task); `handoffs/latest-handoff.md` untouched by the
  cleanup itself; all `RESOLVER-V3-*`/`P1-*`/`P2-*`/product reports untouched.
- **Verification:** Baseline `npm run verify` (after `npm ci --ignore-scripts` to restore
  missing `node_modules` in this container) was fully green before any change: typecheck, lint,
  format, 235 suites / 2,279 tests. Post-cleanup re-run and Git readbacks are recorded in the
  cleanup report and this session's final summary.
- **No-product-effect:** No `src/**`, Supabase/migration, GitHub workflow, or dependency change.
  No secret accessed. `.governance/**` unchanged.
- **Follow-up:** `RALPH-RETIRE-002` (governance consolidation) added to `ROADMAP.md` as `todo`,
  not started.

## RESOLVER-V3-039 — Phase-B Continuation Remediation (protocol v2)

- **Basis and scope:** Branch `claude/resolver-v3-039-phase-b-remediation-yva0my`, created directly
  from `origin/chore/clean-arch-structure` at `f8c5e678ff3d555829a5548ae57ffcb30d0a2c7e` (merge of
  PR #136, the RESOLVER-V3-039 Phase-A implementation). Before authorizing any paid provider
  request, re-read the merged Phase-A implementation end to end (protocol MD/JSON, evidence
  MD/JSON, CLI, harness, every file under `representativeHybridV1/live/**`) and traced the
  documented Development → inspect → Holdout workflow line by line rather than assuming it was
  executable as written.
- **Defect found (pre-execution, zero calls, zero cost):** the documented Holdout command was
  refused once Development's fixed-path output existed (no merge path); the only two workarounds
  were both unsafe (`--allow-rerun` discarded Development's evidence when Holdout rebuilt the report
  from only its own partition — `developmentCaseRecords` was unconditionally `null`;
  `--partition=all` either skipped the required inspection boundary or would have repeated billed
  Development calls on a second invocation). Budget enforcement was also process-local (a fresh,
  full 263-call/$4.174336 gate per CLI process, no cumulative state across Development/Holdout), and
  paid-call evidence was not durable during execution (nothing written to disk until an entire
  partition's loop finished). Full analysis:
  `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`.
- **Zero-calls confirmation:** verified directly from the still-committed, unmodified v1 evidence
  artifact (`actualUsage.calls: 0`, `rawTelemetry: []`, every gate `not_evaluable`) and independently
  asserted by a new regression test reading that same file. This remediation itself made no provider
  request either — no `ANTHROPIC_API_KEY` was read or set anywhere in this branch's work; every new
  test uses fake transports/providers exclusively.
- **Protocol v1 disposition:** preserved unedited as invalidated pre-execution history (frozen,
  never executed, no quality evidence to invalidate because none existed). Superseded for live
  execution by protocol v2 — the harness refuses any `protocolVersion` other than
  `resolver-representative-hybrid-live-protocol-v2`.
- **Corrected architecture (protocol v2):** a durable, atomically-written Development checkpoint
  (`RepresentativeHybridV1LiveCheckpoint.ts`); a tamper-evident, append-only call ledger shared
  across both phases and every process invocation (`RepresentativeHybridV1LiveCallLedger.ts`,
  states `reserved → dispatched → {completed | terminal_failure}` plus
  `indeterminate_after_interruption` on interruption — never auto-rerun, requiring an explicit,
  separate human resolution); deterministic call IDs
  (`RepresentativeHybridV1LiveCallId.ts`); a cumulative-budget reconstruction
  (`RepresentativeHybridV1LiveCumulativeBudget.ts`) that replays every already-consumed call through
  the same, unmodified `LiveProviderBudgetGate`, so Holdout's allowance is the frozen ceiling minus
  Development's actual consumption, never a fresh full ceiling; an execution-tree drift hash
  (`RepresentativeHybridV1LiveExecutionTreeHash.ts`) covering prompts/schemas/provider/pricing/
  harness logic not already covered by the existing corpus/source-manifest/plan hashes; and a
  corrected two-phase CLI (`scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`) that
  refuses `--partition=all` and `--allow-rerun` outright and requires
  `--development-checkpoint=<path>` for Holdout. `RepresentativeHybridV1LiveReportBuilder.ts`/
  `RepresentativeHybridV1LiveReportValidator.ts` received small, additive, backward-compatible
  changes (optional `reportVersion`/`protocolVersion` parameters; validator accepts either version)
  — every pre-existing caller/test is byte-identical in output.
  `planHash` unchanged (`214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e`); new
  `executionTreeHash: 9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e`.
- **Tests:** 69 new focused tests across 8 new suites (defect reproduction, checkpoint, ledger,
  ledger-recording providers, cumulative budget, execution-tree hash, call ID, and an end-to-end
  two-phase workflow composition test) — all green. Full regression: **208/208 tests, 26/26 suites**
  across the entire `representativeHybridV1/**` tree (139 pre-existing + 69 new).
- **Verification:** `npm install --ignore-scripts` (no `node_modules` present in this environment;
  Supabase CLI postinstall network fetch blocked — documented precedent, unrelated to this task),
  `npm run typecheck` (0 errors), `npm run lint` (0 errors), `npm run format:check` (clean after one
  `prettier -w` pass), `npx jest --testPathPattern="representativeHybridV1"` (208/208 green),
  `npm run verify` (green). `git --no-pager status --short` / `--diff --stat` / `--diff --name-only`
  / `diff --check` confirm the diff is limited to the files listed in the remediation report's §13 —
  zero changes to `supabase/migrations/**`, `supabase/functions/**`, `package.json`,
  `package-lock.json`, any environment file, `src/infrastructure/di/container.ts`, any journal/UI
  file, or any RESOLVER-V3-038/023/024/040 frozen artifact.
- **No production effect:** no DI/container registration, feature flag, migration, RPC, Supabase
  adapter, or UI/journal change was made. Every new file lives under
  `representativeHybridV1/live/**` or `reports/**`.
- **Final status:** **RESOLVER-V3-039 remains `in_progress`** — this remediation corrects the
  Phase-B continuation defect and re-freezes a corrected protocol; it collects no live evidence
  itself. RESOLVER-V3-041 remains `todo`, not started. RESOLVER-V3-010 remains `blocked`.
  RESOLVER-V3-038 and RESOLVER-V3-040 remain `done`, unmodified.
- **Branch/PR status:** to be recorded after push/PR/merge (this entry is written before that step
  completes; see the ROADMAP.md RESOLVER-V3-039 entry and the final task report for the eventual PR
  number and merge commit once available).

---

## RESOLVER-V3-040 — Cost/Latency Acceptance Policy

- **PR #133 closure:** Closed `codex/vervollstandige-letzten-task-von-claude` without merging,
  rebasing, resolving its conflicts, cherry-picking from it, or reopening it, and without deleting
  its branch. Closing comment recorded: superseded/redundant relative to the already-merged
  RESOLVER-V3-038 (PR #132) and the separately-submitted RESOLVER-V3-040 below; its stale ROADMAP
  state and incomplete `npm run verify` were called out explicitly. Its proposed policy numbers
  (e.g. USD 0.010/log, fixed USD 100/500/2,000 monthly ceilings) were reviewed for comparison only —
  none were reused; they are unrelated to, and not derivable from, this task's accepted thresholds.
- **Branch/base:** `claude/resolver-v3-040-cost-latency-policy-lpfnw3`, created directly from
  `origin/chore/clean-arch-structure` at `9df3d6c8d6318aa5d35895de02723d1b4bd9026c` (PR #132 merge,
  RESOLVER-V3-038 `done`).
- **Source branch inspected:** `claude/autonomous-tasks-flight-hdewii` (three commits ahead of
  canonical at inspection time, never PR'd). `git diff origin/chore/clean-arch-structure..origin/
claude/autonomous-tasks-flight-hdewii` touched exactly `ROADMAP.md`,
  `docs/domains/ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md`, and
  `handoffs/latest-handoff.md`.
- **Selective-transfer method:** reused only the RESOLVER-V3-040 policy content and its own
  ROADMAP/handoff entries from that branch; excluded its unrelated UT-001 "Attempted A0 run, blocked"
  ROADMAP note and its RESOLVER-V3-038 "parallel-session" discarded-implementation note (neither
  belongs in a RESOLVER-V3-040-only diff). No `learningV2/**`/`learningV3/**`, benchmark corpus, test,
  or production code file was touched. UT-001 does not appear anywhere in the final diff.
- **Corrections made:** (1) the obsolete "no personal-cache read path exists, so `C=0` is the only
  defensible assumption" claim was replaced with the required distinction — implementation exists
  (production-wired `PersonalResolutionMemoryAwareFoodCatalogResolver` in `container.ts`, confirmed by
  direct code reading), measured production hit rate is unknown, and `C=0` is presented only as a
  deliberate conservative scenario input in the `N_low` monthly-volume bucket, never as an
  architectural fact. (2) the AI-routed p95 ceiling was widened from 10,000 ms to 12,000 ms (and the
  all-attempts ceiling to match) because n=7 is too small a sample to trust a bare ~1.35x margin as
  durable headroom. (3) an internal inconsistency between the 15 s per-attempt timeout, one retry, and
  the 20 s total wall-clock ceiling (two full-length attempts plus backoff can exceed 20 s) was
  resolved by making the wall-clock ceiling authoritative over the per-attempt timeout. (4) the cost
  ceiling's aggregation rule was made explicit (partition-level mean over attempted AI-routed logs,
  not a per-case cap). (5) a full, non-ambiguous G2-D/G2-E pass/fail mapping was added — separate
  development/holdout evaluation, retries and technical failures counted in the population, a
  minimum `n ≥ 30` gate-evaluability floor, a single-violation-fails rule, and an explicit
  never-zero-on-missing-data rule.
- **Accepted thresholds:** see the ROADMAP.md RESOLVER-V3-040 entry's "Accepted thresholds" list and
  the policy document itself (`docs/domains/ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md`
  §3–§10, §12 for the full measured/derived/assumed/normative-choice/unknown classification of every
  numeric value).
- **Unknowns retained:** production `F`, `C`, `N`; `e`/`v`/`k`; current (post-2026-07-20) provider
  pricing; cold/warm latency separation; provider tail behavior under real concurrency; product-tier
  economics. None are guessed; all are explicitly left `unknown` in the policy document (§13).
- **Verification:** documentation-only change per `VERIFY.md` Category 1 —
  `git --no-pager status --short` / `--diff --stat` / `--diff --name-only` / `git diff --check` all
  confirm the diff is limited to `ROADMAP.md`, `handoffs/latest-handoff.md`, and the one new policy
  document. `npm run verify` was additionally run for extra confidence; see the PR description/commit
  history for the exact recorded result on this isolated branch (not copied from any other branch's
  prior run).
- **PR/merge state:** merged as **PR #134**, merge commit `81e0b05bf561595f8c0ba9d151a12bf1fec57ceb`.
  CI (`verify` check) was green; no review comments were posted. Independent post-merge review
  confirmed the merged tree is byte-identical to the pre-merge branch tip and that exactly the three
  expected files changed against the pre-PR base — see the ROADMAP.md RESOLVER-V3-040 entry's
  "Branch/PR status" paragraph for the full detail. No defects found; no follow-up code fix required.
- **RESOLVER-V3-039:** remains `todo`, not started, not authorized by this task. Its dependency on
  RESOLVER-V3-040 is now satisfied; its dependency on RESOLVER-V3-038 was already satisfied.
- **RESOLVER-V3-010:** remains `blocked`, unaffected by this task.
- **RESOLVER-V3-038:** remains `done`, unmodified by this task.

---

## RESOLVER-V3-038 — Representative Hybrid Benchmark Successor Corpus & Harness

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
