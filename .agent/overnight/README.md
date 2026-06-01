# RALPH Overnight Worker v1 Foundation

## Purpose

This directory defines the first safe foundation for the RALPH Autonomous Overnight Worker v1.

The current phase is **dry-run only**. It validates a human-authored queue and produces a dry-run plan. It does not execute queued tasks.

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

Normal HealthApp product feature work remains paused for Overnight Worker v1 until this system is proven safe.

## Queue Source

The queue must be human-authored and explicitly supplied to the dry-run planner as a file path.

The planner must not select tasks automatically from `ROADMAP.md` and must not infer product work from backlog state.

Example dry-run commands:

```powershell
node scripts/agent/overnight-dry-run-plan.mjs .agent/overnight/queue.json
node scripts/agent/overnight-dry-run-plan.mjs .agent/overnight/queue.json --pretty
```

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
