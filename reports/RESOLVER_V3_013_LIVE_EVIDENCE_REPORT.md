# RESOLVER-V3-013 — Controlled Live Evidence Preflight

**Date:** 2026-07-20
**Status:** `BLOCKED BEFORE LIVE REQUEST`
**Production-wiring gate:** `INCONCLUSIVE`

## Secret-safe credential and network gate

The three required environment-variable presence checks returned `missing`: the Anthropic API
key and both model-selection variables are unavailable to this execution process. Their values
were neither read nor emitted. A non-billed HTTPS connectivity probe to `api.anthropic.com/`
returned HTTP 404, which proves reachability only, not authentication or provider readiness.

Consequently, no live provider, fixture fallback, prompt change, ground-truth change, or
production wiring was executed. Actual billed calls, tokens, retries, costs, provider latency,
and B/C live quality metrics are all **0 / not available**.

## Implemented hard aggregate gate

`LiveProviderBudgetGate` reserves capacity _before_ each B or C `fetch` call. A caller running
the two variants together passes one shared instance into both benchmark runners. It limits total
calls, input tokens, output tokens, worst-case reserved cost, in-flight fan-out, and every retry
(failed calls retain their call/token/cost reservation). It rejects absent model pricing and any
currency mismatch before a request. The configured pricing is USD per million tokens; the
authorization is EUR 5.00. No FX rate is pinned in the repository, so the gate deliberately
refuses to invent a conversion and no live run is cost-safely executable yet.

## Deterministic preflight projection

| Field                                     | Value                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Provider                                  | Anthropic Messages API                                                           |
| Model B / C                               | unavailable to this process (required selector variables missing)                |
| Prompt/schema B                           | current committed Variant B prompt/schema                                        |
| Prompt/schema C                           | current committed Variant C prompt/schema                                        |
| Corpus                                    | committed 14-case smoke corpus, sorted case order                                |
| B protocol                                | 14 primary calls + 2 extra runs for each of 4 repeat-overlay cases = 22 calls    |
| C protocol                                | 7 live interpretation calls; 7/14 fixture-run cases take the validated fast path |
| Expected / maximum calls without retries  | 29 / 29                                                                          |
| Retry allowance                           | 0; no retry loop exists, and any future retry must reserve a new call            |
| Per-call reservation                      | 8,192 input + 1,536 output tokens                                                |
| Maximum aggregate reservation             | 237,568 input + 44,544 output tokens                                             |
| USD worst-case at committed Haiku pricing | USD 0.460288                                                                     |
| Authorized budget                         | EUR 5.00                                                                         |
| Safety margin                             | not computable safely without a repository-pinned FX rule                        |

The 29-call figure is derived from the current runners, not assumed: B's four repeat-overlay
cases run three times; C currently has no repeat option and makes an AI call only after its
fast-path rejection. The B/C model pricing table only recognizes `claude-haiku-4-5`; an override
that is not represented there is intentionally rejected.

## Results and decision

The rerun A baseline and B/C fixture regressions remain offline controls, not live evidence.
Their recorded headline results are A identification 0.75 with one critical false-confidence
failure; B fixture identification 0.9167 with one critical failure; C fixture identification
0.8333 with one critical failure and 7/14 fast-path cases. These numbers do not establish live
model quality, repeat stability, provenance changes, cost, or latency.

`RESOLVER-V3-010` remains blocked. Resume only when this execution environment exposes all
three required variables and the repository has a conservative, documented EUR/USD conversion
or EUR-denominated pricing configuration that lets the preflight prove the EUR 5.00 limit.
