# RESOLVER-V3-013 — Controlled Live Provider Evidence Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** technically blocked after one controlled USD 5.00-gated B/C live attempt. The
  provider POSTs failed locally; no complete live evidence was collected and the task is not done.

## What Changed

- Added a shared B/C hard aggregate budget gate and its focused tests; reservations are made before
  `fetch` for calls, conservative tokens, cost, fan-out, and failed/retry attempts. Live provider
  construction now refuses to run without this shared gate, preventing an un-gated direct live CLI.
- Added the secret-free preflight report and updated `ROADMAP.md` with the current blocker.

## Why Changed

- The current live adapters have all three authorized environment variables and the maintainer
  clarified that Anthropic's USD 5.00 provider-currency ceiling is authorized.
- Governance and task instructions prohibit a live request, fixture fallback, live-evidence report,
  or completion claim without a safe, tested aggregate budget gate and cost bound.

## Changed Files

- `src/features/nutrition/benchmark/VariantBLiveProvider.ts`
- `src/features/nutrition/benchmark/VariantCLiveInterpretationProvider.ts`
- `src/features/nutrition/benchmark/__tests__/VariantBLiveProvider.test.ts`
- `src/features/nutrition/benchmark/__tests__/VariantCLiveInterpretationProvider.test.ts`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`, `ROADMAP.md`, `handoffs/latest-handoff.md`

## Validation Executed

- `node scripts/benchmark-resolver-v3-variant-a.mjs`
- `node scripts/benchmark-resolver-v3-variant-b.mjs`
- `node scripts/benchmark-resolver-v3-variant-c.mjs`
- `node scripts/benchmark-resolver-v3-variant-{b,c}.mjs --live` (expected aggregate-gate failure;
  no request)
- Focused Variant B/C credential-guard and benchmark Jest tests.
- Focused aggregate gate test and `npm run typecheck`.

## Validation Result

- A baseline passed unchanged: 14 cases, 75.0% identification accuracy, one critical
  false-confidence failure.
- B and C fixture regressions passed. The direct live commands stopped with their secret-free
  missing-aggregate-gate message before starting the harness; no provider request occurred.

## Known Issues / Blockers / Risks

- All three required variables are present. The API-key value was never read, printed, committed,
  or recorded. Network reachability alone passed (HTTP 404 from the provider root).
- The shared gate fixes the total ceiling at USD 5.00; 29 failed provider attempts reserved USD
  0.460288. Actual billing is unknown because no provider usage metadata was returned.

## Human Review Status

- Human/environment action is required: allow successful Anthropic Messages POST requests, then
  rerun the full shared-gate protocol exactly once; do not rerun selected cases.
