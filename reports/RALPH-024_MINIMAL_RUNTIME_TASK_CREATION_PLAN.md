# RALPH-024: Minimal Runtime Task Creation Implementation Plan

**Task ID:** RALPH-024  
**Category:** Implementation Plan (Documentation-only)  
**Generated:** 2026-05-23T21:31:00Z  
**Status:** Plan complete, awaiting human review

---

## Executive Summary

This plan defines the **minimal safe implementation** for creating runtime tasks from ROADMAP.md into tasks/task-state.json. It is deliberately conservative, implementing only the smallest viable subset of the RALPH-023 design.

**Key Constraints (Human-Approved Scope Reduction):**

- Exactly one runtime task per run
- Dry-run first (default behavior)
- No batch creation
- No task-history.jsonl writes (deferred)
- No evidence writes (deferred)
- No package.json changes
- No ROADMAP changes
- No existing runtime task modifications
- No worker execution
- No run creation

**Implementation Goal:** Create the smallest script that can safely create one runtime task from ROADMAP.md into tasks/task-state.json with full safety gates and validation.

---

## 1. Context & Prerequisites

### 1.1 Foundation (RALPH-001 through RALPH-023)

**Completed Infrastructure:**

- ✅ Reconciler: `reconcile-roadmap-task-state.mjs` (green baseline, exit_code=0)
- ✅ Validator: `validate-ralph-state.mjs` (green baseline, exit_code=0)
- ✅ ROADMAP parser: Canonical parser in reconciler (reusable)
- ✅ Ownership classification: `roadmap_backed`, `runtime_only`, `roadmap_only`
- ✅ Test patterns: Established in `__tests__/reconcile-roadmap-task-state.test.mjs`

**Current State:**

- 27 ROADMAP tasks (product backlog)
- 10 runtime tasks (Ralph governance, all `runtime_only: true`)
- 0 roadmap-backed tasks (no active product execution)
- Reconciler: 0 critical, 1 warning (acceptable)
- Validator: 0 critical, 43 warnings (all legacy/non-blocking)

### 1.2 Authority Hierarchy (from SSOK.md, AGENTS.md)

| Level | Authority                          | Files                                            |
| ----- | ---------------------------------- | ------------------------------------------------ |
| 1     | Repository Governance Constitution | `SSOK.md`, `AGENTS.md`                           |
| 2     | Canonical Domain Authorities       | `ROADMAP.md`, `VERIFY.md`, `.governance/*`       |
| 3     | Runtime Execution State            | `tasks/task-state.json`, `runs/current-run.json` |

**Conflict Resolution:**

1. Safety wins first (`.governance/SAFETY.md`)
2. Canonical domain authority wins second (`ROADMAP.md` for planning)
3. Runtime state never overrides planning authority

### 1.3 Scope Reduction Rationale

RALPH-023 designed a comprehensive pipeline. Human review narrowed RALPH-024 to:

**In Scope:**

- Single task creation from ROADMAP.md
- Dry-run mode (default)
- Write mode (explicit flags required)
- Safety gates (reconciler, validator, working tree)
- Atomic write (temp file + rename)
- Schema validation

**Out of Scope (Deferred to Future Tasks):**

- Batch creation (multiple tasks per run)
- task-history.jsonl writes
- validation/review evidence writes
- package.json script registration
- run creation/management
- worker dispatch
- ROADMAP status updates
- Priority inference
- Risk inference
- allowed_files inference
- Acceptance criteria parsing

---

## 2. Script Design: create-runtime-task-from-roadmap.mjs

### 2.1 Script Name & Location

**Recommended:**

```
scripts/agent/create-runtime-task-from-roadmap.mjs
```

**Rationale:**

- Descriptive: Clearly states source (ROADMAP) and destination (runtime task)
- Consistent: Follows existing naming pattern (`reconcile-roadmap-task-state.mjs`)
- Scoped: Located in `scripts/agent/` with other Ralph tools
- Singular: Name reflects single-task creation scope

### 2.2 Core Behavior (v1)

**High-Level Algorithm:**

```
1. Parse ROADMAP.md using existing reconciler parser
2. Load tasks/task-state.json
3. Filter eligible ROADMAP tasks:
   - status = 'todo'
   - NOT already in runtime state
   - Valid task ID format
4. Select first eligible task (document order)
5. Generate runtime task object
6. Validate generated task
7. IF --write AND --confirm-write:
     Write to tasks/task-state.json atomically
   ELSE:
     Print dry-run output
8. Exit with appropriate code
```

**Key Design Decisions:**

- **Reuse reconciler parser:** Import `parseRoadmap()` from reconciler (DRY principle)
- **Single task only:** Select first eligible, create one, exit
- **Conservative defaults:** Dry-run unless explicit write flags
- **No history writes:** Defer to future task (simpler v1)
- **No ROADMAP updates:** Read-only ROADMAP (authority preservation)

### 2.3 Parser Reuse Strategy

**Import from reconciler:**

```javascript
import { parseRoadmap } from './reconcile-roadmap-task-state.mjs';
```

**Rationale:**

- Reconciler parser is canonical (RALPH-018)
- Already tested and validated
- Handles heading-style tasks correctly
- Skips checkbox references
- Extracts status, title, section, DoD/Verify text

**Alternative (if import issues):**

- Copy parser functions into new script
- Document as temporary duplication
- Plan future shared parser module

---

## 3. CLI Contract

### 3.1 Command Syntax

```bash
# Dry-run mode (default, no changes)
node scripts/agent/create-runtime-task-from-roadmap.mjs

# Dry-run with JSON output
node scripts/agent/create-runtime-task-from-roadmap.mjs --json

# Write mode (requires both flags for safety)
node scripts/agent/create-runtime-task-from-roadmap.mjs --write --confirm-write

# Help
node scripts/agent/create-runtime-task-from-roadmap.mjs --help
```

### 3.2 Flags

| Flag              | Required | Default | Purpose                                                   |
| ----------------- | -------- | ------- | --------------------------------------------------------- |
| `--write`         | No       | false   | Enable write mode (must be combined with --confirm-write) |
| `--confirm-write` | No       | false   | Confirm write intent (must be combined with --write)      |
| `--json`          | No       | false   | Output machine-readable JSON                              |
| `--help`          | No       | false   | Show help message                                         |

**Safety Design:**

- Default is dry-run (safest)
- Write requires TWO flags (prevents accidental writes)
- `--write` alone is rejected (explicit confirmation required)
- `--confirm-write` alone is rejected (explicit write intent required)

### 3.3 Exit Codes

| Code | Meaning            | When                                               |
| ---- | ------------------ | -------------------------------------------------- |
| 0    | Success            | Dry-run completed OR task created successfully     |
| 1    | Validation failure | Reconciler/validator failed, or safety gate failed |
| 2    | Creation failure   | Task creation failed (schema, write error, etc.)   |
| 3    | No eligible tasks  | No ROADMAP tasks eligible for creation             |

### 3.4 Output Formats

**Human-readable (default):**

```
Runtime Task Creation from ROADMAP

MODE: Dry-run (no changes will be made)

SAFETY CHECKS:
✓ Reconciler baseline: PASSED (exit_code=0)
✓ Validator baseline: PASSED (exit_code=0)
✓ Working tree: CLEAN
✓ Protected files: NONE MODIFIED

ELIGIBLE TASKS:
Found 15 eligible ROADMAP tasks with status 'todo'

SELECTED TASK:
  ID: P1-003
  Title: Multi-Item Split
  Status: todo → not_started
  Section: PHASE 1 > EPIC: Resolver & Normalization
  Line: 518

GENERATED RUNTIME TASK:
{
  "id": "P1-003",
  "title": "Multi-Item Split",
  "status": "not_started",
  "priority": "medium",
  "risk_level": "review_required",
  "runtime_only": false,
  "source": "roadmap_import",
  "roadmap_section": "PHASE 1 > EPIC: Resolver & Normalization",
  "roadmap_line": 518,
  "roadmap_status": "todo",
  "created_at": "2026-05-23T21:00:00Z",
  "updated_at": "2026-05-23T21:00:00Z",
  "attempt_count": 0,
  "max_attempts": 3,
  "requires_human_review": true
}

DRY-RUN: No changes made. Use --write --confirm-write to create task.
```

**JSON output (--json):**

```json
{
  "mode": "dry_run",
  "timestamp": "2026-05-23T21:00:00Z",
  "safety_checks": {
    "reconciler_baseline": "passed",
    "validator_baseline": "passed",
    "working_tree": "clean",
    "protected_files": "none"
  },
  "eligible_task_count": 15,
  "selected_task": {
    "id": "P1-003",
    "title": "Multi-Item Split",
    "roadmap_status": "todo",
    "roadmap_section": "PHASE 1 > EPIC: Resolver & Normalization",
    "roadmap_line": 518
  },
  "generated_task": {
    "id": "P1-003",
    "title": "Multi-Item Split",
    "status": "not_started",
    "priority": "medium",
    "risk_level": "review_required",
    "runtime_only": false,
    "source": "roadmap_import",
    "roadmap_section": "PHASE 1 > EPIC: Resolver & Normalization",
    "roadmap_line": 518,
    "roadmap_status": "todo",
    "created_at": "2026-05-23T21:00:00Z",
    "updated_at": "2026-05-23T21:00:00Z",
    "attempt_count": 0,
    "max_attempts": 3,
    "requires_human_review": true
  },
  "action": "dry_run_only",
  "exit_code": 0
}
```

---

## 4. Runtime Task Schema (v1)

### 4.1 Required Fields

```typescript
interface RuntimeTaskV1 {
  // Core identity
  id: string; // From ROADMAP (e.g., "P1-003")
  title: string; // From ROADMAP
  status: string; // Runtime status (see lifecycle)

  // Classification
  priority: string; // "high" | "medium" | "low"
  risk_level: string; // "safe_autonomous" | "review_required" | "human_required"
  runtime_only: boolean; // false for ROADMAP-backed tasks

  // Timestamps
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp

  // Execution control
  attempt_count: number; // Default: 0
  max_attempts: number; // Default: 3
  requires_human_review: boolean; // Default: true
}
```

### 4.2 Optional Fields (v1)

```typescript
interface RuntimeTaskV1Optional {
  // Source attribution
  source?: string; // "roadmap_import" for ROADMAP-backed
  roadmap_section?: string; // Section path from ROADMAP
  roadmap_line?: number; // Line number in ROADMAP.md
  roadmap_status?: string; // Original ROADMAP status
}
```

### 4.3 Field Generation Rules

| Field                   | Generation Rule                 | v1 Value                      |
| ----------------------- | ------------------------------- | ----------------------------- |
| `id`                    | Copy from ROADMAP task ID       | From parser                   |
| `title`                 | Copy from ROADMAP task title    | From parser                   |
| `status`                | Map from ROADMAP status         | `"not_started"` (from `todo`) |
| `priority`              | Default (no inference)          | `"medium"`                    |
| `risk_level`            | Default (no inference)          | `"review_required"`           |
| `runtime_only`          | Set to false for ROADMAP-backed | `false`                       |
| `created_at`            | Current timestamp               | `new Date().toISOString()`    |
| `updated_at`            | Same as created_at              | `new Date().toISOString()`    |
| `attempt_count`         | Initialize to 0                 | `0`                           |
| `max_attempts`          | Default based on risk           | `3`                           |
| `requires_human_review` | Default based on risk           | `true`                        |
| `source`                | Set to roadmap_import           | `"roadmap_import"`            |
| `roadmap_section`       | From parser section stack       | From parser                   |
| `roadmap_line`          | From parser line number         | From parser                   |
| `roadmap_status`        | Original ROADMAP status         | From parser                   |

### 4.4 Status Mapping

| ROADMAP Status | Runtime Status | Rationale                                      |
| -------------- | -------------- | ---------------------------------------------- |
| `todo`         | `not_started`  | Normal backlog item ready for execution        |
| `in_progress`  | N/A (skip)     | Already in progress, should have runtime state |
| `blocked`      | N/A (skip)     | Blocked tasks should not enter runtime         |
| `done`         | N/A (skip)     | Completed tasks should not be recreated        |

**v1 Simplification:** Only `todo` → `not_started` mapping. Skip all other statuses.

### 4.5 Deferred Fields (Out of Scope for v1)

**Not generated in v1:**

- `allowed_files` - Requires scope analysis
- `forbidden_files` - Requires safety analysis
- `outputs` - Requires implementation knowledge
- `validation.type` - Requires task type inference
- `validation.required_checks` - Requires DoD parsing
- `acceptance_criteria` - Requires DoD parsing
- `notes` - Requires human context

**Rationale:** These fields require complex inference or parsing logic. Defer to future enhancements to keep v1 minimal and safe.

---

## 5. Safety Gates

### 5.1 Pre-Creation Safety Checks

**All checks must pass before creating any tasks:**

| Check                    | Command                                               | Pass Criteria | Failure Action      |
| ------------------------ | ----------------------------------------------------- | ------------- | ------------------- |
| **Reconciler baseline**  | `node scripts/agent/reconcile-roadmap-task-state.mjs` | exit_code=0   | Abort, report error |
| **Validator baseline**   | `node scripts/agent/validate-ralph-state.mjs`         | exit_code=0   | Abort, report error |
| **Working tree clean**   | `git status --porcelain`                              | Empty output  | Abort, report error |
| **Protected file check** | Check `.governance/SAFETY.md` rules                   | No violations | Abort, report error |
| **Schema validation**    | Parse `tasks/task-state.json`                         | Valid JSON    | Abort, report error |

**Implementation:**

```javascript
async function runSafetyChecks() {
  const checks = {
    reconciler: false,
    validator: false,
    workingTree: false,
    protectedFiles: false,
    schema: false,
  };

  // 1. Reconciler baseline
  const reconcilerResult = spawnSync('node', ['scripts/agent/reconcile-roadmap-task-state.mjs']);
  checks.reconciler = reconcilerResult.status === 0;

  // 2. Validator baseline
  const validatorResult = spawnSync('node', ['scripts/agent/validate-ralph-state.mjs']);
  checks.validator = validatorResult.status === 0;

  // 3. Working tree clean
  const gitStatus = spawnSync('git', ['status', '--porcelain']);
  checks.workingTree = gitStatus.stdout.toString().trim() === '';

  // 4. Protected files (no changes expected at this stage)
  checks.protectedFiles = true; // No changes yet

  // 5. Schema validation
  try {
    const taskState = JSON.parse(fs.readFileSync('tasks/task-state.json', 'utf8'));
    checks.schema = Array.isArray(taskState.tasks);
  } catch {
    checks.schema = false;
  }

  return checks;
}
```

### 5.2 Creation-Time Validation

**For the selected task:**

| Validation            | Check                                                    | Failure Action       |
| --------------------- | -------------------------------------------------------- | -------------------- |
| **ID format**         | Matches `(?:P\d+-\d+\|RESOLVER-V2-\d+\|RALPH-\d+[A-Z]?)` | Skip task, log error |
| **Title presence**    | Non-empty title exists                                   | Skip task, log error |
| **Status validity**   | Status is `todo`                                         | Skip task, log info  |
| **Duplicate check**   | ID not in runtime state                                  | Skip task, log info  |
| **Schema compliance** | Generated task matches schema                            | Abort, log error     |

### 5.3 Post-Creation Verification

**After task created (write mode only):**

| Verification          | Check                         | Failure Action           |
| --------------------- | ----------------------------- | ------------------------ |
| **JSON validity**     | Parse `tasks/task-state.json` | Rollback, restore backup |
| **Schema compliance** | All tasks match schema        | Rollback, restore backup |
| **ID uniqueness**     | No duplicate IDs              | Rollback, restore backup |
| **Reconciler green**  | Reconciler still passes       | Rollback, restore backup |
| **Validator green**   | Validator still passes        | Rollback, restore backup |

**Rollback procedure:**

```javascript
async function rollbackOnFailure(backupPath) {
  console.error('Post-creation verification failed. Rolling back...');
  fs.copyFileSync(backupPath, 'tasks/task-state.json');
  console.error('Rollback complete. task-state.json restored.');
  process.exit(2);
}
```

### 5.4 Working Tree Rules

**Working tree must be clean EXCEPT:**

- When doing the intended write to `tasks/task-state.json`

**Implementation:**

```javascript
function checkWorkingTree(allowTaskStateChange = false) {
  const result = spawnSync('git', ['status', '--porcelain']);
  const changes = result.stdout.toString().trim();

  if (!changes) return true; // Clean

  if (allowTaskStateChange) {
    const lines = changes.split('\n');
    const onlyTaskState = lines.every((line) => line.includes('tasks/task-state.json'));
    return onlyTaskState;
  }

  return false;
}
```

### 5.5 Atomic Write Strategy

**Write pattern:**

```javascript
async function writeTaskStateAtomically(taskState) {
  const targetPath = 'tasks/task-state.json';
  const backupPath = 'tasks/task-state.json.backup';
  const tempPath = 'tasks/task-state.json.tmp';

  // 1. Backup current state
  fs.copyFileSync(targetPath, backupPath);

  // 2. Write to temp file
  fs.writeFileSync(tempPath, JSON.stringify(taskState, null, 2) + '\n', 'utf8');

  // 3. Validate temp file
  try {
    const parsed = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
    if (!Array.isArray(parsed.tasks)) throw new Error('Invalid schema');
  } catch (error) {
    fs.unlinkSync(tempPath);
    throw new Error(`Temp file validation failed: ${error.message}`);
  }

  // 4. Atomic rename
  fs.renameSync(tempPath, targetPath);

  // 5. Verify write
  const written = fs.readFileSync(targetPath, 'utf8');
  const parsed = JSON.parse(written);
  if (!Array.isArray(parsed.tasks)) {
    fs.copyFileSync(backupPath, targetPath);
    throw new Error('Write verification failed, restored backup');
  }

  // 6. Cleanup backup (optional, keep for safety)
  // fs.unlinkSync(backupPath);
}
```

---

## 6. Task Selection Algorithm

### 6.1 Eligibility Criteria

**A ROADMAP task is eligible if ALL of the following are true:**

1. **Status is `todo`** - Only todo tasks (not in_progress, blocked, done)
2. **Not in runtime state** - Task ID does not exist in tasks/task-state.json
3. **Valid ID format** - Matches canonical pattern
4. **Parsed from heading** - Not a checkbox reference
5. **Has title** - Non-empty title exists
6. **Has status** - Status field was parsed

### 6.2 Selection Logic

**Algorithm:**

```javascript
function selectEligibleTask(roadmapTasks, runtimeTasks) {
  const runtimeIds = new Set(runtimeTasks.map((t) => t.id));

  const eligible = roadmapTasks.filter((task) => {
    // 1. Status is todo
    if (task.status !== 'todo') return false;

    // 2. Not in runtime state
    if (runtimeIds.has(task.id)) return false;

    // 3. Valid ID format
    const idPattern = /^(?:P\d+-\d+|RESOLVER-V2-\d+|RALPH-\d+[A-Z]?)$/;
    if (!idPattern.test(task.id)) return false;

    // 4. Has title
    if (!task.title || task.title.trim() === '') return false;

    // 5. Has status (already checked in filter 1)
    return true;
  });

  // Select first eligible task (document order)
  return eligible.length > 0 ? eligible[0] : null;
}
```

### 6.3 Skip Conditions

**Tasks are skipped (not created) if:**

| Condition                | Reason                     | Log Level |
| ------------------------ | -------------------------- | --------- |
| Status is `in_progress`  | Already active             | info      |
| Status is `blocked`      | Blocked in ROADMAP         | info      |
| Status is `done`         | Already completed          | info      |
| Already in runtime state | Duplicate prevention       | info      |
| Invalid ID format        | Parsing error              | warning   |
| Missing title            | Incomplete task definition | warning   |
| Missing status           | Incomplete task definition | warning   |

**No error exit for skipped tasks** - Continue to next eligible task or exit with code 3 if none found.

---

## 7. Test Plan

### 7.1 Test File Structure

**Location:** `scripts/agent/__tests__/create-runtime-task-from-roadmap.test.mjs`

**Pattern:** Follow existing reconciler test pattern (temp project, fixture generation)

### 7.2 Test Matrix

| Test Case                          | Setup                                 | Expected Behavior                  | Assertions                             |
| ---------------------------------- | ------------------------------------- | ---------------------------------- | -------------------------------------- |
| **Dry-run creates no changes**     | ROADMAP with todo task, empty runtime | Dry-run completes, no file changes | exit_code=0, task-state.json unchanged |
| **Write requires both flags**      | ROADMAP with todo task                | --write alone rejected             | exit_code=1, error message             |
| **Confirm-write requires write**   | ROADMAP with todo task                | --confirm-write alone rejected     | exit_code=1, error message             |
| **First todo task selected**       | ROADMAP with 3 todo tasks             | First task selected                | selected_task.id matches first         |
| **Existing runtime task skipped**  | ROADMAP task exists in runtime        | Task skipped, no duplicate         | exit_code=3 or next task selected      |
| **Blocked task skipped**           | ROADMAP task with status blocked      | Task skipped                       | exit_code=3 or next task selected      |
| **Done task skipped**              | ROADMAP task with status done         | Task skipped                       | exit_code=3 or next task selected      |
| **In-progress task skipped**       | ROADMAP task with status in_progress  | Task skipped                       | exit_code=3 or next task selected      |
| **Exactly one task created**       | ROADMAP with 5 todo tasks, write mode | Only first task created            | runtime tasks count +1                 |
| **Duplicate prevention**           | ROADMAP task already in runtime       | No duplicate created               | runtime tasks count unchanged          |
| **Generated fields correct**       | ROADMAP todo task, write mode         | All required fields present        | Validate schema compliance             |
| **Write updates only task-state**  | ROADMAP todo task, write mode         | Only task-state.json modified      | git status shows only task-state.json  |
| **Reconciler green after write**   | ROADMAP todo task, write mode         | Reconciler passes after creation   | reconciler exit_code=0                 |
| **Validator green after write**    | ROADMAP todo task, write mode         | Validator passes after creation    | validator exit_code=0                  |
| **Rollback on validation failure** | Corrupt write scenario                | Backup restored                    | task-state.json matches backup         |
| **JSON output format**             | ROADMAP todo task, --json flag        | Valid JSON output                  | JSON.parse succeeds                    |
| **No eligible tasks**              | ROADMAP with no todo tasks            | Exit code 3                        | exit_code=3, message clear             |
| **Safety gate failure**            | Dirty working tree                    | Creation aborted                   | exit_code=1, error message             |

### 7.3 Test Fixtures

**Minimal ROADMAP fixture:**

```markdown
# Test ROADMAP

## P1-001 First Task

Status: `todo`

**DoD:** Test DoD.

## P1-002 Second Task

Status: `todo`

**DoD:** Test DoD.

## P1-003 Blocked Task

Status: `blocked`

**DoD:** Test DoD.
```

**Minimal task-state fixture:**

```json
{
  "schema_version": "1.0.0",
  "tasks": []
}
```

### 7.4 Test Utilities

**Reuse from reconciler tests:**

```javascript
function tempProject(t, { roadmap = '', state = taskState([]) } = {}) {
  // Create temp directory with ROADMAP.md and task-state.json
}

function runCli(cwd, args = []) {
  // Execute script with args in temp directory
}
```

---

## 8. Expected Changed Files (RALPH-025 Implementation)

### 8.1 New Files

```
scripts/agent/create-runtime-task-from-roadmap.mjs
scripts/agent/__tests__/create-runtime-task-from-roadmap.test.mjs
```

### 8.2 Modified Files

**None expected** - v1 is standalone, no integration with existing scripts.

### 8.3 Documentation Files

**Optional (if required by implementation):**

```
reports/RALPH-025_RUNTIME_TASK_CREATION_IMPLEMENTATION_REPORT.md
handoffs/latest-handoff.md
```

### 8.4 Forbidden Changes

**Must NOT be modified:**

- `package.json` - No script registration in v1
- `ROADMAP.md` - Read-only
- `tasks/task-state.json` - Only modified in write mode with explicit flags
- `tasks/task-history.jsonl` - No history writes in v1
- `validation/validation-results.jsonl` - No evidence writes in v1
- `review/review-results.jsonl` - No evidence writes in v1
- Any product code (`src/**`)
- Any existing scripts (except new files)

---

## 9. Out of Scope (Explicitly Deferred)

### 9.1 Batch Creation

**Not in v1:**

- Creating multiple tasks per run
- `--max-tasks` flag
- Batch size limits
- Batch validation

**Rationale:** Single-task creation is simpler and safer. Batch creation adds complexity (partial failure handling, rollback strategy, performance concerns).

**Future task:** RALPH-026 or later

### 9.2 Task History Writes

**Not in v1:**

- Appending to `tasks/task-history.jsonl`
- Creation event logging
- Audit trail generation

**Rationale:** History writes require:

- Event schema definition
- JSONL append logic
- History validation
- Rollback coordination

**Future task:** RALPH-027 or later

### 9.3 Evidence Writes

**Not in v1:**

- Writing to `validation/validation-results.jsonl`
- Writing to `review/review-results.jsonl`
- Evidence schema compliance

**Rationale:** Evidence system is already established but not required for minimal task creation. Can be added incrementally.

**Future task:** RALPH-028 or later

### 9.4 Package.json Integration

**Not in v1:**

- Adding `npm run` script
- CLI alias registration
- Help text integration

**Rationale:** Script can be run directly with `node scripts/agent/...`. Package.json integration requires:

- Script naming decision
- Help text coordination
- Potential conflicts with existing scripts

**Future task:** RALPH-029 or later

### 9.5 Run Creation

**Not in v1:**

- Creating `runs/current-run.json`
- Run state management
- Run history logging

**Rationale:** Task creation is independent of run management. Run creation is a separate concern.

**Future task:** RALPH-030 or later

### 9.6 Worker Dispatch

**Not in v1:**

- Automatic worker execution after task creation
- Task-to-worker handoff
- Worker selection logic

**Rationale:** Task creation and task execution are separate phases. Keep them decoupled.

**Future task:** RALPH-031 or later

### 9.7 ROADMAP Status Updates

**Not in v1:**

- Updating ROADMAP.md task status
- Bidirectional sync
- Status reconciliation

**Rationale:** ROADMAP.md is planning authority and should remain read-only for automated tools. Status updates require human approval.

**Future task:** RALPH-032 or later (if ever)

### 9.8 Advanced Inference

**Not in v1:**

- Priority inference from ROADMAP metadata
- Risk level inference from DoD/Verify text
- allowed_files inference from task scope
- Acceptance criteria parsing

**Rationale:** Inference requires complex parsing and heuristics. Use conservative defaults in v1.

**Future task:** RALPH-033 or later

---

## 10. Implementation Checklist

### 10.1 Script Implementation

- [ ] Create `scripts/agent/create-runtime-task-from-roadmap.mjs`
- [ ] Import or copy ROADMAP parser from reconciler
- [ ] Implement CLI argument parsing (--write, --confirm-write, --json, --help)
- [ ] Implement safety checks (reconciler, validator, working tree)
- [ ] Implement task selection algorithm
- [ ] Implement runtime task generation
- [ ] Implement dry-run output (human-readable)
- [ ] Implement dry-run output (JSON format)
- [ ] Implement atomic write logic (temp file + rename)
- [ ] Implement post-creation verification
- [ ] Implement rollback on failure
- [ ] Add help text
- [ ] Add exit code handling

### 10.2 Test Implementation

- [ ] Create `scripts/agent/__tests__/create-runtime-task-from-roadmap.test.mjs`
- [ ] Implement test fixtures (ROADMAP, task-state)
- [ ] Implement test utilities (tempProject, runCli)
- [ ] Test: Dry-run creates no changes
- [ ] Test: Write requires both flags
- [ ] Test: First todo task selected
- [ ] Test: Existing runtime task skipped
- [ ] Test: Blocked/done/in_progress tasks skipped
- [ ] Test: Exactly one task created
- [ ] Test: Duplicate prevention
- [ ] Test: Generated fields correct
- [ ] Test: Write updates only task-state.json
- [ ] Test: Reconciler green after write
- [ ] Test: Validator green after write
- [ ] Test: Rollback on validation failure
- [ ] Test: JSON output format
- [ ] Test: No eligible tasks
- [ ] Test: Safety gate failure

### 10.3 Documentation

- [ ] Update handoff with implementation summary
- [ ] Document any deviations from plan
- [ ] Document known limitations
- [ ] Document future enhancement opportunities

### 10.4 Verification

- [ ] Run all tests (must pass)
- [ ] Run reconciler (must pass, exit_code=0)
- [ ] Run validator (must pass, exit_code=0)
- [ ] Verify no product code changes
- [ ] Verify no package.json changes
- [ ] Verify no ROADMAP changes
- [ ] Verify working tree clean (except handoff)

---

## 11. Success Criteria

### 11.1 Functional Requirements

**Must achieve:**

- ✅ Script creates exactly one runtime task from ROADMAP.md
- ✅ Dry-run mode works (default, no changes)
- ✅ Write mode requires explicit confirmation (--write --confirm-write)
- ✅ Safety gates prevent unsafe creation
- ✅ Atomic write prevents partial state
- ✅ Rollback works on validation failure
- ✅ Reconciler remains green after creation
- ✅ Validator remains green after creation

### 11.2 Safety Requirements

**Must achieve:**

- ✅ No accidental writes (dry-run default)
- ✅ No ROADMAP modifications
- ✅ No package.json modifications
- ✅ No product code modifications
- ✅ No duplicate task creation
- ✅ No partial state on failure
- ✅ Working tree clean before creation
- ✅ Protected files never modified

### 11.3 Quality Requirements

**Must achieve:**

- ✅ All tests pass
- ✅ Test coverage >80% for new code
- ✅ No lint errors
- ✅ No type errors
- ✅ Clear error messages
- ✅ Comprehensive help text
- ✅ JSON output valid

### 11.4 Documentation Requirements

**Must achieve:**

- ✅ Handoff documents implementation
- ✅ Known limitations documented
- ✅ Future enhancements identified
- ✅ Test results included

---

## 12. Risk Assessment

### 12.1 Implementation Risks

| Risk                     | Likelihood | Impact   | Mitigation                             |
| ------------------------ | ---------- | -------- | -------------------------------------- |
| **Parser import issues** | Medium     | Medium   | Copy parser functions if import fails  |
| **Atomic write failure** | Low        | High     | Backup + rollback strategy             |
| **Schema drift**         | Low        | High     | Schema validation before/after write   |
| **Duplicate creation**   | Low        | Medium   | Duplicate check in selection algorithm |
| **Safety gate bypass**   | Low        | Critical | Multiple independent checks            |

### 12.2 Integration Risks

| Risk                         | Likelihood | Impact   | Mitigation                           |
| ---------------------------- | ---------- | -------- | ------------------------------------ |
| **Reconciler regression**    | Low        | High     | Pre/post reconciler checks           |
| **Validator regression**     | Low        | High     | Pre/post validator checks            |
| **Working tree pollution**   | Low        | Medium   | Working tree check before creation   |
| **Protected file violation** | Low        | Critical | Protected file check in safety gates |

### 12.3 Operational Risks

| Risk                    | Likelihood | Impact | Mitigation                               |
| ----------------------- | ---------- | ------ | ---------------------------------------- |
| **Accidental write**    | Low        | Medium | Require two explicit flags               |
| **Wrong task selected** | Low        | Low    | Document order selection (deterministic) |
| **No eligible tasks**   | Medium     | Low    | Clear exit code and message              |
| **Human confusion**     | Medium     | Low    | Clear dry-run output, help text          |

---

## 13. Future Enhancements (Post-v1)

### 13.1 Near-Term (RALPH-026 to RALPH-030)

**Batch Creation (RALPH-026):**

- Create multiple tasks per run
- `--max-tasks N` flag
- Batch validation and rollback

**Task History Integration (RALPH-027):**

- Write creation events to task-history.jsonl
- Event schema compliance
- History validation

**Evidence Integration (RALPH-028):**

- Write validation evidence
- Write review evidence
- Evidence schema compliance

**Package.json Integration (RALPH-029):**

- Add `npm run agent:create-task` script
- CLI alias registration
- Help text integration

**Run Management Integration (RALPH-030):**

- Create runs/current-run.json
- Link task to run
- Run history logging

### 13.2 Mid-Term (RALPH-031 to RALPH-035)

**Worker Dispatch (RALPH-031):**

- Automatic worker execution after creation
- Task-to-worker handoff
- Worker selection logic

**Advanced Inference (RALPH-033):**

- Priority inference from ROADMAP metadata
- Risk level inference from DoD/Verify text
- allowed_files inference from task scope
- Acceptance criteria parsing

**Batch Optimization (RALPH-034):**

- Parallel task creation
- Incremental validation
- Performance optimization

**Recovery Scenarios (RALPH-035):**

- Handle in_progress tasks (recovery mode)
- Repair inconsistent state
- Conflict resolution

### 13.3 Long-Term (RALPH-036+)

**Bidirectional Sync (RALPH-036):**

- Update ROADMAP.md from runtime state
- Status synchronization
- Conflict detection and resolution

**Smart Selection (RALPH-037):**

- Dependency-aware selection
- Priority-based selection
- Resource-aware selection

**Continuous Creation (RALPH-038):**

- Watch mode for ROADMAP changes
- Automatic task creation on ROADMAP updates
- Real-time sync

---

## 14. Human Review Checklist

### 14.1 Plan Review

**Before implementation, verify:**

- [ ] Scope is minimal and conservative
- [ ] Safety gates are comprehensive
- [ ] Test plan covers all critical paths
- [ ] Out-of-scope items are clearly deferred
- [ ] No forbidden changes planned
- [ ] CLI contract is clear and safe
- [ ] Schema is complete for v1
- [ ] Rollback strategy is sound

### 14.2 Implementation Review

**After implementation, verify:**

- [ ] All tests pass
- [ ] Reconciler remains green
- [ ] Validator remains green
- [ ] No product code changes
- [ ] No package.json changes
- [ ] No ROADMAP changes
- [ ] Dry-run works correctly
- [ ] Write mode requires confirmation
- [ ] Atomic write works
- [ ] Rollback works
- [ ] Error messages are clear
- [ ] Help text is comprehensive

### 14.3 Approval Gates

**Required approvals:**

- [ ] Human review of plan (this document)
- [ ] Human review of implementation
- [ ] Human review of test results
- [ ] Human approval to merge

---

## 15. Conclusion

This plan defines the **minimal safe implementation** for runtime task creation from ROADMAP.md. It is deliberately conservative, implementing only the smallest viable subset of the RALPH-023 design.

**Key Principles:**

- **Safety first:** Multiple independent safety gates
- **Dry-run default:** No accidental writes
- **Explicit confirmation:** Write requires two flags
- **Atomic operations:** All-or-nothing writes
- **Rollback capability:** Restore on failure
- **Green baseline:** Maintain reconciler/validator green state
- **Single responsibility:** Create one task, do it well

**Next Steps:**

1. Human review and approval of this plan
2. Implementation (RALPH-025)
3. Testing and validation
4. Human review of implementation
5. Approval to merge

**Stop for human review.**
