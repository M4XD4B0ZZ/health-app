# Zera Resolver V3 — Cost/Latency Acceptance Policy

**Status:** `accepted` for the technical thresholds below (2026-07-22). **Task:** RESOLVER-V3-040.
**Authority:** Level 2 canonical domain authority for cost/latency/retry/timeout acceptance
thresholds only. Authored independently of, and before, any RESOLVER-V3-039 live-evidence result —
per this task's own binding requirement, this document must exist and be pinned **before** a future
live run's results can be judged against it, so that no threshold is invented post hoc to fit
whatever RESOLVER-V3-039 happens to observe.

This document does not authorize any implementation change, any live provider call, or any
retroactive threshold applied to RESOLVER-V3-013's already-recorded evidence (RESOLVER-V3-040
non-goals). It does not reopen or pass the RESOLVER-V3-010 production-wiring gate by itself — see
`RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` for that gate's current
`NOT_PASSED` status, which is unaffected by this policy document.

## 1. Evidence base and honesty convention

This policy reuses `RESOLVER_V3_COST_LATENCY_CACHE_ANALYSIS.md` (RESOLVER-V3-007)'s exact
evidence-labeling convention throughout: **measured** = observed in a named run; **fixture-only** =
synthetic metadata, never a provider/production claim; **assumed** = a stated scenario input, never
presented as fact; **derived** = a formula result; **unknown** = absent, so no numeric claim is
permitted in its place. Every threshold below states which of these it rests on. No threshold in
this document is invented from nothing — each one either reuses a real measured value (with its
sample-size caveat carried forward) plus an explicit, stated safety margin, or is deferred as
`unknown pending measurement` rather than guessed.

Primary evidence sources, both already accepted canonical reports:

- `RESOLVER_V3_COST_LATENCY_CACHE_ANALYSIS.md` (RESOLVER-V3-007): cost/latency formula framework;
  fixture-corpus-only cost/latency figures; explicit "not derivable" conclusion for production
  bounds absent live evidence.
- `RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md` (RESOLVER-V3-013): the only real, live-provider
  cost/latency/token evidence that exists anywhere in this repository to date — one controlled,
  non-repeatable live run, 14-case corpus (lacking `COMPOSED`/`HOMEMADE`/`RESTAURANT` coverage per
  its own disclosure), `claude-haiku-4-5`, pinned price snapshot USD 1.00/M input tokens / USD
  5.00/M output tokens (dated 2026-07-20 — must be re-verified against the live provider's current
  pricing before being relied on again, since prices change).

## 2. Latency budget

| Path                             | Measured evidence (V3-013, small sample) | Accepted production budget                              | Basis                                               |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| Fast path (no AI call)           | n=7, p50 49.205 ms, p95 300.696 ms       | **p95 ≤ 1,000 ms**                                      | ~3.3x measured p95 headroom; cheap to police        |
| AI-routed (Hybrid C)             | n=7, p50 5,152.507 ms, p95 7,430.044 ms  | **p95 ≤ 10,000 ms** (10 s) end-to-end per attempted log | ~1.35x measured p95 headroom                        |
| Retrieval (source-network) phase | n=14, p50 0.000 ms, p95 103.207 ms       | **p95 ≤ 2,000 ms** for the retrieval phase alone        | wide headroom; local/fixture-adjacent sources today |
| All-attempts (any path)          | n=14, p50 300.696 ms, p95 7,430.044 ms   | **p95 ≤ 10,000 ms** (dominated by the AI-routed row)    | see AI-routed row                                   |

**Binding rule:** every budget above is a **p95 ceiling on a real, live-measured population**, never
on a fixture run. A future evaluation (RESOLVER-V3-039 or later) must state its own sample size `n`
next to any p50/p95 it reports against this budget; `n` below roughly 30 per path must be reported
as a small-sample observation, not a production SLO claim, mirroring RESOLVER-V3-013's own explicit
caveat.

**Explicitly not set:** cold-start vs. warm-cache latency separation, and provider-side tail
behavior under real concurrent load. Both remain `unknown` (RESOLVER-V3-007 §"Latency model") and
must be measured, not assumed, before this table can be tightened.

## 3. Timeout and retry budget

- **Provider request timeout:** 15 seconds per attempt (chosen to sit above the measured AI-routed
  p95 of 7,430 ms with real margin for network/provider-side variance not captured in a 7-call
  sample).
- **Retry policy:** at most **one** automatic retry on a transient/5xx/timeout failure, not on a
  successful-but-low-confidence response — RESOLVER-V3-013 recorded **zero** automatic network
  retries in its one live run (the 8 B-side "retried" markers were planned repeat-consistency
  attempts, not automatic retries, and must not be conflated with this budget).
- **Total wall-clock ceiling per attempted log, including any retry:** 20 seconds. Exceeding it must
  fail closed — to abstention or a clarification request — **never** to a low-confidence resolution
  presented as if it were confident. This is a direct, binding continuation of the false-confidence
  discipline already established across RESOLVER-V3-003 through RESOLVER-V3-024 (e.g. the `RV3-0011`
  case), not a new invention of this policy.
- **Backoff:** if a retry occurs, it must use a fixed short backoff (≤ 500 ms) before the single
  retry attempt — no unbounded or exponential-with-many-attempts retry loop is authorized by this
  budget.

## 4. Cost budget

Reusing RESOLVER-V3-007's cost formula unchanged: `K_new(C) = (1-F)(1-C) * [q(1+r)(Tin·Pin +
Tout·Pout + Rai) + s·Rs]`, with `K_successful = K_new/(1-e)`, `K_validated = K_new/v`,
`K_correct_complex = K_new/k`.

**Measured baseline (V3-013, n=7 AI-routed Hybrid C calls, single pinned model/price snapshot):**
11,352 input tokens / 2,988 output tokens / USD 0.026292 total ⇒ **≈USD 0.00376 per AI-routed
call**, at USD 1.00/M input + USD 5.00/M output token pricing dated 2026-07-20.

| Ceiling                                           | Value                                                                      | Basis                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cost per attempted AI-routed log                  | **≤ USD 0.02**                                                             | ~5.3x the measured USD 0.00376 baseline — margin for prompt/schema growth, output-token variance (the largest cost sensitivity per RESOLVER-V3-007), and the untested `COMPOSED`/`HOMEMADE`/`RESTAURANT` categories, which are expected to need longer completions than the 14-case smoke corpus |
| Cost per successful/validated/correct-complex log | `K_new/(1-e)`, `K_new/v`, `K_new/k` — **formula only, no numeric ceiling** | `e`, `v`, `k` are **unknown** (RESOLVER-V3-007); inventing a numeric ceiling for a denominator that has never been measured would violate this task's own stated risk ("setting thresholds… instead of before")                                                                                  |
| Source request cost (BLS/OFF/USDA)                | **assumed USD 0** direct marginal cost today                               | BLS is local static data; OFF and USDA are free public APIs at present — this is an **assumed**, not measured, present-state fact, and must be re-checked if either provider's terms change; only rate-limit/availability risk is currently in scope, not billing                                |

**Explicitly not set:** any absolute monthly cost ceiling in dollars. RESOLVER-V3-007 already found
`F` (production fast-path share) and `C` (personal-cache hit rate) both **unknown** in production —
multiplying an unknown `N` (monthly volume) by a per-call ceiling to produce a fixed monthly dollar
figure would be exactly the kind of invented number this task exists to avoid. §6 below fixes the
_scenario_ structure instead; a numeric monthly ceiling can only be pinned once real `N`/`F`/`C`
telemetry exists.

## 5. Product-tier economics

**Deferred — not authored by this document.** Whether Hybrid C's per-call cost budget (§4) is
absorbed as a cost of a paid tier, gated behind a paid tier (see `P2-010: Paid-only Gating for AI
Endpoints`, still `todo`), or subsidized during a private/pilot phase is a product/business decision,
not an engineering threshold — it requires a subscription price point, a target margin, and a
free-tier allowance decision from the product owner. This document intentionally does not invent
those numbers. **RESOLVER-V3-039's results may be judged against §2–§4's engineering thresholds
without this section being resolved first**, since §2–§4 (not §5) are what RESOLVER-V3-024's G2-D/
G2-E gate dimensions require.

## 6. Monthly volume scenarios

Reusing RESOLVER-V3-007's own three-scenario structure (Conservative / Base / Unfavourable) rather
than inventing a new one, and its symbolic-volume convention (`N_low`, `N_base`, `N_high` as
order-of-magnitude product-stage buckets, never a committed business projection):

| Scenario | Volume bucket (order of magnitude, not a projection)                  | `F`, `C` assumption                                                                                         |
| -------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `N_low`  | pilot / private-use scale (single-digit-to-low-double-digit logs/day) | `F=0`, `C=0` — conservative, matches RESOLVER-V3-007's "Conservative" row                                   |
| `N_base` | early-access scale (order of hundreds of logs/day)                    | `F` and `C` **unknown**, must be measured from real traffic before use                                      |
| `N_high` | broader-launch scale (order of thousands+ logs/day)                   | `F` and `C` **unknown**, must be measured; sensitivity-stress only per RESOLVER-V3-007's "Unfavourable" row |

Monthly cost for any scenario is computed as `K_month(N,C) = N · K_new(C)` per RESOLVER-V3-007's
formula, using §4's per-call ceiling as `K_new`'s numeric input only once real `F`/`C`/`N` telemetry
exists. No scenario in this table is a business commitment; each is a sensitivity bucket for
engineering planning only.

## 7. Cache/fast-path assumptions

- The 50% fast-path share (7/14) observed in RESOLVER-V3-013's smoke corpus is **explicitly not** a
  production planning assumption — RESOLVER-V3-007 states `F` is unknown in production, and the
  smoke corpus itself lacks `COMPOSED`/`HOMEMADE`/`RESTAURANT` coverage, which are expected to route
  to AI more often, not less.
- No personal-cache hit rate (`C`) exists yet — the read path over `food_resolver_runs`/
  `food_query_cache_results` that RESOLVER-V3-008 proposed has no production reuse implementation as
  of this document (confirmed unchanged by RESOLVER-V3-007 §"Fast path and future personal cache").
  `C=0` remains the only defensible planning assumption until that read path exists and is measured.
- Any future personal-cache/fast-path telemetry must report cold vs. warm separately (§2) and must
  never be blended with fixture-corpus fast-path counts when computing a production `F`/`C` value.

## 8. Relationship to RESOLVER-V3-039 (G2-D/G2-E)

Per `RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md` §9/§26, gate dimensions
G2-D (latency) and G2-E (cost) were `not_evaluable` for lack of a pre-declared, non-post-hoc
threshold. §2–§4 of this document are that threshold, pinned **before** RESOLVER-V3-039 collects any
new evidence. A future RESOLVER-V3-039 result:

- **passes G2-D** if its measured, real-sample p95 for the AI-routed path is ≤ 10,000 ms (§2) and
  its total wall-clock (including any retry) never exceeds 20,000 ms without failing closed (§3);
- **passes G2-E** if its measured cost per attempted AI-routed log is ≤ USD 0.02 (§4), against a
  freshly re-verified provider price snapshot (not the 2026-07-20 snapshot reused verbatim, if
  provider pricing has since changed);
- must report its own sample size next to every percentile, per §2's binding rule.

## 9. Non-goals (restated)

This document does not: change any implementation; make any live provider call; retroactively judge
RESOLVER-V3-013's already-recorded evidence against §2–§4 (that evidence predates this policy and is
disclosed, not re-scored); set a numeric monthly dollar ceiling (§4, §6); or resolve product-tier
economics (§5). RESOLVER-V3-039 remains not started and not authorized by this document.
