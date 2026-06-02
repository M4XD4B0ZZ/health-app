# RALPH Overnight Worker v1 — Operator Guide

## Purpose

This guide explains how to safely operate the RALPH Autonomous Overnight Worker v1 validation-only dry-run orchestrator.

**Current phase:** RALPH-034I — Worker Prompt / Execution Envelope Planner

**What this system does:**
- Validates human-authored overnight queues
- Executes only mapped validation/check commands
- Produces non-authoritative operational reports and run logs
- Preserves all safety invariants (no queued task execution, no worker invocation, no runtime mutation)
- Simulates future worker intake decisions without executing or authorizing work
- Proposes bounded future-worker envelopes for `would_accept` tasks without executing or authorizing work

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
- Runtime state mutation
- Product feature work
- Dependency changes
- Commits
- Pushes
- Deploys

### Future Work
- Autonomous queued-task executor (requires separate planning task)
- Worker invocation (requires separate planning task)
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
- **Current Phase:** RALPH-034I — Worker Prompt / Execution Envelope Planner
- **Validation Orchestrator Phase:** RALPH-034G
- **Foundation Phase:** RALPH-034A through RALPH-034I
- **Last Updated:** 2026-06-02
