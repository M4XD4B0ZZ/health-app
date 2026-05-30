# RALPH-026: Runtime Run Creation Discovery & Design

**Task ID:** RALPH-026  
**Category:** Documentation / Design only  
**Generated:** 2026-05-30  
**Status:** Design complete; stop for human review  
**Deliverable:** `reports/RALPH-026_RUNTIME_RUN_CREATION_PLAN.md`

---

## 1. Executive Summary

RALPH-026 defines the missing Runtime Run Creation layer between Runtime Tasks and future Worker Execution.

Current target architecture:

```text
ROADMAP
↓
Runtime Task (RALPH-025)
↓
Runtime Run Creation (RALPH-026 design / RALPH-027 implementation)
↓
Worker Execution
↓
Validation
↓
Review Gate
```

The recommended run layer is a deterministic, guarded state transition that converts exactly one eligible runtime task from `tasks/task-state.json` into exactly one active run in `runs/current-run.json`, with append-only run lifecycle evidence in `runs/run-history.jsonl`.

### Core Recommendation

RALPH-027 should implement the smallest safe Runtime Run Creation CLI:

```bash
node scripts/agent/create-runtime-run.mjs
node scripts/agent/create-runtime-run.mjs --json
node scripts/agent/create-runtime-run.mjs --task-id <TASK_ID>
node scripts/agent/create-runtime-run.mjs --write --confirm-write --task-id <TASK_ID>
node scripts/agent/create-runtime-run.mjs --help
```

Default behavior must be dry-run only. Write mode must require both `--write` and `--confirm-write`. The implementation must create or replace `runs/current-run.json` only when no active run exists and the selected task is eligible. It should append exactly one `run.created` event to `runs/run-history.jsonl` in write mode.

---

## 2. Scope and Non-Scope

### 2.1 In Scope for This Report

- Run identity model.
- Run lifecycle recommendation.
- Canonical `runs/current-run.json` schema proposal.
- Run history strategy for `runs/run-history.jsonl`.
- Ownership model for human, script, and future autonomous run creation.
- Safety gates before run creation.
- Failure and recovery design.
- Interactions with existing Ralph components.
- Minimal RALPH-027 implementation scope.
- Autonomous-readiness impact for RALPH-027 through RALPH-029.

### 2.2 Out of Scope for This Report

- No implementation.
- No edits to `scripts/`, `tasks/`, `runs/`, `validation/`, `review/`, `ROADMAP.md`, `package.json`, `package-lock.json`, or product code.
- No runtime state mutation.
- No evidence append.
- No commits or pushes.

---

## 3. Current State Observations

### 3.1 Governance Authorities

The run layer must respect the repository authority hierarchy:

1. `SSOK.md` and `AGENTS.md` define repository governance.
2. `ROADMAP.md`, `VERIFY.md`, and `.governance/*` define domain authority, verification authority, and safety policy.
3. `tasks/task-state.json` and `runs/current-run.json` define runtime execution state.
4. Histories in `tasks/task-history.jsonl`, `runs/run-history.jsonl`, `validation/validation-results.jsonl`, and `review/review-results.jsonl` are evidence, not current-state authority.

### 3.2 Existing Runtime Task Layer

RALPH-025 exists as `scripts/agent/create-runtime-task-from-roadmap.mjs`. It creates exactly one runtime task from `ROADMAP.md` into `tasks/task-state.json`, defaulting to dry-run and requiring `--write --confirm-write` for mutation.

Important RALPH-025 properties that RALPH-027 should mirror:

- Dry-run by default.
- Explicit double-confirm write mode.
- No `ROADMAP.md` writes.
- No `package.json` registration in the minimal version.
- Pre-write safety checks.
- Atomic write with temp-file validation.
- Reconciler and validator remain green.

### 3.3 Existing Run State

`runs/current-run.json` currently contains a completed historical run with fields such as:

- `run_id`
- `created_at`
- `completed_at`
- `selected_task_id`
- `selected_task_title`
- `mode`
- `status`
- `selection_reason`
- `allowed_files`
- `forbidden_files`
- `validation_requirements`
- `safety_checks`
- `metadata`

`runs/run-history.jsonl` contains legacy and current run events with varied schemas and event types such as:

- `run_started`
- `run_completed`
- `smoke_test_completed`
- `runtime_review_completed`
- `bugfix_completed`
- `state_repair_completed`

The validator already tolerates legacy run event schemas and treats canonical dotted event types as the target direction.

---

## 4. Run Identity Model

### 4.1 Recommended `run_id` Format

Use a human-readable, timestamped, task-linked format:

```text
run_YYYYMMDDTHHMMSSZ_<normalized-task-id>_<nonce>
```

Example:

```text
run_20260530T123456Z_p1-003_a1b2c3
```

Where:

- `run_` is a stable prefix.
- `YYYYMMDDTHHMMSSZ` is the UTC creation timestamp without punctuation.
- `<normalized-task-id>` is lower-case `task_id` with non-alphanumeric separators normalized to `-`.
- `<nonce>` is a short random hex suffix, recommended 6 characters.

### 4.2 Human-Readable vs Deterministic IDs

Run IDs should be **human-readable but not purely deterministic**.

Rationale:

- Human-readable timestamp + task ID makes logs easy to inspect.
- A deterministic ID such as `run_<task-id>` would prevent retries or repeated recovery runs for the same task.
- A pure timestamp ID is harder to audit without joining against the run body.
- A nonce prevents collision when two run creation attempts occur within the same second.

### 4.3 Collision Prevention

Collision prevention must use layered checks:

1. Generate `run_id` using timestamp + normalized task ID + nonce.
2. Check `runs/current-run.json` for matching `run_id`.
3. Check `runs/run-history.jsonl` for matching `run_id`.
4. If collision exists, regenerate nonce up to a small bounded retry count, e.g. 5.
5. Abort if a unique ID cannot be produced.

### 4.4 Relationship to `task_id`

One run belongs to exactly one runtime task.

Recommended model:

```text
task_id 1 ──> many historical run_id values
run_id 1 ──> exactly one task_id
```

This supports retries, failed attempts, abandoned-run recovery, and auditability without overwriting task history.

The canonical field should be `task_id`. Existing `selected_task_id` should be treated as a legacy compatibility alias only.

---

## 5. Run Lifecycle

### 5.1 Current Known Statuses

Known run statuses from current runtime documents and validator behavior:

- `planned`
- `active`
- `validating`
- `needs_review`
- `completed`
- `failed`
- `blocked`
- `cancelled`

The validator currently also recognizes legacy `running` and `in_progress` as active-like run statuses.

### 5.2 Recommendation: Keep Current Canonical Statuses

Keep the eight known statuses as the canonical lifecycle:

```text
planned → active → validating → needs_review → completed
             ↓          ↓             ↓
           blocked    failed        failed
             ↓          ↓             ↓
          cancelled  cancelled     cancelled
```

### 5.3 Status Decisions

| Status | Decision | Reason |
|---|---|---|
| `planned` | Keep | Useful for a run created but not yet handed to a worker. Recommended initial status for RALPH-027. |
| `active` | Keep | Worker execution has started. Future Worker Execution should transition `planned` → `active`. |
| `validating` | Keep | Explicit bridge from worker output to validation evidence. |
| `needs_review` | Keep | Explicit stop state before human review gate. |
| `completed` | Keep | Terminal success after validation and required review acceptance. |
| `failed` | Keep | Terminal or recoverable failure during execution/validation. |
| `blocked` | Keep | Stop state when task/run cannot proceed because of dependency, ambiguity, safety, or human decision. |
| `cancelled` | Keep | Terminal state for intentionally stopped runs. |

### 5.4 Do Not Add These as Canonical Statuses

| Candidate | Decision | Reason |
|---|---|---|
| `running` | Do not add | Legacy synonym for `active`; validator may continue tolerating it. |
| `in_progress` | Do not add | Task status, not run status; use `active` for runs. |
| `abandoned` | Do not add | Use `blocked` or `cancelled` plus `stop_reason: "abandoned"`. |
| `stale` | Do not add | Staleness is derived from timestamps, not a lifecycle status. |

---

## 6. `current-run.json` Design

### 6.1 Canonical Schema

Recommended canonical `runs/current-run.json` schema for RALPH-027:

```json
{
  "schema_version": "2.0.0",
  "run_id": "run_20260530T123456Z_p1-003_a1b2c3",
  "task_id": "P1-003",
  "task_title": "Multi-Item Split",
  "status": "planned",
  "created_at": "2026-05-30T12:34:56.000Z",
  "started_at": null,
  "updated_at": "2026-05-30T12:34:56.000Z",
  "completed_at": null,
  "worker": {
    "type": "unassigned",
    "id": null,
    "adapter": null
  },
  "source": {
    "type": "script",
    "id": "create-runtime-run.mjs",
    "mode": "manual_cli",
    "dry_run": false
  },
  "owner": {
    "type": "human",
    "id": "operator"
  },
  "review_required": true,
  "validation_required": true,
  "validation_category": "runtime_run_creation",
  "selection_reason": "Explicit task-id selected for run creation",
  "allowed_files": [],
  "forbidden_files": [],
  "expected_outputs": [],
  "safety_checks": {
    "reconciler": "passed",
    "validator": "passed",
    "working_tree": "clean",
    "task_exists": "passed",
    "duplicate_active_run": "passed",
    "schema_validation": "passed"
  },
  "metadata": {
    "ralph_loop_version": "0.1.0-alpha",
    "creator_version": "1.0.0",
    "notes": "Run created but worker execution has not started."
  }
}
```

### 6.2 Minimum Fields

The absolute minimum remains:

- `run_id`
- `task_id`
- `status`

However, RALPH-027 should include the additional fields above because run creation is the audit boundary before worker execution.

### 6.3 Field Recommendations

| Field | Required? | Recommendation |
|---|---:|---|
| `schema_version` | Yes | Use `"2.0.0"` for canonical run schema. |
| `run_id` | Yes | Unique run identity. |
| `task_id` | Yes | Canonical task reference. |
| `task_title` | Yes | Snapshot from runtime task for human readability. |
| `status` | Yes | Initial value `planned`. |
| `created_at` | Yes | Run creation timestamp. |
| `started_at` | Yes | `null` until worker starts. |
| `updated_at` | Yes | Same as `created_at` initially. |
| `completed_at` | Yes | `null` until terminal status. |
| `worker` | Yes | `unassigned` in RALPH-027. Future worker sets adapter/id. |
| `source` | Yes | Identifies human/script/autonomous creator. |
| `owner` | Yes | Human or system owner accountable for the run. |
| `review_required` | Yes | Derived from task `requires_human_review`, default true if missing. |
| `validation_required` | Yes | Default true. |
| `validation_category` | Yes | Required for later validation routing. |
| `selection_reason` | Yes | Explains why this task was selected. |
| `allowed_files` | Recommended | Snapshot from task, default empty array if absent. |
| `forbidden_files` | Recommended | Snapshot from task, default empty array if absent. |
| `expected_outputs` | Recommended | Snapshot from task outputs, default empty array if absent. |
| `safety_checks` | Yes | Evidence of pre-run gate results. |
| `metadata` | Recommended | Versioning and notes. |

### 6.4 Legacy Compatibility

Existing `selected_task_id` and `selected_task_title` should remain tolerated by validators, but new writes should use `task_id` and `task_title`.

---

## 7. Run History Strategy

### 7.1 Files

- Current mutable run pointer: `runs/current-run.json`
- Append-only run evidence: `runs/run-history.jsonl`

### 7.2 When Entries Are Written

`runs/run-history.jsonl` should receive one append-only event for each run lifecycle transition:

| Transition | Event Type | Writer |
|---|---|---|
| Run created | `run.created` | Runtime Run Creation CLI |
| Worker starts | `run.started` | Future Worker Execution |
| Worker blocks | `run.blocked` | Worker or coordinator |
| Worker fails | `run.failed` | Worker or coordinator |
| Validation starts | `run.validation_started` | Validator/coordinator |
| Review required | `run.review_requested` | Review gate workflow/coordinator |
| Run completed | `run.completed` | Coordinator after validation/review success |
| Run cancelled | `run.cancelled` | Human or recovery CLI |
| Run recovered | `run.recovered` | Future recovery CLI |

RALPH-027 should write only `run.created`.

### 7.3 Append-Only Rules

Run history must be append-only:

- Never rewrite existing lines.
- Never delete historical lines.
- Append exactly one JSON object per line.
- Use canonical dotted `event_type` for new events.
- Include `schema_version`, `event_id`, `timestamp`, `run_id`, `task_id`, `actor`, and `source` on new events.
- Preserve legacy event lines as historical evidence.

Recommended RALPH-027 `run.created` event:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260530T123456Z_run_created_a1b2c3",
  "event_type": "run.created",
  "timestamp": "2026-05-30T12:34:56.000Z",
  "run_id": "run_20260530T123456Z_p1-003_a1b2c3",
  "task_id": "P1-003",
  "status": "planned",
  "actor": {
    "type": "script",
    "id": "create-runtime-run.mjs"
  },
  "source": {
    "writer": "runtime-run-creation",
    "mode": "write"
  },
  "summary": "Created planned runtime run for task P1-003. Worker execution not started."
}
```

### 7.4 Audit Requirements

Every run event should answer:

1. Who or what created/changed the run?
2. Which task was affected?
3. Which run was affected?
4. What status transition occurred?
5. Which safety/validation gates were known at the time?
6. Was this dry-run or real write mode?

---

## 8. Ownership Model

### 8.1 Who May Create Runs?

Run creation may be initiated by three actor classes, but all must use the same repository contract.

| Creator | Allowed? | Conditions |
|---|---:|---|
| Human-created | Yes | Human directly invokes CLI with explicit task ID and write confirmation. |
| Script-created | Yes | Script enforces safety gates and double-confirm write flags. |
| Future autonomous worker-created | Later | Only after RALPH-027/028/029 establish run creation, evidence, and review gates. |

### 8.2 Human-Created Runs

Human-created runs are appropriate for early Ralph phases. The human chooses `task_id`, executes dry-run, reviews output, then executes write mode.

Required source metadata:

```json
{
  "owner": { "type": "human", "id": "operator" },
  "source": { "type": "script", "id": "create-runtime-run.mjs", "mode": "manual_cli" }
}
```

### 8.3 Script-Created Runs

Script-created runs are deterministic CLI outcomes. The script is responsible for safety gates, schema validation, atomic writes, and history append.

### 8.4 Future Autonomous Worker-Created Runs

Future autonomous run creation should be allowed only after:

- Duplicate active run prevention is proven.
- Run creation evidence is canonical.
- Validation evidence is linked to run IDs.
- Review evidence is linked to run IDs.
- Recovery commands exist for stale/abandoned runs.

Until then, autonomous workers should not create runs directly.

---

## 9. Safety Gates Before Run Creation

All safety gates must pass before a real write.

### 9.1 Required Preconditions

| Gate | Required for RALPH-027? | Pass Criteria | Failure Action |
|---|---:|---|---|
| Reconciler status | Yes | `node scripts/agent/reconcile-roadmap-task-state.mjs --json` exits 0 | Abort |
| Validator status | Yes | `node scripts/agent/validate-ralph-state.mjs --json` exits 0 | Abort |
| Working tree state | Yes | Clean before write | Abort |
| Task existence | Yes | `task_id` exists in `tasks/task-state.json` | Abort |
| Task eligibility | Yes | Task status is `not_started` or optionally `in_progress` only with explicit recovery flag later | Abort |
| Duplicate active run prevention | Yes | No `planned`, `active`, `validating`, or `needs_review` current run | Abort |
| Schema validation | Yes | Existing run state and generated run parse and satisfy schema | Abort |
| Protected file scope | Yes | Write only `runs/current-run.json` and `runs/run-history.jsonl` | Abort |
| ROADMAP immutability | Yes | No `ROADMAP.md` write | Abort |
| Product-code immutability | Yes | No `src/**` write | Abort |

### 9.2 Duplicate Active Run Prevention

Active-like run statuses should be:

```text
planned, active, validating, needs_review
```

Legacy tolerated active-like statuses:

```text
running, in_progress
```

If `runs/current-run.json` contains any active-like status, RALPH-027 must refuse to create another run.

### 9.3 Working Tree Policy

For write mode, initial working tree should be clean. After write mode, only these files may change:

- `runs/current-run.json`
- `runs/run-history.jsonl`

No task-state mutation should happen in minimal RALPH-027 unless explicitly approved later.

---

## 10. Failure and Recovery

### 10.1 Partial Write Scenarios

| Scenario | Risk | Required Behavior |
|---|---|---|
| `current-run.json` write succeeds but history append fails | Current state without evidence | Roll back `current-run.json` to original content, report failure. |
| History append succeeds but `current-run.json` write fails | Evidence references non-current run | Avoid by writing `current-run.json` first to temp file, validate, then rename, then append history; if append fails, restore original current run and append `run.creation_failed` only in a later recovery-capable implementation. |
| Temp file remains | Confusing future runs | Delete temp file on failure. |
| JSON parse fails after write | Corrupt current run | Restore original content immediately. |
| Process interruption mid-write | Incomplete state | Use temp file + rename to minimize partial writes. |

### 10.2 Rollback Requirements

Minimal RALPH-027 rollback requirements:

1. Read and store original `runs/current-run.json` content in memory before write.
2. Write generated run to `runs/current-run.json.tmp`.
3. Validate temp JSON.
4. Rename temp file to `runs/current-run.json`.
5. Append `run.created` to `runs/run-history.jsonl`.
6. If any post-write validation fails, restore original `runs/current-run.json`.
7. Never truncate `runs/run-history.jsonl`.

Because JSONL append cannot be truly rolled back without rewriting history, the implementation should reduce risk by validating the exact JSONL line before append and appending only after the current run write succeeds.

### 10.3 Stale Run Recovery

A stale run is a non-terminal current run whose `updated_at` is older than an allowed threshold.

Recommended default threshold for future recovery: 24 hours.

RALPH-027 should detect stale active runs and abort with a clear message. It should not recover them automatically.

Future recovery CLI should support:

```bash
node scripts/agent/recover-runtime-run.mjs --dry-run
node scripts/agent/recover-runtime-run.mjs --cancel-stale --confirm-cancel
```

### 10.4 Abandoned Run Recovery

An abandoned run is a run that cannot continue because worker output, validation, or review evidence is missing beyond a policy threshold.

Recommendation:

- Do not introduce `abandoned` status.
- Mark abandoned runs as `blocked` or `cancelled` with `stop_reason: "abandoned"`.
- Append a `run.cancelled` or `run.blocked` event.
- Require human review before creating a new run for the same task.

---

## 11. Interaction With Existing Ralph Components

### 11.1 Runtime Tasks

Run creation reads `tasks/task-state.json` and selects exactly one eligible task.

Recommended RALPH-027 eligibility:

- Task exists.
- Task status is `not_started`.
- Task is not already represented by an active current run.
- Task contains enough metadata for a run snapshot.

Out of scope for RALPH-027:

- Updating task status.
- Incrementing `attempt_count`.
- Writing `tasks/task-history.jsonl`.

These should be deferred because RALPH-027 is only run creation, not worker start.

### 11.2 Validator

The validator must remain green before and after run creation.

RALPH-027 should use the validator as a safety gate, not modify validator behavior unless the implementation task explicitly allows it.

### 11.3 Reconciler

The reconciler compares `ROADMAP.md` and `tasks/task-state.json`. Run creation should not affect reconciler output because it does not modify either file.

RALPH-027 should still run the reconciler before write as a baseline gate.

### 11.4 Validation Evidence

Run creation should not write validation evidence in the minimal implementation. Validation evidence belongs to validation execution after worker output exists.

Future integration should ensure every validation event includes both `task_id` and `run_id`.

### 11.5 Review Evidence

Run creation should not write review evidence. Review evidence is created only after validation and review gate evaluation.

Future review events should include `run_id` and `task_id`.

### 11.6 Handoffs

Run creation does not need to update `handoffs/latest-handoff.md` in minimal RALPH-027. Handoffs belong to task completion or stop states after meaningful work has occurred.

Future worker execution should generate handoffs linked to `run_id`.

### 11.7 Review Gate

Run creation should set `review_required` on `current-run.json` based on the runtime task. It should not invoke the review gate.

Review gate remains downstream:

```text
Worker Execution → Validation → Handoff → Review Gate → Review Evidence
```

---

## 12. RALPH-027 Minimal Implementation Scope

### 12.1 Exact Files to Change

Recommended RALPH-027 implementation should change only:

```text
scripts/agent/create-runtime-run.mjs
scripts/agent/__tests__/create-runtime-run.test.mjs
reports/RALPH-027_RUNTIME_RUN_CREATION_IMPLEMENTATION_REPORT.md
```

In write-mode verification, the script itself may intentionally modify:

```text
runs/current-run.json
runs/run-history.jsonl
```

Files that must not be changed by RALPH-027 implementation:

```text
ROADMAP.md
tasks/task-state.json
tasks/task-history.jsonl
validation/validation-results.jsonl
review/review-results.jsonl
package.json
package-lock.json
src/**
supabase/**
```

### 12.2 CLI Contract

Recommended CLI:

```bash
# Dry-run default: select first eligible not_started runtime task
node scripts/agent/create-runtime-run.mjs

# Dry-run JSON
node scripts/agent/create-runtime-run.mjs --json

# Dry-run for explicit task
node scripts/agent/create-runtime-run.mjs --task-id P1-003

# Write mode for explicit task
node scripts/agent/create-runtime-run.mjs --task-id P1-003 --write --confirm-write

# Help
node scripts/agent/create-runtime-run.mjs --help
```

Flags:

| Flag | Default | Purpose |
|---|---:|---|
| `--task-id <id>` | none | Create run for explicit task; recommended for write mode. |
| `--write` | false | Enable real write mode. |
| `--confirm-write` | false | Required with `--write`. |
| `--json` | false | Machine-readable output. |
| `--help` | false | Print usage. |

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | Dry-run success or write success. |
| 1 | Safety/validation gate failure. |
| 2 | Run creation/write failure. |
| 3 | No eligible task or task not eligible. |

### 12.3 Write Guards

RALPH-027 write mode must require:

1. `--write` and `--confirm-write` together.
2. Clean working tree before write.
3. Reconciler exit 0.
4. Validator exit 0.
5. Existing `runs/current-run.json` parseable.
6. No active current run.
7. Task exists and is eligible.
8. Generated run schema valid.
9. Generated history event schema valid.
10. Post-write JSON parse of `runs/current-run.json` passes.

### 12.4 Dry-Run Behavior

Dry-run must:

- Never write files.
- Print selected task.
- Print generated `run_id` preview or indicate that final nonce/timestamp is generated on write.
- Print safety check summary.
- Print whether an active current run blocks creation.
- Print exact files that would change in write mode.

### 12.5 Test Matrix

| Test | Expected Result |
|---|---|
| Help prints CLI contract | Exit 0. |
| Dry-run writes nothing | No file changes. |
| `--write` without `--confirm-write` rejected | Exit 1. |
| `--confirm-write` without `--write` rejected | Exit 1. |
| Missing task ID in explicit mode rejected | Exit 3. |
| Unknown task ID rejected | Exit 3. |
| Task not `not_started` rejected | Exit 3. |
| Completed current run allows new planned run | Exit 0 in valid write test. |
| Active current run blocks new run | Exit 1. |
| Generated run has required fields | Schema assertion passes. |
| Run ID includes timestamp, task ID, nonce | Pattern assertion passes. |
| Write modifies only run files | Only `runs/current-run.json` and `runs/run-history.jsonl`. |
| History append is one valid JSONL line | JSON parse succeeds. |
| Reconciler remains green | Exit 0. |
| Validator remains green | Exit 0. |
| JSON output parseable | `JSON.parse` succeeds. |
| Rollback restores current run on post-write failure | Original content restored. |

### 12.6 Verification Commands for RALPH-027

Because RALPH-027 will change governance scripts, it is not Category 1. Recommended verification:

```bash
node --check scripts/agent/create-runtime-run.mjs
node scripts/agent/create-runtime-run.mjs --help
node scripts/agent/create-runtime-run.mjs --json
npm run test -- --runTestsByPath scripts/agent/__tests__/create-runtime-run.test.mjs
node scripts/agent/reconcile-roadmap-task-state.mjs --json
node scripts/agent/validate-ralph-state.mjs --json
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

If test infrastructure cannot run a path-specific ESM test cleanly, document the failure and run the closest existing Jest pattern used by adjacent Ralph tests.

---

## 13. Autonomous Readiness Impact

### 13.1 After RALPH-027

After minimal Runtime Run Creation exists:

- The system can create a canonical planned run from a runtime task.
- `runs/current-run.json` becomes the execution handoff object for future workers.
- `runs/run-history.jsonl` starts receiving canonical `run.created` events.
- Duplicate active runs can be prevented deterministically.
- Humans can review the run object before any worker executes.

What is still not autonomous:

- Worker execution does not start automatically.
- Task status is not advanced automatically.
- Validation/review evidence is not written by run creation.
- Recovery workflows remain manual.

### 13.2 After RALPH-028

Recommended RALPH-028 should integrate run lifecycle evidence and/or task-state transitions.

After RALPH-028, the system should be able to:

- Transition `planned` → `active` when a worker starts.
- Append `run.started` events.
- Optionally increment task `attempt_count` when execution starts, not when run is merely planned.
- Preserve run/task correlation across execution attempts.

### 13.3 After RALPH-029

Recommended RALPH-029 should prepare Worker Execution handoff.

After RALPH-029, the system should be able to:

- Generate a worker-ready prompt or execution envelope from `runs/current-run.json`.
- Assign a worker adapter (`cline`, `opencode`, `codex`, or `roo`) without making the adapter a source of truth.
- Ensure worker execution starts only from a valid `planned` run.
- Stop before validation/review gates as required.

At that point, the architecture becomes:

```text
ROADMAP
↓
Runtime Task
↓
Runtime Run
↓
Worker Execution Envelope
↓
Validation Evidence
↓
Review Gate / Review Evidence
```

---

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Creating a run while another run is active | Conflicting worker execution | Block on active-like current-run status. |
| Run ID collision | Audit ambiguity | Timestamp + task ID + nonce + history collision check. |
| History append without current state | Evidence/current-state mismatch | Validate current-run write before append; validate JSONL line before append. |
| Current-run overwrite loses completed history | Loss of latest pointer context | Preserve completed runs in `run-history`; current-run is a pointer, not full history. |
| Stale planned runs block progress | Autonomous loop stalls | Detect stale runs; defer recovery CLI. |
| Scope creep into worker execution | Unsafe automation | RALPH-027 creates planned run only. No worker execution. |
| Task-state mutation during run creation | Hidden status drift | Defer task status updates until worker start lifecycle. |
| Validator lacks strict v2 run schema | Weak enforcement | Implement local schema checks in RALPH-027 tests; validator integration can follow. |

---

## 15. Deferred Scope

The following should not be implemented in RALPH-027:

- Worker execution.
- Automatic task status updates.
- `tasks/task-history.jsonl` writes.
- Validation evidence writes.
- Review evidence writes.
- Handoff generation.
- Package script registration.
- Run cancellation/recovery CLI.
- Batch run creation.
- Autonomous run creation without human CLI invocation.
- ROADMAP status updates.
- Product code changes.

---

## 16. Explicit Recommendation for RALPH-027

Implement **RALPH-027 — Minimal Runtime Run Creation** as a conservative governance-script task.

### Recommended Deliverables

1. `scripts/agent/create-runtime-run.mjs`
2. `scripts/agent/__tests__/create-runtime-run.test.mjs`
3. `reports/RALPH-027_RUNTIME_RUN_CREATION_IMPLEMENTATION_REPORT.md`

### Required Behavior

- Dry-run by default.
- Write requires `--write --confirm-write`.
- Supports explicit `--task-id`.
- Selects only `not_started` runtime tasks.
- Creates `runs/current-run.json` with status `planned`.
- Appends exactly one `run.created` event to `runs/run-history.jsonl` in write mode.
- Blocks if current run is active-like.
- Runs reconciler and validator as gates.
- Does not modify task state, ROADMAP, validation evidence, review evidence, package files, or product code.

### Why This Is the Smallest Safe Step

The missing architectural layer is not worker execution yet; it is an auditable run object. Creating a planned run without starting a worker gives humans and future automation a stable execution envelope while preserving the one-task-per-run, stop-for-review governance model.

---

## 17. RALPH-026 Verification Plan

This task is Category 1 documentation-only. Required checks:

```bash
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

No commits. No pushes. Stop for human review.

---

## 18. Conclusion

RALPH-026 defines the missing Runtime Run Creation layer as a deterministic, audited transition from a runtime task to a planned run. The layer should not execute workers, mutate task state, or write validation/review evidence in its first implementation.

The recommended RALPH-027 implementation is intentionally minimal: create one planned run, write one current-run state file, append one run-created history event, enforce safety gates, and stop.
