# RALPH Overnight Worker v1 Foundation

## Purpose

This directory defines the first safe foundation for the RALPH Autonomous Overnight Worker v1.

**Current phase:** RALPH-034M — Post-Change Review Gate Simulator

The **overnight validation executor** (`scripts/agent/overnight-validation-executor.mjs`) is the canonical end-to-end dry-run orchestrator. It combines all RALPH-034A through RALPH-034F components into one safe operator-facing command.

RALPH-034H adds a separate **queue acceptance simulator** (`scripts/agent/overnight-queue-simulator.mjs`). It is planning-only and classifies each human-authored queued task according to what a hypothetical future overnight worker would do at intake. It executes no queued tasks, no queue objectives, no queue `allowed_commands`, no raw queue command strings, no validation commands, and no workers/models. It mutates no runtime/evidence state and writes no files.

RALPH-034I adds a separate **worker prompt / execution envelope planner** (`scripts/agent/overnight-worker-envelope-planner.mjs`). It consumes the RALPH-034H simulator result and produces deterministic, reviewable worker envelope proposals only for tasks classified `would_accept`. It does not invoke workers, execute prompts, execute queued tasks, run validation commands, mutate runtime/evidence state, or write files. Every created envelope explicitly states that it is not execution authorization.

RALPH-034J adds a separate **worker invocation contract simulator** (`scripts/agent/overnight-worker-invocation-contract-simulator.mjs`). It consumes the RALPH-034I envelope planner result and produces deterministic, reviewable future-worker invocation contract payload previews only for entries with `envelope_created: true`. It does not invoke workers, execute prompts, execute queued tasks, run validation commands, mutate runtime/evidence state, write reports/run logs, or write files. Every created contract explicitly states that it is not invocation authorization.

RALPH-034K adds a separate **worker adapter simulator** (`scripts/agent/overnight-worker-adapter-simulator.mjs`). It consumes the RALPH-034J invocation contract simulator result and produces deterministic, reviewable adapter routing simulations only for entries with `contract_created: true`. Current contracts remain blocked by authorization, so no route is executable. It does not invoke workers, adapters, providers, models, prompts, queued tasks, validation commands, network endpoints, or runtime/evidence mutations, and it writes no files. Every adapter route simulation explicitly states that it is not adapter, worker, provider/model, prompt, task, validation, network, commit, or push authorization.

RALPH-034L adds a separate **change / diff monitoring simulator** (`scripts/agent/overnight-change-diff-simulator.mjs`). It consumes only an explicitly supplied hypothetical change-set JSON file and classifies the described changes against allowed files, forbidden files, protected files, file-count thresholds, diff-line thresholds, review triggers, and validation-category implications. It does not read git diff, read git status, ingest worker output as authority, invoke workers/adapters/providers/models/prompts, execute queued tasks, execute validation commands, apply changes, mutate runtime/evidence state, write reports/run logs, commit, or push. Every change/diff simulation explicitly states that it is planning-only, non-authoritative, non-mutating, and non-authorizing.

RALPH-034M adds a separate **post-change review gate simulator** (`scripts/agent/overnight-post-change-review-gate-simulator.mjs`). It consumes only an explicitly supplied RALPH-034L change/diff simulation JSON file and classifies the hypothetical post-change result as `would_reject_before_review`, `would_require_human_review`, `would_be_reviewable`, or `invalid_input`. It does not accept review, write review evidence, write validation evidence, run validation commands, invoke workers/adapters/providers/models/prompts, execute queued tasks, apply changes, mutate runtime/evidence state, write reports/run logs, stage, commit, or push. Every post-change review-gate simulation explicitly states that it is planning-only, non-authoritative, non-mutating, non-evidence, and non-authorizing.

**For operator usage instructions, see:** [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)

RALPH-034B adds a separate **command capture smoke harness**. It can run only built-in allowlisted low-risk command IDs and capture their stdout, stderr, exit code, signal, duration, timeout state, and truncation flags as structured JSON. It is not queue execution and does not make queued tasks executable.

RALPH-034C adds **validation-only queue/harness integration planning**. It reads a human-authored queue, validates it using RALPH-034A logic, and maps queue `required_checks` to RALPH-034B command allowlist IDs. It executes no commands, no queued tasks, and invokes no workers. Mapped checks are deferred for future validation execution. Unknown checks fail closed and require human review.

RALPH-034D adds a bounded **validation-only command executor**. It reads a human-authored queue, validates it, builds the RALPH-034C validation plan, and only if all hard preconditions pass executes mapped validation/check command IDs through the RALPH-034B harness. It still does not execute queued task work, queue `allowed_commands`, raw queue command strings, workers, product work, commits, pushes, runtime mutations, or evidence/log/report writes by default.

RALPH-034E adds an explicit bounded **persistent operational report writer** for RALPH-034D validation-only executor results. It writes JSON and Markdown reports only when `--write-report` is passed, only under `.agent/overnight/reports/`, with no arbitrary output paths and no overwrite behavior by default. Reports are non-authoritative operational output, not runtime or evidence state.

RALPH-034F adds a minimal **persistent overnight run-log lifecycle tracker** for RALPH-034D validation-only executor results. It appends non-authoritative lifecycle events only when `--write-run-log` is passed, only to `.agent/overnight/run-log.jsonl`, with no arbitrary output paths and no overwrite or truncate behavior. The run log uses `ovr_` prefixed run IDs to distinguish overnight validation runs from canonical `run_` runtime authority. Lifecycle states include `planned`, `validation_started`, `validation_passed`, `validation_failed`, `report_written`, `completed`, and `aborted`. The run log is append-only JSONL and is non-authoritative operational output, not runtime or evidence state.

## Hard v1 Limits

- No queued task execution.
- No Cline, OpenCode, Codex, Roo, model, or worker invocation.
- No worker intake simulation result authorizes execution.
- No worker envelope or prompt proposal authorizes execution.
- No worker invocation contract preview authorizes execution, prompt execution, or worker invocation.
- No worker adapter route simulation authorizes adapter invocation, worker invocation, provider/model invocation, prompt execution, network activity, task execution, validation execution, or mutation.
- No change/diff monitoring simulation authorizes file changes, worker invocation, adapter invocation, validation execution, review acceptance, runtime/evidence mutation, commits, or pushes.
- No post-change review-gate simulation authorizes review acceptance, review evidence recording, validation evidence recording, validation execution, file changes, worker invocation, adapter invocation, runtime/evidence mutation, commits, or pushes.
- No validation command execution by the queue acceptance simulator.
- No validation command execution by the worker envelope planner.
- No validation command execution by the worker invocation contract simulator.
- No validation command execution by the worker adapter simulator.
- No validation command execution by the change/diff monitoring simulator.
- No validation command execution by the post-change review-gate simulator.
- No runtime state mutation.
- No validation or review evidence mutation.
- No HealthApp product feature work.
- No dependency changes.
- No commits.
- No push.
- No deploys or external side effects.
- No destructive commands.
- No free-form shell command execution.
- No command execution through `cmd`, PowerShell, `sh`, or `bash` wrappers.
- No command logs or reports written by default by the command capture harness.
- No persistent overnight reports written unless an explicit report-writing flag is used.
- No persistent overnight run logs written unless an explicit run-log-writing flag is used.
- No arbitrary output paths for overnight reports or run logs.
- No overwrite or truncate behavior for overnight reports or run logs by default.

Normal HealthApp product feature work remains paused for Overnight Worker v1 until this system is proven safe.

## Queue Source

The queue must be human-authored and explicitly supplied to the dry-run planner as a file path.

The planner must not select tasks automatically from `ROADMAP.md` and must not infer product work from backlog state.

Example dry-run commands:

```powershell
node scripts/agent/overnight-dry-run-plan.mjs .agent/overnight/queue.json
node scripts/agent/overnight-dry-run-plan.mjs .agent/overnight/queue.json --pretty
```

## Validation-Only Queue/Harness Integration

RALPH-034C implements the smallest safe integration between the RALPH-034A queue planner and RALPH-034B command harness:

- `scripts/agent/lib/overnight-validation-plan.mjs`
- `scripts/agent/overnight-validation-plan.mjs`

This integration is **plan-only** and does not execute commands. It:

- Reads a human-authored overnight queue JSON file
- Validates the queue using RALPH-034A queue validation logic
- Maps queue `required_checks` strings to known RALPH-034B command allowlist IDs
- Reports mapped, unmapped, and blocked checks
- Produces a structured validation plan with execution readiness assessment
- Executes no commands (validation or otherwise)
- Executes no queued tasks
- Invokes no workers
- Mutates no runtime/evidence state
- Writes no files by default

Example validation plan commands:

```powershell
node scripts/agent/overnight-validation-plan.mjs .agent/overnight/queue.json
node scripts/agent/overnight-validation-plan.mjs .agent/overnight/queue.json --pretty
```

### Check Mapping Model

The validation planner maps known `required_checks` patterns to command IDs:

- Direct ID references: `"validate_ralph_state"` → `validate_ralph_state`
- Raw command strings: `"node scripts/agent/validate-ralph-state.mjs"` → `validate_ralph_state`
- Unknown checks: reported as `unmapped`, fail closed, require human review
- Blocked checks: mapped ID not in allowlist, require allowlist update

The queue schema remains unchanged. Mapping is implemented in library code only.

### Execution Readiness

The validation planner assesses whether a queue is ready for future validation execution:

- `ready_for_validation_execution: true` — queue valid, all checks mapped, no blocked checks
- `ready_for_validation_execution: false` — queue invalid, unmapped checks, or blocked checks present

Even when ready, RALPH-034C does not execute commands. All mapped checks have `executable: false` and `execution_deferred: true`.

### Validation-Only Command Executor

RALPH-034D implements the next bounded step:

- `scripts/agent/lib/overnight-validation-executor.mjs`
- `scripts/agent/overnight-validation-executor.mjs`

The executor:

- Reads a human-authored queue JSON file supplied explicitly by path
- Validates the queue using RALPH-034A logic
- Builds the RALPH-034C validation plan
- Requires all checks to be mapped and unblocked before execution
- Uses `git_status_short` as preflight/final cleanliness safety checks
- Executes only mapped validation/check command IDs in the validation-only allowlist
- Deduplicates repeated validation command IDs for execution
- Stops on the first failed, timed-out, or blocked validation command
- Aggregates structured command-runner results
- Emits JSON by default or a compact `--pretty` summary
- Writes no files by default

Example validation-only executor commands:

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --pretty
```

RALPH-034D remains **validation-only**. It still forbids queued task execution, queue objective execution, queue `allowed_commands` execution, raw queue command execution, worker invocation, runtime/evidence mutation, product work, commits, pushes, and persistent report/log writes by default.

### Persistent Operational Report Writer

RALPH-034E implements the next bounded reporting step:

- `scripts/agent/lib/overnight-report-writer.mjs`

The report writer:

- Builds bounded JSON and Markdown report bundles from validation-only executor results
- Writes reports only when the executor CLI is run with `--write-report`
- Writes only under the fixed directory `.agent/overnight/reports/`
- Does not accept arbitrary output paths such as `--output` or `--report-dir`
- Sanitizes queue IDs before using them in filenames
- Refuses path traversal by verifying resolved paths remain inside the fixed report directory
- Refuses overwrite by default
- Stores bounded stdout/stderr previews and preserves truncation metadata
- Records command results, safety counters, preflight/final status, and recommended human actions
- Documents reports as non-authoritative operational output
- Does not mutate runtime state, validation evidence, or review evidence
- Does not execute queued tasks, queue objectives, queue `allowed_commands`, or raw queue commands
- Does not invoke workers, perform product work, commit, or push

Example explicit report-writing commands:

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report --report-format json,md
```

Default executor behavior remains stdout-only:

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --pretty
```

Example explicit run-log-writing commands:

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-run-log
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report --write-run-log
```

RALPH-034E reports and RALPH-034F run logs are **not authoritative runtime evidence**. They must not be treated as canonical validation/review evidence unless a later task explicitly defines that authority boundary.

RALPH-034F persistent operational run logs are appended under `.agent/overnight/run-log.jsonl` only with explicit `--write-run-log`. The run log records lifecycle events for each overnight validation run with non-authoritative `ovr_` prefixed run IDs. Each event includes state, previous_state, timestamp, queue_id, run_id, safety counters, and validation command summaries. The run log is append-only and never overwrites or truncates existing records. It is non-authoritative operational output and must not be treated as canonical runtime/evidence state.

RALPH-034G positions the existing validation executor as the canonical overnight dry-run orchestrator. It combines all RALPH-034A through RALPH-034F components into one operator-facing command with explicit orchestration metadata. The orchestrator preserves all safety invariants: no queued task execution, no worker invocation, no runtime mutation, no product work, no commits, no pushes. Operator documentation in `OPERATOR_GUIDE.md` explains safe usage patterns for stdout-only dry-runs, report writing, run-log writing, and complete overnight validation runs with morning review.

### Change / Diff Monitoring Simulation

RALPH-034L implements a planning-only change/diff monitoring simulator:

- `scripts/agent/lib/overnight-change-diff-simulator.mjs`
- `scripts/agent/overnight-change-diff-simulator.mjs`

The simulator reads only an explicitly supplied hypothetical change-set JSON file. It evaluates:

- allowed file compliance
- forbidden file violations
- protected file violations
- file count thresholds
- diff line thresholds
- review triggers
- validation-category implications
- zero/false safety invariants

Example commands:

```powershell
node scripts/agent/overnight-change-diff-simulator.mjs .agent/overnight/change-set.json
node scripts/agent/overnight-change-diff-simulator.mjs .agent/overnight/change-set.json --pretty
```

RALPH-034L remains **planning-only**. It does not read git diff, read git status, execute workers, execute adapters, execute prompts, execute queued tasks, run validation commands, mutate runtime/evidence state, write reports/run logs, apply changes, stage, commit, or push.

### Post-Change Review Gate Simulation

RALPH-034M implements a planning-only post-change review-gate simulator:

- `scripts/agent/lib/overnight-post-change-review-gate-simulator.mjs`
- `scripts/agent/overnight-post-change-review-gate-simulator.mjs`

The simulator reads only an explicitly supplied RALPH-034L change/diff simulation JSON file. It evaluates:

- source simulation validity
- source `would_pass`, `would_require_review`, and `would_block` dispositions
- propagated blocking and review reason codes
- scope, forbidden-file, protected-file, and threshold findings
- validation-category and review-policy triggers
- zero/false execution counters
- planning-only/non-authorizing safety invariants

Example commands:

```powershell
node scripts/agent/overnight-post-change-review-gate-simulator.mjs .agent/overnight/change-diff-simulation.json
node scripts/agent/overnight-post-change-review-gate-simulator.mjs .agent/overnight/change-diff-simulation.json --pretty
```

RALPH-034M remains **planning-only**. It does not accept review, write review evidence, write validation evidence, run validation commands, read real git diff/status, execute workers, execute adapters, execute prompts, execute queued tasks, mutate runtime/evidence state, write reports/run logs, apply changes, stage, commit, or push.

Any real autonomous queued-task executor remains a future separately planned task.

## Command Capture Harness

The command capture harness is implemented in:

- `scripts/agent/lib/overnight-command-runner.mjs`
- `scripts/agent/overnight-command-smoke.mjs`

It exists because unattended overnight-capable execution must not depend on Cline terminal capture, VS Code terminal UI state, or manual confirmation of terminal output.

The harness uses structured command specs internally:

```json
{
  "id": "validate_ralph_state",
  "cmd": "node",
  "args": ["scripts/agent/validate-ralph-state.mjs"],
  "cwd": ".",
  "timeout_ms": 30000,
  "allow_nonzero": false
}
```

Execution rules:

- Commands are selected by allowlist ID only.
- Raw shell command strings are not accepted for execution.
- Node `spawn` is used with `shell: false`.
- Stdin is ignored.
- Stdout and stderr are captured from pipes.
- Timeout is required for every command.
- Output capture is size-limited and records truncation flags.
- Unknown or unsafe commands return `status: "blocked"`.
- No queue files are read as execution sources.
- No queued task commands are executed.
- No Cline/OpenCode/Codex/Roo worker or model scripts are invoked.
- No runtime, validation, or review evidence is mutated.
- No files are written by default.

Example smoke commands:

```powershell
node scripts/agent/overnight-command-smoke.mjs git_status_short
node scripts/agent/overnight-command-smoke.mjs validate_ralph_state --pretty
```

Current built-in command IDs are limited to low-risk checks such as Node syntax checks, focused Node tests, validator/reconciler readbacks, and read-only git status.

## Task Classes

Every queue item must use exactly one machine-readable class:

- `SAFE_AUTONOMOUS` — low-risk candidate work. In this foundation phase it is still dry-run/report only.
- `REVIEW_REQUIRED` — analysis, planning, or proposed work that must be reviewed before execution.
- `HUMAN_ONLY` — decisions or work that cannot be executed autonomously.
- `FORBIDDEN` — explicitly unsafe work. It must never be executable.

## Required Queue Item Fields

Each task must include:

- `task_id`
- `title`
- `class`
- `objective`
- `allowed_files`
- `forbidden_files`
- `max_files_changed`
- `max_diff_lines`
- `allowed_commands`
- `forbidden_commands`
- `required_checks`
- `timeout_minutes`
- `max_attempts`
- `commit_policy`
- `push_policy`
- `stop_conditions`
- `expected_outputs`
- `handoff_required`
- `review_required`
- `notes`

For v1, `commit_policy` must be `never` and `push_policy` must be `never`.

## Safety Boundaries

The dry-run planner fails closed when queue data is missing, ambiguous, or unsafe. It rejects:

- missing or unknown task classes;
- missing required fields;
- broad or empty `allowed_files` for classes that could ever edit;
- missing baseline forbidden file protections;
- product feature scope such as `src/**` while product work is paused;
- unsafe command patterns such as `&&`, heredocs, shell write redirection, `Set-Content`, `Add-Content`, `Out-File`, `git push`, `git reset --hard`, `git rebase`, `rm -rf`, `npm install`, `npm audit fix`, deploy commands, and long inline interpreters.

## Failure and Abort Behavior

Invalid or unsafe queues do not produce an execution plan. They produce critical findings and require human review.

`FORBIDDEN`, `HUMAN_ONLY`, and `REVIEW_REQUIRED` items are never executable in this phase. They are reported as skipped/review-required items.

## Orchestrator Usage

RALPH-034G establishes the validation executor as the canonical overnight dry-run orchestrator.

**Operator command:**
```powershell
node scripts/agent/overnight-validation-executor.mjs <queue.json> [--pretty] [--write-report] [--write-run-log]
```

**Orchestrator behavior:**
- Validates queue (RALPH-034A)
- Maps checks (RALPH-034C)
- Executes validation commands (RALPH-034D)
- Optionally writes reports (RALPH-034E with `--write-report`)
- Optionally writes run logs (RALPH-034F with `--write-run-log`)
- Outputs orchestration metadata with safety counters

**For complete operator instructions, see:** [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)

RALPH-034D completed the first validation-only execution layer for mapped check command IDs. RALPH-034E adds bounded non-authoritative operational reporting for that layer. RALPH-034F adds bounded non-authoritative operational run-log lifecycle tracking for that layer. RALPH-034G positions these components as a complete end-to-end orchestrator with operator-facing documentation. The next safe step after human review remains further reporting/review workflow hardening, not queued task execution.

## Queue Acceptance Simulation

RALPH-034H implements a planning-only queue acceptance simulator:

- `scripts/agent/lib/overnight-queue-simulator.mjs`
- `scripts/agent/overnight-queue-simulator.mjs`

The simulator answers this question without executing anything:

> If an overnight worker existed today, which queued tasks would it theoretically accept, reject, escalate, keep human-only, or forbid at intake?

Example commands:

```powershell
node scripts/agent/overnight-queue-simulator.mjs .agent/overnight/queue.json
node scripts/agent/overnight-queue-simulator.mjs .agent/overnight/queue.json --pretty
```

The simulator reuses existing queue validation and validation-plan/check mapping. It never calls the validation executor, never calls the command runner, never runs validation commands, never executes queued task work, never invokes workers/models, never mutates runtime/evidence state, and writes no files.

### Acceptance Dispositions

Each queued task receives exactly one computed disposition:

- `would_accept` — the task would pass future worker intake simulation only. This does **not** authorize execution.
- `would_require_review` — the task may be theoretically executable later but requires human review/approval first.
- `human_only` — the task must remain human-only and must not be autonomously executed.
- `would_reject` — the task is not acceptable due to invalid shape, unsafe scope, missing fields, unmapped/blocked checks, or policy conflict.
- `forbidden` — the task is explicitly unsafe or forbidden and must never be executable.

`human_only` is intentionally separate from `would_require_review`. A `human_only` task is not a future worker candidate unless a later human decision changes the queue/task definition.

### Simulator Safety Output

Every simulator output preserves zero/false safety counters:

```json
{
  "execution_plan": {
    "queued_tasks_executed": 0,
    "worker_invocations": 0,
    "runtime_state_mutations": 0,
    "validation_commands_executed": 0,
    "task_commands_executed": 0,
    "product_work": 0,
    "commits": false,
    "push": false
  }
}
```

## Worker Prompt / Execution Envelope Planning

RALPH-034I implements a planning-only worker envelope planner:

- `scripts/agent/lib/overnight-worker-envelope-planner.mjs`
- `scripts/agent/overnight-worker-envelope-planner.mjs`

The planner answers this question without executing anything:

> If this accepted task were ever handed to a future worker, what exact bounded envelope would constrain it?

Example commands:

```powershell
node scripts/agent/overnight-worker-envelope-planner.mjs .agent/overnight/queue.json
node scripts/agent/overnight-worker-envelope-planner.mjs .agent/overnight/queue.json --pretty
```

The planner reuses RALPH-034H queue acceptance simulation. It creates envelopes only for tasks classified `would_accept`. For `would_require_review`, `human_only`, `would_reject`, and `forbidden`, it returns `envelope_created: false`.

Each created envelope includes:

- `task_id`
- accepted disposition source from RALPH-034H
- `allowed_files`
- `forbidden_files`
- `forbidden_commands`
- `required_checks`
- `max_files_changed`
- `max_diff_lines`
- `stop_conditions`
- verification expectations
- abort conditions
- `commit_policy: "never"`
- `push_policy: "never"`
- `execution_authorized: false`
- `worker_invocation_authorized: false`
- final human review requirements
- explicit non-authorization statement

### Envelope Safety Output

Every envelope planner output preserves zero/false safety counters:

```json
{
  "execution_plan": {
    "queued_tasks_executed": 0,
    "worker_invocations": 0,
    "runtime_state_mutations": 0,
    "validation_commands_executed": 0,
    "task_commands_executed": 0,
    "product_work": 0,
    "commits": false,
    "push": false
  }
}
```

Envelope and prompt proposals are review artifacts only. They do not authorize worker invocation, task execution, validation execution, runtime/evidence mutation, product work, commits, pushes, report writing, or run-log writing.

## Worker Invocation Contract Simulation

RALPH-034J implements a planning-only worker invocation contract simulator:

- `scripts/agent/lib/overnight-worker-invocation-contract-simulator.mjs`
- `scripts/agent/overnight-worker-invocation-contract-simulator.mjs`

The simulator answers this question without executing anything:

> If this envelope were ever separately approved for a future worker, what exact structured payload would be passed to the worker adapter?

Example commands:

```powershell
node scripts/agent/overnight-worker-invocation-contract-simulator.mjs .agent/overnight/queue.json
node scripts/agent/overnight-worker-invocation-contract-simulator.mjs .agent/overnight/queue.json --pretty
```

The simulator reuses RALPH-034I worker envelope planning. It creates invocation contract previews only for entries with `envelope_created: true`. For all other tasks, it returns `contract_created: false`.

Each created contract includes:

- `contract_id`
- source task, queue, and synthesized envelope IDs
- accepted disposition source from RALPH-034H
- worker type placeholder
- model/provider/model-name placeholders
- adapter binding with no command, endpoint, or callable invocation function
- prompt payload preview with prompt execution unauthorized
- `allowed_files`
- `forbidden_files`
- `allowed_commands`
- `forbidden_commands`
- `required_checks`
- `max_files_changed`
- `max_diff_lines`
- timeout policy
- abort conditions
- expected outputs
- `commit_policy: "never"`
- `push_policy: "never"`
- final and post-worker human review requirements
- explicit non-authorization statement
- `execution_authorized: false`
- `worker_invocation_authorized: false`
- `prompt_execution_authorized: false`

### Invocation Contract Safety Output

Every invocation contract simulator output preserves zero/false safety counters:

```json
{
  "execution_plan": {
    "queued_tasks_executed": 0,
    "worker_invocations": 0,
    "runtime_state_mutations": 0,
    "validation_commands_executed": 0,
    "task_commands_executed": 0,
    "prompt_executions": 0,
    "product_work": 0,
    "commits": false,
    "push": false
  }
}
```

Invocation contract previews are review artifacts only. They do not authorize worker invocation, prompt execution, task execution, validation execution, runtime/evidence mutation, product work, commits, pushes, report writing, run-log writing, dependency changes, external side effects, or adapter execution.

Real worker execution remains future work and requires a separate approved planning and implementation task.

## Worker Adapter Simulation

RALPH-034K implements a planning-only worker adapter simulator:

- `scripts/agent/lib/overnight-worker-adapter-simulator.mjs`
- `scripts/agent/overnight-worker-adapter-simulator.mjs`

The simulator answers this question without executing anything:

> Given a RALPH-034J invocation contract preview, how would a future adapter routing layer classify it without selecting or invoking a real adapter?

Example commands:

```powershell
node scripts/agent/overnight-worker-adapter-simulator.mjs .agent/overnight/queue.json
node scripts/agent/overnight-worker-adapter-simulator.mjs .agent/overnight/queue.json --pretty
```

The simulator reuses RALPH-034J worker invocation contract simulation. It creates adapter route simulations only for entries with `contract_created: true`. For all other tasks, it returns `adapter_simulation_created: false` and `adapter_route_disposition: "not_eligible_no_contract"`.

Current RALPH-034J contracts are explicitly non-authorizing, so current RALPH-034K adapter route simulations use `adapter_route_disposition: "blocked_by_authorization"` and never produce executable routes.

Each created adapter route simulation includes:

- `route_id`
- source contract and task IDs
- worker type placeholder
- adapter family/name placeholders
- provider/model placeholders
- placeholder-only routing strategy
- inert routing decision with no selected adapter/provider/model
- inert adapter binding with no command, endpoint, URL, or callable invocation function
- authorization enforcement details
- explicit non-authorization statement
- `execution_authorized: false`
- `worker_invocation_authorized: false`
- `adapter_invocation_authorized: false`
- `prompt_execution_authorized: false`

### Adapter Simulator Safety Output

Every adapter simulator output preserves zero/false safety counters:

```json
{
  "execution_plan": {
    "queued_tasks_executed": 0,
    "worker_invocations": 0,
    "adapter_invocations": 0,
    "provider_invocations": 0,
    "model_invocations": 0,
    "prompt_executions": 0,
    "network_requests": 0,
    "runtime_state_mutations": 0,
    "validation_commands_executed": 0,
    "task_commands_executed": 0,
    "product_work": 0,
    "files_written": 0,
    "commits": false,
    "push": false
  }
}
```

Adapter route simulations are review artifacts only. They do not authorize adapter invocation, worker invocation, provider/model invocation, prompt execution, task execution, validation execution, runtime/evidence mutation, network activity, product work, commits, pushes, report writing, run-log writing, dependency changes, external side effects, or file writes.

Real worker adapter implementation remains future work and requires a separate approved planning and implementation task.
