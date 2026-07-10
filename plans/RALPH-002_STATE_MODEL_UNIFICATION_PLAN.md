# Executive Summary

RALPH-002 defines the canonical Ralph V2 runtime state model before any additional runtime implementation work begins. This is a planning-only artifact. It intentionally avoids product-code changes, script changes, runtime-state mutations, ROADMAP edits, commits, and pushes.

Ralph V2 must resolve the current split between planning truth, runtime task execution state, active/latest run state, append-only evidence, validation evidence, handoff evidence, and legacy `.agent/state.json` / `.agent/out/*` artifacts. The recommended V2 model is:

- `ROADMAP.md` remains the canonical planning truth.
- `tasks/task-state.json` becomes the canonical structured runtime task registry for Ralph execution.
- `runs/current-run.json` becomes the canonical active-run lock and latest-run snapshot, with explicit semantics for both.
- `tasks/task-history.jsonl`, `runs/run-history.jsonl`, `validation/validation-results.jsonl`, archived handoffs, and review events are append-only evidence.
- `.agent/state.json` and `.agent/out/*` are deprecated as state authorities and retained only as legacy adapter outputs until replaced.

This plan is implementation-ready for:

1. **RALPH-003 Runtime State Validator** — read-only consistency checks across state, history, validation, handoff, and legacy artifacts.
2. **RALPH-004 ROADMAP ↔ Task-State Reconciler** — read-only discrepancy detection first, later human-approved write mode.
3. **RALPH-005 Transactional State Transition Module** — the only future writer for task/run lifecycle transitions and normalized events.

# Current State Split

The current repository has a mature but fragmented Ralph automation scaffold.

## Planning Authority: `ROADMAP.md`

`ROADMAP.md` is the planning SSOK under `SSOK.md` and `AGENTS.md`. It defines task IDs, human-readable task descriptions, priorities/order, and planning statuses. Current ROADMAP status vocabulary is narrower than Ralph runtime state:

- `todo`
- `in_progress`
- `blocked`
- `done`

Current observed product focus is `P1-003` with `Status: in_progress`. Ralph V2 planning tasks such as this RALPH-002 are task-request scoped and should not mutate ROADMAP unless explicitly authorized.

## Runtime Task Authority: `tasks/task-state.json`

`tasks/task-state.json` already declares its role as runtime state for Ralph execution tracking and explicitly states that it does not replace `ROADMAP.md`. It contains Ralph migration tasks `RALPH-001A` through `RALPH-010A`, all currently marked `done`, with richer runtime metadata:

- status
- priority
- risk level
- attempt counts
- human review requirement
- allowed files
- forbidden files
- outputs
- validation requirements
- acceptance criteria

This file contains the canonical minimum Ralph lifecycle vocabulary:

- `not_started`
- `in_progress`
- `needs_validation`
- `needs_review`
- `blocked`
- `failed`
- `done`
- `skipped`
- `cancelled`

## Current/Latest Run State: `runs/current-run.json`

`runs/current-run.json` currently points to a completed closeout run, `run_2026-05-19_ralph-010a-closeout`, with `status: completed`. It is therefore currently a latest-run snapshot, not a pure active lock. Existing discovery identified this ambiguity as a state-corruption risk.

Ralph V2 must formalize whether completed runs may remain in `current-run.json`. This plan allows them to remain only with explicit lock semantics described below.

## JSONL Evidence Streams

Evidence files exist but use inconsistent event taxonomies:

- `tasks/task-history.jsonl` includes `task_started`, `task_completed`, `bugfix_completed`, `state_repaired`, and `completed`.
- `runs/run-history.jsonl` includes `run_started`, `run_completed`, `smoke_test_completed`, `runtime_review_completed`, `bugfix_completed`, and state repair events.
- `validation/validation-results.jsonl` contains structured validation results but is not emitted by one central validator.

V2 must normalize schemas while retaining old events as historical evidence.

## Handoff Evidence

`handoffs/latest-handoff.md` is canonical by governance, but currently contains a product-task `P1-003` handoff rather than a Ralph runtime handoff. It is a shared mutable latest file and can be overwritten by unrelated product or Ralph tasks. Ralph V2 must add archival and run/task identity rules.

## Legacy Adapter State

Legacy orchestration uses:

- `.agent/state.json`
- `.agent/out/selected-task.json`
- `.agent/out/verify-report.md`
- `.agent/out/handoff-template.md`
- `.agent/out/worker-status.json`
- `.agent/out/opencode-*`
- prompts and reports in `.agent/out/`

Observed state is stale:

- `.agent/state.json` references `P1-002` and `ready_for_human_review` from 2026-05-16.
- `.agent/out/selected-task.json` references `P2-011` from 2026-05-16.
- `.agent/out/verify-report.md` is a marker-based legacy report from 2026-05-16.

These artifacts must not be Ralph V2 authorities.

# Canonical State Authority Model

## Authority Table

| Concern                                                                   | Canonical Owner                                  | Role                                                           | Writable by V2 transition module?                               | Evidence-only?            |
| ------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| Planning truth, task identity, priority/order, human-readable task intent | `ROADMAP.md`                                     | Planning authority                                             | No by default; only under explicit ROADMAP task authorization   | No                        |
| Ralph runtime task status and execution metadata                          | `tasks/task-state.json`                          | Runtime task authority                                         | Yes                                                             | No                        |
| Active run lock and latest run snapshot                                   | `runs/current-run.json`                          | Run execution authority                                        | Yes                                                             | No                        |
| Task transition audit                                                     | `tasks/task-history.jsonl`                       | Append-only task evidence                                      | Append only                                                     | Yes                       |
| Run lifecycle audit                                                       | `runs/run-history.jsonl`                         | Append-only run evidence                                       | Append only                                                     | Yes                       |
| Validation execution evidence                                             | `validation/validation-results.jsonl`            | Append-only validation evidence                                | Append only                                                     | Yes                       |
| Validation policy catalog                                                 | `validation/validation-rules.json` + `VERIFY.md` | Structured validation rules + canonical verification authority | No during normal runs                                           | No                        |
| Latest human handoff                                                      | `handoffs/latest-handoff.md`                     | Human-readable latest handoff                                  | Generated by V2 handoff generator after transition state exists | Latest evidence pointer   |
| Archived handoffs                                                         | `handoffs/archive/*.md`                          | Immutable run/task handoff evidence                            | Create only                                                     | Yes                       |
| Morning review                                                            | `reports/morning-review.md`                      | Generated aggregation/report                                   | Generated by reporter only                                      | Derived evidence          |
| Legacy agent state                                                        | `.agent/state.json`                              | Legacy adapter state                                           | No in V2 core                                                   | Deprecated / adapter-only |
| Legacy `.agent/out/*` artifacts                                           | `.agent/out/*`                                   | Legacy adapter outputs                                         | Adapter-only                                                    | Deprecated / adapter-only |

## Binding Authority Rules

1. Safety policy wins first: `.governance/SAFETY.md` and `.agent/config/protected-files.json` override execution attempts.
2. Planning conflicts resolve to `ROADMAP.md`.
3. Verification conflicts resolve to `VERIFY.md`.
4. Runtime execution conflicts resolve to `tasks/task-state.json` and `runs/current-run.json`, constrained by ROADMAP and safety.
5. JSONL histories never override current state; they prove or disprove state integrity.
6. Legacy adapter outputs never override canonical V2 state.

## Required V2 State Files

Ralph V2 runtime implementation must treat these as the minimum canonical state set:

- `ROADMAP.md`
- `tasks/task-state.json`
- `runs/current-run.json`
- `tasks/task-history.jsonl`
- `runs/run-history.jsonl`
- `validation/validation-results.jsonl`
- `handoffs/latest-handoff.md`
- `handoffs/archive/`

# Task Lifecycle Model

## Canonical Task States

| State              | Meaning                                                                                                                                 | Terminal?                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `not_started`      | Task is known to runtime state but no V2 run has started it.                                                                            | No                                            |
| `in_progress`      | Exactly one active run is executing or preparing execution for the task.                                                                | No                                            |
| `needs_validation` | Work exists, but required validation has not passed or has not run.                                                                     | No                                            |
| `needs_review`     | Required validation passed or documented appropriately, and human review is required before final closure or next autonomous task.      | No                                            |
| `blocked`          | Task cannot proceed due to dependency, ambiguity, safety gate, dirty tree, active-run conflict, missing approval, or environment issue. | No                                            |
| `failed`           | Task execution exhausted allowed attempts or encountered non-recoverable failure.                                                       | Conditionally terminal; human may reopen.     |
| `done`             | Task completed with required validation evidence and any required review acceptance.                                                    | Yes unless reopened by explicit human action. |
| `skipped`          | Task intentionally not executed because it is obsolete, out of scope, superseded, or not selected for this run series.                  | Yes unless reopened by explicit human action. |
| `cancelled`        | Task was stopped by explicit human decision before completion.                                                                          | Yes unless reopened by explicit human action. |

## Actor Classes

Allowed transition actors must be recorded in every task event:

- `coordinator` — V2 orchestration logic.
- `worker_adapter` — Cline/OpenCode/Roo/Codex adapter; may report execution result but must not directly mutate canonical state.
- `validator` — validation subsystem; may request validation-state transitions through transition module.
- `reviewer` — human reviewer or explicit human review recorder.
- `human` — direct authorized human action.
- `reconciler` — ROADMAP/task-state reconciliation module.
- `state_validator` — read-only validator; may not mutate state.

## Allowed Transitions

| From               | To                 | Permitted actor                            | Required evidence/gate                                                                 |
| ------------------ | ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `not_started`      | `in_progress`      | `coordinator`                              | No active run conflict; ROADMAP eligibility; safety preflight; run lock created.       |
| `not_started`      | `blocked`          | `coordinator`, `reconciler`, `human`       | Blocker reason.                                                                        |
| `not_started`      | `skipped`          | `human`, `reconciler` with human approval  | Skip reason and superseding task if applicable.                                        |
| `not_started`      | `cancelled`        | `human`                                    | Cancellation reason.                                                                   |
| `in_progress`      | `needs_validation` | `coordinator`                              | Worker completed or partial work detected; changed files recorded.                     |
| `in_progress`      | `blocked`          | `coordinator`                              | Stop condition reason.                                                                 |
| `in_progress`      | `failed`           | `coordinator`                              | Failure reason; attempts exhausted or non-recoverable error.                           |
| `in_progress`      | `cancelled`        | `human`                                    | Cancellation reason.                                                                   |
| `needs_validation` | `needs_review`     | `validator` through transition module      | Required validation passed or docs-only readback satisfied.                            |
| `needs_validation` | `in_progress`      | `coordinator`                              | Retry/fix attempt allowed.                                                             |
| `needs_validation` | `blocked`          | `validator`, `coordinator`                 | Validation blocked by environment or missing prerequisite.                             |
| `needs_validation` | `failed`           | `validator`, `coordinator`                 | Validation failed and attempts exhausted.                                              |
| `needs_review`     | `done`             | `reviewer`, `human`                        | Explicit review acceptance or policy-approved auto acceptance if future policy allows. |
| `needs_review`     | `in_progress`      | `reviewer`, `human`                        | Revision requested; run reopened or new attempt created.                               |
| `needs_review`     | `blocked`          | `reviewer`, `human`                        | Review blocks on missing decision/dependency.                                          |
| `needs_review`     | `failed`           | `reviewer`, `human`                        | Review rejection as failed.                                                            |
| `blocked`          | `not_started`      | `human`, `reconciler`                      | Blocker resolved before execution began.                                               |
| `blocked`          | `in_progress`      | `coordinator` after human/unblock evidence | Blocker resolved and run lock acquired.                                                |
| `failed`           | `not_started`      | `human`                                    | Explicit retry authorization; attempt policy reset/updated.                            |
| `failed`           | `blocked`          | `human`, `reviewer`                        | Failure reclassified as blocked.                                                       |
| `done`             | `in_progress`      | `human` only                               | Explicit reopen reason; new run_id; prior done evidence retained.                      |
| `skipped`          | `not_started`      | `human` only                               | Explicit unskip reason.                                                                |
| `cancelled`        | `not_started`      | `human` only                               | Explicit restart reason.                                                               |

## Forbidden Transitions

These transitions must be blocked by RALPH-005:

- Any transition to `done` without a passing or explicitly accepted validation event linked by `task_id` and `run_id`.
- Any transition to `done` when required human review remains unresolved.
- `not_started` → `done` without intermediate execution/reconciliation evidence.
- `in_progress` → `done` without `needs_validation` and `needs_review` gates, except human-approved state repair events.
- `failed` → `done` without explicit human reopen plus successful validation/review.
- Any state change by a worker adapter directly writing canonical files.
- Any state change that requires modifying a protected or forbidden file outside task scope.
- Any runtime state transition that contradicts `ROADMAP.md` planning existence without being marked as a reconciliation discrepancy.

# Run Lifecycle Model

## Canonical Run States

| State          | Meaning                                                                                | Terminal?                        |
| -------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| `planned`      | Run intent selected but not locked for execution. Optional/transient.                  | No                               |
| `active`       | Run lock acquired; worker/coordinator may operate on exactly one task.                 | No                               |
| `validating`   | Worker execution ended; validation is running or required.                             | No                               |
| `needs_review` | Run is complete enough for human review; no next task may start if review is required. | No                               |
| `completed`    | Run finished and all required gates for its configured scope passed.                   | Yes                              |
| `failed`       | Run failed due to worker, validation, safety, or unrecoverable technical failure.      | Yes                              |
| `blocked`      | Run stopped due to blocker requiring human/environment decision.                       | Yes until unblocked via new run. |
| `cancelled`    | Run stopped by explicit human cancellation.                                            | Yes                              |

## Active-Run Locking Semantics

`runs/current-run.json` must contain enough fields to unambiguously determine whether it is an active lock or a latest-run snapshot.

Required V2 fields:

```json
{
  "schema_version": "2.0.0",
  "run_id": "run_YYYYMMDDTHHMMSSZ_<task_id>_<short_nonce>",
  "task_id": "RALPH-003",
  "status": "active",
  "lock": {
    "is_active": true,
    "owner": "coordinator|cline|opencode|roo|codex",
    "acquired_at": "2026-05-22T15:45:00Z",
    "expires_at": "2026-05-22T16:15:00Z",
    "heartbeat_at": "2026-05-22T15:50:00Z",
    "ttl_minutes": 30
  }
}
```

Lock rules:

1. Exactly one active run may exist at a time.
2. `lock.is_active === true` is allowed only for run states `planned`, `active`, `validating`, or `needs_review`.
3. `completed`, `failed`, `blocked`, and `cancelled` runs must have `lock.is_active === false`.
4. A completed run may remain in `current-run.json` as latest-run snapshot only when `lock.is_active === false`.
5. Starting a new run requires either no `current-run.json`, or `lock.is_active === false`, or a stale active run recovered by the stale-run recovery procedure.
6. Review-required runs in `needs_review` block new task selection even if worker execution is finished.

## Stale-Run Detection

A run is stale when any of these are true:

- `lock.is_active === true` and `now > lock.expires_at`.
- `status` is `active` or `validating` and `heartbeat_at` is older than `ttl_minutes`.
- `status` is active-like but the referenced `task_id` is not `in_progress` or `needs_validation` in `tasks/task-state.json`.
- `task_id` is missing from `tasks/task-state.json` and is not marked as an imported ROADMAP task under reconciliation.
- `run_id` lacks a matching `run_started` event after V2 enforcement begins.

## Recovery From Stale Active Run

RALPH-003 must report stale active runs read-only. RALPH-005 may later implement recovery only through an explicit transition:

1. Append `run_event` with `event_type: stale_run_detected`.
2. If no file changes occurred, transition run to `blocked` or `failed` with `lock.is_active: false`, according to failure cause.
3. If file changes occurred, block immediately for human review; do not auto-clean or auto-rollback.
4. Transition task from `in_progress` to `blocked` unless validation evidence supports `needs_validation`.
5. Require human approval before starting another run.

## Completed Runs in `current-run.json`

Completed runs may remain in `runs/current-run.json` as the latest-run snapshot only if:

- `status` is terminal: `completed`, `failed`, `blocked`, or `cancelled`.
- `lock.is_active` is false or absent in legacy records.
- `completed_at` or terminal timestamp is present.
- A matching terminal `run_event` exists in `runs/run-history.jsonl` after V2 enforcement begins.

# Event Schema Design

All Ralph V2 JSONL events must be single-line JSON objects encoded as UTF-8 without trailing comments. Timestamps must use UTC ISO 8601 format with `Z`, for example `2026-05-22T15:45:00Z`.

## Common Event Envelope

Every V2 event must include:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260522T154500Z_<type>_<short_nonce>",
  "event_type": "task.transition.requested",
  "timestamp": "2026-05-22T15:45:00Z",
  "actor": {
    "type": "coordinator",
    "id": "ralph-v2"
  },
  "task_id": "RALPH-003",
  "run_id": "run_20260522T154500Z_ralph-003_ab12cd",
  "correlation_id": "corr_20260522T154500Z_ralph-003_ab12cd"
}
```

Required common fields:

- `schema_version`
- `event_id`
- `event_type`
- `timestamp`
- `actor.type`
- `task_id` when event is task-scoped
- `run_id` when event is run-scoped
- `correlation_id`

Optional common fields:

- `actor.id`
- `parent_event_id`
- `causation_id`
- `summary`
- `details`
- `files_created`
- `files_modified`
- `files_deleted`
- `warnings`
- `errors`

`correlation_id` must be stable for all events produced by one run. For cross-run reconciliation, a reconciler may create a separate correlation ID.

## Task Events: `tasks/task-history.jsonl`

Canonical task event types:

- `task.created`
- `task.imported_from_roadmap`
- `task.transition.requested`
- `task.transition.applied`
- `task.transition.rejected`
- `task.blocked`
- `task.failed`
- `task.review_required`
- `task.review_accepted`
- `task.review_rejected`
- `task.reopened`
- `task.cancelled`
- `task.skipped`
- `task.reconciled`

Required task transition fields:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260522T154500Z_task_transition_ab12cd",
  "event_type": "task.transition.applied",
  "timestamp": "2026-05-22T15:45:00Z",
  "task_id": "RALPH-003",
  "run_id": "run_20260522T154500Z_ralph-003_ab12cd",
  "correlation_id": "corr_20260522T154500Z_ralph-003_ab12cd",
  "actor": { "type": "coordinator", "id": "ralph-v2" },
  "from_status": "not_started",
  "to_status": "in_progress",
  "reason": "selected_for_execution",
  "attempt_count": 1
}
```

Optional task fields:

- `roadmap_status`
- `validation_id`
- `review_id`
- `blocked_reason`
- `failure_reason`
- `reopen_reason`
- `allowed_files_snapshot`
- `forbidden_files_snapshot`

## Run Events: `runs/run-history.jsonl`

Canonical run event types:

- `run.planned`
- `run.lock_acquired`
- `run.started`
- `run.heartbeat`
- `run.worker_started`
- `run.worker_completed`
- `run.worker_failed`
- `run.validation_started`
- `run.validation_completed`
- `run.review_required`
- `run.completed`
- `run.failed`
- `run.blocked`
- `run.cancelled`
- `run.stale_detected`
- `run.lock_released`

Required run event fields:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260522T154500Z_run_started_ab12cd",
  "event_type": "run.started",
  "timestamp": "2026-05-22T15:45:00Z",
  "run_id": "run_20260522T154500Z_ralph-003_ab12cd",
  "task_id": "RALPH-003",
  "correlation_id": "corr_20260522T154500Z_ralph-003_ab12cd",
  "actor": { "type": "coordinator", "id": "ralph-v2" },
  "from_status": "planned",
  "to_status": "active",
  "lock": {
    "is_active": true,
    "owner": "cline",
    "acquired_at": "2026-05-22T15:45:00Z",
    "expires_at": "2026-05-22T16:15:00Z"
  }
}
```

Optional run fields:

- `worker_adapter`
- `mode`
- `commands_executed`
- `exit_code`
- `elapsed_ms`
- `stop_reason`
- `blocked_reason`
- `failure_reason`
- `changed_files`

## Validation Events: `validation/validation-results.jsonl`

Canonical validation event types:

- `validation.planned`
- `validation.started`
- `validation.check_passed`
- `validation.check_failed`
- `validation.completed`
- `validation.failed`
- `validation.blocked`
- `validation.waived_by_human`

Required validation result fields:

```json
{
  "schema_version": "2.0.0",
  "validation_id": "val_20260522T154500Z_ralph-003_ab12cd",
  "event_id": "evt_20260522T154500Z_validation_completed_ab12cd",
  "event_type": "validation.completed",
  "timestamp": "2026-05-22T15:45:00Z",
  "task_id": "RALPH-003",
  "run_id": "run_20260522T154500Z_ralph-003_ab12cd",
  "correlation_id": "corr_20260522T154500Z_ralph-003_ab12cd",
  "actor": { "type": "validator", "id": "ralph-v2-validator" },
  "verify_category": "documentation-only",
  "required_checks": ["git --no-pager status --short"],
  "checks": [
    {
      "check_id": "git_status_short",
      "command": "git --no-pager status --short",
      "required": true,
      "blocking": true,
      "status": "passed",
      "exit_code": 0
    }
  ],
  "overall_result": "passed",
  "npm_verify_required": false,
  "npm_verify_executed": false
}
```

Optional validation fields:

- `verify_md_rule_reference`
- `validation_rules_reference`
- `changed_files_basis`
- `stdout_excerpt`
- `stderr_excerpt`
- `failure_reason`
- `waiver_reason`
- `waived_by`

## Review Events

V2 should introduce review events as structured evidence. The recommended location is `runs/run-history.jsonl` initially, with `event_type` prefix `review.*`. A future dedicated `reviews/review-history.jsonl` may be introduced only through an explicit governance task.

Canonical review event types:

- `review.requested`
- `review.accepted`
- `review.rejected`
- `review.revision_requested`
- `review.blocked`
- `review.cancelled`

Required review event fields:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260522T154500Z_review_requested_ab12cd",
  "event_type": "review.requested",
  "timestamp": "2026-05-22T15:45:00Z",
  "review_id": "rev_20260522T154500Z_ralph-003_ab12cd",
  "task_id": "RALPH-003",
  "run_id": "run_20260522T154500Z_ralph-003_ab12cd",
  "correlation_id": "corr_20260522T154500Z_ralph-003_ab12cd",
  "actor": { "type": "coordinator", "id": "ralph-v2" },
  "review_status": "requested",
  "handoff_path": "handoffs/latest-handoff.md",
  "archived_handoff_path": "handoffs/archive/20260522T154500Z_RALPH-003_run_20260522T154500Z_ralph-003_ab12cd.md"
}
```

Optional review fields:

- `reviewer_id`
- `decision_rationale`
- `required_changes`
- `risk_assessment`
- `approval_scope`

# ROADMAP To Task-State Synchronization

## Status Mapping

ROADMAP has a simpler planning status vocabulary. Ralph V2 should map it to runtime states without losing information.

| ROADMAP status | Default task-state status                            | Notes                                                       |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `todo`         | `not_started`                                        | Unless runtime has active work.                             |
| `in_progress`  | `in_progress`, `needs_validation`, or `needs_review` | Runtime may be more specific.                               |
| `blocked`      | `blocked`                                            | Runtime blocker details should be structured in task-state. |
| `done`         | `done`                                               | Requires validation evidence.                               |

## Task Exists in ROADMAP but Not Task-State

Rule:

- This is not automatically an error.
- It is a reconciliation finding: `roadmap_task_missing_from_task_state`.
- If the task is eligible for Ralph execution, RALPH-004 should propose importing it into `tasks/task-state.json` with `status` mapped from ROADMAP.
- Initial RALPH-004 implementation must be read-only.
- Write/import mode must require explicit human approval and must use RALPH-005 transition helpers once available.

Required proposed import fields:

- `id`
- `title`
- `status`
- `priority` inferred from ROADMAP order/tier or `medium` if unknown
- `risk_level` inferred conservatively as `review_required` unless explicitly safe
- `allowed_files` empty or task-derived with human confirmation
- `forbidden_files` from protected-file defaults
- `validation` derived from task category if possible
- `source: "ROADMAP.md"`
- `roadmap_line` if parser supports it

## Task Exists in Task-State but Not ROADMAP

Rule:

- This is a reconciliation finding: `runtime_task_missing_from_roadmap`.
- Runtime state must not create planning truth.
- If task is a Ralph-internal migration task intentionally not present in ROADMAP, it must be marked with `runtime_only: true` or equivalent metadata in a future schema.
- If not runtime-only, it must be blocked from new execution until ROADMAP planning authority is resolved.

## ROADMAP Status Differs From Task-State Status

Rule:

- ROADMAP owns planning status; task-state owns runtime status.
- Differences are allowed only when explainable by the mapping table.
- Unexplained differences are reconciliation findings.

Examples:

- ROADMAP `in_progress`, task-state `needs_validation` is valid because runtime is more specific.
- ROADMAP `todo`, task-state `in_progress` is invalid unless a run just acquired a lock and ROADMAP update is explicitly deferred by task constraints.
- ROADMAP `done`, task-state `needs_review` is invalid because done cannot precede review acceptance under V2.

## Task-State Done but ROADMAP Not Done

Rule:

- This is `runtime_done_roadmap_not_done`.
- It may occur when the task forbids ROADMAP edits or when human has not approved ROADMAP update.
- It must block automatic selection of subsequent dependent tasks if ROADMAP planning depends on completion.
- RALPH-004 should propose ROADMAP status update only; it must not write ROADMAP without explicit authorization.

## ROADMAP Done but Task-State Active

Rule:

- This is a high-severity state mismatch.
- If task-state is `in_progress`, `needs_validation`, or `needs_review`, new execution must stop.
- RALPH-003 should report `roadmap_done_runtime_active`.
- Recovery requires human review to either:
  - mark runtime task `done` if evidence exists,
  - reopen ROADMAP if work is incomplete,
  - or cancel/block the runtime task.

## New ROADMAP Tasks Entering Ralph Execution

Rule:

1. Task must exist in ROADMAP with stable ID, status, and DoD/verification expectation.
2. Reconciler imports or proposes import to `tasks/task-state.json`.
3. Imported runtime task starts as `not_started` unless ROADMAP is already `in_progress`.
4. Safety metadata must be explicit before execution: allowed files, forbidden files, risk level, validation category, review requirement.
5. V2 coordinator may select only imported tasks from `tasks/task-state.json`.
6. Legacy ROADMAP-only selection must be treated as adapter-only and not authoritative for Ralph V2.

# Validation Result Model

## Ownership

- `VERIFY.md` owns verification decisions, required checks, optional checks, blocking checks, and verification-related Definition of Done.
- `validation/validation-rules.json` is a structured rule catalog and must not contradict `VERIFY.md`.
- `validation/validation-results.jsonl` is append-only evidence of what was actually run and what passed/failed.

## Production of Validation Results

Validation results must be produced by a V2 validator that:

1. Determines change category from changed files and task metadata.
2. Applies `VERIFY.md` canonical decision table.
3. Applies structured rules from `validation/validation-rules.json` where non-conflicting.
4. Runs or records required readback checks.
5. Emits normalized validation events.
6. Blocks state transitions on failed blocking checks.

For this RALPH-002 planning task, the user explicitly requested only:

```bash
git --no-pager status --short
```

## Linking to Task and Run

Every validation result must include:

- `validation_id`
- `task_id`
- `run_id`
- `correlation_id`
- `verify_category`
- `required_checks`
- `checks[]`
- `overall_result`
- `npm_verify_required`
- `npm_verify_executed`

Validation evidence is valid for task completion only when the `task_id` and `run_id` match the current transition being completed.

## VERIFY.md Category Representation

Recommended `verify_category` values:

- `documentation-only`
- `governance-only`
- `test-only`
- `product-runtime-code`
- `edge-supabase`
- `dependency-change`
- `runtime-state-only`
- `governance-script-only`

Each category must record:

- `verify_md_category_number` when directly matching the decision table.
- `required_checks` as command strings or structured internal checks.
- `optional_checks` if considered.
- `blocking_checks` with pass/fail status.
- `rationale` for not running `npm run verify` when not required.

## Failed Validation Blocking Rules

- A failed blocking check prevents `needs_validation` → `needs_review`.
- A failed blocking check prevents any transition to `done`.
- If failure is fixable and attempts remain, task remains or returns to `needs_validation` / `in_progress`.
- If attempts are exhausted, task transitions to `failed` or `blocked` depending on whether the issue is task-internal or external.
- Failed validation must be documented in handoff and review events.

# Handoff Model

## Role of `handoffs/latest-handoff.md`

`handoffs/latest-handoff.md` is the current human-readable handoff pointer. It should always represent the latest completed, failed, blocked, or review-ready run that requires human awareness.

It must include, at minimum, the normative fields from `.governance/RULES.md`:

1. Run/task identity and status.
2. What changed.
3. Why changed.
4. Changed files list.
5. Validation executed.
6. Validation result.
7. Known issues/blockers/risks.
8. Human-review status.

## Archival Requirement

Ralph V2 should archive every generated handoff before overwriting `latest-handoff.md`.

Archive path convention:

```text
handoffs/archive/YYYYMMDDTHHMMSSZ_<TASK_ID>_<RUN_ID>_handoff.md
```

Example:

```text
handoffs/archive/20260522T154500Z_RALPH-003_run_20260522T154500Z_ralph-003_ab12cd_handoff.md
```

Rules:

- Archive filename must include timestamp, task_id, and run_id.
- Archive content must match the generated latest handoff at the time of archival.
- `latest-handoff.md` should be regenerated from structured state and evidence, not manually templated.
- Existing legacy handoffs remain historical evidence and should not be rewritten during V2 migration unless explicitly tasked.

## Generation Rules

`latest-handoff.md` must be generated from:

- `tasks/task-state.json`
- `runs/current-run.json`
- changed-file detection
- latest validation result for matching `task_id` + `run_id`
- relevant run/task events
- review status
- known blockers/failures

Handoff must link to:

- `task_id`
- `run_id`
- `correlation_id`
- `validation_id`
- archived handoff path once archived

# Legacy Migration Strategy

## Classification Table

| Legacy Artifact                                                     | Current Role                               | V2 Classification                           | Migration Action                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.agent/state.json`                                                 | Legacy orchestrator state; currently stale | Deprecate as authority; keep adapter-only   | RALPH-003 reports if stale; V2 coordinator ignores for state decisions.                         |
| `.agent/out/selected-task.json`                                     | ROADMAP-driven legacy selected task        | Deprecate as authority; keep adapter output | Replace with V2 `runs/current-run.json` lock; adapters may read generated prompts only.         |
| `.agent/out/verify-report.md`                                       | Marker-based verification report           | Migrate into structured validation results  | Future validator may parse as legacy input, but canonical output is `validation-results.jsonl`. |
| `.agent/out/handoff-template.md`                                    | Generic template, not canonical handoff    | Deprecate                                   | Replace with generated `handoffs/latest-handoff.md` and archives.                               |
| `.agent/out/worker-status.json`                                     | Worker adapter execution result            | Keep as adapter output                      | V2 worker adapter should transform into `run.worker_*` events.                                  |
| `.agent/out/opencode-report.md`                                     | OpenCode adapter report                    | Keep as adapter output                      | Link from run event as adapter artifact, not state authority.                                   |
| `.agent/out/opencode-live.log`                                      | Worker log                                 | Keep as adapter output                      | Optional evidence link; never planning/runtime truth.                                           |
| `.agent/out/opencode-worker-done.json`                              | Sentinel success evidence                  | Keep as adapter output                      | Adapter converts to structured worker result event.                                             |
| `.agent/out/worker-prompt.md` / `next-prompt.md` / `worker-task.md` | Generated prompts                          | Keep as adapter output                      | V2 prompt builder may replace format; prompts are not state authority.                          |
| legacy `agent:run` flow                                             | ROADMAP + `.agent/out` orchestration       | Deprecate for V2 core                       | Keep available during transition; label as legacy adapter flow.                                 |
| legacy `selected-task.json`                                         | Selected task snapshot                     | Deprecate                                   | Replaced by current-run lock and task-state selection.                                          |
| legacy `verify-report.md`                                           | Full product verify markdown               | Migrate result semantics                    | Category-aware validator emits JSONL; markdown may be supplemental.                             |
| legacy `handoff-template.md`                                        | Manual template                            | Deprecate                                   | Canonical handoff generator owns latest/archive handoffs.                                       |

## Migration Phases

1. **Read-only validation phase (RALPH-003):** Validate all canonical and legacy state; report stale/mismatched artifacts without modifying them.
2. **Read-only reconciliation phase (RALPH-004):** Compare ROADMAP and task-state; emit proposed imports/status repairs.
3. **Transition module phase (RALPH-005):** Centralize canonical writes using temp-file writes and append-only events.
4. **Adapter conversion phase:** Existing scripts may continue producing `.agent/out/*`, but coordinator consumes only structured adapter result objects.
5. **Deprecation phase:** Mark legacy ROADMAP-only selection and `.agent/state.json` as non-authoritative in docs once replacement is implemented.

# Stop Conditions

Ralph V2 must stop immediately and avoid further task execution under the following conditions.

## Safety Violation

Stop when any `.governance/SAFETY.md` or `.agent/config/protected-files.json` policy is violated, including secrets exposure, forbidden operations, protected-file access, dependency installation without approval, deployment, push, or destructive operations.

## Protected File Change

Stop when changed files include absolute protected patterns or conditionally protected files without explicit task authorization and approval.

## Active Run Conflict

Stop when `runs/current-run.json` contains an active non-stale lock, an unresolved `needs_review` run, or inconsistent active run/task pairing.

## Dirty Working Tree

Stop before execution when the working tree is dirty unless the current task explicitly permits continuing with known existing changes. For planning/read-only tasks, dirty tree must at minimum be reported in verification output.

## Validation Failure

Stop when any required/blocking validation check fails. Do not mark task `done`.

## Missing Handoff

Stop before completion when a handoff is required but cannot be generated or linked to `task_id` and `run_id`.

## State Mismatch

Stop on high-severity mismatch, including ROADMAP done while runtime active, task-state done without validation evidence, active run task mismatch, invalid JSON/JSONL, duplicate task IDs, or missing canonical state fields.

## Human Review Required

Stop after each task/run when policy requires review. Do not proceed to the next task until review outcome is recorded.

## Worker Timeout

Stop when worker exceeds runtime or inactivity timeout. Mark run `failed` or `blocked` according to cause; do not auto-retry beyond configured attempts.

## Ambiguous Task Scope

Stop when task requirements, allowed files, forbidden files, validation category, or acceptance criteria are ambiguous or conflicting.

# State Integrity Rules

RALPH-003 and RALPH-005 should enforce the following invariants.

## Identity and Uniqueness

- `task_id` values are globally stable and never reused.
- `run_id`, `event_id`, `validation_id`, and `review_id` values are unique.
- Every current run must reference exactly one `task_id`.
- Every validation result must reference a valid `task_id` and `run_id`, except legacy imported evidence explicitly marked as legacy.

## Current State and History Consistency

- Every V2 task-state transition must have a corresponding `task.transition.applied` event.
- Every V2 run state transition must have a corresponding run event.
- JSONL evidence cannot change current state by itself.
- Historical evidence must be append-only.

## Completion Integrity

- Task `done` requires validation evidence matching the task/run.
- Task `done` requires review acceptance if `requires_human_review` is true.
- Run `completed` requires lock release.
- ROADMAP `done` and task-state `done` should agree after authorized reconciliation.

## Lock Integrity

- At most one active lock may exist.
- Active lock must have non-expired `expires_at` and recent heartbeat.
- Active lock task must be in an active-compatible task state.
- Completed/failed/blocked/cancelled run snapshots must not keep active locks.

## Scope Integrity

- Changed files must be within task `allowed_files` and outside `forbidden_files`.
- Protected files require explicit approval and task authorization.
- Product code changes are forbidden for Ralph planning/governance-only tasks.

## Validation Integrity

- `VERIFY.md` decision table determines required checks.
- `validation/validation-rules.json` may add structured checks but must not weaken `VERIFY.md`.
- Failed blocking validation prevents `done`.

## Handoff Integrity

- Latest handoff must identify `task_id`, `run_id`, validation status, changed files, and review status.
- Every generated latest handoff should have an archived copy before being overwritten.
- Handoff must not claim completion beyond validation evidence.

# Implementation Roadmap

## RALPH-003 Runtime State Validator

Goal: read-only validator for state integrity.

Scope:

- Parse `tasks/task-state.json`.
- Parse `runs/current-run.json`.
- Parse JSONL histories with legacy/V2 schema tolerance.
- Parse `validation/validation-results.jsonl`.
- Inspect `handoffs/latest-handoff.md` for identity and required sections.
- Detect stale `.agent/state.json` and `.agent/out/selected-task.json` as warnings, not authorities.
- Report active-run conflicts, stale active run, invalid JSON/JSONL, done-without-validation, ROADMAP/runtime mismatch, missing handoff, and protected-file mismatch.

Output:

- Read-only report to stdout or a report file if explicitly tasked.
- No state mutation.

## RALPH-004 ROADMAP ↔ Task-State Reconciler

Goal: read-only reconciliation between planning truth and runtime state.

Scope:

- Parse ROADMAP task IDs, titles, statuses, order, DoD/Verify text where possible.
- Parse task-state tasks.
- Apply mapping rules from this plan.
- Report tasks missing from either side.
- Report status mismatches and severity.
- Propose imports/updates without writing.

Output:

- Reconciliation report with machine-readable findings.
- No ROADMAP or task-state mutation in first implementation.

## RALPH-005 Transactional State Transition Module

Goal: centralize all canonical V2 state writes.

Scope:

- Provide transition functions for task states and run states.
- Validate allowed transitions before writes.
- Write JSON files through temp-file + rename.
- Append normalized JSONL events.
- Ensure lock acquisition/release semantics.
- Prevent `done` without validation/review evidence.
- Provide dry-run mode for every transition.

Output:

- Reusable state-transition module/CLI.
- No product-code changes.
- No legacy `.agent/state.json` authority.

## Later Follow-up Tasks

- Category-aware validator implementing `VERIFY.md` decision table.
- Canonical handoff generator with archive support.
- Safety engine enforcing protected-file and allowed-file scope against actual diffs.
- V2 coordinator dry run.
- Single-task V2 execution without commit/push.
- Review outcome recorder.

# Recommended Next Task

The recommended next task is **RALPH-003 Runtime State Validator**.

Reason:

- RALPH V2 should not write or reconcile state until current integrity can be assessed read-only.
- The repository already shows known divergence: `ROADMAP.md`, `tasks/task-state.json`, `runs/current-run.json`, JSONL histories, `handoffs/latest-handoff.md`, and legacy `.agent/state.json` / `.agent/out/*` do not represent one unified state model.
- A validator is the safest next step because it produces evidence without modifying runtime state, scripts, product code, ROADMAP, or package files.

Recommended RALPH-003 deliverable:

- A read-only validator that implements the state integrity rules in this plan and reports findings for human review.

Explicit non-goals for RALPH-003:

- No product-code changes.
- No ROADMAP edits.
- No automatic repairs.
- No commits or pushes.
