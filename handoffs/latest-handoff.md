# RALPH-034H Handoff: Queue Acceptance Simulator

## Run / Task Identity and Status

**Task ID:** RALPH-034H
**Title:** Queue Acceptance Simulator
**Status:** implemented, pending human review
**Mode:** ACT MODE

## What Changed

Implemented a planning-only queue acceptance simulator that classifies each human-authored overnight queue task according to a hypothetical future worker intake decision.

New task dispositions:

- `would_accept`
- `would_require_review`
- `human_only`
- `would_reject`
- `forbidden`

`human_only` is separate from `would_require_review`. `would_accept` is intake-only and does not authorize execution.

## Why Changed

RALPH-034A through RALPH-034G provided validation, validation-plan mapping, validation-only command execution, report writing, lifecycle logging, and end-to-end dry-run orchestration. The missing safe next step toward a future overnight worker was a deterministic intake decision model, not readiness/risk scoring or task execution.

## Changed Files

1. `scripts/agent/lib/overnight-queue-simulator.mjs`
   - Added pure simulator library.
   - Reuses `validateOvernightQueue`, `validateQueueTask`, and `buildOvernightValidationPlan`.
   - Does not call validation executor, command runner, spawn, or file writes.

2. `scripts/agent/overnight-queue-simulator.mjs`
   - Added CLI with JSON output by default and `--pretty` support.
   - Rejects execution-like flags such as `--execute`, `--worker`, `--run-queue`, `--commit`, `--push`, `--output`, `--overwrite`, `--write-report`, and `--write-run-log`.

3. `scripts/agent/__tests__/overnight-queue-simulator.test.mjs`
   - Added focused tests for all five dispositions, safety counters, no writes, CLI flag rejection, parseable output, and no execution authorization.

4. `.agent/overnight/README.md`
   - Documented RALPH-034H Queue Acceptance Simulation and strict safety boundaries.

5. `.agent/overnight/OPERATOR_GUIDE.md`
   - Added planning-only queue acceptance simulation usage and disposition semantics.

6. `handoffs/latest-handoff.md`
   - Updated this handoff.

## Safety Boundaries

Preserved boundaries:

- No queued tasks executed.
- No queue objectives executed.
- No queue `allowed_commands` executed.
- No raw queue command strings executed.
- No validation commands executed by the simulator.
- No workers/models invoked.
- No Cline/OpenCode/Codex/Roo invocation.
- No runtime/evidence state mutation.
- No `tasks/**`, `runs/**`, `validation/**`, or `review/**` mutation.
- No `src/**` changes.
- No `supabase/**` changes.
- No `package.json` or `package-lock.json` changes.
- No `ROADMAP.md` changes.
- No staging, commit, or push performed.

## Validation Executed

Validation commands were run one command at a time:

- `node --check scripts/agent/lib/overnight-queue-simulator.mjs` — pass
- `node --check scripts/agent/overnight-queue-simulator.mjs` — pass
- `node --test scripts/agent/__tests__/overnight-queue-simulator.test.mjs` — pass, 19/19 tests
- `node scripts/agent/validate-ralph-state.mjs` — pass, status ok, 0 critical findings, 38 warnings
- `node scripts/agent/reconcile-roadmap-task-state.mjs` — pass, status ok, 0 critical findings, 1 warning
- `git --no-pager status --short` — pass, only approved files modified/untracked
- `git --no-pager diff --stat` — pass, tracked documentation/handoff diff shown
- `git --no-pager diff --name-only` — pass, tracked modified files listed

## Validation Result

Passed. Validator/reconciler warnings are pre-existing governance/state alignment warnings or non-blocking handoff/run mismatch warnings; both commands reported status `ok` and 0 critical findings.

`git --no-pager status --short` showed only approved RALPH-034H files:

- `.agent/overnight/OPERATOR_GUIDE.md`
- `.agent/overnight/README.md`
- `handoffs/latest-handoff.md`
- `scripts/agent/__tests__/overnight-queue-simulator.test.mjs`
- `scripts/agent/lib/overnight-queue-simulator.mjs`
- `scripts/agent/overnight-queue-simulator.mjs`

No runtime/evidence files changed. No product files changed. No report/run-log artifacts were created by the simulator tests or CLI checks.

## Known Issues / Risks

No known implementation risks at this stage. The simulator is intentionally planning-only and non-mutating. Future worker prompt/envelope planning remains the next boundary; real execution is still out of scope.

## Human Review Status

Human review required before any follow-up task. Do not proceed to worker invocation or queued task execution from RALPH-034H.
