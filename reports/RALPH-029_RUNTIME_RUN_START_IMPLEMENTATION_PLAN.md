# RALPH-029: Runtime Run Start / Worker Execution Envelope Implementation Plan

**Task ID:** RALPH-029  
**Category:** Documentation / Design only  
**Generated:** 2026-05-31  
**Status:** Implementation plan complete; stop for human review  
**Deliverable:** `reports/RALPH-029_RUNTIME_RUN_START_IMPLEMENTATION_PLAN.md`

---

## 1. Goal, Deliverables, Success Criteria, Constraints

### Goal

Define the smallest safe implementation plan for a deterministic runtime run-start command that transitions one existing planned runtime run into an active worker-ready run by generating a worker execution envelope and recording the run-start boundary.

Recommended implementation target:

```bash
node scripts/agent/start-runtime-run.mjs
```

The command is the next runtime lifecycle step after `scripts/agent/create-runtime-run.mjs` and before any future worker invocation.

### Deliverables for the future implementation task

- New script: `scripts/agent/start-runtime-run.mjs`.
- New tests: `scripts/agent/__tests__/start-runtime-run.test.mjs`.
- Optional implementation report for the future code task, if required by the task definition.
- No product-code behavior change.
- No dependency changes.
- No worker execution.

### Success Criteria for this plan

- Exact run-start semantics are defined for `planned -> active`.
- Attempt-count behavior is refined from RALPH-028 and made transaction-safe.
- Idempotency protection prevents duplicate `run.started` events for the same `run_id`.
- Dry-run, write-mode guards, rollback, and failure behavior are explicit.
- RALPH-030 readiness gaps are documented.
- Verification for this documentation-only task follows `VERIFY.md` Category 1.

### Constraints for this task

This RALPH-029 planning task is documentation/design only.

Do not modify:

- `scripts/`
- `tasks/`
- `runs/`
- `validation/`
- `review/`
- `ROADMAP.md`
- package files
- product code
- `handoffs/latest-handoff.md`

Do not:

- implement the script
- mutate runtime state
- append evidence
- commit
- push
- execute a worker

---

## 2. Exact Implementation Scope / Non-Scope

### In Scope for the future RALPH-029 implementation

The future script should:

1. Read `runs/current-run.json`.
2. Read `tasks/task-state.json`.
3. Read `runs/run-history.jsonl` for idempotency validation.
4. Validate ordered preflight gates.
5. Generate a worker execution envelope for the selected adapter.
6. Dry-run by default and print the envelope without writing files.
7. In explicit write mode only, transition the current run from `planned` to `active`.
8. Append exactly one `run.started` event for the `run_id`.
9. Update task state from `not_started` to `in_progress` only as part of the successful run-start transaction.
10. Increment `attempt_count` only after the complete run-start transaction succeeds.
11. Append exactly one task-start history event only after the complete run-start transaction succeeds.
12. Store envelope metadata in `runs/current-run.json`, not the full envelope prompt text.
13. Never invoke any worker, model, IDE automation, network process, validation writer, review writer, or handoff generator.

### Explicit Non-Scope

The future script must not:

- create a runtime task from ROADMAP
- create a planned runtime run
- select a new task
- execute Cline, OpenCode, Codex, Roo, or any AI/model process
- write prompt files
- write validation evidence
- write review evidence
- write handoff documents
- complete, validate, review, block, fail, cancel, or recover runs
- update `ROADMAP.md`
- modify product code
- modify package files
- install dependencies
- push or deploy
- perform unattended overnight execution

### Smallest Safe Implementation

Smallest safe implementation means:

- one CLI script
- one test file
- dry-run default
- explicit `--write --confirm-write` requirement for mutation
- clean working tree required for write mode
- reconciler and validator required for write mode
- full envelope printed to stdout only
- only envelope metadata persisted
- no worker execution
- no prompt file generation
- no evidence writes outside the canonical run/task lifecycle events described below

---

## 3. Script Contract for `scripts/agent/start-runtime-run.mjs`

### Recommended CLI Flags

```bash
# Dry-run default: validate gates and print envelope preview only
node scripts/agent/start-runtime-run.mjs

# Dry-run JSON output
node scripts/agent/start-runtime-run.mjs --json

# Explicit adapter overlay
node scripts/agent/start-runtime-run.mjs --adapter cline --json

# Write mode: guarded transition only; no worker execution
node scripts/agent/start-runtime-run.mjs --adapter cline --write --confirm-write

# Help
node scripts/agent/start-runtime-run.mjs --help
```

| Flag | Default | Purpose |
| --- | ---: | --- |
| `--adapter <name>` | `cline` | Select worker adapter overlay. |
| `--json` | `false` | Emit machine-readable JSON result. |
| `--write` | `false` | Enable state mutation. Requires `--confirm-write`. |
| `--confirm-write` | `false` | Confirm explicit write intent. Requires `--write`. |
| `--print-envelope` | `true` | Print envelope to stdout. No file write. |
| `--skip-working-tree-check` | `false` | Test-only/internal fixture escape hatch. Must be documented as not for normal use. |
| `--help`, `-h` | `false` | Print usage and exit. |

### Exit Codes

| Code | Name | Meaning |
| ---: | --- | --- |
| `0` | `OK` | Dry-run succeeded or write transaction fully completed. |
| `1` | `VALIDATION_FAILURE` | Preflight, schema, idempotency, adapter, reconciler, validator, dirty tree, or safety gate failed. No attempted write should be considered successful. |
| `2` | `START_FAILURE` | Write transaction failed or rollback was required. |
| `3` | `INELIGIBLE_RUN_OR_TASK` | Current run/task missing, not planned, not eligible, or attempt capacity exhausted. |
| `4` | `IDEMPOTENCY_FAILURE` | Duplicate `run.started` event or inconsistent already-started state detected. |

### JSON Output Schema

Top-level result should be stable and parseable:

```json
{
  "schema_version": "1.0.0",
  "command": "start-runtime-run.mjs",
  "mode": "dry_run",
  "timestamp": "2026-05-31T12:00:00.000Z",
  "exit_code": 0,
  "run": {
    "run_id": "run_...",
    "task_id": "RALPH-029",
    "previous_status": "planned",
    "next_status": "active"
  },
  "task": {
    "task_id": "RALPH-029",
    "previous_status": "not_started",
    "next_status": "in_progress",
    "attempt_count_before": 0,
    "attempt_count_after": 1,
    "max_attempts": 3
  },
  "adapter": {
    "name": "cline",
    "policy_file": ".agent/adapters/cline.md",
    "supported": true
  },
  "preflight_gates": [
    {
      "name": "current_run_exists",
      "status": "passed",
      "blocking": true
    }
  ],
  "envelope": {
    "schema_version": "1.0.0",
    "envelope_id": "env_...",
    "generated_at": "2026-05-31T12:00:00.000Z",
    "delivery_mode": "stdout_only",
    "full_envelope": {}
  },
  "transaction": {
    "status": "not_started",
    "steps_completed": [],
    "files_changed": [],
    "rollback_performed": false
  },
  "would_change": [
    "runs/current-run.json",
    "runs/run-history.jsonl",
    "tasks/task-state.json",
    "tasks/task-history.jsonl"
  ],
  "worker_execution": "not_started",
  "error": null
}
```

In dry-run mode, `transaction.status` should be `not_started`, `files_changed` should be empty, and `would_change` should list the write-mode files.

### Human-Readable Output

Human output should include:

- command name and mode
- timestamp
- selected `run_id` and `task_id`
- adapter name and adapter policy file
- preflight gate summary with pass/fail markers
- envelope preview or a clearly labeled envelope block
- write-mode would-change list
- explicit statement: `Worker execution: not started`
- dry-run reminder: `No changes made. Use --write --confirm-write to start the run.`
- write success statement only after the complete transaction succeeds

---

## 4. `planned -> active` Transition Semantics

The canonical transition for RALPH-029 is:

```text
runs/current-run.json status: planned -> active
```

This transition means the run has crossed the worker-start boundary. It does not mean the worker completed, validation passed, review occurred, or the task is done.

### A. `runs/current-run.json` Updates

In write mode, after preflight gates pass and envelope generation succeeds, prepare a next current-run object with:

```json
{
  "status": "active",
  "started_at": "2026-05-31T12:00:00.000Z",
  "updated_at": "2026-05-31T12:00:00.000Z",
  "worker": {
    "type": "adapter",
    "id": "cline",
    "adapter": "cline",
    "started_by": "start-runtime-run.mjs"
  },
  "execution_envelope": {
    "schema_version": "1.0.0",
    "envelope_id": "env_...",
    "generated_at": "2026-05-31T12:00:00.000Z",
    "delivery_mode": "stdout_only",
    "stored": "metadata_only"
  }
}
```

The update should preserve existing run identity, task identity, scope snapshots, validation requirements, review requirements, and source metadata unless explicitly overwritten by the start transition fields.

### B. `runs/run-history.jsonl` Append

Append exactly one `run.started` event:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260531T120000Z_run_started_abc123",
  "event_type": "run.started",
  "timestamp": "2026-05-31T12:00:00.000Z",
  "run_id": "run_...",
  "task_id": "RALPH-029",
  "previous_status": "planned",
  "status": "active",
  "worker": {
    "adapter": "cline",
    "id": "cline"
  },
  "envelope": {
    "schema_version": "1.0.0",
    "envelope_id": "env_...",
    "generated_at": "2026-05-31T12:00:00.000Z",
    "delivery_mode": "stdout_only",
    "stored": "metadata_only"
  },
  "actor": {
    "type": "script",
    "id": "start-runtime-run.mjs"
  },
  "source": {
    "writer": "runtime-run-start",
    "mode": "write"
  },
  "summary": "Started runtime run for task RALPH-029. Worker execution envelope generated; worker not executed by this script."
}
```

### C. `tasks/task-state.json` Updates

The matching task should transition:

```text
not_started -> in_progress
```

Set:

- `status: "in_progress"`
- `updated_at` to the transaction timestamp
- `attempt_count` to `attempt_count_before + 1`, but only at the end of the successful transaction per RULE-029-ATTEMPT-001

No task should be marked `done`, `needs_validation`, or `needs_review` by this command.

### D. `tasks/task-history.jsonl` Updates

Append exactly one task-start event only after the complete run-start transaction succeeds:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260531T120000Z_task_started_abc123",
  "event_type": "task.started",
  "timestamp": "2026-05-31T12:00:00.000Z",
  "task_id": "RALPH-029",
  "run_id": "run_...",
  "from_status": "not_started",
  "to_status": "in_progress",
  "attempt_count": 1,
  "actor": {
    "type": "script",
    "id": "start-runtime-run.mjs"
  },
  "summary": "Task RALPH-029 started by runtime run-start transaction. Worker execution envelope generated; worker not executed by this script."
}
```

### E. Worker Metadata

Worker metadata identifies the adapter assignment only. It must not imply the worker process was launched.

Recommended metadata:

```json
{
  "type": "adapter",
  "id": "cline",
  "adapter": "cline",
  "started_by": "start-runtime-run.mjs",
  "execution_started": false,
  "adapter_policy_file": ".agent/adapters/cline.md"
}
```

---

## 5. RULE-029-ATTEMPT-001

### Binding Rule

**RULE-029-ATTEMPT-001:** `attempt_count` increases only after successful completion of the entire run-start transaction.

### Refinement of RALPH-028

RALPH-028 recommended incrementing `attempt_count` at run start. RALPH-029 refines that recommendation:

`attempt_count` must not increase merely because preflight begins or because an envelope preview succeeds. It increases only after all required transaction steps succeed.

### Exact Transaction Ordering

The future implementation should use this order:

1. Parse CLI options.
2. Read `runs/current-run.json`.
3. Read `tasks/task-state.json`.
4. Read `runs/run-history.jsonl`.
5. Read adapter policy metadata or validate adapter policy file exists.
6. Run preflight gates in the ordered sequence defined in Section 7.
7. Generate envelope in memory.
8. Validate envelope schema in memory.
9. Prepare next `current-run` in memory with status `active` and envelope metadata.
10. Prepare `run.started` event in memory.
11. Prepare next task-state in memory, but do not persist the increment as final yet.
12. Prepare `task.started` event in memory, but do not append yet.
13. Persist `runs/current-run.json` via temp-file write, parse/readback, and atomic rename.
14. Append `run.started` to `runs/run-history.jsonl`.
15. Re-read `runs/run-history.jsonl` and validate exactly one `run.started` exists for the `run_id`.
16. Persist `tasks/task-state.json` with `attempt_count + 1` and `status: "in_progress"` via temp-file write, parse/readback, and atomic rename.
17. Append `task.started` to `tasks/task-history.jsonl`.
18. Run post-write consistency checks for the touched runtime files.
19. Return success.

`attempt_count` is considered increased only after step 18 succeeds.

### Abort Rule

If any step before successful completion fails:

- `attempt_count` must not increase.
- task status must remain unchanged or be rolled back.
- `current-run` must be restored to its original `planned` state where possible.
- no success message may be printed.
- the command exits non-zero.

### Why this ordering matters

The transaction records an actual worker-start authorization boundary. A failed write, failed history append, duplicate-start detection, or partial rollback is not a valid worker attempt.

---

## 6. RULE-029-IDEMPOTENCY-001

### Binding Rule

**RULE-029-IDEMPOTENCY-001:** A `run_id` may never receive more than one `run.started` event.

### Duplicate Start Detection

Before generating the write transaction, read `runs/run-history.jsonl` and count records where:

```text
record.run_id === currentRun.run_id
record.event_type === "run.started"
```

Behavior:

| Count | Meaning | Action |
| ---: | --- | --- |
| `0` | Safe to start if all other gates pass. | Continue. |
| `1` | Already started. | Abort as duplicate start. Do not mutate files. |
| `>1` | Corrupt idempotency state. | Abort as idempotency failure. Require human recovery. |

Also abort if `current-run.json` has `status !== "planned"` or a non-null `started_at`, even if history is missing, unless a future explicit recovery mode exists.

### Recovery Behavior

Duplicate start attempts must be non-mutating:

- no envelope write
- no `current-run` write
- no `run-history` append
- no task-state update
- no task-history append
- no `attempt_count` increment

If `current-run.json` is `active` and one `run.started` event exists, report: `run_already_started`.

If `current-run.json` is `planned` but one `run.started` event exists, report: `inconsistent_started_history` and require human recovery.

If `current-run.json` is `active` but no `run.started` event exists, report: `partial_start_missing_history` and require human recovery; do not append a repair event in this command.

### Validation Checks

The future implementation should validate:

- no duplicate `run.started` event exists before write
- exactly one `run.started` event exists after write
- event `run_id` matches current run
- event `task_id` matches current run task
- event `previous_status` is `planned`
- event `status` is `active`
- event envelope metadata matches `current-run.execution_envelope`

### Test Cases

- planned run with no `run.started` event starts successfully.
- planned run with one `run.started` event aborts.
- active run with one `run.started` event aborts as already started.
- active run with no `run.started` event aborts as partial/inconsistent state.
- history with two `run.started` events for same `run_id` aborts as corrupt state.
- retry after successful write does not increment attempt count.

---

## 7. Ordered Preflight Gate Sequence

The future implementation must run gates in this order and abort at the first blocking failure unless JSON output is explicitly designed to collect all failures without mutation.

| Order | Gate | Pass Criteria | Abort Behavior |
| ---: | --- | --- | --- |
| 1 | Current run exists | `runs/current-run.json` parses and contains `run_id`, `task_id` or compatible task ID, and `status`. | Exit `3`; no writes. |
| 2 | Planned status | Run status is exactly `planned`; `started_at` is null or absent. | Exit `3`; no writes. |
| 3 | Task exists | Matching task exists in `tasks/task-state.json`. | Exit `3`; no writes. |
| 4 | Task eligible | Task status is `not_started`; task is runtime-eligible; task is not blocked/done/failed/cancelled. | Exit `3`; no writes. |
| 5 | Attempt capacity | `attempt_count < max_attempts`; missing values use safe defaults only if validated by existing state schema. | Exit `3`; no writes. |
| 6 | Idempotency precheck | Zero `run.started` events exist for the `run_id`; no inconsistent started state. | Exit `4`; no writes. |
| 7 | Scope integrity | Allowed/forbidden arrays are present from task and/or run snapshots; protected-file conflicts are rejected. | Exit `1`; no writes. |
| 8 | Clean working tree | Write mode requires clean `git status --porcelain`; dry-run may report but must not require clean tree unless strict mode is later added. | Exit `1`; no writes. |
| 9 | Reconciler green | `node scripts/agent/reconcile-roadmap-task-state.mjs --json` exits `0`. | Exit `1`; no writes. |
| 10 | Validator green | `node scripts/agent/validate-ralph-state.mjs --json` exits `0`. | Exit `1`; no writes. |
| 11 | Adapter supported | Adapter has a known policy file, e.g. `.agent/adapters/cline.md`. | Exit `1`; no writes. |
| 12 | Envelope generation succeeds | Envelope is generated in memory and passes schema checks. | Exit `2`; no writes. |

### Write-Mode Guards

Write mode must require:

- `--write`
- `--confirm-write`
- all preflight gates passing
- clean working tree
- reconciler green
- validator green
- adapter supported
- envelope generation success
- no duplicate `run.started` event

`--write` without `--confirm-write` must fail. `--confirm-write` without `--write` must fail.

### Dry-Run Default

Dry-run is the default and must:

- run read-only gates where safe
- generate and print envelope preview
- print would-change files
- not write any file
- not append JSONL
- not increment attempt count
- not execute worker

---

## 8. Envelope Output Model

### Printed Envelope

The full worker execution envelope should be printed to stdout in both human and JSON modes, clearly marked as an execution envelope preview.

Human output may render the envelope as formatted JSON under a heading.

### JSON Envelope

The JSON output should include the full envelope under:

```json
{
  "envelope": {
    "schema_version": "1.0.0",
    "envelope_id": "env_...",
    "generated_at": "2026-05-31T12:00:00.000Z",
    "delivery_mode": "stdout_only",
    "full_envelope": {}
  }
}
```

The envelope should include:

- run identity
- task identity
- task scope
- allowed files
- forbidden files
- expected outputs
- validation requirements
- review requirements
- governance references
- stop conditions
- adapter command-safety constraints
- expected worker output contract

### Metadata Stored in `current-run.json`

Only envelope metadata should be stored:

```json
{
  "execution_envelope": {
    "schema_version": "1.0.0",
    "envelope_id": "env_...",
    "generated_at": "2026-05-31T12:00:00.000Z",
    "delivery_mode": "stdout_only",
    "stored": "metadata_only"
  }
}
```

### Full Envelope Storage Decision

Do not store the full envelope in `runs/current-run.json` during RALPH-029.

Rationale:

- avoids large runtime-state files
- avoids prompt text becoming a competing source of truth
- keeps runtime state focused on identity and lifecycle metadata
- defers prompt-file generation to a future explicit task

---

## 9. Failure Recovery / Rollback

### Current-Run Write Failure

If writing `runs/current-run.json` fails:

- remove temp file if present
- restore original `runs/current-run.json` content where possible
- do not append `run.started`
- do not update task state
- do not append task history
- do not increment attempt count
- exit `2`

### Run-History Append Failure

If `run.started` append fails after `current-run` was written:

- restore original `runs/current-run.json`
- verify restored file parses
- do not update task state
- do not append task history
- do not increment attempt count
- exit `2`

If rollback fails, report `rollback_failed` and require human recovery. Do not claim success.

### Task-State Write Failure

If task-state write fails after `current-run` and `run.started` succeeded:

- attempt to restore original `runs/current-run.json`
- task-state should remain original if temp-write failed safely
- because JSONL append cannot be reliably un-appended without rewriting history, report partial transaction failure
- do not append task history
- do not consider `attempt_count` increased
- exit `2`
- require human recovery

This is why implementation should strongly consider preparing all in-memory objects first and writing mutable JSON files before irreversible JSONL appends where possible. However, RULE-029-ATTEMPT-001 requires the attempt increment to become authoritative only after the complete transaction succeeds.

### Task-History Append Failure

If task-history append fails after task-state write:

- attempt to restore original `tasks/task-state.json`
- attempt to restore original `runs/current-run.json` if safe
- report partial transaction failure
- do not claim attempt increment success
- require human recovery if JSONL has already recorded `run.started`

### Duplicate Start Attempt

Duplicate start is always non-mutating:

- report duplicate/inconsistent state
- print existing `run.started` event count
- do not generate write transaction
- do not increment attempt count
- exit `4`

### Partial Transaction Failure

Partial transaction failure means one or more durable writes succeeded but the full transaction did not complete.

Required behavior:

- stop immediately
- print structured failure details
- identify files possibly changed
- identify rollback status per file
- do not retry automatically
- require human review/recovery
- do not execute worker

---

## 10. Test Matrix

| Area | Test | Expected Result |
| --- | --- | --- |
| Help | `--help` prints contract | Exit `0`; no writes. |
| Dry-run | Default mode | Envelope printed; no files changed. |
| Dry-run | `--json` | JSON parses; includes full envelope and would-change list. |
| Happy path | Planned run, eligible task, no started event | Write mode transitions run to `active`, appends one `run.started`, updates task to `in_progress`, appends one `task.started`, attempt count increases by one after completion. |
| Duplicate start | One existing `run.started` for run | Abort; no writes; attempt count unchanged. |
| Duplicate corrupt | More than one `run.started` for run | Abort idempotency failure; no writes. |
| Inconsistent state | `active` current run without `run.started` | Abort; no writes; human recovery required. |
| Append failure | Simulated `run-history` append failure | Restore current-run; task state unchanged; attempt unchanged; exit non-zero. |
| Write failure | Simulated current-run write failure | Restore/remove temp; no append; task unchanged; attempt unchanged. |
| Task-state failure | Simulated task-state write failure | No task-history append; attempt not considered increased; partial failure reported if run-history already appended. |
| Task-history failure | Simulated task-history append failure | Attempt rollback where possible; partial failure reported; no success claim. |
| Gate failure | Missing current run | Abort; no writes. |
| Gate failure | Non-planned run | Abort; no writes. |
| Gate failure | Missing task | Abort; no writes. |
| Gate failure | Task not `not_started` | Abort; no writes. |
| Gate failure | Attempt capacity exhausted | Abort; no writes. |
| Gate failure | Dirty working tree in write mode | Abort; no writes. |
| Gate failure | Reconciler non-zero | Abort; no writes. |
| Gate failure | Validator non-zero | Abort; no writes. |
| Gate failure | Unsupported adapter | Abort; no writes. |
| Envelope | Cline adapter selected | Envelope includes `.agent/adapters/cline.md` and PowerShell command-safety constraints. |
| Attempt rule | Any failure before complete transaction | `attempt_count` unchanged. |
| Attempt rule | Successful write transaction | `attempt_count` increments exactly once. |
| Idempotency | Retry after successful write | Abort duplicate; no second `run.started`; no second attempt increment. |
| Worker safety | Write mode | No worker process spawned. |
| Scope safety | Generated result | Only expected runtime files would change in write mode. |

---

## 11. RALPH-030 Readiness Gaps

After RALPH-029 is implemented, the system will have a planned-to-active run-start boundary and a worker-ready envelope. Before an actual worker can be invoked, remaining gaps include:

1. **Worker invocation command**
   - A separate command must invoke a worker adapter using the envelope.
   - It must not be mixed into `start-runtime-run.mjs`.

2. **Prompt delivery mechanism**
   - Decide whether RALPH-030 passes envelope via stdout copy/paste, generated prompt file, adapter API, or CLI stdin.
   - Any prompt-file generation needs its own file path, retention policy, and safety rules.

3. **Worker output capture**
   - Define where worker output lands.
   - Define structured return schema for changed files, commands run, validation disclosure, blockers, and review status.

4. **Run completion transitions**
   - Define `active -> needs_validation`, `active -> blocked`, `active -> failed`, or `active -> needs_review` semantics.

5. **Validation integration**
   - Decide when validation is run, who runs it, and how validation results are written.

6. **Review gate integration**
   - Define how worker output enters review and how human-review stop points are represented.

7. **Handoff generation**
   - The worker must produce or update `handoffs/latest-handoff.md` in a future worker-execution task, not in RALPH-029.

8. **Recovery commands**
   - Separate recovery tooling is needed for stale active runs, partial transactions, duplicate/corrupt histories, and cancelled runs.

9. **Adapter-specific execution hardening**
   - Cline remains an interactive VS Code adapter with strict PowerShell command limits.
   - OpenCode/Codex/Roo invocation semantics must be adapter-specific and subordinate to repository governance.

10. **Unattended execution trust boundary**
    - Cline is not yet trusted for unattended overnight execution.
    - RALPH-030 should remain controlled and review-gated.

---

## 12. Verification Section

This task is documentation-only under `VERIFY.md` Category 1.

Required readback checks:

```bash
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

Commands must be run separately, consistent with `.agent/adapters/cline.md` command isolation rules.

No `npm run verify` is required because this task changes only a report file and does not modify runtime code, product code, tests, package files, governance runtime state, validation evidence, review evidence, or handoff files.

---

## 13. Human Review Stop Point

Stop after creating this plan and running the required documentation-only verification checks.

Do not proceed to implementation.

Do not modify:

- `scripts/`
- `tasks/`
- `runs/`
- `validation/`
- `review/`
- `ROADMAP.md`
- package files
- product code
- `handoffs/latest-handoff.md`

Do not commit or push.

Human review is required before RALPH-029 implementation begins.
