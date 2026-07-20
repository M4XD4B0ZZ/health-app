# RESOLVER-V3-007 — Cost, Latency & Cache Analysis

**Status:** completed analysis; no product decision and no production wiring.
**Evidence run:** 2026-07-20, corpus/harness v1.0.0, 14 shared smoke cases. The three canonical CLIs were rerun in their default modes. A is local resolver/BLS evidence; B and C are fixture runs.

## Executive summary

1. A useful provisional model is possible now: B/C run metadata has provider/model, mode, latency, tokens, cost, pricing status, HTTP error, request counts, and C phase timings.
2. Production bounds are **not derivable**: no real B/C tokens, billed cost, retry/error distribution, source-network latency, or live repeat variability exists.
3. Fixture values remain fixture-only. B 0 ms / $0 / 0 tokens and C $0/no token fields are synthetic, not provider evidence. A p50/p95 28.82/95.53 ms and C 62.99/107.58 ms are local-harness measurements, not production SLOs.
4. C avoided seven AI calls because seven of fourteen corpus cases used the current resolver fast path. This is not a personal-cache hit rate.
5. A controlled live-evidence task is required before re-reviewing V3-006. RESOLVER-V3-013 is added with identical B/C corpus, pinned versions, repeated live runs, real telemetry, no fixture fallback, and no production wiring.

## Evidence inventory

Labels: **measured** = observed in a named run; **fixture-only** = synthetic metadata; **assumed** = scenario input; **derived** = formula result; **unknown** = absent, so no numeric claim is permitted.

| Variant | Fields                                                                                                        | Current evidence                                                                                                                             | Limit                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A       | total latency, p50/p95, resolver/source behavior                                                              | p50 28.82 ms, p95 95.53 ms (**measured**, 14-case local resolver/BLS harness)                                                                | no AI/token/cost fields; not production network latency                            |
| B       | mode, provider/model, latency, input/output tokens, cost, pricing status, HTTP error, calls/requests, p50/p95 | fixture; 0/0 ms, 22 calls/requests, 0/0 tokens, $0 (**fixture-only**)                                                                        | plumbing only; no real provider cost/latency/error/consistency                     |
| C       | B-like AI fields; fast-path count; AI/retrieval/fast-path/total phases; source requests                       | 7/14 fast paths, 7 avoided calls, 7 AI calls, 13 requests; p50/p95 62.99/107.58 ms (**measured** local orchestration); $0 (**fixture-only**) | no real AI tokens/cost/latency; BLS-local retrieval is not source-network evidence |

Live adapters can obtain provider usage and estimate token cost only for their pinned default model; an override deliberately reports pricing unknown. They do not establish invoices, fixed request fees, or retry/timeout counters from a real run.

## Cost model

Record per provider/model/version: currency and price effective date; input/output token prices; any cached-token, tool/search, regional, batch, or fixed-request price; actual tokens; billed cost if available; success/failure/retry; and AI-route/bypass. For sources record request count, charge, timeout, retry, and outcome. Without applicable price and actual usage, cost is **unknown**, never zero.

| Symbol         | Meaning                                                       | Status                                                           |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| F              | share reaching validated fast path                            | 7/14 **measured** only in fixture corpus; production **unknown** |
| C              | personal-cache hit rate among non-fast-path logs after V3-008 | **unknown**; scenario only                                       |
| U = (1-F)(1-C) | AI-routed share after cache                                   | **derived**                                                      |
| q              | AI requests per routed log                                    | **assumed**; C spike currently makes one interpretation call     |
| Tin, Tout      | billed input/output tokens per request                        | **unknown**                                                      |
| Pin, Pout      | current token prices                                          | **unknown** until dated/pinned live price                        |
| Rai            | fixed AI request/tool/search charge                           | **unknown**                                                      |
| r, e           | retry rate and terminal error rate after retries              | **unknown**                                                      |
| s, Rs          | source requests per routed log and source request cost        | local count only; production charge **unknown**                  |
| v, k           | validated share and correctly resolved complex share          | **unknown** for live B/C                                         |

Let Pcall = Tin*Pin + Tout*Pout + Rai. The expected cost per attempted new log is:

K_new(C) = (1-F)(1-C) * [q(1+r)(Tin*Pin + Tout*Pout + Rai) + s*Rs]

K_new_without_fast_path sets F=0. K_new_without_personal_cache sets C=0. Monthly cost is K_month(N,C) = N\*K_new(C). Fast-path saving is F times the bracket; future cache saving is (1-F)C times the bracket. Neither is a personal-cache saving today. Terminal failures retain attempted-call cost.

For a predeclared non-zero denominator: K_successful = K_new/(1-e); K_validated = K_new/v; K_correct_complex = K_new/k. If a denominator is zero or unknown, the result is **unknown**, never silently $0. Use symbolic N_low, N_base, and N_high volumes unless their values are explicitly labelled assumptions.

| Scenario     | Inputs                                                                 | Permitted conclusion                                  |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Conservative | low F; C=0; high q, token/price/retry/source-cost assumptions          | upper scenario projection, not production upper bound |
| Base         | date-pinned assumptions; C=0 until V3-008 telemetry                    | planning comparison only                              |
| Unfavourable | lower fast-path/cache; higher output/retry/timeout/failure assumptions | sensitivity stress only                               |

The dated pricing report/default adapter snapshot are point-in-time references, not Zera truth. Amy's “almost 1 cent” statement is external product testimony only and is not used as a Zera value.

## Latency model

Use nearest-rank p50/p95 on homogeneous per-log samples. Do not add independently computed phase p95 values to claim total p95; calculate end-to-end percentiles from complete traces.

L_fast = local resolver fast path.
L_ai = AI wall time including provider timeout/retries.
L_retrieval = source critical-path time including timeout/retries.
L_rank = candidate ranking and decision.
L_calc = deterministic scaling/summation.
L_total = L_fast + AI branch (L_ai + L_retrieval + L_rank + L_calc) + measured overhead.

Record cold and warm separately using a documented reset condition. Personal-cache hits after V3-008 are a third path and never mix with fast-path timings. Timeout/fallback traces retain elapsed time and outcome. Report all-attempts and successful/validated subsets with counts.

| Component                                       | Classification                          | Current claim                        |
| ----------------------------------------------- | --------------------------------------- | ------------------------------------ |
| A total p50/p95                                 | **measured** local harness              | small-corpus baseline only           |
| B total p50/p95 0/0                             | **fixture-only**                        | not provider latency                 |
| C total p50/p95                                 | **measured** fixture-plus-local harness | not production p95                   |
| C phase fields                                  | instrumentation exists                  | usable for future live decomposition |
| provider/source cold/warm, timeout, retry tails | **unknown**                             | V3-013 must collect                  |

An acceptable G2 latency multiple of A non-fast-path p95 is **not derivable**: no live C provider tail exists.

## Fast path and future personal cache

The C fast path prevented seven calls on this fixture corpus. It is distinct from resolver cacheHit telemetry and V3-008's proposed personal read path over food_resolver_runs/food_query_cache_results. Tables exist but no reuse read path exists. Global/curated knowledge-layer results and personal reuse remain separate populations.

| Hypothetical C | AI calls per N logs | Cost                           | p50/p95                                                       | Consistency                        |
| -------------- | ------------------- | ------------------------------ | ------------------------------------------------------------- | ---------------------------------- |
| 0%             | N(1-F)q             | baseline K_new(0)              | no cache contribution                                         | none from personal reuse           |
| low            | N(1-F)(1-C)q        | proportional derived reduction | central improvement possible; tail depends on lookup/fallback | repeatability possible; unmeasured |
| medium         | same                | proportional derived reduction | same caveat                                                   | same caveat                        |
| high           | same                | proportional derived reduction | include stale/miss fallback                                   | monitor stale/wrong reuse          |

No numeric cache rate is asserted: repetition, cache key, TTL/invalidation, acceptance policy, privacy scope, and real input distribution remain unimplemented/unobserved.

## Assumptions, unknowns, sensitivity

| Item                                                                                         | Label            | Treatment                                |
| -------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------- |
| A timing; C fast-path/local total timing                                                     | **measured**     | retain with sample caveat                |
| B zero timing/cost/tokens; C fixture AI cost                                                 | **fixture-only** | exclude from provider projections        |
| F=7/14 outside corpus; C scenarios                                                           | **assumed**      | never traffic/cache evidence             |
| formulas                                                                                     | **derived**      | recompute after telemetry/pricing update |
| real tokens/prices/billing, q, retries/errors, v/k, source charges, volumes, cold/warm tails | **unknown**      | collect; never use fixture defaults      |

Largest sensitivities are (1-F)(1-C), token volume/prices (especially output), q, retry rate, source fan-out/charges, and v/k. Tail latency is especially sensitive to provider/source timeout and retry policy.

## Production bounds and required evidence

| Bound                                   | Status               | Reason                                                                              |
| --------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Production cost per log/monthly ceiling | **not derivable**    | no live B/C tokens, pricing/billing, retries, source costs, or traffic distribution |
| Production p95 budget                   | **not derivable**    | no provider/source cold-warm, timeout, retry, or tail samples                       |
| Variable model                          | **provisional only** | instrumentation supports transparency, not numeric limits                           |

Before a V3-006 gate re-review, collect B/C live evidence on the same corpus/IDs with pinned provider/model/prompt/schema/harness versions, multiple cold/warm repeats, real tokens/pricing status/cost/phase latency/source requests/retries/timeouts/errors, development/holdout separation, and proof that live mode never fell back to fixtures. This is an experiment, not provider selection or production wiring.

## Recommendation

**A:** yes—instrumentation supports a provisional variable model.
**B:** no—numeric production cost and p95 bounds remain **not derivable** without live runs.
**C:** yes—perform RESOLVER-V3-013 next in a new context window because it is credential-gated empirical work. Keep RESOLVER-V3-010 blocked: this report neither passes nor reopens the V3-006 production-wiring gate.
