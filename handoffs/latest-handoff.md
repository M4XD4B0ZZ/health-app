# RESOLVER-V3-013 — Controlled Live Evidence Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C.
- **Status:** `done`. The one explicitly authorized shared B/C protocol completed successfully.
  The production-wiring gate is **NOT PASSED**; `RESOLVER-V3-010` remains `blocked`.

## What Changed and Why

- Ran exactly one `node scripts/benchmark-resolver-v3-live-evidence.mjs --live` command on
  PR #97 merge commit `2155d322fd685d3e7af53485ff364fd8e7ff0920`; no separate B/C command,
  replay, automatic retry, fixture fallback, prompt/schema/ground-truth change, or production
  wiring occurred.
- Updated the canonical live-evidence report and Roadmap with actual usage, estimated cost,
  quality, latency, telemetry unknowns, and the gate decision.
- The protocol made 22 B and 7 C AI-routed provider attempts. The remaining 7 C cases used the
  deterministic fast path. Combined actual returned usage is 54,728 input and 8,046 output tokens,
  with USD 0.094958 estimated provider cost under pinned pricing. The USD 0.460288 reservation is
  deliberately reported separately as a ceiling.

## Changed Files

- `ROADMAP.md`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`
- `handoffs/latest-handoff.md`

## Validation Executed and Result

- All secret-safe required credential-presence, version, pricing, common-gate, and common-transport
  preflight checks passed.
- Focused B/C schema-contract, usage, live-provider, proxy-transport, and budget-gate tests passed:
  6 suites / 34 tests.
- Variant-A baseline and Variant-B/C fixture regressions passed.
- `npm run verify` passed: 158 suites / 1,441 tests.
- The one authorized live command completed its complete fixed 29-attempt protocol.

## Result and Risks

- **Gate: NOT PASSED.** B scored 2/12 identification and C 7/12, versus A's offline 9/12.
  B false-confidence case: `RV3-0002`; C false-confidence case: `RV3-0011` (fast path).
  B is ungrounded by its direct-estimation design. C had zero unbacked numeric results but only
  83.3% sourceId coverage and AI-routed p95 end-to-end latency of 7,430.044 ms.
- The 14-case corpus lacks COMPOSED, HOMEMADE, and RESTAURANT coverage. It cannot establish a
  production conclusion and does not justify production wiring.
- C's persisted HTTP status and cache-token fields are unknown for all seven successful provider
  calls; this was documented as unknown rather than inferred. It is a separately scoped telemetry
  follow-up candidate, not a reason to rerun this authorization.
- No future live request, individual-case replay, or production-wiring work is authorized by this
  handoff. The next sound work is corpus diversification and/or separately scoped C telemetry work.

## Human-Review Status

Human review is required before any remediation or future controlled provider run. Do not start
`RESOLVER-V3-010`.
