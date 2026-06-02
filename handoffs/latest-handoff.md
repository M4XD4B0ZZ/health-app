# RALPH-034K Handoff: Worker Adapter Simulator

## Run / Task Identity and Status

**Task ID:** RALPH-034K
**Title:** Worker Adapter Simulator
**Status:** implemented, pending human review
**Mode:** ACT MODE

## What Changed

Implemented a planning-only worker adapter simulator that consumes a human-authored queue JSON file, internally reuses the RALPH-034J worker invocation contract simulator, and produces deterministic adapter route simulations only for entries with `contract_created: true`.

For all other tasks, the simulator returns `adapter_simulation_created: false` and `adapter_route_disposition: "not_eligible_no_contract"`.

For current created RALPH-034J contracts, adapter routing is blocked by authorization and returns `adapter_route_disposition: "blocked_by_authorization"`. No route is executable.

Each created adapter route includes route/source IDs, worker type placeholder, adapter family/name placeholders, provider/model placeholders, placeholder-only routing strategy, inert routing decision, inert adapter binding, authorization enforcement details, and explicit non-authorization fields.

## Why Changed

RALPH-034J could produce future-worker invocation contract payload previews, but there was no deterministic answer to:

> Given a RALPH-034J invocation contract preview, how would a future adapter routing layer classify it without selecting or invoking a real adapter?

RALPH-034K adds that next safe planning layer without invoking workers, adapters, providers, models, prompts, queued tasks, validation commands, network endpoints, runtime/evidence state, product work, commits, or pushes.

## Changed Files

1. `scripts/agent/lib/overnight-worker-adapter-simulator.mjs`
   - Added pure planning-only adapter simulator library.
   - Imports and reuses `buildWorkerInvocationContractSimulation` from RALPH-034J.
   - Creates adapter route simulations only for `contract_created: true` entries.
   - Produces `not_eligible_no_contract` for non-created contracts.
   - Produces `blocked_by_authorization` for current non-authorizing contracts.
   - Preserves zero/false execution counters and explicit non-authorization fields.

2. `scripts/agent/overnight-worker-adapter-simulator.mjs`
   - Added CLI with JSON output by default and `--pretty` support.
   - Reads only an explicitly supplied queue JSON file.
   - Rejects execution, worker, adapter, provider, model, prompt, diff, write, commit, and push flags.

3. `scripts/agent/__tests__/overnight-worker-adapter-simulator.test.mjs`
   - Added focused tests for adapter simulation creation, non-created handling, mandatory fields, placeholder-only behavior, blocked authorization, zero counters, no writes, CLI flag rejection, pretty output safety language, and no imports/use of execution, network, or artifact writer layers.

4. `.agent/overnight/README.md`
   - Updated current phase to RALPH-034K.
   - Documented worker adapter simulation and safety output.
   - Added hard-limit statements that adapter route simulations do not authorize execution or invocation.

5. `.agent/overnight/OPERATOR_GUIDE.md`
   - Updated current phase to RALPH-034K.
   - Added Mode 0.875: Worker Adapter Simulation.
   - Documented route fields, rejected flags, non-authorization semantics, and remaining missing gates.

6. `handoffs/latest-handoff.md`
   - Updated this handoff.

## Safety Boundaries

Preserved boundaries:

- No queued tasks executed.
- No queue objectives executed.
- No queue `allowed_commands` executed.
- No raw queue command strings executed.
- No validation commands executed by RALPH-034K.
- No prompt text executed.
- No workers invoked.
- No adapters invoked.
- No providers invoked.
- No models invoked.
- No network activity performed.
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

- `git --no-pager status --short` — pass, only approved RALPH-034K files modified/untracked
- `git --no-pager diff --stat` — pass, tracked documentation/handoff diff shown
- `git --no-pager diff --name-only` — pass, tracked modified files listed
- `node --check scripts/agent/lib/overnight-worker-adapter-simulator.mjs` — pass
- `node --check scripts/agent/overnight-worker-adapter-simulator.mjs` — pass
- `node --test scripts/agent/__tests__/overnight-worker-adapter-simulator.test.mjs` — pass, 11/11 tests
- `node --test scripts/agent/__tests__/overnight-worker-invocation-contract-simulator.test.mjs` — pass, 11/11 tests
- `node --test scripts/agent/__tests__/overnight-worker-envelope-planner.test.mjs` — pass, 10/10 tests
- `node scripts/agent/validate-ralph-state.mjs` — pass, status ok, 0 critical findings, 38 warnings
- `node scripts/agent/reconcile-roadmap-task-state.mjs` — pass, status ok, 0 critical findings, 1 warning

## Validation Result

Passed. Validator/reconciler warnings are pre-existing governance/state alignment warnings or non-blocking handoff/run mismatch warnings; both commands reported status `ok` and 0 critical findings.

Initial `git --no-pager status --short` after edits showed only approved RALPH-034K files:

- `.agent/overnight/OPERATOR_GUIDE.md`
- `.agent/overnight/README.md`
- `handoffs/latest-handoff.md`
- `scripts/agent/__tests__/overnight-worker-adapter-simulator.test.mjs`
- `scripts/agent/lib/overnight-worker-adapter-simulator.mjs`
- `scripts/agent/overnight-worker-adapter-simulator.mjs`

No runtime/evidence files changed. No product files changed. No report/run-log artifacts were created by the simulator tests or CLI checks.

## Known Issues / Risks

No known implementation risks at handoff draft time. Real worker invocation, worker adapter implementation, adapter invocation, provider/model invocation, prompt execution, queued task execution, diff/change monitoring, post-worker review gate implementation, runtime/evidence mutation, commits, and pushes remain out of scope and require separate approved tasks.

## Human Review Status

Human review required before any follow-up task. Do not proceed to worker invocation, adapter invocation, provider/model invocation, prompt execution, validation execution, queued task execution, runtime mutation, evidence mutation, commits, or pushes from RALPH-034K.