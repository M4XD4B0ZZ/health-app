# RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence

## 1. Executive Result

**Phase A (protocol implementation, freeze, and verification) is complete. Phase B (actual live
execution against Anthropic) did not run and could not run in this session: `ANTHROPIC_API_KEY` is
not set in this execution environment.**

No paid provider request occurred. Zero of the 263 planned live calls were made. The full
authorized USD 5.00 budget — and even the frozen plan's own USD 4.174336 worst-case reservation —
remain entirely unused. This is not a partial run: the live CLI and harness both fail closed on the
missing credential **before** spawning any process, making any network call, or reserving any
budget, exactly as required ("missing credentials must fail before any provider request," "no
fixture fallback"). This was verified directly (§11).

## 2. Task Completion vs. System/Gate Outcome

These are two different, deliberately separate judgments:

- **Task completion (RESOLVER-V3-039 itself):** **not complete.** The task requires collecting
  controlled representative live evidence; no live evidence was collected. Per the task's own
  rule — _"do not mark V3-039 done merely because partial calls were made... Record the exact
  blocker and preserve partial evidence"_ — this task remains `in_progress` with an explicit,
  recorded credential blocker, not `done`.
- **System/gate outcome (G2-A through G2-G):** every dimension is `not_evaluable` (§16–§22). No
  gate passed, no gate failed — there is simply no live evidence yet to evaluate. This does **not**
  reopen, weaken, or replace the historical RESOLVER-V3-024 verdict (`NOT_PASSED`), which stands
  unchanged.

## 3. Protocol-Freeze Commit and Evidence Commit

- **Protocol-freeze commit:** `da3bae6939bd5514e7a7521597ae670940e45ea6`
- **Evidence commit:** none (no live execution occurred, so there is no evidence-bearing commit
  distinct from the protocol freeze; this final documentation/handoff commit is the closest
  analogue and is recorded as such in the git history, not inside the JSON report's
  `evidenceCommit` field, which stays `null` per the "unknown remains null" rule).

## 4. Provider / Model

- Provider: `anthropic`
- Model: `claude-haiku-4-5` (Claude API alias), pinned snapshot `claude-haiku-4-5-20251001`
- Verified available at `https://platform.claude.com/docs/en/about-claude/models/overview`,
  retrieved 2026-07-22.

## 5. Official Pricing Source / Date

`https://platform.claude.com/docs/en/about-claude/pricing` (redirected from
`https://docs.claude.com/en/docs/about-claude/pricing`), retrieved **2026-07-22**: Claude Haiku 4.5
— **$1 / MTok input, $5 / MTok output**. Matches the repository's existing pricing constants
exactly (`LiveProviderBudgetGate.ts`, `VariantBLiveProvider.ts`, `VariantCLiveInterpretationProvider.ts`)
— no drift, no substitution.

## 6. Prompt / Schema / Interpreter Versions

| Field                                  | Value                           |
| -------------------------------------- | ------------------------------- |
| Variant B prompt                       | `variant-b-prompt-v1`           |
| Variant B schema                       | `variant-b-schema-v3`           |
| Variant B estimator                    | `variant-b-ai-only-v1`          |
| Variant B contract                     | `1`                             |
| Variant C prompt                       | `variant-c-prompt-v1`           |
| Variant C schema                       | `variant-c-schema-v1`           |
| Variant C interpreter                  | `variant-c-live-interpreter-v1` |
| Variant C (AI interpretation) contract | `1`                             |

## 7. Corpus / Registry / Harness / Source-Manifest Versions and Hashes

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Corpus version          | `resolver-representative-hybrid-benchmark-corpus-1.0.0`            |
| Corpus hash             | `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a` |
| Registry version        | `resolver-representative-hybrid-benchmark-registry-v1`             |
| Harness version         | `1.0.0`                                                            |
| Source-manifest version | `resolver-representative-hybrid-benchmark-source-manifest-v1`      |
| Source-manifest hash    | `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52` |
| Plan hash               | `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e` |

All values re-verified at the `--preflight` run against the exact protocol-freeze commit (§11) and
matched the frozen protocol JSON exactly.

## 8. Exact Execution Plan

See `reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL.md` §6–§9 for the full derivation. Summary:

- 114 total corpus scenarios: 88 resolution base cases + 16 repeat/paraphrase overlay cases (104
  primary resolution scenarios) + 10 governance-only scenarios (never invoke live B/C).
- Variant B calls planned: **136** (development 108, holdout 28).
- Variant C attempts planned: **136** primary/consistency + **3** deterministic sample-floor
  supplements (holdout only, 27→30) = 139 total attempts.
- Variant C fast-path attempts (zero-cost, local): **12**.
- Variant C AI-routed calls planned (max): **127** (development 97, holdout 30).
- **Total planned observations: 275. Total planned paid calls (B + C AI-routed): 263.**

## 9. Budget Reservation and Actual Estimated Cost

|                                    | Value                                     |
| ---------------------------------- | ----------------------------------------- |
| Authorized ceiling                 | USD 5.00                                  |
| Frozen plan worst-case reservation | **USD 4.174336** (headroom: USD 0.825664) |
| `maxInFlight`                      | 1                                         |
| Actual calls made                  | **0**                                     |
| Actual estimated cost              | **USD 0.00** (nothing spent)              |

## 10. No-Fixture-Fallback Proof

`createLiveVariantBProvider`/`createLiveVariantCInterpreter` throw a secret-free config error
before any network call whenever `ANTHROPIC_API_KEY` or the shared budget gate is missing
(`VariantBLiveProvider.ts`, `VariantCLiveInterpretationProvider.ts`, unchanged from RESOLVER-V3-013
except for the additive optional transport parameter). The live runner
(`RepresentativeHybridV1LiveRunner.ts`) never constructs or accepts a
`FixtureVariantBProvider`/`NoopVariantBProvider`/`FixtureCostAiInterpreter`/`NoopAiInterpretationProvider`
— those types are not even imported. This is additionally proven by
`RepresentativeHybridV1LiveIsolation.test.ts`.

## 11. Verification of the Credential Blocker (Performed, Not Assumed)

Run directly against the protocol-freeze commit, in this exact environment:

```text
$ node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs --preflight
...
RESOLVER-V3-039 preflight complete. planHash=214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e
maxCalls=263 worstCaseReservedCostUsd=4.174336 apiKeyPresent=false. No provider request made.

$ node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs --partition=development \
    --protocol=reports/resolver-v3-039-controlled-live-protocol.json
ANTHROPIC_API_KEY is not set. Live execution refuses to run without it, and there is no
fixture fallback. Set it in the environment (e.g. via `.env`, never committed) and retry.
$ echo $?
1
```

The second command exits `1` **before spawning the Jest harness at all** — the credential check is
the CLI's very first gate for any non-preflight mode, checked before any protocol/hash comparison,
before any budget-gate construction, before any process spawn.

## 12. Development Results

Not executed. `not_evaluable`.

## 13. Holdout Results

Not executed. `not_evaluable`. (Holdout also requires `--final-evaluation` and would additionally
require development to have completed first — neither precondition was reached.)

## 14. A/B/C Quality Metrics

Not evaluable — no case was run.

## 15. G2-A Representative Quality Analysis

`not_evaluable`. No identification/expected-behavior/component data exists for any arm.

## 16. G2-B False-Confidence Analysis

`not_evaluable`. The accepted criterion (C strictly lower than both A and B) cannot be evaluated
without any C or B observations.

## 17. G2-C Friction Analysis

`not_evaluable`. No clarification/abstention observations exist.

## 18. G2-D Latency Policy Evaluation

`not_evaluable` for every phase (fast path, AI-routed, retrieval, all-attempts) — `n = 0` in every
partition, below the n ≥ 30 floor by construction.

## 19. G2-E Cost Policy Evaluation

`not_evaluable` — zero attempted AI-routed logs exist to average.

## 20. G2-F Provenance Analysis

`not_evaluable` for source-grounded rate/missing-provenance/unbacked-numeric counts (no C
observations exist). The hard invariant "AI-generated nutrient values must never become
authoritative in C" is unviolated **by construction** (zero C observations occurred, and the
resolver code path that would need to violate it — assigning an AI-produced number as
`macrosPer100g`/`scaledNutrients` — does not exist anywhere in `ResolverV3VariantCAdapter.ts`,
independent of whether any call happened).

## 21. G2-G Consistency Analysis

`not_evaluable` — none of the 16 frozen overlay groups were observed.

## 22. Every Technical Failure

None occurred — no request was attempted, so there is nothing to report as a technical failure,
timeout, or HTTP error. (`actualUsage.technicalFailureCount = 0`, `timeoutCount = 0`,
`retryCount = 0` in the JSON report.)

## 23. Every Unknown / Not-Evaluable Field

Every quality/false-confidence/friction/latency/cost/provenance/consistency field in
`reports/resolver-v3-039-controlled-representative-live-evidence.json` is `null` with an explicit
`not_evaluable` gate verdict alongside it — never defaulted to zero or to a silent pass. See the
JSON report directly for the exhaustive field-by-field state.

## 24. Source/Provenance Results

Not evaluable (§20).

## 25. Residual Limitations

- **Primary limitation: missing `ANTHROPIC_API_KEY`.** This is the sole reason Phase B did not
  run. No workaround was attempted, per instruction ("no workarounds" / "do not ask for or assume
  a higher budget" — the analogous rule for credentials).
- The frozen plan's sample-floor supplementation logic was exercised only for Variant C AI-routed
  holdout (27→30, +3). If the real corpus's deterministic route classification is ever wrong
  (e.g. because a resolver code change altered fast-path acceptance behavior after this freeze),
  the CLI's plan-hash/corpus-hash comparison will refuse to run rather than silently using a stale
  plan — this was verified structurally (tests), not by an actual drift scenario in this session.
- The metrics/report layer (`RepresentativeHybridV1LiveMetrics.ts`,
  `RepresentativeHybridV1LiveReportBuilder.ts`) is exercised by focused tests with synthetic case
  records and a synthetic blocked-state report, but has never processed a real 100+ case live
  dataset. Its per-dimension logic (nearest-rank percentiles, partition-mean cost, false-confidence
  comparison, consistency agreement) is unit-tested against constructed examples, not integration-
  tested against real live-shaped data at the scale this protocol would eventually produce.
- This task did not attempt to acquire or request an API key from any party — that is outside its
  scope and authority.

## 26. Explicit No-Production-Effect Statement

No production DI/container registration, no feature flag, no database migration, no RPC, no
Supabase adapter change, and no UI/journal change was made by this task. Every new file lives
under `src/features/nutrition/benchmark/representativeHybridV1/live/**` or `scripts/**`. The two
modified pre-existing files (`VariantBLiveProvider.ts`, `VariantCLiveInterpretationProvider.ts`)
each received one small, optional, backward-compatible parameter addition; no existing caller or
test was changed to use it. `SequentialFoodCatalogResolver` and all other production resolver code
are untouched. This is proven structurally by
`RepresentativeHybridV1LiveIsolation.test.ts`'s "no production DI file imports the live module
tree" test, which scans the actual `src/` tree.

## 27. Handoff to the Separate Gate Re-Decision Task

A separate follow-up task, **RESOLVER-V3-041 — Representative Hybrid Gate Re-Decision After
Controlled Live Evidence**, has been added to `ROADMAP.md` as `todo`, not started, depending on
RESOLVER-V3-039 reaching a complete evidence set. `RESOLVER-V3-010` remains `blocked` and will stay
blocked until RESOLVER-V3-041 explicitly passes — this task does not and cannot change that.

## What Happens Next

Phase B remains fully specified and ready: once `ANTHROPIC_API_KEY` is available in an authorized
execution environment, running

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=development --protocol=reports/resolver-v3-039-controlled-live-protocol.json
```

followed, after inspection and with no protocol/code change in between, by

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=holdout --final-evaluation \
  --protocol=reports/resolver-v3-039-controlled-live-protocol.json
```

will execute exactly this frozen plan and produce a fully populated version of this report. No
further authorization change, code change, or protocol change is needed for that — only the
credential.
