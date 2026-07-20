# RESOLVER-V3-013 — Authorized Post-Remediation Controlled Live Run Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** remains `blocked`. One newly authorized shared B/C live invocation was completed,
  but it is a technical partial run: B's 22 responses were schema rejections while C completed
  seven AI-routed calls. `RESOLVER-V3-010` remains blocked.

## What Changed and Why

- Ran exactly one authorized `node scripts/benchmark-resolver-v3-live-evidence.mjs --live` protocol
  on commit `832c9c37ef1a3f786e194a9ea08e50d2fbd51422`, after secret-safe boolean credential
  checks and all required offline verification.
- The shared gate reserved at most 29 calls, 237,568 input tokens, 44,544 output tokens, and USD
  0.460288. There was no fixture fallback, prompt/schema/ground-truth edit, individual-case
  replay, or production wiring.
- B's 22 fixed attempts reached Anthropic but failed provider schema validation for the mixed
  nullable `quantity.unit` enum. B has no usage/billing metadata and no evaluable quality result.
- C completed seven AI-routed calls and seven local fast paths. It recorded 9/12 identification,
  P/R/F1 0.733/0.846/0.786, one inherited fast-path false-confidence case (`RV3-0011`), no
  unbacked numeric result, estimated USD 0.025792, and p50/p95 end-to-end latency 119.014 /
  10,109.354 ms. The current aggregate artifact does not persist actual per-request C token counts.

## Changed Files

- `ROADMAP.md`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`
- `handoffs/latest-handoff.md`

## Validation Executed and Result

- Focused B/C schema-contract, live-provider, proxy transport, and shared budget-gate tests passed.
  Variant-A baseline and B/C fixture regressions passed. `npm run verify` passed (157 suites,
  1,435 tests). The authorized live command then completed its fixed B/C protocol.

## Known Issues / Blockers / Risks

- B's provider-facing schema is still not fully accepted by Anthropic: nullable enum compatibility
  remains a blocker. Actual B token usage and billing are unknown.
- C's per-request input/output tokens are not retained in the committed aggregate. The C subset
  cannot repair the absent B evidence; the production-wiring gate is `INCONCLUSIVE`.
- Do not repeat the full run or individual cases without a new explicit authorization and a
  separately scoped remediation/review.

## Human-Review Status

Human review is required before any remediation or future controlled provider run; do not start
production wiring.

## RESOLVER-V3-013 nullable-enum and usage-telemetry follow-up (in progress)

- No provider request or live run was performed. The task remains blocked and the production-wiring gate remains INCONCLUSIVE.
- The follow-up changes the provider-facing B `quantity.unit` nullable enum to separate `anyOf` branches and persists benchmark-local, secret-safe provider usage fields for future B/C runs. Reserved budget is kept distinct from actual usage cost.
