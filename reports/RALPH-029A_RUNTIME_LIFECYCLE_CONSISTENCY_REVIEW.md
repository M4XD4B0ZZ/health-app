# RALPH-029A: Runtime Lifecycle Consistency Review

**Task ID:** RALPH-029A  
**Category:** Documentation / architecture review only  
**Generated:** 2026-05-31  
**Status:** Review complete; stop for human review  
**Deliverable:** `reports/RALPH-029A_RUNTIME_LIFECYCLE_CONSISTENCY_REVIEW.md`

---

## 1. Goal, Scope, and Sources Reviewed

### Goal

Define consistency rules between:

- run lifecycle
- task lifecycle
- evidence lifecycle
- recovery behavior

This review exists to remove ambiguity before the next runtime lifecycle implementation step.

### Scope

This task is documentation / architecture review only.

### Files reviewed

- `reports/RALPH-026_RUNTIME_RUN_CREATION_PLAN.md`
- `reports/RALPH-028_WORKER_EXECUTION_ENVELOPE_PLAN.md`
- `reports/RALPH-029_RUNTIME_RUN_START_IMPLEMENTATION_PLAN.md`
- `scripts/agent/create-runtime-run.mjs`
- `tasks/task-state.json`
- `runs/current-run.json`
- `runs/run-history.jsonl`
- `tasks/task-history.jsonl`
- `validation/validation-results.jsonl`
- `review/review-results.jsonl`
- `SSOK.md`
- `AGENTS.md`
- `VERIFY.md`
- `.governance/SYSTEM.md`
- `.governance/RULES.md`
- `.governance/SAFETY.md`
- `.governance/REVIEW_POLICY.md`
- `ROADMAP.md` as required by repository governance before task work

### Non-scope honored

No runtime state was intentionally mutated. No evidence was appended. No code was implemented. No task, run, validation, review, package, product-code, or handoff file was edited.

---

## 2. Authority Model

### 2.1 Canonical authority hierarchy

Per `SSOK.md` and `AGENTS.md`:

1. `SSOK.md`, `AGENTS.md` define repository governance.
2. `ROADMAP.md`, `VERIFY.md`, `.governance/*` define canonical domain, verification, lifecycle, safety, and review policy.
3. `tasks/task-state.json` and `runs/current-run.json` define current runtime execution state.
4. `tasks/task-history.jsonl`, `runs/run-history.jsonl`, `validation/validation-results.jsonl`, and `review/review-results.jsonl` are evidence/audit, not current-state authority.
5. Adapter docs and operational guides never override repository governance.

### 2.2 Current execution authority vs. task lifecycle authority

| Concern                                                   | Current authority              | Notes                                                                                    |
| --------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Which run is currently selected/executing                 | `runs/current-run.json`        | Current mutable run pointer and run lifecycle status.                                    |
| Which task is currently executing / task lifecycle status | `tasks/task-state.json`        | Current task lifecycle state, attempt count, scope, review requirement, and eligibility. |
| Planning priority / task existence at roadmap level       | `ROADMAP.md`                   | Runtime state never overrides roadmap planning authority.                                |
| Verification completion gate                              | `VERIFY.md`                    | Required checks and done-claim authority.                                                |
| Safety stop policy                                        | `.governance/SAFETY.md`        | Safety wins first on conflicts.                                                          |
| Lifecycle gate ordering                                   | `.governance/SYSTEM.md`        | Owns lifecycle gate order and stop-for-review placement.                                 |
| Handoff schema                                            | `.governance/RULES.md`         | Normative handoff schema owner.                                                          |
| Review acceptance                                         | `.governance/REVIEW_POLICY.md` | Human review acceptance/revision/rejection policy.                                       |
| Evidence of past events                                   | JSONL files                    | Evidence supports reconciliation; it does not override current state.                    |

### 2.3 Conflict classification

Run/task conflicts should be classified as runtime consistency findings, not planning conflicts, unless they contradict `ROADMAP.md`.

| Conflict type                                             | Classification                  | Authority to inspect                   | Recovery owner                                                                             |
| --------------------------------------------------------- | ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Run status and task status are inconsistent but parseable | Runtime lifecycle inconsistency | `current-run` + `task-state` + history | Future lifecycle consistency checker; human recovery if ambiguity exists.                  |
| History evidence contradicts current run/task state       | Evidence/current-state mismatch | Current state first, evidence second   | Human recovery unless a deterministic repair rule exists.                                  |
| Validation/review evidence missing for terminal success   | Completion-gate inconsistency   | `VERIFY.md`, validation/review JSONL   | Human review; no automatic done claim.                                                     |
| Safety/protected-file conflict                            | Safety violation                | `.governance/SAFETY.md`                | Immediate stop; human review required.                                                     |
| ROADMAP status contradicts runtime task status            | Planning/runtime drift          | `ROADMAP.md` + `task-state`            | `reconcile-roadmap-task-state.mjs` should report; human decision if destructive/ambiguous. |

### 2.4 Automatic repair policy

Automatic repair is allowed only when all of these are true:

1. The intended state is derivable from a single current authority without ambiguity.
2. The repair is append-only or affects only current mutable state with an exact before/after check.
3. The repair does not rewrite history.
4. The repair does not mark work `done`, `completed`, or review-accepted without required evidence.
5. The repair does not bypass safety or human-review gates.

When evidence is missing, duplicated, or contradictory around execution start/completion, human recovery is required. A future recovery CLI may perform deterministic repairs, but only with explicit recovery mode, clear audit events, and human confirmation.

---

## 3. Lifecycle Mapping Matrix

Legend:

- **V** = valid normal combination
- **I** = invalid / must block normal automation
- **T** = transitional or recovery-only; may exist briefly during a guarded transaction or under explicit recovery handling

| Run status \ Task status | not_started | in_progress | needs_validation | needs_review | done | failed | blocked | cancelled | skipped |
| ------------------------ | ----------: | ----------: | ---------------: | -----------: | ---: | -----: | ------: | --------: | ------: |
| `planned`                |           V |           T |                I |            I |    I |      I |       T |         T |       I |
| `active`                 |           T |           V |                T |            I |    I |      T |       T |         T |       I |
| `validating`             |           I |           T |                V |            T |    I |      T |       T |         T |       I |
| `needs_review`           |           I |           T |                T |            V |    T |      T |       T |         T |       I |
| `completed`              |           I |           I |                I |            T |    V |      I |       I |         I |       I |
| `failed`                 |           I |           T |                T |            I |    I |      V |       T |         T |       I |
| `blocked`                |           T |           T |                T |            T |    I |      T |       V |         T |       I |
| `cancelled`              |           T |           T |                I |            T |    I |      T |       T |         V |       T |

### Matrix interpretation

- `planned` + `not_started` is the canonical post-RALPH-027 state: a run exists but no execution has started.
- `active` + `in_progress` is the canonical run-start state.
- `validating` + `needs_validation` is the canonical validation boundary.
- `needs_review` + `needs_review` is the canonical human-review stop state.
- `completed` + `done` is the canonical successful terminal state and requires validation/review evidence where required.
- `failed` + `failed`, `blocked` + `blocked`, and `cancelled` + `cancelled` are canonical non-success terminal or stop states.
- Transitional pairs are acceptable only inside a transaction, after partial failure, or during explicit human-approved recovery. Normal start/validation/review commands must treat them as blocking unless the command is a dedicated recovery command.
- `skipped` is a task planning/runtime selection outcome, not a normal current-run execution outcome. It should not usually have a current active run.

---

## 4. Canonical Transition Rules

Each transition must be treated as a lifecycle boundary and produce current-state updates plus evidence.

### 4.1 `planned -> active`

| Requirement               | Rule                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required run update       | `runs/current-run.json.status = "active"`; set `started_at`, `updated_at`, worker adapter metadata, and envelope metadata.                         |
| Required task update      | `not_started -> in_progress`; increment `attempt_count` exactly once only after the complete transaction succeeds.                                 |
| Required history event    | Append `run.started`; append `task.started`.                                                                                                       |
| Required evidence linkage | Both events include `run_id`, `task_id`, previous/new statuses, actor, source, timestamp, and envelope metadata link.                              |
| Human review required?    | Not before start if all gates pass; human review required later before completion/next task. Human recovery required if inconsistency is detected. |

### 4.2 `active -> validating`

| Requirement               | Rule                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Required run update       | `status = "validating"`; set `updated_at`; optionally set validation start metadata.                               |
| Required task update      | `in_progress -> needs_validation`.                                                                                 |
| Required history event    | Append `run.validation_started`; append `task.validation_requested` or equivalent future canonical task event.     |
| Required evidence linkage | Link validation command/category to `run_id` and `task_id`; no validation result required yet at transition start. |
| Human review required?    | No, unless worker output is incomplete, safety concerns exist, or validation cannot be run.                        |

### 4.3 `validating -> needs_review`

| Requirement               | Rule                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Required run update       | `status = "needs_review"`; set `updated_at`; include validation summary reference.                                                      |
| Required task update      | `needs_validation -> needs_review`.                                                                                                     |
| Required history event    | Append `run.review_requested`; append `task.review_requested`.                                                                          |
| Required evidence linkage | A `validation.completed` evidence record with `overall_result: passed` or accepted equivalent must exist and link `run_id` + `task_id`. |
| Human review required?    | Yes. This transition is the explicit review gate.                                                                                       |

### 4.4 `needs_review -> completed`

| Requirement               | Rule                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Required run update       | `status = "completed"`; set `completed_at`, `updated_at`, and completion summary.                                   |
| Required task update      | `needs_review -> done`.                                                                                             |
| Required history event    | Append `run.completed`; append `task.completed`.                                                                    |
| Required evidence linkage | Required validation evidence and required review acceptance evidence must link `run_id` and `task_id`.              |
| Human review required?    | Yes. Completion is allowed only after required human review is accepted or task explicitly does not require review. |

### 4.5 `active -> blocked / failed / cancelled`

| Requirement               | Rule                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Required run update       | Set terminal/stop status; set `updated_at`; include `blocked_reason`, `failure_reason`, or `cancel_reason`.                        |
| Required task update      | `in_progress -> blocked`, `failed`, or `cancelled`.                                                                                |
| Required history event    | Append `run.blocked`, `run.failed`, or `run.cancelled`; append matching task event.                                                |
| Required evidence linkage | Link blocker/failure/cancellation cause to `run_id` and `task_id`; include changed-files/verification disclosure if work occurred. |
| Human review required?    | Yes for blocked/failed/cancelled active work before retry or new run.                                                              |

### 4.6 `validating -> failed / blocked`

| Requirement               | Rule                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| Required run update       | Set `failed` or `blocked`; include validation failure details or blocker. |
| Required task update      | `needs_validation -> failed` or `blocked`.                                |
| Required history event    | Append `run.failed` or `run.blocked`; append matching task event.         |
| Required evidence linkage | Link validation result or blocker to `run_id` and `task_id`.              |
| Human review required?    | Yes when validation fails or cannot be resolved within scope.             |

### 4.7 `needs_review -> failed / blocked / cancelled`

| Requirement               | Rule                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Required run update       | Set `failed`, `blocked`, or `cancelled`; include review outcome/reason.             |
| Required task update      | `needs_review -> failed`, `blocked`, or `cancelled`.                                |
| Required history event    | Append `run.failed`, `run.blocked`, or `run.cancelled`; append matching task event. |
| Required evidence linkage | Link review rejection/revision/blocker evidence to `run_id` and `task_id`.          |
| Human review required?    | Yes; this transition is driven by review outcome or human cancellation.             |

---

## 5. RALPH-029 Transaction Risk Review

### 5.1 Planned RALPH-029 write ordering reviewed

`reports/RALPH-029_RUNTIME_RUN_START_IMPLEMENTATION_PLAN.md` currently proposes:

1. Persist `runs/current-run.json` with status `active`.
2. Append `run.started` to `runs/run-history.jsonl`.
3. Validate exactly one `run.started` exists.
4. Persist `tasks/task-state.json` with `status: "in_progress"` and `attempt_count + 1`.
5. Append `task.started` to `tasks/task-history.jsonl`.
6. Run post-write checks.

### 5.2 Risk assessment

This ordering is **not safe enough** if task-state update and task-history append are included in the same implementation.

The unsafe point is that `run.started` is appended before `tasks/task-state.json` and `tasks/task-history.jsonl` are durable. Because JSONL history is append-only and cannot be safely un-appended without rewriting evidence, any failure after `run.started` creates a partial start state:

```text
current-run active + run.started exists + task still not_started or missing task.started
```

That state is recoverable only by human-approved recovery, not normal retry, because duplicate-start idempotency correctly prevents another `run.started` append.

### 5.3 Corrected ordering recommendation

If RALPH-030 includes task-state and task-history start semantics, use a safer two-phase durable-write order that writes mutable JSON files before irreversible JSONL appends:

1. Parse CLI options.
2. Read `runs/current-run.json`.
3. Read `tasks/task-state.json`.
4. Read `runs/run-history.jsonl` and `tasks/task-history.jsonl` for idempotency checks.
5. Run all preflight gates.
6. Generate and validate envelope in memory.
7. Prepare next current-run object in memory.
8. Prepare next task-state object in memory with `status: "in_progress"` and `attempt_count + 1`.
9. Prepare `run.started` event in memory.
10. Prepare `task.started` event in memory.
11. Write `runs/current-run.json` to temp file and validate readback.
12. Write `tasks/task-state.json` to temp file and validate readback.
13. Rename current-run temp into place.
14. Rename task-state temp into place.
15. Re-read and validate both mutable state files together.
16. Append `run.started`.
17. Append `task.started`.
18. Re-read histories and validate exactly one `run.started` and exactly one `task.started` for the `run_id`/`task_id` pair.
19. Run post-write consistency checks.
20. Return success only after all checks pass.

### 5.4 Remaining unavoidable risk

Even the corrected ordering can partially fail between appending `run.started` and `task.started`. This must be mitigated by:

- validating both JSONL lines before append;
- appending to histories as late as possible;
- treating missing `task.started` after `run.started` as a high-severity recovery condition;
- not executing a worker inside the start command;
- requiring human recovery if either history append fails after durable current-state mutation.

### 5.5 Alternative safer minimal option

The safest RALPH-030 implementation is narrower:

- update only `runs/current-run.json`;
- append only `run.started`;
- explicitly defer task-state update, task-history append, and `attempt_count` increment.

However, this creates a known transitional state (`active` + `not_started`) and should be accepted only if documented as a temporary lifecycle gap and blocked from downstream worker execution until task-state start semantics are implemented.

---

## 6. Partial Failure and Recovery States

| Case                                                | Severity    | Recovery recommendation                                                                                                                                                                                          | Auto repair allowed? | Human review required? |
| --------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------: | ---------------------: |
| `run.started` exists but task remains `not_started` | High        | Do not retry normal start. Confirm current run status, verify no worker executed, then use future recovery CLI to either complete task start (`in_progress` + `task.started`) or cancel/block run with evidence. |                   No |                    Yes |
| `current-run` active but no `run.started` event     | High        | Treat as partial start missing evidence. Do not append ad hoc repair in start command. Human decides whether to restore to `planned`, append recovery event, or block/cancel.                                    |                   No |                    Yes |
| Task `in_progress` but current-run `planned`        | Medium/High | Determine whether task was started outside run lifecycle. If no `run.started`, either restore task to `not_started` or start run via recovery path.                                                              |                   No |                    Yes |
| Task `done` but run `active`                        | Critical    | Completion/current-run mismatch. Verify validation and review evidence. If evidence exists, recover run to `completed`; otherwise block and investigate false done claim.                                        |                   No |                    Yes |
| Run `completed` but task not `done`                 | Critical    | Completion/task mismatch. Verify validation and review evidence. If task update failed after legitimate completion, recover task to `done`; otherwise downgrade/block run via recovery.                          |                   No |                    Yes |
| Duplicate `run.started` events                      | Critical    | Corrupt idempotency state. Block normal automation. Future recovery may mark duplicate as historical anomaly but must not rewrite JSONL.                                                                         |                   No |                    Yes |
| Missing `task.started` event                        | High        | If task is `in_progress` and run has `run.started`, append-only repair may be possible only through explicit recovery CLI with human confirmation and `task.recovered`/`task.started_recovered` evidence.        |    Recovery CLI only |                    Yes |
| `attempt_count` incremented but no started event    | High        | Attempt count is not valid without start evidence. Human must decide whether to decrement via state repair or append recovery evidence; do not do automatically in normal command.                               |                   No |                    Yes |

---

## 7. Validator / Reconciler Implications

### 7.1 `validate-ralph-state.mjs`

The existing validator should eventually check structural consistency that does not require roadmap planning decisions:

- JSON/JSONL syntax and schema compatibility.
- Known run statuses and task statuses.
- `current-run.task_id` or legacy `selected_task_id` can be resolved when relevant.
- Active-like run statuses are recognized consistently.
- No duplicate canonical `run.started` event for the same `run_id`.
- Terminal run states have appropriate timestamp fields.
- Validation/review evidence records include `task_id` and `run_id` when present.

It should initially report lifecycle mismatches as warnings or classified findings unless the repository has accepted a strict lifecycle checker.

### 7.2 `reconcile-roadmap-task-state.mjs`

The reconciler should remain focused on planning/runtime task alignment:

- `ROADMAP.md` task existence and status versus `tasks/task-state.json`.
- Missing runtime task definitions for eligible roadmap tasks.
- Runtime tasks not represented in roadmap, classified as `runtime_only` or drift.
- Task status drift between roadmap and runtime task state.

It should not own run lifecycle consistency, run-history idempotency, validation linkage, or review linkage.

### 7.3 Future lifecycle consistency checker

A future dedicated checker should own cross-file lifecycle invariants:

- run/task status matrix classification;
- run-start idempotency (`run.started` count);
- task-start evidence linkage;
- validation evidence required before `needs_review`;
- review acceptance required before `completed`/`done` when `requires_human_review` is true;
- terminal state consistency between run and task;
- partial transaction detection;
- recovery-only state classification;
- severity and recovery recommendation output.

Recommended future script name:

```bash
node scripts/agent/check-runtime-lifecycle-consistency.mjs --json
```

---

## 8. RALPH-030 Implementation Implications

### 8.1 Should RALPH-030 update `task-state.json` during run start?

**Recommendation:** Yes, if RALPH-030 is the implementation of run start and not merely envelope preview.

Rationale: `active` means execution authority has started. The corresponding task should be `in_progress`. Leaving the task `not_started` after a run becomes `active` creates a known inconsistency that downstream worker/validator logic must special-case.

### 8.2 Should RALPH-030 append `task-history` during run start?

**Recommendation:** Yes, if task-state is updated.

Rationale: task lifecycle changes must be traceable. A `not_started -> in_progress` task update without `task.started` evidence is incomplete.

### 8.3 Should RALPH-030 increment `attempt_count` during run start?

**Recommendation:** Yes, but only after the complete run-start transaction succeeds.

Refinement: `attempt_count` represents authorized execution start, not dry-run preview, not planned run creation, and not partial transaction progress.

### 8.4 Should these be deferred?

Deferral is acceptable only if RALPH-030 is explicitly scoped as **run-only start** and documents that:

- `active` + `not_started` is transitional by design;
- no worker invocation may happen downstream until task-start semantics exist;
- `attempt_count` remains unchanged;
- `task.started` is not appended;
- future RALPH task must close the lifecycle gap before real worker execution.

The stronger recommendation is not to defer: implement run start and task start together with strict transaction tests.

---

## 9. RALPH-030 Safety Recommendation

### 9.1 Is RALPH-030 safe to implement next?

**Yes, with constraints.**

RALPH-030 is safe to implement next only if it remains a controlled lifecycle-start implementation and does not execute a worker. It must be dry-run by default, require explicit write confirmation, and include transaction/idempotency tests before acceptance.

### 9.2 Exact constraints to add to RALPH-030

RALPH-030 must:

1. Be dry-run by default.
2. Require `--write --confirm-write` for mutation.
3. Never execute Cline, OpenCode, Codex, Roo, a model, an IDE automation process, network process, validation writer, review writer, or handoff generator.
4. Generate the full envelope to stdout only; persist only envelope metadata.
5. Require current run status exactly `planned` and `started_at` null/absent.
6. Require matching task status exactly `not_started` unless an explicit future recovery mode exists.
7. Require `attempt_count < max_attempts` when attempt fields are present.
8. Read run history before write and abort if any `run.started` exists for the `run_id`.
9. Update task-state and append task-history in the same logical start transaction, or explicitly defer all task lifecycle mutation and block downstream worker execution.
10. Increment `attempt_count` exactly once and only after complete transaction success.
11. Validate no duplicate `run.started` and no duplicate `task.started` for the same start boundary.
12. Use temp-file writes and readback validation for mutable JSON files.
13. Append JSONL events as late as possible and validate exact lines before append.
14. Treat any partial transaction as non-success and require human recovery.
15. Modify only the approved implementation files and, in write-mode tests/fixtures, only explicitly expected runtime state files.
16. Keep package files and product code out of scope.

### 9.3 Mandatory tests before acceptance

Minimum test set:

| Area          | Mandatory test                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| CLI           | `--help` prints contract.                                                                                                |
| Dry-run       | Default dry-run writes nothing and prints envelope.                                                                      |
| JSON          | `--json` output parses and includes envelope, would-change files, and no worker execution.                               |
| Write guard   | `--write` without `--confirm-write` fails.                                                                               |
| Write guard   | `--confirm-write` without `--write` fails.                                                                               |
| Eligibility   | Missing current run fails without writes.                                                                                |
| Eligibility   | Non-`planned` run fails without writes.                                                                                  |
| Eligibility   | Missing task fails without writes.                                                                                       |
| Eligibility   | Task not `not_started` fails without writes.                                                                             |
| Attempt       | Attempt capacity exhausted fails without writes.                                                                         |
| Idempotency   | Existing one `run.started` aborts without writes.                                                                        |
| Idempotency   | More than one `run.started` aborts as corrupt.                                                                           |
| Happy path    | Planned run + eligible task transitions to `active` + `in_progress`.                                                     |
| Attempt       | Successful start increments `attempt_count` exactly once.                                                                |
| Evidence      | Successful start appends exactly one `run.started`.                                                                      |
| Evidence      | Successful start appends exactly one `task.started` if task-state is updated.                                            |
| Retry         | Retry after successful write does not append events or increment attempt count.                                          |
| Failure       | Simulated current-run write failure restores/no append/no task mutation.                                                 |
| Failure       | Simulated task-state write failure restores/no history append where possible and reports partial failure if unavoidable. |
| Failure       | Simulated run-history append failure reports non-success and requires recovery.                                          |
| Failure       | Simulated task-history append failure reports non-success and requires recovery.                                         |
| Safety        | Dirty working tree blocks write mode.                                                                                    |
| Safety        | Reconciler failure blocks write mode.                                                                                    |
| Safety        | Validator failure blocks write mode.                                                                                     |
| Worker safety | No worker process is spawned in any mode.                                                                                |
| Scope         | Write mode changes only expected files.                                                                                  |

---

## 10. Final Recommendation

RALPH-030 may proceed next, but only as a guarded lifecycle-start implementation. The safest accepted scope is:

```text
planned run + not_started task
  -> active run + in_progress task
  -> run.started evidence + task.started evidence
  -> attempt_count increment exactly once
  -> no worker execution
  -> stop for human review after implementation verification
```

The key correction from RALPH-029 is transaction ordering: prepare all objects in memory, write and validate mutable JSON state before append-only JSONL history where practical, append histories late, and treat any inconsistency as a recovery-only state.

RALPH-030 should not be accepted without tests for idempotency, partial failures, attempt-count invariants, no-worker-execution guarantees, and exact changed-file scope.

---

## 11. Verification Plan for RALPH-029A

This task is documentation-only under `VERIFY.md` Category 1. Required readback checks:

```bash
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

No `npm run verify` is required because this task changes only a report file and does not modify runtime code, product code, tests, package files, runtime state, validation evidence, review evidence, or handoff files.

No commit. No push. Stop for human review.
