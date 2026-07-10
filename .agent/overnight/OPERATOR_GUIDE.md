# RALPH Overnight Worker v1 — Operator Guide

## Purpose

This guide explains how to safely operate the RALPH Autonomous Overnight Worker v1 validation-only dry-run orchestrator.

**Current phase:** RALPH-034T — Supervised Docs-Only Executor

**What this system does:**

- Validates human-authored overnight queues
- Executes only mapped validation/check commands
- Produces non-authoritative operational reports and run logs
- Preserves all safety invariants (no queued task execution, no worker invocation, no runtime mutation)
- Simulates future worker intake decisions without executing or authorizing work
- Proposes bounded future-worker envelopes for `would_accept` tasks without executing or authorizing work
- Produces future-worker invocation contract payload previews for created envelopes without executing or authorizing work
- Simulates future worker adapter routing for created invocation contracts without selecting, invoking, or authorizing adapters, providers, models, prompts, tasks, validation commands, or network activity
- Simulates hypothetical change/diff monitoring without reading git diff/status, applying changes, or authorizing review acceptance
- Simulates post-change review-gate outcomes from RALPH-034L change/diff simulations without accepting review, recording evidence, executing validation, or authorizing mutation
- Simulates validation approval-gate requirements from RALPH-034M output without running validation, recording evidence, accepting review, authorizing approval, or mutating state
- Simulates runtime/evidence transition requirements from RALPH-034N output without writing runtime state, writing evidence, accepting review, executing validation, or authorizing mutation
- Simulates approval readiness from hypothetical RALPH-034P human approval checkpoint simulations without making approval decisions, recording approvals, writing evidence, mutating runtime state, executing validation, accepting review, invoking workers/adapters/providers/models/prompts, performing network activity, or authorizing git actions
- Simulates first supervised docs-only execution capability eligibility from RALPH-034Q approval readiness output without granting execution, writing files, invoking workers/adapters/providers/models/prompts, running validation, accepting review, mutating runtime/evidence state, staging, committing, or pushing
- Executes the first supervised docs-only create capability only when an explicit RALPH-034T input is supplied and `--write-docs-only` is passed; dry-run remains the default

**What this system does NOT do:**

- Execute queued task objectives
- Execute queue `allowed_commands`
- Execute validation commands during queue acceptance simulation
- Invoke workers or models
- Mutate runtime/evidence state
- Perform product work
- Commit or push changes
- Accept arbitrary output paths
- Treat `would_accept` as execution authorization
- Treat a worker envelope or prompt proposal as execution authorization
- Treat an invocation contract preview as worker, prompt, task, validation, commit, or push authorization
- Treat an adapter route simulation as adapter, worker, provider/model, prompt, task, validation, network, commit, or push authorization
- Treat a change/diff monitoring simulation as file-change, validation, review-acceptance, runtime/evidence mutation, commit, or push authorization
- Treat a post-change review-gate simulation as review acceptance, review evidence, validation evidence, validation execution, runtime/evidence mutation, commit, or push authorization
- Treat a validation approval-gate simulation as approval, review acceptance, review evidence, validation evidence, validation execution, runtime/evidence mutation, stage, commit, or push authorization
- Treat a runtime/evidence transition simulation as approval, runtime transition, evidence transition, validation execution, review acceptance, validation evidence, review evidence, task-history, run-history, stage, commit, or push authorization
- Treat an approval readiness simulation as approval, approval readiness authorization, approval recording, approval evidence, review acceptance, validation execution, evidence recording, runtime mutation, worker/adapter/provider/model/prompt invocation, network activity, stage, commit, or push authorization
- Treat an execution capability gate simulation as execution authorization, docs-only execution authorization, file-change authorization, validation execution, review acceptance, runtime/evidence mutation, worker/adapter/provider/model/prompt invocation, stage, commit, or push authorization
- Use the docs-only executor for anything other than one explicit `create_markdown_file` operation targeting a direct `docs/<file>.md`, `plans/<file>.md`, or `reports/<file>.md` path

---

## Canonical Orchestrator

The **overnight validation executor** is the canonical end-to-end dry-run orchestrator:

```
scripts/agent/overnight-validation-executor.mjs
```

This CLI combines all RALPH-034A through RALPH-034F components into one safe operator-facing command.

---

## Usage Modes

### Mode 0: Queue Acceptance Simulation (Planning-Only)

**Use case:** Decide which queued tasks a hypothetical future worker would accept, require review for, keep human-only, reject, or forbid at intake.

**Command:**

```powershell
node scripts/agent/overnight-queue-simulator.mjs <queue.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-queue-simulator.mjs <queue.json> --pretty
```

**Behavior:**

- Reads the supplied human-authored queue JSON file
- Reuses queue validation and validation-plan/check mapping
- Classifies each queued task into one of five dispositions
- Outputs JSON by default or a human-readable summary with `--pretty`
- **Runs no validation commands**
- **Executes no queued task objectives**
- **Invokes no workers/models**
- **Writes no files**

**Dispositions:**

- `would_accept` — passes future worker intake simulation only; does not authorize execution
- `would_require_review` — may be theoretically executable later but requires human review/approval first
- `human_only` — must remain human-only and must not be autonomously executed
- `would_reject` — invalid, unsafe, incomplete, unmapped/blocked, or policy-conflicting
- `forbidden` — explicitly unsafe or forbidden and must never be executable

---

### Mode 0.5: Worker Envelope Planning (Planning-Only)

**Use case:** Review the exact bounded envelope that would constrain a future worker if a `would_accept` task were ever separately authorized for supervised invocation.

**Command:**

```powershell
node scripts/agent/overnight-worker-envelope-planner.mjs <queue.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-worker-envelope-planner.mjs <queue.json> --pretty
```

**Behavior:**

- Reads the supplied human-authored queue JSON file
- Reuses RALPH-034H queue acceptance simulation
- Creates worker envelope proposals only for `would_accept` tasks
- Marks all other dispositions with `envelope_created: false`
- Emits JSON by default or a human-readable summary with `--pretty`
- **Runs no validation commands**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/models**
- **Writes no files**

**Created envelope fields include:**

- `task_id`
- accepted disposition source
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
- `human_review_required: true`
- `final_human_review_required: true`
- explicit non-authorization statement

**Important:** A worker envelope is a planning artifact only. It is not a worker invocation request, not a prompt execution request, not queued task execution, and not authorization for commits, pushes, runtime mutation, evidence mutation, validation execution, product work, report writing, or run-log writing.

---

### Mode 0.75: Worker Invocation Contract Simulation (Planning-Only)

**Use case:** Review the exact structured payload preview that would be passed to a future worker adapter if a created RALPH-034I envelope were ever separately approved for supervised invocation.

**Command:**

```powershell
node scripts/agent/overnight-worker-invocation-contract-simulator.mjs <queue.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-worker-invocation-contract-simulator.mjs <queue.json> --pretty
```

**Behavior:**

- Reads the supplied human-authored queue JSON file
- Reuses RALPH-034I worker envelope planning
- Creates invocation contract previews only for entries with `envelope_created: true`
- Marks all other tasks with `contract_created: false`
- Emits JSON by default or a human-readable summary with `--pretty`
- **Runs no validation commands**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/models/providers/adapters**
- **Writes no files**

**Created contract fields include:**

- `contract_id`
- source task, queue, and synthesized envelope IDs
- accepted disposition source
- worker type placeholder
- model/provider/model-name placeholders
- adapter binding with no command, endpoint, or callable invocation function
- prompt payload preview with `prompt_execution_authorized: false`
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
- `execution_authorized: false`
- `worker_invocation_authorized: false`
- `prompt_execution_authorized: false`
- final and post-worker human review requirements
- explicit non-authorization statement

**Important:** A worker invocation contract preview is a planning artifact only. It is not a worker invocation request, not a prompt execution request, not queued task execution, not validation execution, and not authorization for file changes, commits, pushes, runtime mutation, evidence mutation, product work, report writing, run-log writing, dependency changes, external side effects, or adapter execution.

---

### Mode 0.875: Worker Adapter Simulation (Planning-Only)

**Use case:** Review how a future adapter routing layer would classify created RALPH-034J invocation contracts without selecting or invoking any real adapter, provider, model, prompt, task, validation command, or network endpoint.

**Command:**

```powershell
node scripts/agent/overnight-worker-adapter-simulator.mjs <queue.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-worker-adapter-simulator.mjs <queue.json> --pretty
```

**Behavior:**

- Reads the supplied human-authored queue JSON file
- Reuses RALPH-034J worker invocation contract simulation
- Creates adapter route simulations only for entries with `contract_created: true`
- Marks all other tasks with `adapter_simulation_created: false` and `adapter_route_disposition: "not_eligible_no_contract"`
- Current created contracts route to `adapter_route_disposition: "blocked_by_authorization"`
- Emits JSON by default or a human-readable summary with `--pretty`
- **Runs no validation commands**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Performs no network activity**
- **Writes no files**

**Created adapter route fields include:**

- `route_id`
- `source_contract_id`
- `source_task_id`
- `worker_type_placeholder`
- `adapter_family_placeholder`
- `adapter_name_placeholder`
- `provider_placeholder`
- `model_placeholder`
- `routing_strategy: "placeholder_only_no_selection"`
- `routing_decision` with no selected adapter/provider/model
- inert `adapter_binding` with no command, endpoint, URL, or callable function
- `authorization_enforcement`
- `non_authorization_statement`
- `execution_authorized: false`
- `worker_invocation_authorized: false`
- `adapter_invocation_authorized: false`
- `prompt_execution_authorized: false`

**Important:** A worker adapter route simulation is a planning artifact only. It is not an adapter invocation request, not a worker invocation request, not a provider/model invocation request, not a prompt execution request, not queued task execution, not validation execution, not network activity, and not authorization for file changes, commits, pushes, runtime mutation, evidence mutation, product work, report writing, run-log writing, dependency changes, external side effects, or adapter execution.

---

### Mode 0.9375: Change / Diff Monitoring Simulation (Planning-Only)

**Use case:** Review how RALPH would classify a hypothetical future worker change-set against allowed files, forbidden files, protected files, file-count thresholds, diff-line thresholds, review triggers, and validation-category implications without executing a worker or reading a real git diff.

**Command:**

```powershell
node scripts/agent/overnight-change-diff-simulator.mjs <change-set.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-change-diff-simulator.mjs <change-set.json> --pretty
```

**Behavior:**

- Reads only the supplied hypothetical change-set JSON file
- Evaluates allowed-file compliance
- Evaluates forbidden/protected-file violations
- Evaluates `max_files_changed` and `max_diff_lines`
- Simulates review triggers and validation-category implications
- Emits JSON by default or a human-readable summary with `--pretty`
- **Does not read git diff or git status**
- **Does not ingest worker output as authority**
- **Does not apply or write changes**
- **Runs no validation commands**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Performs no network activity**
- **Writes no files**

**Top-level dispositions:**

- `would_pass` — hypothetical change-set stays within monitoring constraints; still does not authorize execution or review acceptance
- `would_require_review` — no blocking violation detected, but review triggers or category escalation require manual review
- `would_block` — invalid input, scope violation, forbidden/protected file, or threshold violation blocks the hypothetical change-set

**Reason codes include:**

- `scope_violation`
- `forbidden_file`
- `protected_file`
- `threshold_exceeded`
- `invalid_input`
- `review_policy_trigger`
- `category_escalation`

**Important:** A change/diff monitoring simulation is a planning artifact only. It is not file-change authorization, not worker execution, not adapter execution, not validation execution, not review acceptance, not runtime/evidence mutation, not product work, not staging, not commit, and not push authorization.

---

### Mode 0.96875: Post-Change Review Gate Simulation (Planning-Only)

**Use case:** Review how RALPH would classify a hypothetical RALPH-034L change/diff simulation at the post-change review gate without accepting review, recording evidence, running validation, invoking workers/adapters/providers/models/prompts, applying changes, or reading a real git diff.

**Command:**

```powershell
node scripts/agent/overnight-post-change-review-gate-simulator.mjs <ralph-034l-simulation.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-post-change-review-gate-simulator.mjs <ralph-034l-simulation.json> --pretty
```

**Behavior:**

- Reads only the supplied RALPH-034L change/diff simulation JSON file
- Evaluates source simulation validity and RALPH-034L disposition
- Propagates blocking and review reason codes
- Enforces zero/false execution counters and planning-only safety flags
- Emits JSON by default or a human-readable summary with `--pretty`
- **Does not accept review**
- **Does not write review evidence**
- **Does not write validation evidence**
- **Runs no validation commands**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Performs no network activity**
- **Writes no files**

**Top-level dispositions:**

- `would_reject_before_review` — hard blocker detected before any future review could proceed
- `would_require_human_review` — no hard blocker detected, but manual human review would be required
- `would_be_reviewable` — low-risk hypothetical result could proceed to human review only; it is not accepted
- `invalid_input` — supplied JSON is not a valid RALPH-034L change/diff simulation object

**Always false / non-authorizing fields include:**

- `review_acceptance_authorized: false`
- `review_evidence_authorized: false`
- `validation_execution_authorized: false`
- `runtime_mutation_authorized: false`
- `commit_authorized: false`
- `push_authorized: false`
- `human_review_required: true`
- `not_review_evidence: true`
- `not_validation_evidence: true`

**Important:** A post-change review-gate simulation is a planning artifact only. It is not review acceptance, not review evidence, not validation evidence, not validation execution, not file-change authorization, not worker execution, not adapter execution, not runtime/evidence mutation, not product work, not report/run-log writing, not staging, not commit, and not push authorization.

---

### Mode 0.984375: Validation Approval Gate Simulation (Planning-Only)

**Use case:** Review what hypothetical validation requirements would need to be satisfied before any future approval could be considered, based only on RALPH-034M post-change review-gate simulator output.

**Command:**

```powershell
node scripts/agent/overnight-validation-approval-gate-simulator.mjs <ralph-034m-simulation.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-validation-approval-gate-simulator.mjs <ralph-034m-simulation.json> --pretty
```

**Behavior:**

- Reads only the supplied RALPH-034M post-change review-gate simulation JSON file
- Evaluates source simulation validity, source safety invariants, and source non-authorization claims
- Maps propagated validation categories to hypothetical VERIFY.md validation requirements
- Emits JSON by default or a human-readable summary with `--pretty`
- **Does not run validation commands**
- **Does not create validation evidence**
- **Does not create review evidence**
- **Does not accept review**
- **Does not authorize approval**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Performs no network activity**
- **Writes no files**
- **Does not stage, commit, or push**

**Top-level dispositions:**

- `invalid_input` — supplied JSON is not a valid RALPH-034M post-change review-gate simulation object
- `blocked_before_validation` — upstream review-gate or validation category findings block before validation consideration
- `validation_requirements_identified` — hypothetical validation requirements were identified; none were executed or satisfied here
- `no_future_approval_consideration` — source safety/authorization claims fail closed before approval consideration

**Requirement entries always include:**

- `execution_authorized: false`
- `executed: false`
- `passed: null`
- `evidence_created: false`
- `not_validation_evidence: true`

**Important:** A validation approval-gate simulation is a planning artifact only. It is not approval, not review acceptance, not review evidence, not validation evidence, not validation execution, not file-change authorization, not worker execution, not adapter execution, not runtime/evidence mutation, not product work, not report/run-log writing, not staging, not commit, and not push authorization.

---

### Mode 0.9921875: Runtime / Evidence Transition Simulation (Planning-Only)

**Use case:** Review what hypothetical runtime state transitions and evidence state transitions would be required before any future approved workflow could proceed, based only on RALPH-034N validation approval-gate simulator output.

**Command:**

```powershell
node scripts/agent/overnight-runtime-evidence-transition-simulator.mjs <ralph-034n-simulation.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-runtime-evidence-transition-simulator.mjs <ralph-034n-simulation.json> --pretty
```

**Behavior:**

- Reads only the supplied RALPH-034N validation approval-gate simulation JSON file
- Evaluates source simulation validity, source safety invariants, and source non-authorization claims
- Identifies hypothetical runtime state transitions and evidence state transitions only
- Emits JSON by default or a human-readable summary with `--pretty`
- **Does not write runtime state**
- **Does not write task history or run history**
- **Does not create validation evidence**
- **Does not create review evidence**
- **Does not run validation commands**
- **Does not accept review**
- **Does not authorize approval**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Performs no network activity**
- **Writes no files**
- **Does not stage, commit, or push**

**Top-level dispositions:**

- `invalid_input` — supplied JSON is not a valid RALPH-034N validation approval-gate simulation object
- `blocked_before_transition_planning` — upstream validation approval-gate findings or blocked categories prevent transition planning
- `no_future_workflow_consideration` — source safety/authorization claims fail closed before workflow consideration
- `transitions_identified` — hypothetical runtime/evidence transition requirements were identified; none were authorized or performed

**Transition entries always include:**

- `simulated_only: true`
- `mutation_authorized: false` or `evidence_authorized: false`
- `mutation_performed: false` or `evidence_written: false`
- `not_runtime_state: true` for runtime-transition previews
- non-evidence flags for evidence-transition previews

**Important:** A runtime/evidence transition simulation is a planning artifact only. It is not approval, not runtime state, not runtime mutation, not validation evidence, not review evidence, not task-history writing, not run-history writing, not validation execution, not review acceptance, not file-change authorization, not worker execution, not adapter execution, not product work, not report/run-log writing, not staging, not commit, and not push authorization.

---

### Mode 0.99609375: Approval Readiness Simulation (Planning-Only)

**Use case:** Review whether a future supervised workflow could even be considered approval-ready and identify missing approval prerequisites, based only on a hypothetical RALPH-034P human approval checkpoint simulator output.

**Command:**

```powershell
node scripts/agent/overnight-approval-readiness-simulator.mjs <ralph-034p-simulation.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-approval-readiness-simulator.mjs <ralph-034p-simulation.json> --pretty
```

**Behavior:**

- Reads only the supplied RALPH-034P human approval checkpoint simulation JSON file
- Evaluates source simulation validity, source safety invariants, checkpoint authority claims, and source non-authorization claims
- Determines hypothetical approval readiness consideration only
- Identifies missing approval prerequisites without satisfying them
- Emits JSON by default or a human-readable summary with `--pretty`
- **Does not make approval decisions**
- **Does not request, grant, or record approval**
- **Does not create approval, review, or validation evidence**
- **Does not write runtime state, task history, or run history**
- **Does not run validation commands**
- **Does not accept review**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Performs no network activity**
- **Writes no files**
- **Does not stage, commit, or push**

**Top-level dispositions:**

- `invalid_input` — supplied JSON is not a valid RALPH-034P human approval checkpoint simulation object
- `blocked_before_readiness_assessment` — upstream approval-checkpoint findings prevent readiness assessment
- `no_future_approval_readiness_consideration` — source safety, authorization, approval, or evidence claims fail closed before readiness consideration
- `not_approval_ready_missing_prerequisites` — source is structurally valid, but one or more approval prerequisites are missing
- `hypothetically_approval_ready_for_human_consideration` — all required prerequisites are represented as present in the hypothetical input; this still grants no approval and records no approval

**Missing prerequisite entries always include:**

- `required_before_approval_readiness: true`
- `present_in_source_simulation: false`
- `satisfied_by_this_simulation: false`
- `evidence_created: false`
- `approval_granted: false`
- `blocking: true`

**Important:** An approval readiness simulation is a planning artifact only. It is not approval, not an approval decision, not approval evidence, not approval recording, not review acceptance, not validation execution, not validation evidence, not review evidence, not runtime state, not runtime mutation, not task-history writing, not run-history writing, not file-change authorization, not worker execution, not adapter execution, not provider/model invocation, not prompt execution, not network activity, not product work, not report/run-log writing, not staging, not commit, and not push authorization.

---

### Mode 0.998046875: Execution Capability Gate Simulation (Planning-Only)

**Use case:** Review whether a hypothetically approval-ready task is eligible for the first future supervised docs-only execution capability, based only on RALPH-034Q approval readiness output.

**Command:**

```powershell
node scripts/agent/overnight-execution-capability-gate-simulator.mjs <ralph-034q-simulation.json>
```

**Pretty output:**

```powershell
node scripts/agent/overnight-execution-capability-gate-simulator.mjs <ralph-034q-simulation.json> --pretty
```

**Behavior:**

- Reads only the supplied RALPH-034Q approval readiness simulation JSON file
- Requires source phase `RALPH-034Q`, mode `approval_readiness_simulation_only`, and disposition `hypothetically_approval_ready_for_human_consideration`
- Requires clean source safety/non-authorization invariants
- Classifies intended changed files into direct low-authority docs/plans/reports Markdown, high-authority Markdown, forbidden execution scope, or invalid input
- Emits JSON by default or a human-readable summary with `--pretty`
- **Does not grant execution capability**
- **Does not write files**
- **Does not run validation commands**
- **Does not accept review**
- **Executes no queued task objectives**
- **Executes no prompt text**
- **Invokes no workers/adapters/providers/models**
- **Mutates no runtime/evidence state**
- **Does not stage, commit, or push**

**Top-level dispositions:**

- `invalid_input` — supplied JSON or intended changed-file scope is invalid
- `blocked_for_execution` — source readiness/safety or forbidden scope blocks future execution capability consideration
- `requires_higher_capability` — high-authority Markdown or non-first-capability Markdown scope requires a later higher capability
- `eligible_for_docs_only_execution` — direct `docs/<file>.md`, `plans/<file>.md`, or `reports/<file>.md` only; this still grants no execution authorization

**Important:** An execution capability gate simulation is a planning artifact only. It is not execution, not docs-only execution authorization, not file-change authorization, not validation execution, not review acceptance, not runtime state, not evidence, not worker execution, not adapter execution, not provider/model invocation, not prompt execution, not network activity, not product work, not report/run-log writing, not staging, not commit, and not push authorization.

---

### Mode 0.9990234375: Supervised Docs-Only Executor

**Use case:** Create exactly one direct low-authority Markdown file after a human has supplied an explicit operation JSON and a RALPH-034R source object with `eligible_for_docs_only_execution`.

**Dry-run command:**

```powershell
node scripts/agent/overnight-docs-only-executor.mjs <docs-only-operation.json>
```

**Explicit write command:**

```powershell
node scripts/agent/overnight-docs-only-executor.mjs <docs-only-operation.json> --write-docs-only
```

**Pretty output:**

```powershell
node scripts/agent/overnight-docs-only-executor.mjs <docs-only-operation.json> --pretty
```

**Behavior:**

- Reads one explicitly supplied JSON input file
- Requires embedded or supplied RALPH-034R source with phase `RALPH-034R`, mode `execution_capability_gate_simulation_only`, `valid: true`, and disposition `eligible_for_docs_only_execution`
- Requires clean RALPH-034R safety/non-authorization invariants
- Supports exactly one operation: `create_markdown_file`
- Dry-run is default and writes no files
- Write mode requires exact `--write-docs-only`
- Write mode may create exactly one direct Markdown file under `docs/<file>.md`, `plans/<file>.md`, or `reports/<file>.md`
- Refuses overwrite, nested paths, root Markdown, high-authority Markdown, protected scopes, runtime/evidence paths, product paths, package files, `.env*`, `.git/**`, staging, commits, and pushes
- Runs no validation commands and accepts no review
- Invokes no workers/adapters/providers/models/prompts
- Mutates no runtime/evidence state

**Important:** RALPH-034T is supervised and bounded. It is not a queued-task executor, not worker execution, not adapter execution, not validation execution, not review acceptance, not runtime/evidence mutation, not product work, not staging, not commit, and not push automation.

---

### Mode 1: Stdout-Only Dry-Run (Safest)

**Use case:** Manual verification, debugging, testing

**Command:**

```powershell
node scripts/agent/overnight-validation-executor.mjs <queue.json>
```

**Behavior:**

- Validates queue using RALPH-034A logic
- Maps checks using RALPH-034C logic
- Executes only mapped validation commands using RALPH-034D logic
- Outputs JSON to stdout
- **Writes no files**
- **Creates no persistent artifacts**

**Output:** JSON with orchestration metadata, validation results, safety counters

**Example:**

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json
```

---

### Mode 2: Human-Readable Summary

**Use case:** Quick operator review

**Command:**

```powershell
node scripts/agent/overnight-validation-executor.mjs <queue.json> --pretty
```

**Behavior:**

- Same as Mode 1
- Outputs human-readable summary instead of JSON
- **Writes no files**

**Output:** Compact text summary with validation status, command results, safety invariants

**Example:**

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --pretty
```

---

### Mode 3: With Operational Report

**Use case:** Persistent operational tracking, morning review

**Command:**

```powershell
node scripts/agent/overnight-validation-executor.mjs <queue.json> --write-report
```

**Behavior:**

- Same as Mode 1
- **Additionally writes non-authoritative operational report** under `.agent/overnight/reports/`
- Report includes JSON and Markdown formats by default
- Report is timestamped and queue-ID-scoped
- **Refuses to overwrite existing reports**

**Output:** JSON to stdout + report files written

**Report location:** `.agent/overnight/reports/<timestamp>_<queue-id>.{json,md}`

**Report authority:** Non-authoritative operational output (not runtime evidence)

**Example:**

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report
```

**Custom report format:**

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report --report-format json
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report --report-format md
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report --report-format json,md
```

---

### Mode 4: With Run-Log Lifecycle Tracking

**Use case:** Operational lifecycle tracking, audit trail

**Command:**

```powershell
node scripts/agent/overnight-validation-executor.mjs <queue.json> --write-run-log
```

**Behavior:**

- Same as Mode 1
- **Additionally appends non-authoritative lifecycle events** to `.agent/overnight/run-log.jsonl`
- Run log uses `ovr_` prefixed run IDs (not canonical `run_` IDs)
- Run log is append-only JSONL
- **Never overwrites or truncates existing run log**

**Output:** JSON to stdout + run-log events appended

**Run-log location:** `.agent/overnight/run-log.jsonl`

**Run-log authority:** Non-authoritative operational lifecycle log (not runtime evidence)

**Lifecycle states:** `planned`, `validation_started`, `validation_passed`, `validation_failed`, `report_written`, `completed`, `aborted`

**Example:**

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-run-log
```

---

### Mode 5: Complete Overnight Dry-Run (Report + Run-Log)

**Use case:** Full operational tracking with persistent artifacts

**Command:**

```powershell
node scripts/agent/overnight-validation-executor.mjs <queue.json> --write-report --write-run-log
```

**Behavior:**

- Same as Mode 1
- **Writes both operational report and run-log lifecycle events**
- Both outputs are non-authoritative
- Both outputs are explicitly requested via flags

**Output:** JSON to stdout + report files + run-log events

**Example:**

```powershell
node scripts/agent/overnight-validation-executor.mjs .agent/overnight/queue.json --write-report --write-run-log --pretty
```

---

## Safety Boundaries

### Hard Invariants (Always Enforced)

The orchestrator **never** performs:

- Queued task execution
- Queue objective execution
- Queue `allowed_commands` execution
- Raw queue command execution
- Worker/model invocation
- Treating queue simulator `would_accept` as execution authorization
- Treating worker envelope or prompt proposals as execution authorization
- Treating worker invocation contract previews as worker, prompt, task, validation, commit, or push authorization
- Treating worker adapter route simulations as adapter, worker, provider/model, prompt, task, validation, network, commit, or push authorization
- Treating validation approval-gate simulations as approval, review acceptance, validation execution, evidence, stage, commit, or push authorization
- Treating approval readiness simulations as approval, approval recording, approval evidence, review acceptance, validation execution, evidence recording, runtime mutation, worker/adapter/provider/model/prompt invocation, network activity, stage, commit, or push authorization
- Treating execution capability gate simulations as execution authorization, docs-only execution authorization, file-change authorization, validation execution, review acceptance, runtime/evidence mutation, worker/adapter/provider/model/prompt invocation, stage, commit, or push authorization
- Using the docs-only executor without an explicit human-authored input and `--write-docs-only` for write mode
- Runtime state mutation (`tasks/**`, `runs/**`)
- Validation evidence mutation (`validation/**`)
- Review evidence mutation (`review/**`)
- Product code changes (`src/**`)
- Dependency changes (`package.json`, `package-lock.json`)
- Commits
- Pushes
- Deploys or external side effects

### Execution Constraints

The orchestrator **only** executes:

- Mapped validation/check command IDs from the validation-only allowlist
- Through the RALPH-034B command harness (Node spawn with `shell:false`)
- With preflight/final git status cleanliness checks
- With timeout enforcement
- With structured output capture

**Current validation-only allowlist:**

- `validate_ralph_state`
- `reconcile_roadmap_task_state`
- `node_check_overnight_queue_schema`
- `node_check_overnight_dry_run_plan`
- `test_overnight_dry_run_plan`

### Output Constraints

The orchestrator **only** writes:

- Reports under `.agent/overnight/reports/` (with `--write-report`)
- Run logs to `.agent/overnight/run-log.jsonl` (with `--write-run-log`)
- **No arbitrary output paths accepted**
- **No overwrite behavior by default**

### Forbidden Flags

The orchestrator **rejects** these flags:

- `--execute`, `--run-queue`, `--worker`
- `--commit`, `--push`
- `--output`, `--report-dir`, `--run-log-path`, `--log-dir`
- `--overwrite`

The worker invocation contract simulator additionally rejects provider/model/adapter/prompt/diff flags such as:

- `--execute-prompt`, `--prompt-execute`, `--invoke-model`
- `--provider`, `--model`, `--adapter`, `--adapter-command`
- `--apply-diff`, `--write-changes`

The worker adapter simulator additionally rejects adapter/provider/model/prompt/diff flags such as:

- `--invoke-adapter`, `--adapter`, `--adapter-command`, `--adapter-endpoint`
- `--provider`, `--model`, `--invoke-model`
- `--execute-prompt`, `--prompt-execute`
- `--apply-diff`, `--write-changes`

The change/diff monitoring simulator rejects execution/write/validation/git-action flags such as:

- `--execute`, `--worker`, `--run-worker`, `--invoke-worker`
- `--adapter`, `--invoke-adapter`, `--provider`, `--model`
- `--execute-prompt`, `--apply-diff`, `--write-changes`
- `--validate`, `--run-validation`, `--write-report`, `--write-run-log`
- `--output`, `--commit`, `--push`, `--stage`

The docs-only executor rejects unsafe flags such as:

- `--worker`, `--adapter`, `--provider`, `--model`, `--prompt`
- `--validate`, `--review`, `--approve`
- `--stage`, `--commit`, `--push`, `--output`
- `--write-runtime`, `--write-evidence`, `--write-report`, `--write-run-log`

---

## Queue Requirements

### Queue Source

Queues must be:

- **Human-authored** (not auto-generated)
- **Explicitly supplied** by file path
- **Validated** before any execution

The orchestrator **never**:

- Selects tasks automatically from `ROADMAP.md`
- Infers product work from backlog state
- Generates queues autonomously

### Queue Schema

Every queue must include:

- `schema_version: "1.0.0"`
- `queue_id: "..."`
- `created_at: "..."`
- `created_by: "human-operator"`
- `mode: "dry_run"`
- `tasks: [...]`

Every task must include all required fields (see `.agent/overnight/README.md` for full schema).

### Queue Validation

The orchestrator validates:

- Queue structure and required fields
- Task classes (`SAFE_AUTONOMOUS`, `REVIEW_REQUIRED`, `HUMAN_ONLY`, `FORBIDDEN`)
- Commit/push policies (must be `never` for v1)
- Allowed/forbidden files
- Allowed/forbidden commands
- Required checks

Invalid queues **fail closed** and execute nothing.

---

## Output Interpretation

### Orchestration Metadata

Every output includes:

```json
{
  "schema_version": "1.0.0",
  "runner": "overnight-validation-executor.mjs",
  "phase": "RALPH-034G",
  "orchestration": {
    "mode": "overnight_dry_run",
    "components_used": [
      "RALPH-034A: queue validation",
      "RALPH-034C: validation plan mapping",
      "RALPH-034D: validation command execution",
      "RALPH-034E: optional report writing",
      "RALPH-034F: optional run-log writing"
    ],
    "orchestrator_role": "end_to_end_validation_dry_run"
  },
  "queue_id": "...",
  "valid": true/false,
  ...
}
```

### Safety Counters

Every output includes safety counters that **must remain zero/false**:

```json
{
  "execution_plan": {
    "queued_tasks_executed": 0,
    "worker_invocations": 0,
    "runtime_state_mutations": 0,
    "task_commands_executed": 0,
    "product_work": 0,
    "commits": false,
    "push": false
  }
}
```

**If any counter is non-zero or true, the orchestrator has violated safety invariants.**

### Validation Results

The output includes:

- `queue_validation_summary`: Queue validation findings
- `validation_plan_summary`: Check mapping results
- `preflight`: Working tree cleanliness before/after
- `command_execution`: Validation command results
- `report_summary`: Report write status (if `--write-report`)
- `run_log_summary`: Run-log write status (if `--write-run-log`)

### Exit Codes

- `0`: Success (queue valid, all validation commands passed)
- `1`: Invalid input (queue unreadable, parse error, invalid arguments)
- `2`: Not ready (queue invalid, unmapped checks, blocked checks, preflight failed)
- `3`: Command failed (validation command failed, timed out, or blocked)
- `4`: Report write failed (report writing requested but failed)
- `5`: Run-log write failed (run-log writing requested but failed)

---

## Operational Workflows

### Workflow 1: Manual Queue Verification

**Goal:** Verify a queue is valid and ready for validation execution

**Steps:**

1. Create human-authored queue JSON file
2. Run stdout-only dry-run:
   ```powershell
   node scripts/agent/overnight-validation-executor.mjs <queue.json> --pretty
   ```
3. Review output for:
   - `valid: true`
   - `validation_plan_summary.ready_for_validation_execution: true`
   - All safety counters zero/false
4. If invalid, repair queue and retry

**No files written, no persistent artifacts.**

---

### Workflow 2: Overnight Validation Run with Morning Review

**Goal:** Execute validation checks overnight and produce morning review report

**Steps:**

1. Create human-authored queue JSON file
2. Run complete overnight dry-run:
   ```powershell
   node scripts/agent/overnight-validation-executor.mjs <queue.json> --write-report --write-run-log
   ```
3. Review exit code:
   - `0`: Success
   - Non-zero: Review output for failures
4. Review report files:
   - `.agent/overnight/reports/<timestamp>_<queue-id>.json`
   - `.agent/overnight/reports/<timestamp>_<queue-id>.md`
5. Review run-log events:
   - `.agent/overnight/run-log.jsonl` (append-only)
6. Decide next human actions based on report recommendations

**Files written:** Report bundle + run-log events (both non-authoritative)

---

### Workflow 3: Debugging Failed Validation

**Goal:** Understand why validation failed

**Steps:**

1. Run stdout-only dry-run:
   ```powershell
   node scripts/agent/overnight-validation-executor.mjs <queue.json>
   ```
2. Review JSON output:
   - `preflight.critical_findings`: Preflight failures
   - `command_execution.results`: Command-level failures
   - `validation_plan_summary`: Check mapping issues
3. Inspect failed command details:
   - `stdout_preview`, `stderr_preview`
   - `exit_code`, `timed_out`, `status`
4. Repair queue or validation checks as needed
5. Retry

**No files written, no persistent artifacts.**

---

## Non-Authoritative Outputs

### Reports (RALPH-034E)

**Authority:** Non-authoritative operational output

**Purpose:** Human review, operational tracking, morning review

**Not suitable for:**

- Canonical runtime evidence
- Canonical validation evidence
- Canonical review evidence
- Automated decision-making without human review

**Location:** `.agent/overnight/reports/`

**Format:** JSON + Markdown

**Retention:** Manual cleanup required

---

### Run Logs (RALPH-034F)

**Authority:** Non-authoritative operational lifecycle log

**Purpose:** Operational audit trail, lifecycle tracking

**Not suitable for:**

- Canonical runtime evidence
- Canonical validation evidence
- Canonical review evidence
- Automated decision-making without human review

**Location:** `.agent/overnight/run-log.jsonl`

**Format:** Append-only JSONL

**Run ID prefix:** `ovr_` (not canonical `run_`)

**Retention:** Manual cleanup required

---

## What Remains Out of Scope

The following are **explicitly out of scope** for RALPH Overnight Worker v1:

### Not Implemented

- Real queued task execution
- Queue objective execution
- Queue `allowed_commands` execution
- Worker/model invocation
- Prompt execution
- Worker adapter implementation
- Worker adapter invocation or adapter route execution
- Provider/model invocation
- Network activity from adapter simulation
- Real git diff/change monitoring
- Applying hypothetical change sets
- Post-worker review gate implementation
- Runtime state mutation
- Product feature work
- Dependency changes
- Commits
- Pushes
- Deploys

### Future Work

- Autonomous queued-task executor (requires separate planning task)
- Worker invocation (requires separate planning task)
- Worker adapter implementation (requires separate planning task)
- Worker adapter invocation (requires separate planning task)
- Provider/model invocation (requires separate planning task)
- Real diff/change monitoring from actual worker output (requires separate planning task)
- Post-worker review gate implementation (requires separate planning task)
- Runtime/evidence mutation (requires separate planning task)
- Product work (requires separate planning task)
- Commit/push automation (requires separate planning task)

---

## Troubleshooting

### Queue Validation Fails

**Symptom:** `valid: false`, `preflight.critical_findings` present

**Causes:**

- Missing required queue fields
- Invalid task class
- `commit_policy` or `push_policy` not `never`
- Broad or empty `allowed_files`
- Missing baseline `forbidden_files`
- Product scope (`src/**`) while product work paused
- Unsafe command patterns (&&, heredocs, shell redirection, etc.)

**Resolution:** Repair queue JSON and retry

---

### Unmapped Checks Block Execution

**Symptom:** `validation_plan_summary.unmapped_checks > 0`, `ready_for_validation_execution: false`

**Causes:**

- Queue `required_checks` contain unknown check strings
- Check strings not in `KNOWN_CHECK_MAPPINGS`

**Resolution:**

- Review unmapped checks in output
- Update `scripts/agent/lib/overnight-validation-plan.mjs` `KNOWN_CHECK_MAPPINGS` if safe
- Or repair queue to use known check strings

---

### Blocked Checks Block Execution

**Symptom:** `validation_plan_summary.blocked_checks > 0`, `ready_for_validation_execution: false`

**Causes:**

- Mapped command ID not in command runner allowlist
- Command ID not in validation-only allowlist

**Resolution:**

- Review blocked checks in output
- Update command runner allowlist if safe
- Update validation-only allowlist if safe
- Or repair queue to use allowlisted checks

---

### Dirty Working Tree Blocks Execution

**Symptom:** `preflight.critical_findings` includes `working_tree_dirty_before_execution`

**Causes:**

- Uncommitted changes in working tree
- Untracked files

**Resolution:**

- Commit or stash changes
- Clean working tree
- Retry

---

### Validation Command Fails

**Symptom:** `command_execution.failed > 0`, `valid: false`

**Causes:**

- Validation command returned non-zero exit code
- Validation command timed out
- Validation command blocked by safety checks

**Resolution:**

- Review command result details in output
- Inspect `stdout_preview`, `stderr_preview`
- Fix underlying validation issue
- Retry

---

### Report Write Fails

**Symptom:** Exit code 4, `report_write_failed: true`

**Causes:**

- Report file already exists (refuses overwrite)
- Filesystem permissions
- Disk space

**Resolution:**

- Remove existing report files
- Check filesystem permissions
- Check disk space
- Retry

---

### Run-Log Write Fails

**Symptom:** Exit code 5, `run_log_write_failed: true`

**Causes:**

- Filesystem permissions
- Disk space
- Invalid run-log event

**Resolution:**

- Check filesystem permissions
- Check disk space
- Review run-log event structure
- Retry

---

## Safety Checklist

Before running the orchestrator, verify:

- [ ] Queue is human-authored (not auto-generated)
- [ ] Queue `mode` is `dry_run`
- [ ] Queue `commit_policy` is `never` for all tasks
- [ ] Queue `push_policy` is `never` for all tasks
- [ ] Queue `allowed_files` are specific (not broad patterns)
- [ ] Queue `forbidden_files` include baseline protections
- [ ] Queue `required_checks` are known and safe
- [ ] Working tree is clean (no uncommitted changes)
- [ ] No product work is expected (product work paused for v1)
- [ ] Operator understands outputs are non-authoritative

After running the orchestrator, verify:

- [ ] Exit code is as expected (0 for success)
- [ ] `valid` is `true` (or expected failure reason is clear)
- [ ] All safety counters are zero/false
- [ ] No queued tasks were executed
- [ ] No workers were invoked
- [ ] No runtime state was mutated
- [ ] No product work was performed
- [ ] No commits were made
- [ ] No pushes were made
- [ ] Working tree remains clean (if validation passed)
- [ ] Report files are under `.agent/overnight/reports/` (if `--write-report`)
- [ ] Run-log events are in `.agent/overnight/run-log.jsonl` (if `--write-run-log`)
- [ ] No arbitrary output paths were used

---

## Support

For questions or issues:

1. Review this operator guide
2. Review `.agent/overnight/README.md` for technical details
3. Review existing test files for usage examples
4. Review orchestrator output for detailed error messages
5. Consult RALPH governance documentation in `.governance/`

---

## Version

- **Operator Guide Version:** 1.0.0
- **Current Phase:** RALPH-034T — Supervised Docs-Only Executor
- **Validation Orchestrator Phase:** RALPH-034G
- **Foundation Phase:** RALPH-034A through RALPH-034T
- **Last Updated:** 2026-06-04
