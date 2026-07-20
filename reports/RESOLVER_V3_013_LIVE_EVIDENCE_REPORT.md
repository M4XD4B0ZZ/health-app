# RESOLVER-V3-013 — Controlled Live Evidence Preflight

**Date:** 2026-07-20
**Status:** `TECHNICALLY BLOCKED AFTER CONTROLLED LIVE ATTEMPT`
**Production-wiring gate:** `INCONCLUSIVE`

## Secret-safe credential and network gate

The three required environment-variable presence checks returned `present`. The Anthropic API-key
value was neither read nor emitted. The configured B and C model selectors both name the sole
repository-priced model, `claude-haiku-4-5`. A non-billed HTTPS connectivity probe to
`api.anthropic.com/` returned HTTP 404, which proves reachability only, not authentication or
provider readiness.

Consequently, no live provider request, fixture fallback, prompt change, ground-truth change, or
production wiring was executed. Actual billed calls, tokens, retries, costs, provider latency,
and B/C live quality metrics are all **0 / not available**.

## Implemented hard aggregate gate

`LiveProviderBudgetGate` reserves capacity _before_ each B or C `fetch` call. A caller running
the two variants together must pass one shared instance into both benchmark runners; B and C live
provider construction fails before any `fetch` if that aggregate gate is absent. It limits total
calls, input tokens, output tokens, worst-case reserved cost, in-flight fan-out, and every retry
(failed calls retain their call/token/cost reservation). It rejects absent model pricing and any
currency mismatch before a request. The configured pricing is USD per million tokens. The
maintainer explicitly authorized a provider-currency ceiling of USD 5.00, so the gate uses that
literal limit without any EUR/USD conversion.

## Deterministic preflight projection

| Field                                     | Value                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Provider                                  | Anthropic Messages API                                                           |
| Model B / C                               | `claude-haiku-4-5` / `claude-haiku-4-5` (both present and repository-priced)     |
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
| Authorized budget                         | USD 5.00                                                                         |
| Safety margin                             | USD 4.539712 against the maximum reservation                                     |

The 29-call figure is derived from the current runners, not assumed: B's four repeat-overlay
cases run three times; C currently has no repeat option and makes an AI call only after its
fast-path rejection. The B/C model pricing table only recognizes `claude-haiku-4-5`; an override
that is not represented there is intentionally rejected.

## Results and decision

The rerun A baseline and B/C fixture regressions passed and remain offline controls, not live evidence.
Their recorded headline results are A identification 0.75 with one critical false-confidence
failure; B fixture identification 0.9167 with one critical failure; C fixture identification
0.8333 with one critical failure and 7/14 fast-path cases. These numbers do not establish live
model quality, repeat stability, provenance changes, cost, or latency.

## Controlled live attempt

The shared-gate runner completed its fixed protocol with 29 reserved attempts: 22 B attempts and
7 C AI-routed attempts. Every provider POST failed locally with `network error calling Anthropic:
fetch failed`; the provider returned no usage or billed-cost metadata. Thus the gate reserved USD
0.460288, but actual provider cost is **unknown**, not USD 0.00. There were no retries and no
fixture fallback. B has no evaluable live result (14 technical errors). C retains its seven
deterministic local fast-path results but all seven AI-routed cases are technical errors, so it is
not live provider evidence. No live latency, token, quality, provenance, or consistency comparison
is valid from this attempt.

`RESOLVER-V3-010` remains blocked. Resume only after the execution environment permits successful
Anthropic Messages POST requests; do not rerun individual cases outside the fixed protocol.

## Follow-up transport diagnosis (2026-07-20)

The subsequent secret-free transport-only diagnosis is recorded in
`reports/RESOLVER_V3_013_ANTHROPIC_TRANSPORT_DIAGNOSIS.md`. It established that DNS works and curl
receives the expected HTTP 401 for a minimal dummy-key Messages POST, while the benchmark-equivalent
Node v20.20.2 global `fetch` fails with secret-free `ENETUNREACH`. The same Node fetch reaches HTTP
401 when its configured HTTPS proxy is explicitly supplied through Undici's `ProxyAgent`; IPv4-first
DNS does not change the unconfigured failure. The root cause is consequently the missing Node/Undici
proxy dispatcher, not provider reachability, credentials, model configuration, or a benchmark result.
No live B/C benchmark was rerun and both RESOLVER-V3-013 and RESOLVER-V3-010 remain blocked pending a
separately scoped, reviewed transport configuration change and a repeat dummy-key probe.

## Proxy-aware transport follow-up (2026-07-20)

The separately scoped benchmark-local follow-up is documented in
`reports/RESOLVER_V3_013_ANTHROPIC_PROXY_TRANSPORT_EVIDENCE.md`. One shared B/C transport factory
now uses an explicit, per-request Undici proxy dispatcher when a standard proxy variable is present,
and otherwise preserves direct transport. The post-change invalid-dummy-key Messages POST received
HTTP 401 through the configured proxy; no real key, billed request, or benchmark protocol was used.
This resolves the demonstrated Node transport path only. RESOLVER-V3-013 and RESOLVER-V3-010 remain
blocked pending human review and a separately authorized fixed full run.
