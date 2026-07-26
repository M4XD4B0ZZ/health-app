# RESOLVER-V3-046 — Haiku Response Reliability and Latency Remediation

**Status:** implementation complete; live effectiveness unverified  
**Basis:** `8413c668422cee41c61c0e70d6005366e0f8668e` (local `chore/clean-arch-structure`
tip supplied by the workspace, PR #182 merge). The checkout contains no configured Git remote, so
an independent remote-tip fetch was impossible; this limitation must be resolved before merge.
**Execution:** offline only; provider calls **0**; provider cost **USD 0**; no credential lookup.

## 1. Evidence boundary and historical reconstruction

The seven frozen files are the seven `logs/resolver-v3-039-*` files. Their pre-change SHA-256
values were recorded and are rechecked at closeout. The ledger and persisted raw telemetry contain
HTTP status, usage/cost and latency, but not response text or parser diagnostics. Consequently the
eight HTTP-200 failures can be identified as response-layer failures, but their narrower JSON vs
schema vs contract root cause cannot honestly be reconstructed. They are classified below as
`unknown_http_200_response_failure`, not guessed.

All rows had `retried=false`. `?` means the frozen evidence does not establish a value.

|   # | Partition   | Scenario / variant        | HTTP | Historical    | Usage (in/out) | Persisted cost USD | Latency ms (provider/e2e) | Evidence-supported cause                                   | Retry eligible                             |
| --: | ----------- | ------------------------- | ---: | ------------- | -------------: | -----------------: | ------------------------: | ---------------------------------------------------------- | ------------------------------------------ |
|   1 | development | BRANDED-DEV-001 / B       | null | network_error |              ? |                  ? |         15010.31/15010.97 | transport-or-timeout, indistinguishable                    | only under future bounded transient policy |
|   2 | development | BRANDED-DEV-001 / C       | null | network_error |              ? |                  ? |         15002.86/15003.57 | transport-or-timeout, indistinguishable                    | only under future bounded transient policy |
|   3 | development | COMPOSED-DEV-006 / B      | null | network_error |              ? |                  ? |         15015.78/15015.87 | transport-or-timeout, indistinguishable                    | only under future bounded transient policy |
|   4 | development | HOMEMADE-DEV-004 / C      |  200 | network_error |       1629/285 |           0.003054 |           3622.81/3623.58 | unknown_http_200_response_failure                          | no                                         |
|   5 | development | OVERLAY-DEV-006 run 1 / C | null | network_error |              ? |                  ? |         15007.06/15007.15 | transport-or-timeout, indistinguishable                    | only under future bounded transient policy |
|   6 | development | PREPARATION-DEV-005 / B   | null | network_error |              ? |                  ? |         15015.82/15015.90 | transport-or-timeout, indistinguishable                    | only under future bounded transient policy |
|   7 | development | UNRELIABLE-DEV-003 / C    |  200 | network_error |       1634/164 |           0.002454 |           2344.95/2345.92 | unknown_http_200_response_failure                          | no                                         |
|   8 | development | VAGUE-DEV-003 / C         |  200 | network_error |       1623/184 |           0.002543 |           2976.79/2977.69 | unknown_http_200_response_failure                          | no                                         |
|   9 | development | VAGUE-DEV-004 / C         |  200 | network_error |       1622/234 |           0.002792 |           2999.96/3000.50 | unknown_http_200_response_failure                          | no                                         |
|  10 | development | VAGUE-DEV-005 / C         |  200 | network_error |       1639/209 |           0.002684 |           4443.19/4443.95 | unknown_http_200_response_failure                          | no                                         |
|  11 | development | VAGUE-DEV-006 / C         |  200 | network_error |       1627/170 |           0.002477 |           2651.56/2652.31 | unknown_http_200_response_failure                          | no                                         |
|  12 | holdout     | HOUSEHOLD-HOLD-001 / C    | null | network_error |              ? |                  ? |         15005.72/15005.90 | transport-or-timeout, indistinguishable                    | only under future bounded transient policy |
|  13 | holdout     | HOUSEHOLD-HOLD-002 / B    | null | network_error |              ? |                  ? |         10281.29/10281.41 | transport failure; timeout not evidenced by duration alone | only under future bounded transient policy |
|  14 | holdout     | PREPARATION-HOLD-002 / B  | null | network_error |              ? |                  ? |         10281.56/10281.63 | transport failure; timeout not evidenced by duration alone | only under future bounded transient policy |
|  15 | holdout     | VAGUE-HOLD-001 / C        |  200 | network_error |       1625/147 |           0.002360 |           2799.80/2800.90 | unknown_http_200_response_failure                          | no                                         |
|  16 | holdout     | VAGUE-HOLD-002 / C        |  200 | network_error |       1622/208 |           0.002662 |           2587.46/2588.45 | unknown_http_200_response_failure                          | no                                         |

Thus exactly **8/16** historical terminal failures had HTTP 200, reported usage and non-null
estimated cost. The old telemetry decorator classified every Variant-C `error` outcome as
`network_error`; this is the directly proven taxonomy root cause. The separate parser defect was
also reproduced: malformed optional `brand`, `preparation`, `modifiers`, `assumptions`, and
`uncertainties` reached `.trim()`/`.map()` and threw `TypeError` after validation.

## 2. Failure taxonomy and contract

| Failure kind               | Meaning                                      | Telemetry status      | Retryable        | Attempts / reservation / cost / result                                    |
| -------------------------- | -------------------------------------------- | --------------------- | ---------------- | ------------------------------------------------------------------------- |
| `transport_error`          | fetch rejected before Response               | `network_error`       | yes in principle | current protocol: 1, reservation released, usage/cost unknown, error      |
| `timeout_abort`            | Abort/timeout                                | `timeout_abort`       | yes in principle | current protocol: 1; outer timeout remains no-retry; unknown usage, error |
| `http_error`               | non-2xx Response                             | `http_error`          | 408/429/5xx only | current protocol: 1; status retained; usage unknown; error                |
| `http_envelope_json_error` | 2xx body not envelope JSON                   | `invalid_response`    | no               | HTTP retained; usage unavailable; error                                   |
| `missing_text_block`       | 2xx envelope lacks text                      | `invalid_response`    | no               | reported envelope usage/cost retained; error                              |
| `text_block_json_error`    | text is not JSON                             | `invalid_response`    | no               | reported usage/cost retained; error                                       |
| `schema_contract_error`    | JSON violates closed interpretation contract | `invalid_response`    | no               | reported usage/cost retained; error                                       |
| `internal_parser_error`    | unexpected validator/normalizer exception    | `internal_error`      | no               | caught only at parser/provider boundary; error                            |
| `budget_config_error`      | pre-dispatch gate/config refusal             | `budget_config_error` | no               | 0 calls, 0 cost, harness/config failure                                   |

`retryable` expresses class eligibility, not permission to retry. Protocol v3 still performs
**zero automatic retries**. Any protocol-v4 retry must reserve an additional call, worst-case
tokens, cost, and wall-clock time before dispatch and remain inside its declared aggregate budget.
There is never an automatic retry after an indeterminate process interruption. Deterministic
response/contract failures are not retried. A billed HTTP-200 response retains returned usage and
estimated cost and is never treated as a free network failure.

## 3. Fail-closed parser/contract invariants

Validation now covers every normalized component field, finite quantity values, all optional
quantity strings, source-type arrays including exclusions, every native-query object, outcome and
resolution enums, clarification shape/kind/reference, unique component IDs, known search-plan
references, and exactly one plan per interpreted component. Optional string arrays must actually
be arrays containing only strings. Validation and normalization each have a narrow fail-closed
exception boundary; arbitrary JSON values return a structured `error`, never escape via `.trim()`,
`.map()`, iteration, or non-null assertion.

The outer provider boundary independently catches an unexpected parser throw. It does not add a
global catch and does not suppress defects elsewhere in the application.

## 4. Before/after replay classification

The failing baseline is **measured locally** against the pre-fix implementation: five table rows
failed, four with thrown `TypeError` and one incorrectly accepted malformed `null`. The corrected
tests are **fixture-executed**. Replaying the persisted metadata yields this **derived** result:
the eight HTTP-200 rows become `invalid_response` / narrow cause unknown, while the eight null-HTTP
rows remain historical transport-or-timeout unknowns. No historical artifact is rewritten.

The V3-045 consistency values remain unchanged: **68.75% fixture-executed/measured**, **75.00%
derived counterfactual**, and prompt effectiveness **live-unverified**. There is no measured
after-rate.

## 5. Latency budget analysis

The immutable policy remains 12,000 ms. Frozen Holdout AI-routed p95 is 12,417.52 ms: +417.52 ms,
or 3.48%. Inspection finds:

- provider duration dominates; historical HTTP-200 parser failures took 2.35–4.44 s, demonstrating
  that classification/parsing is post-response work and not a safe basis for claiming 418 ms of
  provider-time savings;
- request construction performs one `JSON.stringify`; response processing performs one envelope
  JSON parse by `Response.json()`, one text-block JSON parse, one validation walk and one
  normalization walk. No duplicate serialization/validation was found;
- `max_tokens=1536`, JSON schema output, temperature zero, and the v2 semantic prompt are all
  quality/safety constraints. Reducing the token ceiling or schema/prompt without a controlled
  candidate-quality comparison could truncate or weaken valid multi-component responses and was
  therefore rejected here;
- the 15 s transport timeout and 20 s outer ceiling are failure containment, not the 12 s
  acceptance target. Lowering them would convert slow successes into failures rather than improve
  p95 and is rejected;
- automatic retries are already zero, so retry removal offers no historical p95 gain;
- fast-path and pre/post-provider work must be measured by V3-047 candidate evaluation and the
  protocol-v4 telemetry contract before attribution. Frozen evidence cannot split cold/warm
  provider time reliably.

The implemented latency remediation is therefore deliberately reliability-oriented: deterministic
non-retryability prevents response-contract failures from consuming an additional latency/cost
budget, while transient eligibility is explicit for future bounded policy. The credible next
optimization is an offline V3-047 A/B payload candidate (prompt/schema byte counts and local parser
CPU benchmark, with identical semantic fixtures), followed exclusively by V3-048 live p95 proof.
Any provider-time benefit is **theoretical and live-unverified**. No new p50/p95 is claimed and the
limit is not changed.

## 6. Taskgraph correction

This report adopts exactly the “implementation completion vs live effectiveness” model. V3-043
and V3-045 are `done` as deterministic implementation tasks: their owned code/policy/integrity and
offline regression obligations are complete. This does **not** claim 75%, a live repeat-consistency
improvement, or G2 success. V3-048 alone verifies live effectiveness and remains `todo`. V3-047 can
therefore evaluate candidates after V3-046 without a task depending on its own future proof. V3-010
remains `blocked`.

## 7. Tests, integrity and residual risks

Focused coverage includes malformed optional fields/arbitrary JSON, unknown/duplicate/missing
references/plans, transport exception, Abort, 429, retryable 5xx, non-retryable 4xx, invalid
envelope JSON, missing text, invalid text JSON, schema violation, valid response, telemetry and
ledger propagation. Existing V3-044/V3-045 and Representative Hybrid suites are included by full
verification.

Verification results: the pre-fix baseline failed 5 table rows as expected. The final focused
provider/parser/adapter/live-report/ledger/telemetry command passed 7 suites and 85 tests. Typecheck,
lint, format check, and `git diff --check` passed. `npm run verify` completed typecheck/lint/format
and entered the full Jest run, but did not terminate under the repository's known local symptom; it
was interrupted and is **not** represented as green. Green GitHub CI is required before merge.

Residual risks: the eight historical 200-response subcauses are unknowable from the frozen data;
the taxonomy is proven with fixtures, not new live evidence; p95 improvement is unverified; and
protocol-v4 must decide whether to enable any eligible retry while proving aggregate budgets.
V3-047 owns candidate comparison. V3-048 owns all new provider reliability, cost and latency
evidence and any G2 re-decision. This task creates no G2 decision and authorizes no production
wiring.

Integrity: frozen V3-039 evidence, corpus, ground truth, BLS workbooks/generated artifacts,
Production DI/UI/Journal/Supabase/feature flags, dependencies and CI configuration are unchanged.
No environment credential was read. Provider calls: **0**. Cost: **USD 0**.

## 8. Post-Merge Correction — HTTP Envelope, Usage Integrity, and Wall-Clock Taxonomy

**Correction basis:** `d62b77b1c5ae7a08474309e3fb9973c0763361c9` (PR #183 merge and the
local checkout tip). This workspace has no configured Git remote, so the requested independent
remote-tip fetch failed before editing; the exact supplied merge commit was nevertheless present
and used. `SYSTEM.md`, `RULES.md`, `SAFETY.md`, and `REVIEW_POLICY.md` were also requested but do not
exist in this merge tree; active governance is the consolidated `AGENTS.md`/`SSOK.md` contract.

### Residual defects and failing baseline

The correction tests were first run against the merge tree. The focused command failed 17 tests:
`null`, object-valued `content`, and `content: [null]` escaped as `TypeError`; array/missing content
and malformed blocks were misclassified as `missing_text_block`; missing/null/malformed usage was
accepted, defaulted, or produced unreliable arithmetic; both outer ceiling tests reported
`timeout_abort`/`unknown`, and Variant C returned no failure taxonomy. The run was 2 failed suites,
20 passed tests, 17 failed tests, exit 1. The thrown envelope paths also bypassed the scattered
release calls.

### Corrected envelope and usage contracts

Every successful HTTP envelope must be a non-null, non-array object with an array `content`; every
block must be a non-null object with a string `type`, and a selected text block must have string
`text`. An absent text block remains `missing_text_block`; damaged blocks are instead
`http_envelope_contract_error`. Syntactically invalid `Response.json()` remains
`http_envelope_json_error`.

Live HTTP-200 usage is required. Input/output tokens must be finite non-negative integers. Optional
cache token fields may be absent, but when present must satisfy the same rule; `null`, strings,
arrays, objects, negatives, and fractions fail closed. Thus V3-048 cannot represent a semantic text
response with unknown usage as a cost-known success. `computeCostUsd()` receives only validated
numbers; large finite safe integers are accepted, and invalid usage yields unknown cost rather than
zero or `NaN`.

### Reservation lifecycle and timeout taxonomy

One `finally` now owns the reservation after a successful reserve. Fetch rejection/Abort, envelope
JSON failure, HTTP failure, envelope contract failure, missing text, text JSON/schema failure,
success, and unexpected envelope-processing exceptions all pass through that single release point;
tests directly assert one release for representative normal/error paths and an unexpected throw.
Reserve failure remains pre-reservation and therefore has nothing to release.

The AbortController-driven per-request timeout remains `timeout_abort` and transient-eligible. The
outer `Promise.race` does not prove or perform an abort and is now non-retryable
`wall_clock_ceiling`. Variant B and C telemetry use that provider status/failure kind; Variant C
also returns it in `runMeta`; ledger details copy the same telemetry fields. No outer ceiling is
described as an abort or `unknown`.

### Verification, evidence classification, and residual risks

All testing is fixture/fake-transport **measured offline evidence**, never new provider evidence.
The focused provider/telemetry/ledger/timeout run passed 4 suites and 52 tests; the broader focused
regression run passed 9 suites and 188 tests. `npm run verify` passed typecheck, lint, and format,
then advanced deep into full Jest but did not terminate after about 126 seconds; it was interrupted
with exit 130 and is not claimed green. Green GitHub CI is required. The seven frozen V3-039
SHA-256 values were rechecked; corpus,
ground truth, BLS artifacts, V3-049/V3-050/V3-051 behavior, G2 evaluator, CI, dependencies, and
production wiring are unchanged. Provider calls **0**, cost **USD 0**.

Residual risk is limited to live effectiveness: fixtures prove classification and fail-closed
behavior, not provider reliability, cost distribution, or latency. V3-048 exclusively owns that
live evidence. The 12,000 ms limit is unchanged. V3-046 remains implementation-complete (`done`),
while V3-047/V3-048 remain `todo` and V3-010 remains `blocked`.
