# RALPH-028: Worker Execution Envelope Plan

**Task ID:** RALPH-028  
**Category:** Documentation / Design only  
**Generated:** 2026-05-31  
**Status:** Design complete; stop for human review  
**Deliverable:** `reports/RALPH-028_WORKER_EXECUTION_ENVELOPE_PLAN.md`

---

## 1. Executive Summary

RALPH-028 designs the missing layer between a `planned` runtime run and actual worker execution. It defines a **worker execution envelope**: a deterministic, adapter-neutral object that a coordinator can hand to a worker adapter such as Cline, OpenCode, Codex, or a future adapter.

Current target architecture:

```text
ROADMAP
↓
Runtime Task
↓
Runtime Run with status planned
↓
Worker Execution Envelope
↓
Worker Execution
↓
Validation
↓
Review Gate
```

RALPH-028 is design only. It must not execute a worker, mutate runtime state, append evidence, generate real prompt files, or write runtime outputs. Report examples below are illustrative only.

### Core Recommendation

RALPH-029 should implement the smallest safe **Run Start / Envelope Generation** CLI that:

- reads `runs/current-run.json`, `tasks/task-state.json`, governance policy, and adapter policy;
- validates pre-start gates;
- produces a worker-ready envelope in dry-run mode by default;
- optionally transitions `runs/current-run.json` from `planned` to `active` and appends one `run.started` event only in explicit write mode;
- does not execute any worker;
- does not write validation, review, handoff, or task-completion evidence.

---

## 2. Scope and Non-Scope

### 2.1 In Scope

- Worker execution envelope schema.
- `planned -> active` run-start transition model.
- Task-state interaction recommendations at worker start.
- Adapter-neutral worker model.
- Cline-specific command-safety constraints as an adapter overlay.
- Pre-worker-start safety gates.
- Worker output and handoff requirements.
- Failure and recovery rules.
- Minimal RALPH-029 implementation recommendation.
- Test matrix and deferred scope.

### 2.2 Out of Scope

- No worker execution.
- No runtime-state mutation by this design task.
- No run-history, task-history, validation, or review evidence writes by this design task.
- No real prompt file generation.
- No changes to `scripts/`, `tasks/`, `runs/`, `validation/`, `review/`, `ROADMAP.md`, package files, product code, or `handoffs/latest-handoff.md`.
- No commit or push.

---

## 3. Authority and Architecture Overview

The envelope layer must respect the active repository authority hierarchy:

1. `SSOK.md` and `AGENTS.md` define repository governance and authority order.
2. `ROADMAP.md`, `VERIFY.md`, and `.governance/*` define planning, verification, lifecycle, execution, safety, and review policy.
3. `tasks/task-state.json` and `runs/current-run.json` define runtime execution state.
4. `.agent/adapters/*` defines adapter execution rules.
5. Operational guides and checklists provide non-authoritative onboarding guidance.

The envelope is a **derived execution contract**, not a new source of truth. It should snapshot current runtime state and policy references so a worker can operate without relying on chat history.

Recommended ownership:

| Concept | Canonical Owner | Envelope Role |
|---|---|---|
| Task priority and planning | `ROADMAP.md` | Reference only |
| Runtime task status/scope | `tasks/task-state.json` | Snapshot into envelope |
| Runtime run status | `runs/current-run.json` | Source run object |
| Safety policy | `.governance/SAFETY.md` | Required constraints |
| Lifecycle ordering | `.governance/SYSTEM.md` | Required stop model |
| Execution discipline | `.governance/RULES.md` | Required worker rules |
| Review acceptance | `.governance/REVIEW_POLICY.md` | Required review gate |
| Verification | `VERIFY.md` | Required checks and disclosure |
| Adapter behavior | `.agent/adapters/<adapter>.md` | Adapter overlay only |

---

## 4. Worker Execution Envelope

### 4.1 Purpose

The worker execution envelope is the object passed to a worker or used to generate a worker prompt. It answers:

1. Which run is starting?
2. Which task is assigned?
3. What files may be touched?
4. What files and actions are forbidden?
5. Which checks and stop conditions apply?
6. Which adapter-specific rules must be obeyed?
7. What output must the worker return?

### 4.2 Recommended Envelope Schema

Illustrative schema only; RALPH-028 must not generate a real envelope file.

```json
{
  "schema_version": "1.0.0",
  "envelope_id": "env_20260531T114500Z_run_20260531T114400Z_ralph-029_a1b2c3",
  "created_at": "2026-05-31T11:45:00.000Z",
  "source": {
    "type": "script",
    "id": "start-runtime-run.mjs",
    "mode": "dry_run"
  },
  "run": {
    "run_id": "run_20260531T114400Z_ralph-029_a1b2c3",
    "status": "planned",
    "required_transition": "planned -> active",
    "created_at": "2026-05-31T11:44:00.000Z",
    "started_at": null
  },
  "task": {
    "task_id": "RALPH-029",
    "title": "Minimal Run Start / Worker Execution Envelope Implementation",
    "status": "not_started",
    "attempt_count": 0,
    "max_attempts": 3,
    "requires_human_review": true
  },
  "scope": {
    "allowed_files": [
      "scripts/agent/start-runtime-run.mjs",
      "scripts/agent/__tests__/start-runtime-run.test.mjs",
      "reports/RALPH-029_RUN_START_IMPLEMENTATION_REPORT.md"
    ],
    "forbidden_files": [
      ".env*",
      "package.json",
      "package-lock.json",
      "src/**/*",
      "supabase/**/*"
    ],
    "expected_outputs": [
      "reports/RALPH-029_RUN_START_IMPLEMENTATION_REPORT.md"
    ]
  },
  "validation": {
    "validation_required": true,
    "validation_type": "governance_script",
    "required_checks": [
      "node --check scripts/agent/start-runtime-run.mjs",
      "npm run test -- --runTestsByPath scripts/agent/__tests__/start-runtime-run.test.mjs",
      "node scripts/agent/reconcile-roadmap-task-state.mjs --json",
      "node scripts/agent/validate-ralph-state.mjs --json",
      "git --no-pager status --short",
      "git --no-pager diff --stat",
      "git --no-pager diff --name-only"
    ],
    "verification_authority": "VERIFY.md"
  },
  "review": {
    "review_required": true,
    "review_policy": ".governance/REVIEW_POLICY.md",
    "stop_after_worker": true,
    "human_review_status": "required"
  },
  "governance_constraints": {
    "authority_hierarchy": [
      "SSOK.md",
      "AGENTS.md",
      "ROADMAP.md",
      "VERIFY.md",
      ".governance/*",
      "tasks/task-state.json",
      "runs/current-run.json",
      ".agent/adapters/*"
    ],
    "one_task_per_run": true,
    "repository_state_is_durable_memory": true,
    "chat_history_is_not_authority": true,
    "no_autonomous_continuation": true
  },
  "stop_conditions": [
    "task requirements are ambiguous or conflicting",
    "validation failure cannot be resolved within scope",
    "protected-file or forbidden-file modification is required or attempted",
    "implementation exceeds allowed scope",
    "interactive or hanging terminal process is detected",
    "human review is required"
  ],
  "command_safety": {
    "adapter": "cline",
    "policy_file": ".agent/adapters/cline.md",
    "one_command_per_execution": true,
    "forbidden_shell_patterns": ["&&", "||", ";", "|", "<<EOF", "python - <<'PY'"],
    "interactive_sessions_forbidden": true,
    "long_running_processes_require_approval": true,
    "git_pager_policy": "use git --no-pager for read-only git inspection"
  },
  "expected_worker_output": {
    "format": "structured_handoff_markdown_and_optional_json_summary",
    "required_fields": [
      "run_id",
      "task_id",
      "worker_adapter",
      "changed_files",
      "verification_commands_run",
      "validation_results",
      "skipped_commands",
      "blockers",
      "human_review_status"
    ]
  }
}
```

### 4.3 Required Envelope Fields

| Field | Required | Source | Notes |
|---|---:|---|---|
| `run_id` | Yes | `runs/current-run.json` | Canonical run identity. |
| `task_id` | Yes | `runs/current-run.json` and task state | Must match runtime task. |
| `task.title` | Yes | Task state / run snapshot | Human readability. |
| `task.status` | Yes | `tasks/task-state.json` | Used for eligibility. |
| `allowed_files` | Yes | Runtime task/run snapshot | Worker write boundary. |
| `forbidden_files` | Yes | Runtime task/run + safety policy | Hard deny list. |
| `validation_requirements` | Yes | Runtime task + `VERIFY.md` | Completion gate. |
| `review_requirements` | Yes | Runtime task + review policy | Stop gate. |
| `governance_constraints` | Yes | Governance files | Authority and lifecycle. |
| `stop_conditions` | Yes | `.governance/*` + adapter policy | Immediate stops. |
| `command_safety_constraints` | Yes | Adapter policy | Cline-specific today; adapter-specific later. |
| `expected_output_format` | Yes | `.governance/RULES.md`, `VERIFY.md` | Handoff and validation disclosure. |

---

## 5. Run Start Transition Model

### 5.1 Canonical Transition

The worker-start boundary is:

```text
runs/current-run.json status: planned -> active
```

This transition means a worker has been assigned and execution authority has started. It does **not** mean the worker completed, validated, or passed review.

### 5.2 Current-Run Updates at Start

When RALPH-029 or a later start CLI performs a real write, `runs/current-run.json` should update:

```json
{
  "status": "active",
  "started_at": "2026-05-31T11:45:00.000Z",
  "updated_at": "2026-05-31T11:45:00.000Z",
  "worker": {
    "type": "adapter",
    "id": "cline",
    "adapter": "cline",
    "started_by": "start-runtime-run.mjs"
  },
  "execution_envelope": {
    "schema_version": "1.0.0",
    "envelope_id": "env_20260531T114500Z_run_...",
    "generated_at": "2026-05-31T11:45:00.000Z",
    "delivery_mode": "printed_prompt_or_stdout_only"
  }
}
```

Recommendation: store only envelope metadata in `current-run.json`, not the full prompt text. The full envelope may be printed in dry-run or write mode, but writing prompt files should be deferred unless explicitly approved.

### 5.3 Task-State Status at Run Start

Recommended behavior for RALPH-029 write mode:

- Update the matching runtime task from `not_started` to `in_progress` at the same logical run-start boundary.
- Do not update task status during envelope dry-run.
- Do not update task status during planned run creation (`RALPH-027` already correctly defers this).

Rationale:

- `planned` means a run exists but no worker has begun.
- `active` means execution has started; task state should reflect that work is in progress.
- Updating task status at run creation would overstate execution progress.

If RALPH-029 is kept even smaller, task-state mutation can be deferred, but the report recommends implementing run-start and task-start atomically once write mode exists.

### 5.4 Attempt Count at Run Start

Recommended behavior:

- Increment `attempt_count` exactly once when a planned run transitions to `active`.
- Do not increment on dry-run.
- Do not increment at planned run creation.
- Do not increment again if a duplicate start command is retried against an already `active` run; abort instead.

Rationale: attempts represent actual worker execution attempts, not planning or envelope preview attempts.

### 5.5 Run History at Start

Write mode should append exactly one canonical event:

```json
{
  "schema_version": "2.0.0",
  "event_id": "evt_20260531T114500Z_run_started_a1b2c3",
  "event_type": "run.started",
  "timestamp": "2026-05-31T11:45:00.000Z",
  "run_id": "run_20260531T114400Z_ralph-029_a1b2c3",
  "task_id": "RALPH-029",
  "previous_status": "planned",
  "status": "active",
  "worker": {
    "adapter": "cline",
    "id": "cline"
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

### 5.6 Task History at Start

If task state is updated to `in_progress`, append one task-history event in the same write transaction model:

- `event_type`: `task.started`
- previous status: `not_started`
- new status: `in_progress`
- link to `run_id`
- include `attempt_count` after increment.

This can be deferred from the first implementation if atomic multi-file state changes are considered too broad. If deferred, RALPH-029 must document that only run state changes and task status remains unchanged until a later lifecycle task.

---

## 6. Worker Adapter Model

### 6.1 Adapter-Neutral Core

All workers share the same core contract:

- Execute exactly one assigned task per run.
- Treat repository files, not chat history, as authority.
- Respect `allowed_files` and `forbidden_files`.
- Read required governance before work.
- Run required verification.
- Produce required handoff/output.
- Stop for human review.
- Never continue to another task automatically.
- Never push, deploy, install dependencies, or modify protected files without explicit task authorization.

### 6.2 Adapter-Specific Overlay

Adapter-specific rules live under:

```text
.agent/adapters/<adapter>.md
```

Current and future examples:

| Adapter | Adapter File | Specific Concerns |
|---|---|---|
| Cline | `.agent/adapters/cline.md` | VS Code, tool execution, PowerShell command safety, no chained commands. |
| OpenCode | `.agent/adapters/opencode.md` | CLI/headless semantics, deterministic file edits, terminal behavior. |
| Codex | `.agent/adapters/codex.md` | Repository-aware assistant behavior, command and edit boundaries. |
| Future adapters | `.agent/adapters/<name>.md` | Must implement the same core envelope. |

Adapter docs never override `SSOK.md`, `AGENTS.md`, `VERIFY.md`, or `.governance/*`.

### 6.3 Cline-Specific Rules in Envelope

For Cline, the envelope should include or reference:

- Windows PowerShell-safe commands.
- Exactly one terminal command per execution.
- No command chains such as `&&`, `||`, pipes, semicolon chains, or multiline command blocks.
- No Bash heredocs in PowerShell.
- No interactive Python, Node, PowerShell prompts, or stdin-waiting commands.
- Use `git --no-pager` for Git inspection commands.
- Stop and report terminal hangs or interactive states.
- Blocking commands such as development servers require explicit approval.

---

## 7. Safety Gates Before Worker Start

All gates must pass before a planned run can become worker-ready or active.

| Gate | Pass Criteria | Failure Action |
|---|---|---|
| Current run exists | `runs/current-run.json` parses and contains `run_id`, `task_id`, `status`. | Abort. |
| Run status planned | Current run status is exactly `planned`. | Abort; do not start non-planned run. |
| Task exists | Matching `task_id` exists in `tasks/task-state.json`. | Abort. |
| Task eligible | Task status is `not_started`, or explicit recovery mode permits another state. | Abort. |
| Attempt capacity | `attempt_count < max_attempts` when both exist. | Abort or require human recovery. |
| Run/task match | Run `task_id` matches task `id`; title mismatch is warning or abort depending strictness. | Abort on ID mismatch. |
| Allowed files present | Allowed files array exists; empty allowed list requires explicit documentation-only/no-write semantics. | Abort or require human review. |
| Forbidden files present | Forbidden files array exists and includes protected constraints from task/policy. | Abort. |
| Protected-file check | No planned allowed file conflicts with protected files unless explicitly authorized. | Abort. |
| Working tree policy | Clean working tree before write-mode start. | Abort. |
| Reconciler green | `node scripts/agent/reconcile-roadmap-task-state.mjs --json` exits 0. | Abort. |
| Validator green | `node scripts/agent/validate-ralph-state.mjs --json` exits 0. | Abort. |
| Adapter supported | Requested adapter has known adapter contract file. | Abort. |
| Command safety acknowledged | Envelope includes adapter command policy refs and constraints. | Abort. |
| No worker execution | Start/envelope command does not invoke an agent, model, IDE, network process, or prompt runner. | Abort. |

### Working Tree Policy

Recommended RALPH-029 write mode should require a clean working tree before mutation. After write mode, only explicitly permitted state files should change. If minimal RALPH-029 writes only run start state, expected changed files are:

```text
runs/current-run.json
runs/run-history.jsonl
```

If task-state start semantics are included, expected changed files additionally include:

```text
tasks/task-state.json
tasks/task-history.jsonl
```

The implementation should choose one model explicitly and test it.

---

## 8. Worker Output and Handoff Requirements

After actual worker execution, the worker must return enough information for validation and review. The output should be structured and durable in `handoffs/latest-handoff.md` per `.governance/RULES.md`, with verification disclosure per `VERIFY.md`.

### Required Worker Return Fields

| Field | Required | Description |
|---|---:|---|
| `run_id` | Yes | Current run identity. |
| `task_id` | Yes | Assigned task. |
| `worker_adapter` | Yes | Adapter used, e.g. `cline`. |
| `started_at` / `completed_at` | Yes | Execution timestamps or null on failure. |
| `changed_files` | Yes | Added, modified, deleted files. |
| `verification_commands_run` | Yes | Commands executed exactly as run. |
| `validation_results` | Yes | Pass/fail/skipped per check. |
| `skipped_commands` | Yes | Any expected checks not run, with rationale. |
| `blockers` | Yes | Ambiguities, validation failures, safety issues, missing tools. |
| `safety_findings` | Yes | Scope/protected-file/forbidden-action result. |
| `human_review_status` | Yes | `required`, `blocked`, `ready_for_review`, or `not_applicable`. |
| `completion_claim` | Yes | Must not claim done unless required verification passed. |

### Expected Handoff Structure

Minimum handoff sections:

1. Run/task identity and status.
2. What changed.
3. Why changed.
4. Changed files list.
5. Validation executed.
6. Validation result.
7. Known issues/blockers/risks.
8. Human-review status.

---

## 9. Failure and Recovery Rules

### 9.1 Worker Cannot Start

Examples:

- Current run missing.
- Current run not `planned`.
- Task missing or ineligible.
- Reconciler/validator fails.
- Adapter contract missing.

Required behavior:

- Abort before state mutation.
- Print structured failure output.
- Do not append run-history evidence unless a future recovery/audit task explicitly defines `run.start_failed` events.
- Require human review for ambiguous or repeated failures.

### 9.2 Worker Violates Command Rules

Examples:

- Cline attempts chained commands.
- Bash heredoc used in PowerShell.
- Interactive Python or Node REPL starts.
- Long-running process starts without approval.

Required behavior:

- Stop immediately.
- Document the exact command and violation.
- Do not retry with increasingly complex shell syntax.
- Require human intervention if terminal is interactive or hanging.
- Mark run as `blocked` or `failed` only through a dedicated recovery/status CLI, not ad hoc edits.

### 9.3 Worker Changes Forbidden Files

Required behavior:

- Stop immediately.
- Preserve evidence of changed files and diff.
- Do not continue implementation.
- Human reviews whether to revert.
- If safe, revert forbidden changes.
- Record blocker/safety violation in handoff.
- Future coordinator may transition run to `blocked` or `failed` with a `run.blocked` or `run.failed` event.

### 9.4 Worker Returns Incomplete Output

Incomplete output includes missing changed-file list, missing validation disclosure, missing blockers section, or no human-review status.

Required behavior:

- Do not mark task done.
- Treat run as `needs_review` only if sufficient evidence exists for review; otherwise `blocked` is safer.
- Human reviewer decides whether to request revision, recover manually, or cancel.

### 9.5 Terminal Hangs / Interactive Process Detected

Required behavior:

- Stop execution attempts.
- Report visible terminal state.
- Do not press forward with unattended continuation.
- For Git pager symptoms, prefer `git --no-pager`; if a pager is already open and input is accepted, press `q` once per Cline policy.
- Require human intervention for REPL prompts or stdin-waiting commands.

### 9.6 Run Remains Active Too Long

Recommended stale active threshold: 24 hours by default, configurable later.

Required behavior for future recovery:

- Detect stale active runs.
- Do not start another run for the same task automatically.
- Require a recovery command such as `recover-runtime-run.mjs`.
- Mark stale run as `blocked` or `cancelled` with `stop_reason: "stale_active_run"` only after human-approved recovery.
- Append canonical recovery evidence only through the recovery command.

---

## 10. RALPH-029 Minimal Implementation Recommendation

### 10.1 Likely Script Name

Recommended:

```bash
node scripts/agent/start-runtime-run.mjs
```

Alternative names considered:

- `generate-worker-envelope.mjs` — too narrow if it also transitions run state.
- `prepare-worker-execution.mjs` — clear but less lifecycle-specific.
- `start-runtime-run.mjs` — preferred because the canonical transition is `planned -> active`.

### 10.2 CLI Contract

Recommended minimal CLI:

```bash
# Dry-run default: validate and print envelope preview only
node scripts/agent/start-runtime-run.mjs

# Dry-run JSON output
node scripts/agent/start-runtime-run.mjs --json

# Dry-run for explicit adapter
node scripts/agent/start-runtime-run.mjs --adapter cline --json

# Write mode: transition planned -> active and append run.started
node scripts/agent/start-runtime-run.mjs --adapter cline --write --confirm-write

# Help
node scripts/agent/start-runtime-run.mjs --help
```

Flags:

| Flag | Default | Purpose |
|---|---:|---|
| `--adapter <name>` | `cline` or none | Select worker adapter overlay. |
| `--json` | false | Machine-readable output. |
| `--write` | false | Enable real state transition. |
| `--confirm-write` | false | Required with `--write`. |
| `--print-envelope` | true | Print envelope to stdout; no file write. |
| `--help` | false | Show usage. |

### 10.3 Dry-Run Default

Default behavior must be dry-run only:

- Validate current run and task.
- Validate pre-start gates except write-only final mutation checks.
- Print envelope preview.
- Print files that would change in write mode.
- Do not write `current-run.json`.
- Do not append `run-history.jsonl`.
- Do not execute any worker.
- Do not write prompt files.

### 10.4 Write Behavior

Recommended smallest safe write behavior:

- Require `--write --confirm-write`.
- Require clean working tree.
- Require reconciler and validator green.
- Require current run status `planned`.
- Update `runs/current-run.json` to `active` with `started_at`, `updated_at`, worker metadata, and envelope metadata.
- Append one `run.started` event to `runs/run-history.jsonl`.
- Do not execute a worker.
- Do not write validation/review evidence.
- Do not write prompt files.

Task-state update and task-history append are recommended lifecycle semantics, but may be deferred to keep RALPH-029 minimal. If deferred, RALPH-029 should explicitly document that `task.status` and `attempt_count` remain unchanged until a later task.

### 10.5 Prompt Handling

Recommended for RALPH-029:

- Print the worker prompt/envelope to stdout only.
- Do not write `.agent/out`, `.agent/prompts`, or any generated prompt file.
- Include report examples only in documentation.

Future prompt-file generation should be separate and opt-in, with explicit output path and dry-run default.

### 10.6 Tests

Recommended test file:

```text
scripts/agent/__tests__/start-runtime-run.test.mjs
```

Recommended tests:

- Help prints CLI contract.
- Dry-run writes nothing.
- Dry-run rejects missing current run.
- Dry-run rejects non-`planned` run.
- Dry-run rejects missing task.
- Dry-run rejects ineligible task status.
- Dry-run rejects attempt limit exceeded.
- Dry-run includes required envelope fields.
- Dry-run includes adapter command-safety constraints for Cline.
- `--write` without `--confirm-write` rejected.
- `--confirm-write` without `--write` rejected.
- Write mode updates run status to `active`.
- Write mode sets `started_at` and `updated_at`.
- Write mode appends one `run.started` event.
- Write mode modifies only expected files.
- Active or already-started run cannot be started again.
- Reconciler failure blocks write.
- Validator failure blocks write.
- Working tree dirty blocks write.
- No worker process is spawned.

### 10.7 Verification Commands for RALPH-029

Because RALPH-029 would change governance/runtime scripts, recommended verification:

```bash
node --check scripts/agent/start-runtime-run.mjs
node scripts/agent/start-runtime-run.mjs --help
node scripts/agent/start-runtime-run.mjs --json
npm run test -- --runTestsByPath scripts/agent/__tests__/start-runtime-run.test.mjs
node scripts/agent/reconcile-roadmap-task-state.mjs --json
node scripts/agent/validate-ralph-state.mjs --json
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

Commands should be run separately when executed by Cline.

---

## 11. Test Matrix

| Area | Test | Expected Result |
|---|---|---|
| Envelope | Generated preview includes run identity | `run_id` present and matches current run. |
| Envelope | Generated preview includes task identity | `task_id`, title, status present. |
| Envelope | Scope included | Allowed, forbidden, expected outputs present. |
| Envelope | Governance included | Authority and stop conditions present. |
| Envelope | Adapter constraints included | Cline command safety rules present when adapter is Cline. |
| Start gate | Missing current run | Abort, no writes. |
| Start gate | Current run not planned | Abort, no writes. |
| Start gate | Task missing | Abort, no writes. |
| Start gate | Task status not eligible | Abort, no writes. |
| Start gate | Attempt count exceeded | Abort, no writes. |
| Safety | Protected-file conflict | Abort, no writes. |
| Safety | Dirty working tree in write mode | Abort, no writes. |
| Safety | Reconciler fails | Abort, no writes. |
| Safety | Validator fails | Abort, no writes. |
| Write mode | `--write` without confirmation | Reject. |
| Write mode | Confirm without write | Reject. |
| Write mode | Planned run starts | `current-run.json` status becomes `active`. |
| Write mode | History append | Exactly one `run.started` JSONL line appended. |
| Write mode | No worker execution | No worker process spawned. |
| Recovery | Already active run | Abort as duplicate start. |
| Recovery | Partial write failure | Restore current-run where possible; do not claim success. |
| Output | JSON mode parseable | `JSON.parse` succeeds. |
| Output | Human output clear | Includes gates, would-change files, and next steps. |

---

## 12. Deferred Scope

Do not include in RALPH-029 unless separately approved:

- Actual worker execution.
- Invoking Cline, OpenCode, Codex, Roo, or any AI/model process.
- Network calls or external services.
- Prompt file generation.
- Validation evidence writes.
- Review evidence writes.
- Handoff generation.
- Run completion transitions.
- Automatic recovery of stale or blocked runs.
- Batch run starts.
- Parallel workers.
- Unattended overnight execution.
- Package script registration.
- Product code changes.
- Dependency changes.

---

## 13. RALPH-028 Verification Plan

This task is documentation-only. Required checks:

```bash
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

No worker execution. No runtime-state mutation. No evidence writes. No commit. No push. Stop for human review.

---

## 14. Conclusion

RALPH-028 defines the worker execution envelope as a narrow, deterministic bridge from a planned runtime run to a worker-ready assignment. The envelope makes scope, safety, validation, review, adapter rules, and expected output explicit before any worker can act.

The recommended RALPH-029 implementation should be conservative: dry-run by default, no worker execution, no prompt files, explicit write confirmation, guarded `planned -> active` transition, one `run.started` event, and a strict stop before downstream validation and review workflows.