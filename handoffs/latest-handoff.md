# RALPH-034J Handoff: Worker Invocation Contract Simulator

## Run / Task Identity and Status

**Task ID:** RALPH-034J
**Title:** Worker Invocation Contract Simulator
**Status:** implemented, pending human review
**Mode:** ACT MODE

## What Changed

Implemented a planning-only worker invocation contract simulator that consumes a human-authored queue JSON file, internally reuses the RALPH-034I worker envelope planner, and produces deterministic future-worker invocation contract payload previews only for entries with `envelope_created: true`.

For all other tasks, the simulator returns `contract_created: false`.

Each created contract includes contract/source IDs, accepted disposition lineage, worker/provider/model placeholders, a non-callable adapter binding, prompt payload preview, file/command/check boundaries, timeout policy, abort conditions, expected outputs, no-commit/no-push policy, final/post-worker human review requirements, and explicit non-authorization fields.

## Why Changed

RALPH-034I could produce bounded worker envelope proposals, but there was no deterministic answer to:

> If this envelope were ever separately approved for a future worker, what exact structured payload would be passed to the worker adapter?

RALPH-034J adds that next safe planning layer without invoking workers/models/providers/adapters, executing prompts, executing queued tasks, running validation commands, writing reports/logs, mutating runtime/evidence state, performing product work, committing, or pushing.

## Changed Files

1. `scripts/agent/lib/overnight-worker-invocation-contract-simulator.mjs`
   - Added pure planning-only simulator library.
   - Imports and reuses `buildWorkerEnvelopePlan` from RALPH-034I.
   - Creates invocation contract previews only for `envelope_created: true` entries.
   - Produces `contract_created: false` for non-created envelopes.
   - Preserves zero/false execution counters and explicit non-authorization fields.

2. `scripts/agent/overnight-worker-invocation-contract-simulator.mjs`
   - Added CLI with JSON output by default and `--pretty` support.
   - Reads only an explicitly supplied queue JSON file.
   - Rejects execution, write, provider, model, adapter, prompt, and diff flags.

3. `scripts/agent/__tests__/overnight-worker-invocation-contract-simulator.test.mjs`
   - Added focused tests for contract creation, non-created handling, mandatory fields, non-authorization, prompt-preview-only behavior, no writes, CLI flag rejection, pretty output safety language, and no imports of execution/artifact writer layers.

4. `.agent/overnight/README.md`
   - Updated current phase to RALPH-034J.
   - Documented worker invocation contract simulation and safety output.
   - Added hard-limit statements that invocation contract previews do not authorize execution.

5. `.agent/overnight/OPERATOR_GUIDE.md`
   - Updated current phase to RALPH-034J.
   - Added Mode 0.75: Worker Invocation Contract Simulation.
   - Documented contract fields, rejected flags, non-authorization semantics, and remaining missing gates.

6. `handoffs/latest-handoff.md`
   - Updated this handoff.

## Safety Boundaries

Preserved boundaries:

- No queued tasks executed.
- No queue objectives executed.
- No queue `allowed_commands` executed.
- No raw queue command strings executed.
- No validation commands executed by RALPH-034J.
- No prompt text executed.
- No workers/models/providers/adapters invoked.
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

- `node --check scripts/agent/lib/overnight-worker-invocation-contract-simulator.mjs` — pass
- `node --check scripts/agent/overnight-worker-invocation-contract-simulator.mjs` — pass
- `node --test scripts/agent/__tests__/overnight-worker-invocation-contract-simulator.test.mjs` — pass, 11/11 tests
- `node --test scripts/agent/__tests__/overnight-worker-envelope-planner.test.mjs` — pass, 10/10 tests
- `node scripts/agent/validate-ralph-state.mjs` — pass, status ok, 0 critical findings, 38 warnings
- `node scripts/agent/reconcile-roadmap-task-state.mjs` — pass, status ok, 0 critical findings, 1 warning
- `git --no-pager status --short` — pass, only approved RALPH-034J files modified/untracked
- `git --no-pager diff --stat` — pass, tracked documentation/handoff diff shown
- `git --no-pager diff --name-only` — pass, tracked modified files listed

## Validation Result

Passed. Validator/reconciler warnings are pre-existing governance/state alignment warnings or non-blocking handoff/run mismatch warnings; both commands reported status `ok` and 0 critical findings.

`git --no-pager status --short` showed only approved RALPH-034J files:

- `.agent/overnight/OPERATOR_GUIDE.md`
- `.agent/overnight/README.md`
- `handoffs/latest-handoff.md`
- `scripts/agent/__tests__/overnight-worker-invocation-contract-simulator.test.mjs`
- `scripts/agent/lib/overnight-worker-invocation-contract-simulator.mjs`
- `scripts/agent/overnight-worker-invocation-contract-simulator.mjs`

No runtime/evidence files changed. No product files changed. No report/run-log artifacts were created by the simulator tests or CLI checks.

## Known Issues / Risks

No known implementation risks at handoff draft time. Real worker invocation, worker adapter implementation, prompt execution, queued task execution, diff/change monitoring, post-worker review gate implementation, runtime/evidence mutation, commits, and pushes remain out of scope and require separate approved tasks.

## Human Review Status

Human review required before any follow-up task. Do not proceed to worker invocation, prompt execution, validation execution, queued task execution, runtime mutation, evidence mutation, commits, or pushes from RALPH-034J.