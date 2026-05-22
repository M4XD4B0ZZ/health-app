# Executive Summary

RALPH-001-DISCOVERY was performed as analysis only. No implementation, roadmap edit, commit, or push was performed.

This report was reviewed and refreshed for the requested `RALPH-001-DISCOVERY` analysis run on 2026-05-22. The discovery scope covered the required governance files, Ralph runtime directories, agent scripts, state files, validation evidence, handoff/report artifacts, and automation-gate logic.

The repository currently contains a Ralph automation ecosystem with two partially overlapping generations:

1. **Legacy/Phase A-E `.agent/out` orchestrator** in `scripts/agent/`, driven primarily by `ROADMAP.md` parsing and npm scripts such as `agent:run`, `agent:auto`, `agent:milestone`, `agent:worker`, and `agent:verify`.
2. **Newer Ralph runtime-state foundation** under `.governance/`, `tasks/`, `runs/`, `validation/`, `handoffs/`, and `.agent/config/`, driven by structured task state (`tasks/task-state.json`) and executable components such as `select-next-ralph-task.mjs` and `generate-morning-review.mjs`.

The ecosystem is mature as a **single-task, human-gated automation scaffold**. It is not yet mature as a safe multi-task autonomous loop. The strongest working parts are governance, safety policy, task-state schema, dry-run task selection, morning review aggregation, OpenCode worker observability, and manual review/verify gates. The weakest areas are synchronization between ROADMAP and task-state, write-safe state transitions, commit safety, robust validation enforcement, automatic handoff generation into the canonical handoff location, and overnight multi-task orchestration.

Overall autonomous readiness is low-to-moderate for a single task and low for overnight multi-task execution.

# Current Architecture

## Components

### Governance layer

- `SSOK.md`
  - Defines the repository authority hierarchy.
  - Declares Ralph-Loop transition status.
  - Establishes ROADMAP as planning authority, VERIFY as verification authority, task/run files as runtime state, and `.agent/adapters/*` as adapter-level execution rules.

- `AGENTS.md`
  - Defines Ralph-Loop execution rules: one assigned task per run, respect `tasks/task-state.json`, write handoff, stop for human review, respect protected files, and stop on ambiguity, validation failure, protected-file violations, or human review gates.

- `VERIFY.md`
  - Defines canonical verification decision table.
  - Documentation/report-only changes require readback checks, primarily `git --no-pager status --short`, plus diff stat/name-only in normal docs-only cases. This task explicitly requested only `git --no-pager status --short`.

- `.governance/SYSTEM.md`
  - Defines Ralph lifecycle: read governance, read task state, select one task, execute scoped work, write handoff, validate, update state, stop for review.

- `.governance/RULES.md`
  - Defines one-task-per-run, scoped execution, handoff schema, validation expectations, and repository-state-as-authoritative-memory.

- `.governance/SAFETY.md`
  - Defines protected files, forbidden actions, safety gates, and immediate stop rules.

- `.governance/REVIEW_POLICY.md`
  - Defines review gate policy, review outcomes, blocked/failed handling, rollback principles, and morning review expectations.

### Legacy `.agent/out` script orchestrator

Located in `scripts/agent/` and exposed through `package.json` scripts:

- `roadmap-parser.mjs`
  - Parses `ROADMAP.md` task headers for `P*` and `RESOLVER-V2-*` task IDs.
  - Extracts status, descriptions, and DoD.

- `select-next-task.mjs` (`npm run agent:next`)
  - Selects the first `in_progress` task from `ROADMAP.md`, otherwise the first `todo` task.
  - Writes `.agent/out/selected-task.json`.

- `stale-detection.mjs`
  - Checks whether `.agent/out/selected-task.json` is stale against `ROADMAP.md` mtime and task status.

- `build-roo-prompt.mjs` (`npm run agent:prompt`)
  - Builds `.agent/out/next-prompt.md` for manual Roo work.

- `build-worker-prompt.mjs` (`npm run agent:worker-prompt`)
  - Builds `.agent/out/worker-prompt.md` for OpenCode worker execution.

- `run-agent-loop.mjs` (`npm run agent:run`)
  - Manages `.agent/state.json` and gates through task selection, prompt generation, manual implementation gate, verify-report analysis, handoff-template generation, or fix-prompt generation.

- `run-opencode-worker.mjs` (`npm run agent:worker`)
  - Runs OpenCode using `.agent/out/worker-task.md`, `.agent/out/worker-prompt.md`, or `.agent/out/next-prompt.md`.
  - Adds safety header and sentinel-file expectation.
  - Writes `.agent/out/opencode-report.md`, `.agent/out/opencode-live.log`, and `.agent/out/worker-status.json`.
  - Includes Windows spawn strategy matrix/debug support, timeouts, heartbeat, inactivity timeout, error-pattern detection, and success-evidence evaluation.

- `run-verify.mjs` (`npm run agent:verify`)
  - Runs `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test`.
  - Writes `.agent/out/verify-report.md`.
  - Does not run edge verification automatically.

- `write-handoff-template.mjs` (`npm run agent:handoff`)
  - Writes `.agent/out/handoff-template.md` only, not the canonical `handoffs/latest-handoff.md`.

- `select-model.mjs` (`npm run agent:model`)
  - Attempts model selection through Codex CLI using `.agent/models.json` or `.agent/models.example.json`.
  - Falls back to a registry model on router failure.
  - Writes `.agent/out/model-selection.json`.

- `run-auto-task.mjs` (`npm run agent:auto`)
  - Automates a single task: prompt preparation, model selection, worker execution, verification, optional one fix attempt, then human review gate.
  - Does not commit, push, mark ROADMAP done, or continue to another task.

- `run-milestone.mjs` (`npm run agent:milestone`)
  - Attempts controlled multi-task automation with max task count, clean-tree requirement, diff guard, verify gate, worker gate, and review gate.
  - Default configuration stops after each task for human review.
  - Uses legacy ROADMAP-driven `agent:run`, not the structured Ralph selector.

- `watch-agent.mjs` (`npm run agent:watch`)
  - Terminal dashboard for `.agent/state.json`, worker status, model selection, selected task, logs, and reports.

### Structured Ralph runtime foundation

- `tasks/task-state.json`
  - Structured Ralph runtime task registry with task IDs `RALPH-001A` through `RALPH-010A` marked done.
  - Contains status, priority, risk level, allowed/forbidden files, outputs, validation, and acceptance criteria.

- `tasks/task-history.jsonl`
  - Append-only task event evidence: started/completed/fix/state repair events.

- `runs/current-run.json`
  - Current/latest run record. Currently points to a completed `RALPH-010A-CLOSEOUT` run.

- `runs/run-history.jsonl`
  - Append-only run evidence, including run_started/run_completed/smoke/runtime review events.

- `validation/validation-rules.json`
  - Structured validation rules and validation levels.

- `validation/validation-results.jsonl`
  - Append-only validation evidence.

- `handoffs/latest-handoff.md`
  - Canonical handoff file by governance, but currently contains product-task P1-003 handoff rather than a Ralph runtime handoff.

- `reports/morning-review.md`
  - Generated morning review report.

- `.agent/config/loop-config.json`
  - Ralph loop constraints, execution policy, human review policy, validation config, logging config, and adapter config.

- `.agent/config/protected-files.json`
  - Machine-readable protected-file and forbidden-action policy.

- `.agent/adapters/*.md`
  - Static adapter contracts for Cline, Codex, OpenCode, and Roo.

- `.agent/prompts/*.md`
  - Static prompt contracts for coordinator, worker, reviewer, and validator.

### Structured Ralph executable components

- `select-next-ralph-task.mjs`
  - Reads `tasks/task-state.json`, `.agent/config/loop-config.json`, `.agent/config/protected-files.json`, optional handoff, and optional `runs/current-run.json`.
  - Validates task structure.
  - Filters eligible tasks by status, risk, attempts, review availability, and safety constraints.
  - Selects by priority, status preference, created_at, and ID.
  - Can write `runs/current-run.json` with `--write`.
  - Does not implement task execution.

- `generate-morning-review.mjs`
  - Reads task state/history, current run, run history, validation results, handoff, loop config, review policy, and safety policy.
  - Generates markdown or JSON morning review.
  - Read-only by default; writes only `reports/morning-review.md` with `--write`.

## Responsibilities

- **Planning authority:** `ROADMAP.md` for canonical task planning; `tasks/task-state.json` for Ralph runtime execution tracking.
- **Execution authority:** `.agent/state.json` in legacy flow; `runs/current-run.json` in structured Ralph flow.
- **Evidence authority:** `tasks/task-history.jsonl`, `runs/run-history.jsonl`, `validation/validation-results.jsonl`, generated reports.
- **Worker execution:** OpenCode via `run-opencode-worker.mjs`; Cline/Roo/Codex currently documented as adapters rather than fully machine-orchestrated workers.
- **Verification:** `VERIFY.md` as policy; `run-verify.mjs` as legacy full verification runner; `validation/validation-rules.json` as structured Ralph rule catalog.
- **Review:** `.governance/REVIEW_POLICY.md` plus manual gates in `run-agent-loop.mjs`, `run-auto-task.mjs`, and `run-milestone.mjs`.
- **Handoff:** Governance requires `handoffs/latest-handoff.md`; legacy script only generates `.agent/out/handoff-template.md`.

## Execution Flow

### Legacy manual flow

1. `npm run agent:run`
2. If no selected task exists, parse `ROADMAP.md` and write `.agent/out/selected-task.json`.
3. Generate `.agent/out/next-prompt.md` and `.agent/out/worker-prompt.md`.
4. Stop at manual Roo implementation gate.
5. User/worker implements task.
6. `npm run agent:verify` writes `.agent/out/verify-report.md`.
7. `npm run agent:run` analyzes report.
8. If passed, writes `.agent/out/handoff-template.md` and sets `.agent/state.json` to `ready_for_human_review`.
9. If failed, writes `.agent/out/fix-prompt.md` and stops.

### Legacy single-task autonomous flow

1. `npm run agent:auto`
2. Ensures prompt exists.
3. Runs model selection.
4. Ensures worker prompt.
5. Runs OpenCode worker.
6. Runs verification.
7. Runs `agent:run` to update state and produce handoff/fix artifacts.
8. If verify failed, performs at most one fix attempt.
9. Stops at human review gate on success or final failure.

### Legacy milestone flow

1. `npm run agent:milestone`
2. Requires clean working tree, ignoring `.agent/out` artifacts.
3. Loops up to configured `maxTasks`.
4. Deletes task artifacts.
5. Runs `agent:run`, model selection, worker prompt, worker, verify, state update, diff guard.
6. Stops on worker failure, verify failure, large diff, high risk model, or review gate.
7. By default stops after one task because `requireHumanReviewAfterRun` is true.

### Structured Ralph selection flow

1. `node scripts/agent/select-next-ralph-task.mjs --dry-run` or `--write`.
2. Reads structured state/config/protection data.
3. Validates task schema.
4. Rejects stale active runs.
5. Filters eligible tasks.
6. Performs allowed-files safety checks.
7. Outputs selection result or no-eligible-task stop reason.
8. Optional `--write` updates `runs/current-run.json`.

### Structured morning review flow

1. `node scripts/agent/generate-morning-review.mjs --dry-run|--write|--json`.
2. Aggregates state/history/validation/handoff data.
3. Detects review issues such as failed validations, stale active runs, and done-without-validation.
4. Suggests next run.
5. Writes only `reports/morning-review.md` when requested.

# Existing Components

## Reusable components

- `roadmap-parser.mjs`
  - Reusable for ROADMAP extraction, but limited to known task ID formats and not aware of `RALPH-*` tasks.

- `stale-detection.mjs`
  - Reusable for legacy selected-task invalidation.
  - Tied to `ROADMAP.md` and `.agent/out/selected-task.json`.

- `select-next-ralph-task.mjs`
  - Reusable structured selector for Ralph runtime state.
  - Strong candidate for V2 coordinator selection core.

- `generate-morning-review.mjs`
  - Reusable reporting/aggregation component.
  - Good basis for review dashboard and overnight summary.

- `run-opencode-worker.mjs`
  - Reusable worker wrapper with strong observability, timeout, spawn diagnostics, and success-evidence detection.

- `run-verify.mjs`
  - Reusable full product verification runner, although it does not implement the full VERIFY.md decision table.

- `.agent/config/protected-files.json`
  - Reusable machine-readable safety policy.

- `.agent/config/loop-config.json`
  - Reusable conservative loop policy.

- `validation/validation-rules.json`
  - Reusable validation policy catalog.

## Mature components

- Governance and safety documentation are mature and explicit.
- Structured task state schema is sufficiently rich for single-task Ralph selection.
- Dry-run Ralph selector is implemented and historically fixed after initial execution bugs.
- Morning review generator is implemented with CLI modes and historical smoke evidence.
- OpenCode worker wrapper is mature in observability, Windows spawn handling, timeout controls, sentinel handling, and report generation.
- Manual gates are consistently present and conservative.

## Partially implemented components

- `run-auto-task.mjs`
  - Implements one-task automation but uses legacy ROADMAP selection and `.agent/out` state rather than `tasks/task-state.json` / `runs/current-run.json` as the execution source.

- `run-milestone.mjs`
  - Implements multi-task loop skeleton but is gated to stop after each task by default and does not safely commit, update canonical task state, or advance across structured Ralph tasks.

- `run-verify.mjs`
  - Runs full product verification, but does not select verification commands by change category from VERIFY.md.

- Handoff generation
  - Produces `.agent/out/handoff-template.md`; does not create the canonical `handoffs/latest-handoff.md` from actual run data.

- Validation results
  - `validation/validation-results.jsonl` exists as evidence, but there is no central validator that enforces every rule in `validation/validation-rules.json` against current diffs and state.

- Task history / run history
  - Exist and contain useful evidence, but are manually or semi-manually appended and not consistently synchronized by a single state-transition API.

- Model selection
  - Implemented but depends on external `codex` CLI and model registry availability; fallback behavior exists.

# Runtime State Model

## `tasks/task-state.json`

### Ownership

- Runtime execution authority for Ralph task status and task-scoped constraints.
- Does not replace `ROADMAP.md` as planning authority.
- Used by `select-next-ralph-task.mjs` and `generate-morning-review.mjs`.

### Lifecycle

Expected lifecycle values:

- `not_started`
- `in_progress`
- `needs_validation`
- `needs_review`
- `blocked`
- `failed`
- `done`
- `skipped`
- `cancelled`

Actual current state:

- All listed Ralph tasks `RALPH-001A` through `RALPH-010A` are `done`.
- Current product task P1-003 exists in `ROADMAP.md`/handoff, not in Ralph task-state.

### Synchronization model

- Intended model: ROADMAP is planning truth; task-state is runtime execution tracking.
- Actual model: synchronization is manual/semi-manual. Historical evidence includes a dedicated `RALPH-007A-STATE-FIX` because state updates were missed.
- Risk: ROADMAP and task-state can diverge, especially because legacy automation selects from ROADMAP while structured Ralph selector selects from task-state.

## `tasks/task-history.jsonl`

### Ownership

- Evidence authority for task lifecycle events.

### Lifecycle

- Append-only JSONL event stream.
- Contains task_started, task_completed, bugfix_completed, state_repaired, and completed events.

### Synchronization model

- Intended to mirror task-state transitions.
- Actual entries are plausible but not guaranteed by a central transition function.
- Event type taxonomy is inconsistent (`task_completed`, `completed`, `bugfix_completed`, `state_repaired`).

## `runs/current-run.json`

### Ownership

- Runtime execution authority for current/latest run.

### Lifecycle

- Should represent active selected task during execution and final completed/blocked/failed state after execution.
- Current file is a completed closeout run: `run_2026-05-19_ralph-010a-closeout` with status `completed`.

### Synchronization model

- `select-next-ralph-task.mjs --write` can write this file.
- Many historical updates were manual or task-specific.
- The file is currently a latest-run snapshot, not a lock with robust active-run semantics.

## `runs/run-history.jsonl`

### Ownership

- Evidence authority for run lifecycle events.

### Lifecycle

- Append-only run evidence stream with run_started, run_completed, smoke_test_completed, runtime_review_completed, and bugfix/state repair entries.

### Synchronization model

- Intended to record run lifecycle transitions from current-run.
- Actual event types and schemas vary by task and era.
- There is no observed atomic transaction that updates current-run, run-history, task-state, task-history, validation-results, and handoff together.

## Additional runtime state: `.agent/state.json`

- Legacy orchestration state, not part of the formal runtime contract hierarchy.
- Currently stale relative to current repo state: it references `P1-002` and `ready_for_human_review` from 2026-05-16, while current ROADMAP focus is P1-003 and current handoff is P1-003.
- Important divergence risk for legacy `agent:*` commands.

## Synchronization conclusion

There is no single authoritative state transition API. The ecosystem currently has at least three state models:

1. `ROADMAP.md` task status and task order.
2. `tasks/task-state.json` structured Ralph tasks.
3. `.agent/state.json` / `.agent/out/*` legacy orchestrator state.

This split is the central blocker to Ralph V2 multi-task automation.

# Review And Verification Pipeline

## Current review gates

Governance-defined gates:

- `.governance/SYSTEM.md`: stop after one task completion for review.
- `.governance/RULES.md`: one-task-per-run and mandatory stop-for-review.
- `.governance/REVIEW_POLICY.md`: review acceptance policy, manual review triggers, failed/blocked handling.
- `.agent/config/loop-config.json`: `require_review_after_each_task: true`, auto-approve docs-only false, auto-approve single-file false.

Script-level gates:

- `run-agent-loop.mjs`
  - Manual Roo implementation gate.
  - Fix gate on verify failure.
  - Review gate on verify success.

- `run-auto-task.mjs`
  - Stops after worker failure.
  - Stops after verify success at human review gate.
  - Stops after verify/fix failure at human review gate.

- `run-milestone.mjs`
  - Clean working-tree gate.
  - High-risk model gate.
  - Worker failure gate.
  - Verify failure gate.
  - Large diff gate.
  - Human review gate after each task by default.

- `select-next-ralph-task.mjs`
  - Stale active run stop.
  - No eligible task stop.
  - Safety violation stop.

## Current verify gates

- `VERIFY.md` is canonical.
- `validation/validation-rules.json` defines structured validation levels and core rules.
- `run-verify.mjs` executes full product verification commands:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm run test`
- `run-agent-loop.mjs`, `run-auto-task.mjs`, and `run-milestone.mjs` parse `.agent/out/verify-report.md` for success/failure markers.
- Edge verification is explicitly not automatic in `run-verify.mjs`.

## Current stop conditions

Observed stop conditions include:

- No task available.
- Stale selected task.
- Stale active run.
- Protected-file safety violation.
- Worker failure.
- Worker timeout.
- Inactivity/hang timeout.
- Verification failure.
- Missing prompt.
- Missing/invalid config or JSON.
- High-risk model selection.
- Large diff.
- Dirty working tree before milestone.
- Human review required.

## Pipeline gaps

- No central validator enforces all `validation/validation-rules.json` rules against actual diffs.
- `run-verify.mjs` does not use VERIFY.md decision table by change category.
- Handoff template generation is not equivalent to a real handoff with actual changed files and verification evidence.
- Validation evidence in `validation-results.jsonl` is not automatically generated by the verification runner.
- Review outcomes are not modeled as structured approvals/rejections that unlock next task execution.

# Autonomous Readiness Assessment

| Capability | Readiness | Rationale |
| --- | ---: | --- |
| Task selection | 60% | Structured selector is solid for `tasks/task-state.json`, but legacy selection uses ROADMAP; no unified selector or dependency resolver. |
| Execution | 45% | OpenCode worker wrapper is strong, and `agent:auto` runs one task, but execution is prompt-based, external-tool-dependent, and not tightly scoped by structured allowed_files at runtime. |
| Review | 55% | Review policy and gates are strong, but review outcomes are manual and not machine-recorded as approvals/rejections that control next steps. |
| Verification | 45% | Full verify runner exists, but category-aware VERIFY.md enforcement and validation-results synchronization are missing. Current repo has known full-verify formatting blocker from product work. |
| Commit safety | 20% | Scripts intentionally do not commit/push. There is no safe auto-commit workflow with staged-file allowlists, secret scanning, diff review, and rollback. This is safe but not autonomous. |
| Overnight readiness | 25% | Milestone skeleton exists, but state divergence, human-review-after-each-task, no commit safety, weak state transactionality, and validation blockers prevent safe overnight multi-task automation. |

Overall:

- **Single-task assisted automation readiness:** ~55%
- **Single-task autonomous-with-human-review readiness:** ~45%
- **Multi-task autonomous readiness:** ~25%
- **Overnight autonomous readiness:** ~25%

# Failure Modes

## Technical risks

- Legacy `run-opencode-worker.mjs` contains a `hasGitChanges` function using `require` inside an ES module. If executed in that path, this may fail because `require` is not defined in ESM.
- `run-opencode-worker.mjs` depends on external `opencode` CLI behavior, model availability, Windows spawn quirks, and sentinel compliance by the model.
- `select-model.mjs` depends on external `codex` CLI and LLM JSON output quality.
- `roadmap-parser.mjs` only recognizes limited task ID formats and does not parse `RALPH-*` tasks from ROADMAP if introduced there.
- `run-milestone.mjs` uses `.agent/config.json`, while the structured Ralph config is `.agent/config/loop-config.json`; configuration split can cause surprising behavior.
- `.agent/state.json` is stale and can mislead legacy flow.
- `.agent/out` artifacts are transient and not visible in the initial listed repository tree, increasing risk of stale/missing artifact behavior.
- Verification parsing is marker-based (`✅ ERFOLGREICH`, `❌ FEHLGESCHLAGEN`) rather than structured JSON.

## Governance risks

- ROADMAP is planning authority, but structured Ralph task-state currently contains only completed Ralph migration tasks and not current product tasks.
- Legacy scripts can select from ROADMAP while structured Ralph scripts select from task-state, creating dual task queues.
- `handoffs/latest-handoff.md` is a shared canonical handoff target and can be overwritten by unrelated product or Ralph tasks.
- Some runtime files record historical repairs, proving earlier synchronization drift.
- `scripts/agent/README.md` contains older statements that scripts do not run OpenCode, while later sections describe OpenCode execution; documentation is partially stale due to phased evolution.

## Safety risks

- Protected-file constraints are documented and configured, but not uniformly enforced by all legacy scripts before worker execution.
- Worker prompts instruct safety but cannot guarantee compliance by the model/tool.
- No automatic secret scanner was observed in the executable pipeline.
- No robust allowlist-based file-system sandbox exists for worker edits.
- `run-milestone.mjs` deletes `.agent/out` artifacts; intended but could erase useful debugging evidence before review.
- Network/dependency safety is policy-based; not strongly enforced at process level.

## State corruption risks

- No atomic transaction for updating task-state, current-run, histories, validation results, handoff, and reports together.
- JSONL append schemas are inconsistent and may become hard to consume deterministically.
- Current-run can represent completed latest run rather than active lock, making stale-active-run detection ambiguous.
- Task attempt counts are not automatically incremented by all executors.
- Done-without-validation detection exists in morning review logic but is not a blocking state-transition guard.
- Concurrent agents could write shared files without locking.

# Ralph V2 Target Architecture

## Target architecture

Ralph V2 should consolidate the ecosystem into a single structured coordinator around repository state, with legacy `.agent/out` scripts reduced to adapter utilities.

Recommended components:

1. **Coordinator CLI**
   - New single entrypoint, e.g. `scripts/agent/ralph.mjs` or `scripts/agent/run-ralph-loop.mjs`.
   - Owns task selection, run locking, lifecycle transitions, validation dispatch, handoff generation, and review stop.

2. **Task Registry Adapter**
   - Reads `ROADMAP.md` as planning authority.
   - Reads/writes `tasks/task-state.json` as runtime authority.
   - Provides reconciliation: detect tasks in ROADMAP not in task-state, stale statuses, duplicate IDs, and completed runtime tasks not reflected in ROADMAP.

3. **State Store / Transaction Layer**
   - Single module for atomic-ish updates to:
     - `tasks/task-state.json`
     - `tasks/task-history.jsonl`
     - `runs/current-run.json`
     - `runs/run-history.jsonl`
     - `validation/validation-results.jsonl`
     - `handoffs/latest-handoff.md`
   - Uses temp-file writes and append-only event schema validation.

4. **Safety Engine**
   - Reads `.governance/SAFETY.md` and `.agent/config/protected-files.json`.
   - Enforces allowed_files, forbidden_files, protected patterns, dirty working-tree policy, max diff size, max changed files, no secrets, no dependency drift.

5. **Selector**
   - Builds on `select-next-ralph-task.mjs`.
   - Adds dependencies, ROADMAP order reconciliation, review approval requirement, and task-type classification.

6. **Prompt Builder**
   - Generates task-specific worker prompts from structured task/run state rather than legacy `.agent/out/selected-task.json`.
   - Includes allowed/forbidden files and exact verification requirements.

7. **Worker Adapter Interface**
   - Standard interface for Cline, OpenCode, Roo, Codex.
   - OpenCode wrapper can remain the first executable adapter.
   - Adapter must report structured result JSON, changed files, and sentinel evidence.

8. **Validator**
   - Implements `VERIFY.md` decision table and `validation/validation-rules.json` enforcement.
   - Emits structured validation results JSON/JSONL.
   - Supports docs-only, governance-only, test-only, product/runtime, edge/supabase, dependency categories.

9. **Reviewer Gate**
   - Records review-required status in task-state/current-run.
   - Supports explicit human approval/rejection/revision records before next task can start.

10. **Commit Gate**
   - Initially manual only.
   - Later optional auto-commit after human approval with staged allowlist, secret scan, diff summary, and no push.

11. **Morning Review / Dashboard**
   - Reuse `generate-morning-review.mjs` but feed it normalized state and review outcomes.

## Minimal viable orchestration flow

1. Preflight:
   - Read governance files.
   - Check clean working tree or allowed dirty state.
   - Validate JSON/JSONL state files.
   - Reconcile ROADMAP and task-state.

2. Select exactly one task:
   - Use structured task-state plus ROADMAP order.
   - Require no active unreviewed run.
   - Write run lock to `runs/current-run.json`.
   - Append run_started and task_started events.

3. Build prompt:
   - Include task ID, objective, allowed files, forbidden files, verification requirements, stop conditions, and handoff schema.

4. Execute worker:
   - Run adapter with timeout and output capture.
   - Track changed files after execution.
   - Stop immediately if forbidden/protected files changed.

5. Validate:
   - Determine category from changed files and task metadata.
   - Run required VERIFY.md checks.
   - Emit structured validation event.

6. Handoff:
   - Generate `handoffs/latest-handoff.md` from run data, changed files, validation results, known issues, and human review status.

7. State update:
   - If validation passes, set task `needs_review` or `done` depending policy.
   - If validation fails, set `needs_validation` or `failed` based attempts.
   - Append all histories.

8. Stop:
   - Always stop for human review in V2 MVP.
   - Do not continue to next task automatically until review outcome is recorded.

# Recommended Ralph Roadmap

## RALPH-001 — Discovery

Status recommendation: complete when `reports/RALPH-001_DISCOVERY.md` exists and requested git status check is run.

Scope:

- Current task: complete ecosystem discovery.

## RALPH-002 — State Model Unification Plan

Scope:

- Define one canonical Ralph V2 state model.
- Specify how ROADMAP, task-state, current-run, histories, validation, and handoff synchronize.
- Define normalized event schemas.
- Define review outcome schema.

Dependency: RALPH-001.

## RALPH-003 — Runtime State Validator

Scope:

- Implement read-only validation of task-state/current-run/history/validation/handoff consistency.
- Detect stale `.agent/state.json`, mismatched current-run, invalid JSONL schemas, done-without-validation, and active-run conflicts.

Dependency: RALPH-002.

## RALPH-004 — ROADMAP ↔ Task-State Reconciler

Scope:

- Read ROADMAP and task-state.
- Report discrepancies.
- Initially read-only; later optional write mode with human approval.

Dependency: RALPH-003.

## RALPH-005 — Transactional State Transition Module

Scope:

- Centralize writes to task-state, current-run, histories, validation results, and handoff.
- Use temp-file writes and append-only event helpers.

Dependency: RALPH-003.

## RALPH-006 — Category-Aware Validator

Scope:

- Implement VERIFY.md decision table in code.
- Generate structured validation result objects.
- Support docs-only/report-only, governance-only, test-only, runtime-code, edge, and dependency categories.

Dependency: RALPH-005.

## RALPH-007 — Canonical Handoff Generator

Scope:

- Generate `handoffs/latest-handoff.md` from current-run, git diff, validation results, and task metadata.
- Archive previous handoffs if needed.

Dependency: RALPH-005 and RALPH-006.

## RALPH-008 — Safety Engine Enforcement

Scope:

- Implement protected-file and forbidden-action enforcement against actual git diff and task allowlists.
- Add secret scan and package drift checks.

Dependency: RALPH-005.

## RALPH-009 — V2 Coordinator Dry Run

Scope:

- Implement read-only coordinator that selects a task, simulates lifecycle, validates state, and reports next action.

Dependency: RALPH-004, RALPH-006, RALPH-008.

## RALPH-010 — V2 Single-Task Execution Without Commit

Scope:

- Execute one task using structured current-run, worker adapter, validator, handoff, and review gate.
- No commit/push.

Dependency: RALPH-009.

## RALPH-011 — Review Outcome Recorder

Scope:

- Add explicit human approval/rejection/revision recording.
- Prevent next task if previous run requires review.

Dependency: RALPH-010.

## RALPH-012 — Controlled Multi-Task Dry Run

Scope:

- Simulate multiple tasks without worker execution.
- Validate stop conditions and review requirements.

Dependency: RALPH-011.

## RALPH-013 — Controlled Multi-Task Execution With Review Stops

Scope:

- Execute multiple tasks only when previous review is approved.
- Still no automatic commit/push.

Dependency: RALPH-012.

## RALPH-014 — Commit Safety Plan

Scope:

- Design safe no-push commit workflow: staged allowlist, diff summary, secret scan, validation evidence, human approval.

Dependency: RALPH-011.

## RALPH-015 — Optional Auto-Commit After Human Approval

Scope:

- Implement commit-only, no-push workflow after explicit review approval.

Dependency: RALPH-014.

## RALPH-016 — Overnight Readiness Gate

Scope:

- Define and test overnight criteria: clean state, approved queue, max tasks, rollback strategy, review report, no pushes, no protected file changes.

Dependency: RALPH-013 and RALPH-015.

# Recommended First Implementation

The first implementation after this discovery should be **RALPH-002 — State Model Unification Plan**, not code execution.

Reason:

- The main blocker is not lack of scripts; it is fragmented state ownership and synchronization.
- Legacy ROADMAP-driven `.agent/out` orchestration and structured `tasks/`/`runs/` Ralph state currently coexist without a single coordinator.
- `.agent/state.json` is stale, `handoffs/latest-handoff.md` is shared with product work, and historical state repair was already needed.

Recommended RALPH-002 deliverable:

- A plan under `plans/` defining:
  - canonical Ralph V2 lifecycle states,
  - event schemas for task/run/validation/review,
  - synchronization rules between ROADMAP and task-state,
  - active-run locking rules,
  - handoff ownership and archival rules,
  - migration strategy from legacy `.agent/out` orchestration to structured runtime state,
  - explicit stop conditions for V2.

Recommended success criteria:

- No code execution changes.
- No product code changes.
- No ROADMAP edits unless explicitly approved.
- Clear implementation-ready design for a runtime state validator and transaction module.
