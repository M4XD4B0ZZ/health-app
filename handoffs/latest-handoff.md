# RALPH-034L Handoff: Change / Diff Monitoring Simulator

## Run / Task Identity and Status

**Task ID:** RALPH-034L
**Title:** Change / Diff Monitoring Simulator
**Status:** implemented and verified, pending human review
**Mode:** ACT MODE

## What Changed

Implemented a planning-only, non-authoritative, non-mutating change/diff monitoring simulator that consumes an explicitly supplied hypothetical change-set JSON file and evaluates allowed-file compliance, forbidden-file violations, protected-file violations, file-count thresholds, diff-line thresholds, review triggers, validation-category implications, and safety invariants.

The simulator emits `would_pass`, `would_require_review`, or `would_block` with reason codes such as `scope_violation`, `forbidden_file`, `protected_file`, `threshold_exceeded`, `invalid_input`, `review_policy_trigger`, and `category_escalation`.

The simulator does not read git diff, read git status, ingest worker output as authority, execute workers/adapters/providers/models/prompts, execute queued tasks, run validation commands, apply changes, mutate runtime/evidence state, write reports/run logs, stage, commit, or push.

## Why Changed

RALPH-034K could produce planning-only future adapter route simulations, but there was no deterministic answer to:

> Given a RALPH-034J invocation contract preview, how would a future adapter routing layer classify it without selecting or invoking a real adapter?

The next missing control point was:

> If a future worker produced a hypothetical change-set, how would RALPH classify, constrain, and evaluate those changes without executing a worker today?

RALPH-034L adds that safe planning layer without invoking workers, adapters, providers, models, prompts, queued tasks, validation commands, network endpoints, runtime/evidence state, product work, commits, or pushes.

## Changed Files

1. `scripts/agent/lib/overnight-change-diff-simulator.mjs`
   - Added pure planning-only change/diff simulator library.
   - Exports `buildChangeDiffSimulation`, `classifyChangedFile`, `evaluateScope`, `evaluateThresholds`, `simulateReviewGate`, and `formatChangeDiffSimulationPretty`.
   - Evaluates hypothetical change sets against constraints without reading git or executing commands.
   - Preserves zero/false execution counters and explicit non-authorization fields.

2. `scripts/agent/overnight-change-diff-simulator.mjs`
   - Added CLI with JSON output by default and `--pretty` support.
   - Reads only an explicitly supplied hypothetical change-set JSON file.
   - Rejects execution, worker, adapter, provider, model, prompt, diff/apply, validation, write, commit, stage, and push flags.

3. `scripts/agent/__tests__/overnight-change-diff-simulator.test.mjs`
   - Added focused tests for allowed changes, scope violations, forbidden/protected files, thresholds, review triggers, invalid input, category classification, safety counters, CLI flag rejection, pretty output safety language, helper evaluation, and pattern matching.

4. `.agent/overnight/README.md`
   - Updated current phase to RALPH-034L.
   - Documented change/diff monitoring simulation and safety output.
   - Added hard-limit statements that change/diff simulations do not authorize file changes, execution, validation, review acceptance, commits, or pushes.

5. `.agent/overnight/OPERATOR_GUIDE.md`
   - Updated current phase to RALPH-034L.
   - Added Mode 0.9375: Change / Diff Monitoring Simulation.
   - Documented dispositions, reason codes, rejected flags, non-authorization semantics, and remaining real-diff scope boundaries.

6. `handoffs/latest-handoff.md`
   - Updated this handoff.

## Safety Boundaries

Preserved boundaries:

- No queued tasks executed.
- No queue objectives executed.
- No queue `allowed_commands` executed.
- No raw queue command strings executed.
- No validation commands executed by RALPH-034K.
- No validation commands executed by RALPH-034L.
- No prompt text executed.
- No workers invoked.
- No adapters invoked.
- No providers invoked.
- No models invoked.
- No network activity performed.
- No git diff or git status read by the simulator.
- No hypothetical changes applied.
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

- `node --check scripts/agent/lib/overnight-change-diff-simulator.mjs` — pass
- `node --check scripts/agent/overnight-change-diff-simulator.mjs` — pass
- `node --test scripts/agent/__tests__/overnight-change-diff-simulator.test.mjs` — pass, 12/12 tests
- `node scripts/agent/validate-ralph-state.mjs` — pass, status ok, 0 critical findings, 38 warnings
- `node scripts/agent/reconcile-roadmap-task-state.mjs` — pass, status ok, 0 critical findings, 1 warning
- `git --no-pager status --short` — pass, only approved RALPH-034L files modified/untracked
- `git --no-pager diff --stat` — pass, tracked documentation/handoff diff shown
- `git --no-pager diff --name-only` — pass, tracked modified files listed

## Validation Result

Passed. Validator/reconciler warnings are pre-existing governance/state alignment warnings or non-blocking handoff/run mismatch warnings; both commands reported status `ok` and 0 critical findings.

Initial `git --no-pager status --short` after edits showed only approved RALPH-034L files:

- `.agent/overnight/OPERATOR_GUIDE.md`
- `.agent/overnight/README.md`
- `handoffs/latest-handoff.md`
- `scripts/agent/__tests__/overnight-change-diff-simulator.test.mjs`
- `scripts/agent/lib/overnight-change-diff-simulator.mjs`
- `scripts/agent/overnight-change-diff-simulator.mjs`

No runtime/evidence files changed. No product files changed. No report/run-log artifacts were created by the simulator tests or CLI checks.

## Known Issues / Risks

Real worker invocation, worker adapter implementation, adapter invocation, provider/model invocation, prompt execution, queued task execution, real git diff monitoring, applying change sets, post-worker review gate implementation, runtime/evidence mutation, commits, and pushes remain out of scope and require separate approved tasks.

## Human Review Status

Human review required before any follow-up task. Do not proceed to worker invocation, adapter invocation, provider/model invocation, prompt execution, validation execution, queued task execution, real diff monitoring, applying changes, runtime mutation, evidence mutation, commits, or pushes from RALPH-034L.