# RESOLVER-V3-013 — Controlled Live Provider Evidence Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** blocked; no live evidence was collected and the task is not done.

## What Changed

- Marked the task blocked in `ROADMAP.md` and recorded the secret-free credential-gate result.
- Recorded the explicit EUR 5.00 maximum test budget and the conditions required before resuming.

## Why Changed

- The current live adapters require `ANTHROPIC_API_KEY`, which is absent from this environment.
- Governance and task instructions prohibit a live request, fixture fallback, live-evidence report,
  or completion claim without the credential.

## Changed Files

- `ROADMAP.md`
- `handoffs/latest-handoff.md`

## Validation Executed

- `node scripts/benchmark-resolver-v3-variant-a.mjs`
- `node scripts/benchmark-resolver-v3-variant-b.mjs`
- `node scripts/benchmark-resolver-v3-variant-c.mjs`
- `node scripts/benchmark-resolver-v3-variant-b.mjs --live` (expected credential-gate failure;
  no request)
- Focused Variant B/C credential-guard and benchmark Jest tests.

## Validation Result

- A baseline passed unchanged: 14 cases, 75.0% identification accuracy, one critical
  false-confidence failure.
- B and C fixture regressions passed. The live command stopped with its secret-free
  missing-credential message before starting the harness; no provider request occurred.

## Known Issues / Blockers / Risks

- `ANTHROPIC_API_KEY` must be added exclusively to the Codex environment before live work resumes.
  Its value must never be printed, committed, or recorded.
- The existing harness does not yet provide the task-required hard aggregate budget/call gate.
  Configure and test that gate before any live request, using the authorized EUR 5.00 ceiling.
- No provider reachability check, live B/C run, live report, gate reevaluation, or
  RESOLVER-V3-010 change is authorized while blocked.

## Human Review Status

- Human action is required: add the credential to the environment, then start a fresh
  RESOLVER-V3-013 execution window.
