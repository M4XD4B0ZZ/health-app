# RALPH-004 ROADMAP ↔ Task-State Reconciler Report

## Task

- **Task ID:** RALPH-004
- **Task type:** Governance / tooling
- **Date:** 2026-05-22
- **Scope:** Read-only reconciliation between `ROADMAP.md` planning truth and `tasks/task-state.json` runtime task state

## Files Changed

- `scripts/agent/reconcile-roadmap-task-state.mjs`
  - Added read-only ROADMAP ↔ task-state reconciler CLI.
- `reports/RALPH-004_ROADMAP_TASK_STATE_RECONCILER_REPORT.md`
  - Added this implementation report.
- `handoffs/latest-handoff.md`
  - Updated canonical latest handoff for the RALPH-004 run.

No product code, Supabase files, package files, ROADMAP, task state, run state, validation state, `.agent/state.json`, or `.agent/out/*` files were modified.

## Reconciler Scope

The reconciler compares:

- `ROADMAP.md` as planning authority.
- `tasks/task-state.json` as Ralph runtime execution state.

The reconciler is read-only and reports discrepancies without modifying either authority file.

ROADMAP parsing detects at least these task ID formats:

- `P0-001`
- `P1-003`
- `P2-011`
- `RESOLVER-V2-001`
- `RALPH-001`
- `RALPH-001A`

For ROADMAP tasks, the reconciler extracts where detectable:

- task ID
- title
- planning status
- order/index
- section/phase heading path
- DoD/Verify text

For runtime task-state tasks, the reconciler extracts:

- task ID
- title
- status
- priority
- risk level
- source
- runtime-only marker

## Checks Implemented

The reconciler reports these required finding categories:

- `roadmap_task_missing_from_task_state`
- `runtime_task_missing_from_roadmap`
- `roadmap_status_differs_from_task_state`
- `roadmap_done_runtime_active`
- `runtime_done_roadmap_not_done`
- `duplicate_roadmap_task_id`
- `duplicate_task_state_id`
- `unknown_roadmap_status`
- `unknown_task_state_status`

Severity classification implemented:

- `critical`
- `warning`
- `info`

Status mapping follows `plans/RALPH-002_STATE_MODEL_UNIFICATION_PLAN.md`:

| ROADMAP status | Allowed runtime status                            |
| -------------- | ------------------------------------------------- |
| `todo`         | `not_started`                                     |
| `in_progress`  | `in_progress`, `needs_validation`, `needs_review` |
| `blocked`      | `blocked`                                         |
| `done`         | `done`                                            |

## Output Modes

- Human-readable default output:

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs
```

- Machine-readable JSON output:

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs --json
```

## Exit Codes

- `0` — no critical reconciliation findings.
- `1` — critical reconciliation findings found.
- `2` — reconciler execution error.

## Sample Commands Run

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs
```

## Sample Result

The initial smoke run executed successfully and returned exit code `1` because current repository state contains a critical reconciliation finding. This is expected behavior for a read-only reconciler when critical findings are present.

Observed summary:

```text
Status: critical_findings
ROADMAP tasks parsed: 28
Task-state tasks parsed: 10
Critical findings: 1
Warnings: 11
Info findings: 27
```

## Critical Findings

The smoke run reported:

- `duplicate_roadmap_task_id`
  - `P0-002` appears more than once in `ROADMAP.md`.

This finding is reported only. The reconciler does not mutate `ROADMAP.md` or `tasks/task-state.json`.

## Warnings

The smoke run reported warnings for:

- `roadmap_task_missing_from_task_state`
  - `P1-003` is `in_progress` in ROADMAP but missing from runtime task-state.
- `runtime_task_missing_from_roadmap`
  - `RALPH-001A` through `RALPH-010A` exist in runtime task-state but are not present in ROADMAP.

## Non-Goals

- No product code changes.
- No ROADMAP edits.
- No task-state writes.
- No run-state writes.
- No validation-state writes.
- No `.agent/state.json` or `.agent/out/*` writes.
- No automatic imports.
- No automatic status repairs.
- No generated runtime state writes.
- No package changes.
- No commits.
- No push.

## Verification Commands Run

Final verification is recorded in `handoffs/latest-handoff.md` after executing the user-requested checks:

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs
node scripts/agent/reconcile-roadmap-task-state.mjs --json
node scripts/agent/validate-ralph-state.mjs
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

## Next Recommended Task

Recommended next task: **RALPH-005 — Transactional State Transition Module**.

Reason: RALPH-004 now reports ROADMAP/task-state divergence read-only. The next planned safe step from `plans/RALPH-002_STATE_MODEL_UNIFICATION_PLAN.md` is a write-safe transition module that centralizes future authorized state changes, while preserving human approval gates and preventing ad hoc runtime writes.
