# RESOLVER-V3-013 — Controlled Live Provider Evidence

**Date:** 2026-07-20
**Tested commit:** `2155d322fd685d3e7af53485ff364fd8e7ff0920` (PR #97 merge)
**Protocol:** exactly one shared `node scripts/benchmark-resolver-v3-live-evidence.mjs --live` invocation
**Task status:** `done`
**Production-wiring gate:** **NOT PASSED**

## Protocol integrity and preflight

The three required credentials were checked only for boolean presence before the paid command; all
were present. No credential value, length, prefix, proxy URL/credential, authorization header, or
environment dump was read or logged. The tested commit contains PR #97.

All required offline preflight checks passed before the one live command: recursive B/C schema
contract, `LiveProviderUsage`, B/C live-provider, proxy transport, and shared budget-gate tests
(34 tests); Variant-A baseline; Variant-B and Variant-C fixture regressions; and `npm run verify`
(158 suites, 1,441 tests).

| Configuration | Verified value |
| --- | --- |
| Variant B model / versions | `claude-haiku-4-5`; `variant-b-prompt-v1`; `variant-b-schema-v3`; `variant-b-ai-only-v1` |
| Variant C model / versions | `claude-haiku-4-5`; `variant-c-prompt-v1`; `variant-c-schema-v1`; `variant-c-live-interpreter-v1` |
| Transport / gate | Both adapters use `createAnthropicBenchmarkTransport`; one `LiveProviderBudgetGate` instance is passed to B and C |
| Pinned price snapshot | USD 1.00/M input tokens; USD 5.00/M output tokens |
| Maximum reservation | 29 calls, 237,568 input tokens, 44,544 output tokens, USD 0.460288, one request in flight |
| Authorization | USD 5.00; reservation is USD 4.539712 below the limit |

There was no fixture fallback, prompt/schema/ground-truth change, individual-case replay, second
live command, or production wiring.

## Actual provider evidence

All 29 fixed protocol attempts completed successfully: 22 Variant-B calls (including the defined
repeat overlay) and 7 Variant-C AI-routed calls; the remaining 7 C cases used the deterministic
fast path. Eight B repeat-overlay calls are marked `retried` by the benchmark telemetry; these are
the planned repeat-consistency attempts, not automatic network retries. No provider request was
automatically retried after a failure.

| Actual measure | Variant B | Variant C | Combined |
| --- | ---: | ---: | ---: |
| Provider attempts / retries | 22 / 8 | 7 / 0 | 29 / 8 |
| HTTP status | 22 × 200 | unknown for 7 records | 22 × 200; 7 unknown |
| Provider status | 22 success | 7 success | 29 success |
| Input tokens | 43,376 | 11,352 | 54,728 |
| Output tokens | 5,058 | 2,988 | 8,046 |
| Cache-creation tokens | 0 | unknown (not delivered) | unknown |
| Cache-read tokens | 0 | unknown (not delivered) | unknown |
| Actual estimated provider cost | USD 0.068666 | USD 0.026292 | **USD 0.094958** |
| Unknown usage / cost records | 0 / 0 | 0 / 0 | 0 / 0 |

The USD 0.460288 gate reservation is a ceiling only and is **not** actual billing. C's response
adapter persists actual input/output usage and provider latency, but its HTTP-status field is
currently unavailable and is reported as `unknown`, not inferred as 200. C cache-token fields were
not delivered and are likewise `unknown`.

## Quality and safety results

The common corpus contains only 14 cases and lacks COMPOSED, HOMEMADE, and RESTAURANT coverage;
these results are a small smoke-evidence set, not a production-quality estimate.

| Dimension | A baseline (offline) | B live | C live |
| --- | --- | --- | --- |
| Identification accuracy | 9/12 (75.0%) | 2/12 (16.7%) | 7/12 (58.3%) |
| Component P/R/F1 | n/a | 1.000 / 0.154 / 0.267 | 0.643 / 0.692 / 0.667 |
| Quantity / unit | n/a | 2 correct, 0 incorrect, median absolute deviation 75 | not separately aggregated |
| Macro tolerance | n/a | 1 within, 1 outside, 12 not evaluable | 7 within, 3 outside, 4 not evaluable |
| Clarification / abstention | baseline control | 10 no-resolution outcomes | 0 clarification; 5 abstained; 2 multiple-candidate |
| Technical errors | baseline control | none | none |
| Unbacked numeric results | 0 | direct-estimation design; not source-grounded | 0 |
| Grounding / provenance | BLS sourceId present 100% | no source grounding by B design | sourceId present 83.3% |
| Repeat stability | synonym groups consistent | one synonym group inconsistent; planned same-input repeats internally consistent | both synonym groups consistent; both fast path |

False-confidence remains material: B produced `RV3-0002`; C retained the inherited fast-path
case `RV3-0011`. B's direct estimates are not source-grounded by architecture. C produced no
unbacked numeric result, but its sourceId coverage is not complete.

## Latency (small samples)

All percentile figures use the committed linear-interpolation calculation and must be read as
small-sample observations.

| Variant / path | n | p50 | p95 |
| --- | ---: | ---: | ---: |
| B provider latency | 22 | 3,306.224 ms | 6,218.762 ms |
| B end-to-end latency | 22 | 3,306.224 ms | 6,218.762 ms |
| C all cases end-to-end | 14 | 300.696 ms | 7,430.044 ms |
| C fast-path end-to-end | 7 | 49.205 ms | 300.696 ms |
| C AI-routed end-to-end | 7 | 5,152.507 ms | 7,430.044 ms |
| C provider latency (usage records) | 7 | 4,928.749 ms | 6,973.894 ms |
| C retrieval latency | 14 | 0.000 ms | 103.207 ms |

## Production-wiring gate decision

**NOT PASSED.** The controlled live evidence is complete enough to reject a production-wiring
conclusion: neither live B (16.7%) nor live C (58.3%) surpasses A's 75.0% baseline identification
on this corpus; both have a false-confidence case; B lacks grounding by design; C has substantial
AI-path latency and incomplete provenance; and the corpus is only 14 cases without the required
COMPOSED/HOMEMADE/RESTAURANT coverage. A better average alone would not have been sufficient in
any event. `RESOLVER-V3-010` remains blocked because its existing cache dependency is also unmet.

## Evidence limitations and follow-up boundary

- The protocol was intentionally run once only. This report does not authorize a rerun, a case
  replay, diagnostic request with the real key, prompt/schema change, or result optimization.
- The persisted C HTTP status is unknown for all seven successful calls; that telemetry gap is
  explicitly retained as unknown rather than reconstructed.
- Actual provider costs are estimates derived from returned usage and the pinned pricing snapshot,
  not invoices. Reserved capacity remains separate from actual estimated cost.
- The next sound product task is not RESOLVER-V3-010: first enlarge and diversify the corpus and
  separately scope any C telemetry remediation or evidence-quality follow-up.
