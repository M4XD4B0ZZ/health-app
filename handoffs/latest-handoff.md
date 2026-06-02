# RALPH-034I Handoff: Worker Prompt / Execution Envelope Planner

## Run / Task Identity and Status

**Task ID:** RALPH-034I
**Title:** Worker Prompt / Execution Envelope Planner
**Status:** implemented, pending human review
**Mode:** ACT MODE

## What Changed

Implemented a planning-only worker envelope planner that produces deterministic, reviewable future-worker envelope proposals only for tasks classified `would_accept` by the RALPH-034H queue acceptance simulator.

For all other dispositions, the planner returns `envelope_created: false`:

- `would_require_review`
- `human_only`
- `would_reject`
- `forbidden`

Each created envelope includes bounded constraints, verification expectations, abort conditions, no-commit/no-push policy, final human review requirements, and explicit non-authorization fields.

## Why Changed

RALPH-034H could classify which queued tasks would theoretically pass future worker intake, but there was no deterministic answer to:

> If this accepted task were ever handed to a future worker, what exact bounded envelope would constrain it?

RALPH-034I adds that next safe planning layer without invoking workers, executing prompts, executing queued tasks, running validation commands, writing reports/logs, or mutating runtime/evidence state.

## Changed Files

1. `scripts/agent/lib/overnight-worker-envelope-planner.mjs`
   - Added pure planner library.
   - Imports and reuses `simulateOvernightQueueAcceptance`.
   - Builds worker envelopes only for `would_accept` tasks.
   - Adds prompt proposals as deterministic review text, not executable prompts.
   - Preserves zero/false execution counters and explicit non-authorization fields.

2. `scripts/agent/overnight-worker-envelope-planner.mjs`
   - Added CLI with JSON output by default and `--pretty` support.
   - Reads only an explicitly supplied queue JSON file.
   - Rejects execution-like and write-like flags including `--execute`, `--worker`, `--run-queue`, `--run-worker`, `--invoke-worker`, `--commit`, `--push`, `--output`, `--overwrite`, `--write-report`, `--write-run-log`, `--report-dir`, and `--run-log-path`.

3. `scripts/agent/__tests__/overnight-worker-envelope-planner.test.mjs`
   - Added focused tests for envelope creation, non-accepted disposition handling, mandatory safety fields, non-authorization, no writes, CLI flag rejection, prompt boundedness, and zero execution counters.

4. `.agent/overnight/README.md`
   - Updated current phase to RALPH-034I.
   - Documented worker prompt / execution envelope planning and envelope safety output.
   - Added hard-limit statements that envelope/prompt proposals do not authorize execution.

5. `.agent/overnight/OPERATOR_GUIDE.md`
   - Updated current phase to RALPH-034I.
   - Added Mode 0.5: Worker Envelope Planning.
   - Documented envelope fields and non-authorization semantics.
   - Updated future-work and version sections.

6. `handoffs/latest-handoff.md`
   - Updated this handoff.

## Safety Boundaries

Preserved boundaries:

- No queued tasks executed.
- No queue objectives executed.
- No queue `allowed_commands` executed.
- No raw queue command strings executed.
- No validation commands executed.
- No prompt text executed.
- No workers/models invoked.
- No Cline/OpenCode/Codex/Roo invocation.
- No runtime/evidence state mutation.
- No `tasks/**`, `runs/**`, `validation/**`, or `review/**` mutation.
- No report or run-log artifacts created.
- No `src/**` changes.
- No `supabase/**` changes.
- No `package.json` or `package-lock.json` changes.
- No `ROADMAP.md` changes.
- No staging, commit, or push performed.

## Validation Executed

Validation commands were run one command at a time:

- `node --check scripts/agent/lib/overnight-worker-envelope-planner.mjs` — pass
- `node --check scripts/agent/overnight-worker-envelope-planner.mjs` — pass
- `node --test scripts/agent/__tests__/overnight-worker-envelope-planner.test.mjs` — pass, 10/10 tests
- `node scripts/agent/validate-ralph-state.mjs` — pass, status ok, 0 critical findings, 38 warnings
- `node scripts/agent/reconcile-roadmap-task-state.mjs` — pass, status ok, 0 critical findings, 1 warning
- `git --no-pager status --short` — pass, only approved RALPH-034I files modified/untracked
- `git --no-pager diff --stat` — pass, tracked documentation/handoff diff shown
- `git --no-pager diff --name-only` — pass, tracked modified files listed

## Validation Result

Passed. Validator/reconciler warnings are pre-existing governance/state alignment warnings or non-blocking handoff/run mismatch warnings; both commands reported status `ok` and 0 critical findings.

`git --no-pager status --short` showed only approved RALPH-034I files:

- `.agent/overnight/OPERATOR_GUIDE.md`
- `.agent/overnight/README.md`
- `handoffs/latest-handoff.md`
- `scripts/agent/__tests__/overnight-worker-envelope-planner.test.mjs`
- `scripts/agent/lib/overnight-worker-envelope-planner.mjs`
- `scripts/agent/overnight-worker-envelope-planner.mjs`

No runtime/evidence files changed. No product files changed. No report/run-log artifacts were created by the planner tests or CLI checks.

## Known Issues / Risks

No known implementation risks. The planner is intentionally non-authorizing and planning-only. Real worker invocation remains out of scope and requires a separate approved task.

## Human Review Status

Human review required before any follow-up task. Do not proceed to worker invocation, prompt execution, validation execution, queued task execution, runtime mutation, evidence mutation, commits, or pushes from RALPH-034I.
