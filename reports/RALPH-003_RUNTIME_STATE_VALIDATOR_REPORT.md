# RALPH-003 Runtime State Validator Report

## Task

- **Task ID:** RALPH-003
- **Task type:** Governance / tooling
- **Date:** 2026-05-22
- **Scope:** Read-only Ralph V2 runtime state validation

## Files Changed

- `scripts/agent/validate-ralph-state.mjs`
  - Added read-only Ralph V2 runtime state validator CLI.
- `reports/RALPH-003_RUNTIME_STATE_VALIDATOR_REPORT.md`
  - Added this implementation report.
- `handoffs/latest-handoff.md`
  - Updated handoff for this RALPH-003 run.

No product code, Supabase files, package files, ROADMAP, task state, run state, validation state, `.agent/state.json`, or `.agent/out/*` files were modified.

## Validator Scope

The validator inspects the current Ralph runtime state and reports inconsistencies without writing files or attempting repairs.

Files inspected by the validator:

- `ROADMAP.md`
- `tasks/task-state.json`
- `tasks/task-history.jsonl`
- `runs/current-run.json`
- `runs/run-history.jsonl`
- `validation/validation-rules.json`
- `validation/validation-results.jsonl`
- `handoffs/latest-handoff.md`
- `.agent/state.json`
- `.agent/out/selected-task.json` when present
- `.agent/out/verify-report.md` when present
- `.agent/out/handoff-template.md` when present

## Checks Implemented

The validator implements deterministic checks for:

- Safe JSON parsing for canonical JSON files.
- Line-by-line JSONL parseability for evidence streams.
- Legacy JSONL event schemas as warnings, not fatal errors.
- Duplicate task IDs in `tasks/task-state.json`.
- Duplicate evidence IDs where `event_id` / `validation_id` fields exist.
- `runs/current-run.json` references to missing tasks.
- Active-run/task status conflicts.
- Stale active-run detection for expired lock / stale heartbeat fields when present.
- Completed current-run with active lock.
- Task `done` without matching passing validation evidence.
- Task `done` without review acceptance evidence when `requires_human_review` is true.
- ROADMAP `done` while runtime status is active.
- Runtime `done` while ROADMAP status is not `done` when both sides contain the same task ID.
- `handoffs/latest-handoff.md` required handoff concepts.
- Handoff task/run mismatch where detectable.
- Stale `.agent/state.json`.
- Stale `.agent/out/selected-task.json`.
- Legacy `.agent/out/verify-report.md` and `.agent/out/handoff-template.md` presence as non-authoritative warnings.

## Output Modes

- Human-readable default output:

```bash
node scripts/agent/validate-ralph-state.mjs
```

- Machine-readable JSON output:

```bash
node scripts/agent/validate-ralph-state.mjs --json
```

## Exit Codes

- `0` — no critical errors.
- `1` — critical integrity errors found.
- `2` — validator execution error.

## Sample Command Run

```bash
node scripts/agent/validate-ralph-state.mjs
```

## Sample Result

The validator executed successfully and returned exit code `1` because it detected critical integrity findings in the existing runtime state. This is the expected exit-code behavior for a read-only validator when critical findings are present.

Observed summary:

```text
Status: critical_findings
Critical findings: 8
Warnings: 43
EXIT_CODE=1
```

## Critical Findings

The smoke run reported these critical finding categories:

- `done_without_review_evidence`
  - Several `done` Ralph tasks require human review but do not have detectable review acceptance evidence in the current evidence streams.
- `done_without_validation_evidence`
  - `RALPH-006A` is marked `done` but the current validation evidence is attached to `RALPH-006A-FIX`, so the validator does not treat it as matching task completion evidence.

These findings are reported only. The validator does not mutate task state, run state, validation results, or handoff evidence.

## Warnings

The final verification run reported warning categories for:

- Legacy JSONL event schemas in `tasks/task-history.jsonl` and `runs/run-history.jsonl`.
- `handoffs/latest-handoff.md` not mentioning the older latest-run snapshot ID `run_2026-05-19_ralph-010a-closeout` from `runs/current-run.json`.
- `.agent/state.json` being stale and non-authoritative.
- `.agent/out/selected-task.json` being stale and non-authoritative.
- Legacy `.agent/out/verify-report.md` and `.agent/out/handoff-template.md` being present and non-authoritative.

## Verification Commands Run

```bash
node scripts/agent/validate-ralph-state.mjs
node scripts/agent/validate-ralph-state.mjs --json
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

Results:

- `node scripts/agent/validate-ralph-state.mjs` executed successfully and exited `1` due to critical findings.
- `node scripts/agent/validate-ralph-state.mjs --json` executed successfully and exited `1` due to critical findings.
- `git --no-pager status --short` showed only intended scoped changes.
- `git --no-pager diff --stat` and `git --no-pager diff --name-only` showed the tracked handoff diff; new untracked files are listed by status until staged.

## Non-Goals

- No product code changes.
- No ROADMAP edits.
- No task-state, run-state, validation-state, `.agent/state.json`, or `.agent/out/*` mutations.
- No automatic repairs.
- No generated runtime state writes.
- No package changes.
- No commits.
- No push.

## Next Recommended Task

Recommended next task: **RALPH-004 — ROADMAP ↔ Task-State Reconciler**.

Reason: the validator now reports runtime-state integrity issues read-only. The next safe step is a read-only reconciler that compares ROADMAP planning truth to structured task-state and proposes, but does not write, reconciliation actions.