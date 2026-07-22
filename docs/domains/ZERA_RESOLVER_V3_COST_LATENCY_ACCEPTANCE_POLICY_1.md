# Zera Resolver V3 — Cost/Latency Acceptance Policy

**Status:** `accepted` for the technical thresholds below (2026-07-22). **Task:** RESOLVER-V3-040.
**Authority:** Level 2 canonical domain authority (per `SSOK.md`) for cost/latency/retry/timeout
acceptance thresholds only. Authored independently of, and before, any RESOLVER-V3-039 live-evidence
result — this document must exist and be pinned **before** a future live run's results can be judged
against it, so that no threshold is invented post hoc to fit whatever RESOLVER-V3-039 happens to
observe.

This document does not authorize any implementation change, any live provider call, or any
retroactive threshold applied to RESOLVER-V3-013's already-recorded evidence. It does not reopen or
pass the RESOLVER-V3-010 production-wiring gate by itself — see
`RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` for that gate's current
`NOT_PASSED` status, which is unaffected by this policy document.

## 1. Evidence cutoff

This policy is authored against the repository state at commit
`9df3d6c8d6318aa5d35895de02723d1b4bd9026c` (tip of `origin/chore/clean-arch-structure`, merge of PR
#132 / RESOLVER-V3-038). No evidence dated or produced after this commit is used. The evidence base
is exactly:

- `RESOLVER_V3_COST_LATENCY_CACHE_ANALYSIS.md` (RESOLVER-V3-007, cost/latency formula framework;
  evidence run 2026-07-20).
- `RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md` (RESOLVER-V3-013, the only real live-provider evidence
  in this repository; live run 2026-07-20).
- `RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` (RESOLVER-V3-024, 2026-07-22;
  confirms G2-D/G2-E were `not_evaluable` for lack of an accepted threshold, and confirms the current
  production personal-memory read-path status used in §8 below).
- `RESOLVER_V3_038_REPRESENTATIVE_HYBRID_BENCHMARK_READINESS_REPORT.md` (RESOLVER-V3-038, `done`,
  merged via PR #132; corpus hash `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a`,
  114 scenarios, three-arm A/B/C harness ready for live provider injection).
- Direct, independent code reading of `src/infrastructure/di/container.ts` (personal-memory wiring,
  `resolverSources` composition) performed for this task, confirming rather than merely citing the
  claims in RESOLVER-V3-024 §27/§31.

## 2. Evidence-class definitions

Reused verbatim from RESOLVER-V3-007/RESOLVER-V3-024's convention, not reinvented: **measured** =
observed in a named run; **fixture-only** = synthetic metadata, never a provider/production claim;
**assumed** = a stated scenario input, never presented as fact; **derived** = a formula result;
**normative policy choice** = a value this document deliberately sets, informed by measured evidence
plus an explicit stated margin, but not itself a measurement; **unknown** = absent, so no numeric
claim is permitted in its place, and a missing denominator or missing evidence is `unknown` /
`not_evaluable`, **never** silently treated as zero.

Every threshold below states which of these classes it rests on, and every numeric value in this
document is classified in the summary table in §12.

## 3. Latency thresholds

| Path                             | Measured evidence (V3-013, small sample) | Accepted policy budget                               | Basis                                                                                                                                                                                               |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fast path (no AI call)           | n=7, p50 49.205 ms, p95 300.696 ms       | **p95 ≤ 1,000 ms**                                   | ~3.3x measured p95 headroom; cheap to police; normative policy choice                                                                                                                               |
| AI-routed single attempt         | n=7, p50 5,152.507 ms, p95 7,430.044 ms  | **p95 ≤ 12,000 ms** for one attempt (no retry)       | ~1.6x measured p95 headroom, widened from a bare ~1.35x specifically because n=7 is a tiny sample with material tail-estimation risk (see §4's retry/timeout interaction) — normative policy choice |
| Retrieval (source-network) phase | n=14, p50 0.000 ms, p95 103.207 ms       | **p95 ≤ 2,000 ms** for the retrieval phase alone     | wide headroom; local/fixture-adjacent sources today; normative policy choice                                                                                                                        |
| All-attempts (any path)          | n=14, p50 300.696 ms, p95 7,430.044 ms   | **p95 ≤ 12,000 ms** (dominated by the AI-routed row) | see AI-routed row                                                                                                                                                                                   |

**Change from the prior draft:** the AI-routed p95 budget is widened from 10,000 ms to 12,000 ms.
The measured n=7 p95 of 7,430.044 ms is too small a sample to trust a ~1.35x margin as durable
headroom — a single additional slow call in a 7-call sample can move the p95 substantially. 12,000 ms
(~1.6x) is still a real, tight, policed ceiling, not a loose one; it is chosen as a deliberately more
conservative predeclared bound precisely because RESOLVER-V3-039 will report a p95 over a larger
sample that may legitimately land anywhere in this small sample's confidence range.

**Binding rule:** every budget above is a **p95 ceiling on a real, live-measured population**, never
on a fixture run. RESOLVER-V3-039 (or any later evaluation) must state its own sample size `n` next
to any p50/p95 it reports against this budget. Per §10's minimum-sample rule, `n` below 30 for a given
path/partition is reported as a small-sample observation and is **not evaluable** for gate-pass
purposes (it may still be disclosed).

**Explicitly not set:** cold-start vs. warm-cache latency separation, and provider-side tail behavior
under real concurrent load. Both remain `unknown` (RESOLVER-V3-007 §"Latency model") and must be
measured, not assumed, before this table can be tightened.

## 4. Timeout, retry, and total wall-clock policy

- **Provider request timeout:** 15 seconds maximum for any single attempt (chosen to sit above the
  measured AI-routed p95 of 7,430 ms with real margin for network/provider-side variance not captured
  in a 7-call sample).
- **Retry policy:** at most **one** automatic retry on a transient/5xx/timeout failure, never on a
  successful-but-low-confidence response — RESOLVER-V3-013 recorded **zero** automatic network
  retries in its one live run (the 8 B-side "retried" markers were planned repeat-consistency
  attempts, not automatic retries, and must not be conflated with this budget).
- **Backoff:** if a retry occurs, it must use a fixed short backoff (≤ 500 ms) before the single retry
  attempt — no unbounded or exponential-with-many-attempts retry loop is authorized by this budget.
- **Total wall-clock ceiling per attempted log, including any retry and backoff:** 20 seconds. This is
  the ultimate, outer bound and takes priority over the per-attempt timeout: a retry is only initiated
  if enough wall-clock budget remains to plausibly complete it, and any in-flight attempt (initial or
  retry) must fail closed at the 20-second wall-clock boundary even if its own 15-second per-attempt
  timeout has not yet elapsed. **Correction made during this task's independent review:** the prior
  draft stated a 15 s per-attempt timeout, one retry, and a 20 s total ceiling without reconciling
  that two full 15 s attempts plus backoff (≈30.5 s) can exceed a 20 s total — an internal
  inconsistency. This section resolves it by making the wall-clock ceiling authoritative over the
  per-attempt timeout rather than changing any of the three numbers.
- Exceeding the wall-clock ceiling must fail closed — to abstention or a clarification request —
  **never** to a low-confidence resolution presented as if it were confident. This is a direct,
  binding continuation of the false-confidence discipline already established across
  RESOLVER-V3-003 through RESOLVER-V3-024 (e.g. the `RV3-0011` case), not a new invention of this
  policy.

## 5. Cost thresholds

Reusing RESOLVER-V3-007's cost formula unchanged: `K_new(C) = (1-F)(1-C) * [q(1+r)(Tin·Pin +
Tout·Pout + Rai) + s·Rs]`, with `K_successful = K_new/(1-e)`, `K_validated = K_new/v`,
`K_correct_complex = K_new/k`.

**Measured baseline (V3-013, n=7 AI-routed Hybrid C calls, single pinned model/price snapshot):**
11,352 input tokens / 2,988 output tokens / USD 0.026292 total ⇒ **≈USD 0.00376 per AI-routed call**,
at USD 1.00/M input + USD 5.00/M output token pricing dated 2026-07-20.

| Ceiling                                           | Value                                                                      | Basis                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cost per attempted AI-routed log                  | **≤ USD 0.02** — a partition-level **mean**, see §10's aggregation rule    | ~5.3x the measured USD 0.00376 baseline — margin for prompt/schema growth, output-token variance (the largest cost sensitivity per RESOLVER-V3-007), and the untested `COMPOSED`/`HOMEMADE`/`RESTAURANT` categories, which are expected to need longer completions than the 14-case smoke corpus; normative policy choice |
| Cost per successful/validated/correct-complex log | `K_new/(1-e)`, `K_new/v`, `K_new/k` — **formula only, no numeric ceiling** | `e`, `v`, `k` are **unknown** (RESOLVER-V3-007); inventing a numeric ceiling for a denominator that has never been measured would fabricate a value this task is explicitly forbidden to fabricate. A missing/unknown denominator makes the result `unknown`, not `not_passed` and not `$0`                               |
| Source request cost (BLS/OFF/USDA)                | **assumed USD 0** direct marginal cost today                               | BLS is local static data; OFF and USDA are free public APIs at present — this is an **assumed**, not measured, present-state fact, and must be re-checked if either provider's terms change; only rate-limit/availability risk is currently in scope, not billing                                                         |

**Explicitly not set:** any absolute monthly cost ceiling in dollars. RESOLVER-V3-007 already found
`F` (production fast-path share) and `C` (personal-memory hit rate) both **unknown** in production —
multiplying an unknown `N` (monthly volume) by a per-call ceiling to produce a fixed monthly dollar
figure would be exactly the kind of invented number this task exists to avoid, and would additionally
require a product-economics decision this document does not have standing to make (§6). §7 fixes the
_scenario structure_ instead; a numeric monthly ceiling can only be pinned once real `N`/`F`/`C`
telemetry exists and a product-tier economics decision (§6) has been made.

## 6. Product-tier economics boundary

**Deferred — not authored by this document.** Whether Hybrid C's per-call cost budget (§5) is
absorbed as a cost of a paid tier, gated behind a paid tier (`P2-010: Paid-only Gating for AI
Endpoints`, confirmed still `todo` in the current `ROADMAP.md` — no AI/premium edge function exists
yet to gate), or subsidized during a private/pilot phase is a product/business decision, not an
engineering threshold — it requires a subscription price point, a target margin, and a free-tier
allowance decision from the product owner, none of which this document invents.
**RESOLVER-V3-039's results may be judged against §3–§5's engineering thresholds without this
section being resolved first**, since §3–§5 (not §6) are what RESOLVER-V3-024's G2-D/G2-E gate
dimensions require (§10).

## 7. Monthly volume scenarios

Reusing RESOLVER-V3-007's own three-scenario structure (Conservative / Base / Unfavourable) rather
than inventing a new one, and its symbolic-volume convention (`N_low`, `N_base`, `N_high` as
order-of-magnitude product-stage buckets, never a committed business projection):

| Scenario | Volume bucket (order of magnitude, not a projection)                  | `F`, `C` assumption                                                                                                                  |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `N_low`  | pilot / private-use scale (single-digit-to-low-double-digit logs/day) | `F=0`, `C=0` — a deliberate conservative/worst-case scenario input, see §8's semantics; matches RESOLVER-V3-007's "Conservative" row |
| `N_base` | early-access scale (order of hundreds of logs/day)                    | `F` and `C` **unknown**, must be measured from real traffic before use                                                               |
| `N_high` | broader-launch scale (order of thousands+ logs/day)                   | `F` and `C` **unknown**, must be measured; sensitivity-stress only per RESOLVER-V3-007's "Unfavourable" row                          |

Monthly cost for any scenario is computed as `K_month(N,C) = N · K_new(C)` per RESOLVER-V3-007's
formula, using §5's per-call ceiling as `K_new`'s numeric input only once real `F`/`C`/`N` telemetry
exists. No scenario in this table is a business commitment; each is a sensitivity bucket for
engineering planning only.

## 8. Personal-memory implementation status, hit-rate uncertainty, and cache/fast-path assumptions

**Critical factual correction made by this task.** A prior draft of this policy (on the discarded
`claude/autonomous-tasks-flight-hdewii` branch) stated that no personal-cache read path exists and
that `C=0` was therefore "the only defensible assumption" as an architectural fact. **That statement
is obsolete and is not carried forward.** Independent code reading performed for this task
(`src/infrastructure/di/container.ts`) and RESOLVER-V3-024 §20/§27/§28 both confirm the current,
accepted state is:

- A production-wired, same-owner private personal-memory read path **exists**:
  `PersonalResolutionMemoryAwareFoodCatalogResolver` wraps the base resolver in `container.ts`
  (`SupabasePersonalResolutionMemoryReadRepository` in non-test environments;
  `NoopPersonalResolutionMemoryReadRepository` in test environments), implemented and merged under
  RESOLVER-V3-019/026/027.
- It performs **exact, confirmed P2 reuse**: exact-match only, keyed on the already-resolved
  `{sourceType, sourceId}` identity (never raw or normalized query text), `P2_confirmed`-only for
  deterministic reuse.
- It **can avoid later interpretation/resolution work** for eligible matches (a `P2_confirmed` match
  deterministically selects that candidate, avoiding an AI call for that log).
- **Invalidation and owner isolation exist**: owner-scoped RLS, atomic plan-then-commit invalidation
  (RESOLVER-V3-027), fails open on any missing owner/lookup/error.
- **The real production traffic-level hit rate remains unknown**: RESOLVER-V3-010 (hybrid production
  wiring) remains `blocked`, so there is no production Hybrid traffic to measure a hit rate against
  in the first place (RESOLVER-V3-024 §27/§29).
- **No production Hybrid traffic distribution exists.**

**Required distinction, stated exactly as this task requires:**

```text
Implementation availability:
  personal-memory read path exists

Measured production hit rate:
  unknown

Conservative benchmark/economic scenario:
  C = 0 may still be selected as a deliberate worst-case assumption
```

This document does **not** claim `C = 0 because the cache/read path does not exist`, and does not
present the deliberately conservative `C=0` scenario in §7's `N_low` row as an architectural fact —
`C=0` there is a chosen worst-case scenario input for a sensitivity bucket, exactly as RESOLVER-V3-007
already labels its own "Conservative" scenario, not a statement about what is or is not implemented.

Additional cache/fast-path assumptions:

- The fast-path share observed in RESOLVER-V3-013's 14-case smoke corpus (7/14 = 50%) is **explicitly
  not** a production planning assumption — RESOLVER-V3-007 states `F` is unknown in production, and
  the smoke corpus itself lacks `COMPOSED`/`HOMEMADE`/`RESTAURANT` coverage, which are expected to
  route to AI more often, not less.
- Any future personal-memory/fast-path telemetry must report cold vs. warm separately (§3) and must
  never be blended with fixture-corpus fast-path counts when computing a production `F`/`C` value.
- The personal-memory read path's own benchmark-fixture avoided-call evidence (Learning Benchmark V2
  `INV-02`: 2 avoided interpretation calls, measured, real use cases, fixture repository) is real but
  is not production traffic-level evidence and must not be blended with production `C`.

## 9. Provider-price freshness requirement

This policy does **not** authorize any live provider lookup or live request; the USD 1.00/M input /
USD 5.00/M output token snapshot dated 2026-07-20 is cited **historically**, as the pricing in effect
when RESOLVER-V3-013's evidence was collected. It must not be silently treated as current. Before
RESOLVER-V3-039 executes, it must:

- re-check the provider's current price for the pinned model before execution;
- pin a dated pricing snapshot for its own run, separate from and not defaulting to the 2026-07-20
  snapshot;
- **fail closed** (report `unknown`, never a fabricated or reused-without-verification price) if
  current pricing cannot be confirmed;
- compare its actual measured usage against this document's §5 threshold using **its own** current
  pinned price, not the 2026-07-20 snapshot, unless that snapshot is independently re-verified as
  still accurate at execution time.

## 10. G2-D and G2-E mapping for RESOLVER-V3-039

Per `RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` §9, G2-D (latency) and G2-E
(cost) were `not_evaluable` for lack of a pre-declared, non-post-hoc threshold. §3–§5 of this document
are that threshold, pinned **before** RESOLVER-V3-039 collects any new evidence. The rules below are
the complete, unambiguous pass/fail mapping; nothing about aggregation, retries, or partitions is left
open for RESOLVER-V3-039 to decide for itself.

### G2-D latency

- **Measured population:** every attempted log in the applicable path population (fast path,
  AI-routed, retrieval, all-attempts — §3), including technical failures and the (at most one) retry
  attempt's elapsed time. Technical failures are **not** excluded from the population; a terminal
  failure still contributes its elapsed wall-clock time to the relevant percentile.
- **Percentile:** p95, nearest-rank, computed over complete end-to-end traces per RESOLVER-V3-007's
  latency-model rule (never summed from independently-computed phase percentiles).
- **Partition treatment:** development and holdout partitions are evaluated **separately**; both must
  independently pass for G2-D to pass overall. Neither partition's result may be averaged with, or
  substitute for, the other's.
- **Route treatment:** fast path, AI-routed (single-attempt), retrieval phase, and all-attempts are
  each evaluated against their own §3 ceiling; a violation in any one of the four applicable rows
  fails G2-D for that partition.
- **Retry treatment:** a retried attempt's elapsed time is counted in the all-attempts and (if
  AI-routed) AI-routed populations; the retry does not get a separate, discounted accounting. The
  total wall-clock ceiling (§4) is evaluated as its own pass/fail check, independent of the p95
  ceilings: any single attempted log whose total elapsed time (including retry and backoff) exceeds
  20 seconds without failing closed is itself a G2-D failure for that partition, regardless of the
  partition's aggregate p95.
- **Timeout treatment:** an attempt that hits the 15 s per-attempt timeout or the 20 s wall-clock
  ceiling and does not fail closed (i.e. returns a confident-looking result instead of abstaining/
  requesting clarification) is a hard G2-D failure for that partition, independent of any percentile
  computation.
- **Minimum sample disclosure:** RESOLVER-V3-039 must report `n` for every percentile against every
  applicable path/partition. Per RESOLVER-V3-013's own established small-sample convention, any
  path/partition population with `n < 30` is disclosed but treated as **`not_evaluable`** for
  gate-pass purposes for that specific path/partition — it does not count as either a pass or a
  fail, and it does not default to a pass.
- **One-violation rule:** within a gate-evaluable (`n ≥ 30`) path/partition, a single reported p95
  (or the wall-clock/timeout hard checks above) exceeding its ceiling fails G2-D for that partition.
  This is a **hard per-metric check on the aggregate percentile**, not an average-across-partitions
  or average-across-paths rule — one exceeded ceiling in one gate-evaluable path/partition is
  sufficient to fail G2-D for that run, mirroring the false-confidence dimension's own
  non-averageable, hard-criterion treatment.

### G2-E cost

- **Cost population:** attempted AI-routed logs only (matching §5's "cost per attempted AI-routed
  log" definition), including retries (a retried attempt's additional token/cost is included in that
  log's total attempted cost) and terminal technical failures (a failed attempt that still consumed
  provider tokens still counts its cost).
- **Aggregation rule (explicit, not left ambiguous):** the §5 ≤ USD 0.02 ceiling is evaluated as the
  **partition-level mean** — total estimated cost of all attempted AI-routed logs in the partition,
  divided by the count of attempted AI-routed logs in that partition — not a per-individual-log hard
  cap. This is a deliberate choice: real per-log cost is expected to vary by category (composed/
  homemade/restaurant cases plausibly cost more per log than simple cases), and gating on the
  partition mean, with the pre-declared ≥5.3x margin already built into the ceiling, is the rule that
  makes the threshold meaningful without requiring every individual outlier case to separately clear
  the bar. Development and holdout partitions are evaluated separately; both must pass.
- **Price snapshot requirement:** every cost figure used in the gate check must use RESOLVER-V3-039's
  own freshly re-verified price snapshot (§9), not the 2026-07-20 snapshot, unless that snapshot is
  independently reconfirmed as still accurate.
- **Missing token usage:** if actual input/output token usage is not available for an attempted
  AI-routed log (e.g. a delivery gap like V3-013's unresolved cache-token fields), that log's cost is
  `unknown`, and the partition's mean cost is itself `not_evaluable` unless the missing-usage logs are
  a small enough, disclosed minority that RESOLVER-V3-039 can still compute a defensible mean over the
  remaining known-usage logs — this determination must be disclosed explicitly, not silently decided.
- **Unavailable billing metadata:** the same `unknown`/`not_evaluable` treatment applies to any other
  missing billing-relevant field (e.g. an unresolved HTTP status or cache-token field, as seen in
  V3-013); it is never treated as a $0 cost.
- **Source costs:** included per §5's current assumption (assumed USD 0 for BLS/OFF/USDA); if that
  assumption is no longer valid at RESOLVER-V3-039's execution time (a provider terms/pricing change),
  RESOLVER-V3-039 must disclose the change and include the real source cost rather than silently reuse
  the assumption.
- **Estimated vs. invoiced cost:** every cost figure in this policy and in RESOLVER-V3-039's results is
  an **estimated provider cost** derived from returned token usage and a pinned price snapshot — never
  an invoice. This distinction must be stated explicitly in RESOLVER-V3-039's own report, exactly as
  RESOLVER-V3-013's report already does.
- **Missing denominator:** if the attempted-AI-routed-log count itself is zero or otherwise
  undefined for a partition, the result is `not_evaluable`, **never** `$0` and never a default pass.
- **One-violation rule:** the partition-level mean exceeding USD 0.02 fails G2-E for that partition;
  since this is already a mean (not a percentile), no separate "one case vs. aggregate" ambiguity
  exists beyond what is stated above — the mean itself is the single number checked against the
  ceiling, per partition.

### Overall G2-D/G2-E outcome

G2-D passes only if every gate-evaluable path/partition combination in §3/§4's ceilings passes, with
no `not_evaluable` combination silently counted as a pass. G2-E passes only if every gate-evaluable
partition's mean cost passes, with the same rule. A `not_evaluable` result for either dimension keeps
that dimension `not_evaluable` overall — it is not averaged away by other passing combinations, and it
does not retroactively apply to RESOLVER-V3-013's already-recorded evidence, which predates and is not
re-scored by this policy.

## 11. Non-goals

This document does not: change any implementation; make any live provider call; retroactively judge
RESOLVER-V3-013's already-recorded evidence against §3–§5 (that evidence predates this policy and is
disclosed, not re-scored); set a numeric monthly dollar ceiling (§5, §7); or resolve product-tier
economics (§6). RESOLVER-V3-039 remains not started and not authorized by this document. This
document does not reopen or pass RESOLVER-V3-010, RESOLVER-V3-039, or any other gate by itself.

## 12. Threshold classification summary

| Value                                                        | Classification                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Fast-path p95 ≤ 1,000 ms                                     | Normative policy choice, margined on measured evidence (n=7)                             |
| AI-routed single-attempt p95 ≤ 12,000 ms                     | Normative policy choice, margined on measured evidence (n=7)                             |
| Retrieval-phase p95 ≤ 2,000 ms                               | Normative policy choice, margined on measured evidence (n=14)                            |
| Provider timeout 15 s / one retry / ≤500 ms backoff          | Normative policy choice                                                                  |
| Total wall-clock ceiling 20 s (authoritative over timeout)   | Normative policy choice, corrected for internal consistency during this task             |
| Cost per attempted AI-routed log ≤ USD 0.02 (partition mean) | Normative policy choice, margined on measured evidence (n=7)                             |
| `K_successful`/`K_validated`/`K_correct_complex` formulas    | Derived (formula), no numeric ceiling — denominators `e`/`v`/`k` unknown                 |
| Source request cost = USD 0                                  | Assumed (present-state), not measured or guaranteed                                      |
| Monthly dollar ceiling                                       | Not set — would require unknown `F`/`C`/`N` and an unmade product-tier decision          |
| `N_low`/`N_base`/`N_high` volume buckets                     | Assumed, symbolic, order-of-magnitude only                                               |
| Personal-memory read-path implementation                     | Measured / architectural fact (confirmed by direct code reading)                         |
| Personal-memory production hit rate                          | Unknown                                                                                  |
| `C=0` in the `N_low` conservative scenario                   | Normative policy choice (deliberate worst case), not an architectural fact               |
| 2026-07-20 pricing snapshot                                  | Measured, historical only — not current                                                  |
| Minimum gate-evaluable sample size n≥30                      | Normative policy choice, reused from RESOLVER-V3-013's established convention            |
| G2-E cost aggregation = partition mean                       | Normative policy choice (this task's explicit resolution of an otherwise-ambiguous rule) |

## 13. Residual unknowns

The following remain unknown after this policy and are not resolved by it: production `F` (fast-path
share), production `C` (personal-memory hit rate), production `N` (monthly volume), `e`/`v`/`k`
(error/validated/correct-complex shares), current (not 2026-07-20) provider pricing, cold/warm latency
separation, provider-side tail behavior under real concurrent load, and any product-tier economics
decision (§6). RESOLVER-V3-039 is expected to close some of these; none are guessed here.

## 14. No-production-effect statement

This task changed no resolver behavior, no review behavior, no benchmark corpus, no registry, no
canonical historical report, no production wiring, no feature flag, no Supabase migration/RPC/
adapter, no package/dependency, and made no provider call of any kind. It is a documentation task
only, confined to this document plus the `ROADMAP.md` and `handoffs/latest-handoff.md` status/handoff
updates required to record its outcome.
