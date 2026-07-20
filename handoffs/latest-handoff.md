# RESOLVER-V3-013 — Controlled Live Provider Evidence Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** blocked before any live request; no live evidence was collected and the task is not done.

## What Changed

- Added a shared B/C hard aggregate budget gate and its focused tests; reservations are made before
  `fetch` for calls, conservative tokens, cost, fan-out, and failed/retry attempts.
- Added the secret-free preflight report and updated `ROADMAP.md` with the current blocker.

## Why Changed

- The current live adapters require all three authorized environment variables, which are absent
  from this environment.
- Governance and task instructions prohibit a live request, fixture fallback, live-evidence report,
  or completion claim without the credential.

## Changed Files

- `src/features/nutrition/benchmark/LiveProviderBudgetGate.ts`
- `src/features/nutrition/benchmark/VariantBLiveProvider.ts`
- `src/features/nutrition/benchmark/VariantCLiveInterpretationProvider.ts`
- `src/features/nutrition/benchmark/runResolverV3Variant{B,C}Benchmark.ts`
- `src/features/nutrition/benchmark/__tests__/LiveProviderBudgetGate.test.ts`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`, `ROADMAP.md`, `handoffs/latest-handoff.md`

## Validation Executed

- `node scripts/benchmark-resolver-v3-variant-a.mjs`
- `node scripts/benchmark-resolver-v3-variant-b.mjs`
- `node scripts/benchmark-resolver-v3-variant-c.mjs`
- `node scripts/benchmark-resolver-v3-variant-b.mjs --live` (expected credential-gate failure;
  no request)
- Focused Variant B/C credential-guard and benchmark Jest tests.
- Focused aggregate gate test and `npm run typecheck`.

## Validation Result

- A baseline passed unchanged: 14 cases, 75.0% identification accuracy, one critical
  false-confidence failure.
- B and C fixture regressions passed. The live command stopped with its secret-free
  missing-credential message before starting the harness; no provider request occurred.

## Known Issues / Blockers / Risks

- All three required variables are missing from this process; values were never read, printed,
  committed, or recorded. Network reachability alone passed (HTTP 404 from the provider root).
- Pricing is USD but the authorized ceiling is EUR 5.00; no FX configuration exists, so the gate
  blocks rather than inventing a conversion. See the preflight report for exact reservations.
- No live B/C run or gate reevaluation is authorized while blocked.

## Human Review Status

- Human action is required: add the credential to the environment, then start a fresh
  RESOLVER-V3-013 execution window.
