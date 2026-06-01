# RALPH Overnight Worker v1 Foundation

## Purpose

This directory defines the first safe foundation for the RALPH Autonomous Overnight Worker v1.

The current phase is **dry-run only**. It validates a human-authored queue and produces a dry-run plan. It does not execute queued tasks.

RALPH-034B adds a separate **command capture smoke harness**. It can run only built-in allowlisted low-risk command IDs and capture their stdout, stderr, exit code, signal, duration, timeout state, and truncation flags as structured JSON. It is not queue execution and does not make queued tasks executable.

## Hard v1 Limits

- No queued task execution.
- No Cline, OpenCode, Codex, Roo, model, or worker invocation.
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

Normal HealthApp product feature work remains paused for Overnight Worker v1 until this system is proven safe.

## Queue Source

The queue must be human-authored and explicitly supplied to the dry-run planner as a file path.

The planner must not select tasks automatically from `ROADMAP.md` and must not infer product work from backlog state.

Example dry-run commands:

```powershell
node scripts/agent/overnight-dry-run-plan.mjs .agent/overnight/queue.json
node scripts/agent/overnight-dry-run-plan.mjs .agent/overnight/queue.json --pretty
```

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

## Morning Report Concept

Future Overnight Worker phases should produce a morning review report under `.agent/overnight/reports/`. The report should summarize queue identity, task-by-task outcomes, skipped/aborted items, verification status, safety findings, commands considered, and exact next human decisions.

Future integration should happen in a separate task. The next safe step is to connect the dry-run queue planner and command capture harness in validation-only mode, without executing queued task work or invoking workers.
