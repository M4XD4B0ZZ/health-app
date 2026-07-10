# RALPH-023: Runtime Task Creation Pipeline — Discovery & Design

**Task ID:** RALPH-023  
**Category:** Analysis / Design (Documentation-only)  
**Generated:** 2026-05-23T18:46:51Z  
**Status:** Design complete, awaiting human review

---

## Executive Summary

This report designs the first autonomous execution entrypoint for the Ralph-Loop system: the Runtime Task Creation Pipeline. This pipeline will enable automated creation of runtime task entries in `tasks/task-state.json` from planning authority in `ROADMAP.md`, establishing the bridge between planning and execution.

**Key Design Principles:**

- **Read-only ROADMAP.md:** Never modify planning authority
- **Explicit task selection:** Human-approved task selection criteria
- **Duplicate prevention:** Robust ID collision detection
- **Safety-first:** Multiple validation gates before task creation
- **Evidence-driven:** Full audit trail of all creation decisions
- **Reconciliation-aware:** Designed to maintain green baseline

**Recommended Implementation:** RALPH-024 (controlled, incremental, human-reviewed)

---

## 1. Context & Prerequisites

### 1.1 Completed Foundation (RALPH-001 through RALPH-022)

**Governance Layer:**

- ✅ Agent-neutral governance (`.governance/`)
- ✅ Runtime state model (`tasks/`, `runs/`, `validation/`, `review/`)
- ✅ Evidence system operational
- ✅ Handoff system operational

**Verification Tools:**

- ✅ Reconciler: `reconcile-roadmap-task-state.mjs` (exit_code=0)
- ✅ Validator: `validate-ralph-state.mjs` (exit_code=0)
- ✅ Ownership classification complete
- ✅ Green baseline achieved (RALPH-022)

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
| 4     | Adapter Execution Rules            | `.agent/adapters/*`                              |
| 5     | Operational Guides                 | Non-canonical implementation guidance            |

**Conflict Resolution Order:**

1. Safety wins first (`.governance/SAFETY.md`)
2. Canonical domain authority wins second (`ROADMAP.md` for planning)
3. Runtime state never overrides planning authority
4. Historical evidence never overrides current authority
5. Adapter docs never override governance

### 1.3 Ownership Classes (from RALPH-015)

| Class            | Definition                                                 | Authority                                                                     |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `roadmap_backed` | Task exists in both ROADMAP.md and task-state.json         | ROADMAP.md owns planning; task-state.json owns runtime execution              |
| `runtime_only`   | Task exists only in task-state.json, explicitly classified | task-state.json owns runtime existence; ROADMAP.md remains planning authority |
| `roadmap_only`   | Task exists only in ROADMAP.md                             | ROADMAP.md owns planning; no runtime authority until imported                 |

---

## 2. Runtime Task Lifecycle Analysis

### 2.1 Current Lifecycle (Manual)

```
ROADMAP.md (planning)
    ↓ (manual human decision)
tasks/task-state.json (runtime)
    ↓ (agent execution)
runs/current-run.json (active execution)
    ↓ (validation/review)
validation/validation-results.jsonl (evidence)
review/review-results.jsonl (evidence)
    ↓ (completion)
tasks/task-state.json (status: done)
    ↓ (manual human update)
ROADMAP.md (status: done)
```

### 2.2 Target Lifecycle (Automated Task Creation)

```
ROADMAP.md (planning authority)
    ↓ (automated task creation pipeline)
tasks/task-state.json (runtime task created)
    ↓ (task selector)
runs/current-run.json (task selected)
    ↓ (agent execution)
[execution, validation, review as before]
    ↓ (completion)
tasks/task-state.json (status: done)
    ↓ (manual human update OR future automation)
ROADMAP.md (status: done)
```

**Scope of RALPH-023/024:** Only the first arrow (ROADMAP → task-state creation)

### 2.3 State Transitions

**ROADMAP Status → Runtime Status Mapping:**

| ROADMAP Status | Eligible for Creation? | Initial Runtime Status | Rationale                                           |
| -------------- | ---------------------- | ---------------------- | --------------------------------------------------- |
| `todo`         | ✅ Yes                 | `not_started`          | Normal backlog item ready for execution             |
| `in_progress`  | ⚠️ Conditional         | `in_progress`          | Only if no runtime state exists (recovery scenario) |
| `blocked`      | ❌ No                  | N/A                    | Blocked tasks should not enter runtime execution    |
| `done`         | ❌ No                  | N/A                    | Completed tasks should not be recreated             |

**Runtime Status Lifecycle:**

```
not_started → in_progress → needs_validation → needs_review → done
                ↓               ↓                   ↓
              blocked         failed            cancelled
                                                  skipped
```

---

## 3. Task Selection Algorithm

### 3.1 Eligibility Criteria

**A ROADMAP task is eligible for runtime creation if ALL of the following are true:**

1. **Status Check:** Task status is `todo` (primary) or `in_progress` (recovery only)
2. **Duplicate Prevention:** Task ID does not already exist in `tasks/task-state.json`
3. **ID Validity:** Task ID matches canonical pattern: `(?:P\d+-\d+|RESOLVER-V2-\d+|RALPH-\d+[A-Z]?)`
4. **Parsing Confidence:** Task was parsed from a canonical heading-style section (not checkbox reference)
5. **Metadata Completeness:** Task has title, status, and parseable section context
6. **Safety Check:** Task does not require forbidden operations (checked via DoD/Verify text)
7. **Human Override:** No explicit exclusion marker in task metadata

### 3.2 Priority Resolution

**When multiple eligible tasks exist, select based on:**

1. **Explicit Priority Field:** If ROADMAP task has priority metadata (future enhancement)
2. **ROADMAP Order:** Earlier tasks in ROADMAP.md take precedence
3. **Section Context:** Tasks in higher-priority sections (e.g., "TIER 1") before lower tiers
4. **Dependency Analysis:** Tasks with no unmet dependencies before dependent tasks (future)

**For RALPH-024 (initial implementation):**

- Use ROADMAP order only (simplest, deterministic)
- Select first eligible `todo` task in document order
- Defer priority/dependency logic to future enhancements

### 3.3 Blocked Task Handling

**Tasks are skipped (not created) if:**

1. **Status is `blocked`:** Explicit blocker in ROADMAP
2. **Status is `done`:** Already completed
3. **Already exists in runtime:** Duplicate prevention
4. **Parsing ambiguity:** Multiple canonical definitions with same ID
5. **Safety violation:** DoD/Verify text indicates forbidden operations
6. **Missing required metadata:** No title, no status, or unparseable

**Skipped tasks are logged but not created.**

### 3.4 Already-Existing Runtime Task Handling

**If task ID already exists in `tasks/task-state.json`:**

1. **Log as info:** "Task {id} already exists in runtime state, skipping creation"
2. **Do not modify existing runtime task:** Preserve runtime execution state
3. **Do not create duplicate:** Maintain ID uniqueness
4. **Continue to next eligible task:** Selection algorithm proceeds
5. **Report in dry-run output:** Include in "skipped" list with reason

**Reconciliation implications:**

- Existing runtime tasks remain `roadmap_backed` or `runtime_only` based on current classification
- No status synchronization during creation (reconciler handles drift detection)
- Creation pipeline is additive only, never modifies existing runtime state

---

## 4. Runtime Task Schema Proposal

### 4.1 Required Fields (Canonical)

```json
{
  "id": "string",              // Canonical task ID from ROADMAP (required, unique)
  "title": "string",           // Task title from ROADMAP (required)
  "status": "string",          // Runtime status (required, see lifecycle)
  "priority": "string",        // Priority level: "high" | "medium" | "low" (required)
  "risk_level": "string",      // Risk classification (required, see risk levels)
  "runtime_only": boolean,     // Ownership classification (required)
  "created_at": "ISO8601",     // Creation timestamp (required)
  "updated_at": "ISO8601",     // Last update timestamp (required)
  "attempt_count": number,     // Execution attempt counter (required, default: 0)
  "max_attempts": number,      // Maximum retry attempts (required, default: 3)
  "requires_human_review": boolean  // Review gate flag (required)
}
```

### 4.2 Optional Fields (Metadata)

```json
{
  "source": "string",          // Source of task creation: "roadmap_import" | "runtime_generated"
  "roadmap_section": "string", // Section path from ROADMAP (e.g., "TIER 1 > EPIC: Resolver")
  "roadmap_line": number,      // Line number in ROADMAP.md where task was found
  "roadmap_status": "string",  // Original ROADMAP status at time of creation
  "allowed_files": ["string"], // File scope restrictions (optional, for safety)
  "forbidden_files": ["string"], // Protected file list (optional, for safety)
  "outputs": ["string"],       // Expected output files (optional)
  "validation": {              // Validation requirements (optional)
    "type": "string",
    "required_checks": ["string"]
  },
  "acceptance_criteria": ["string"], // DoD criteria from ROADMAP (optional)
  "notes": "string"            // Additional context (optional)
}
```

### 4.3 Risk Level Classification

**Risk levels determine review requirements and safety constraints:**

| Risk Level        | Review Required? | Max Attempts | Allowed Operations                                   | Example Tasks          |
| ----------------- | ---------------- | ------------ | ---------------------------------------------------- | ---------------------- |
| `safe_autonomous` | No               | 3            | Documentation, planning, read-only analysis          | RALPH-001A, RALPH-005A |
| `review_required` | Yes              | 3            | Code changes, state modifications, script creation   | RALPH-006A, RALPH-008A |
| `human_required`  | Yes              | 1            | High-risk operations, governance changes, migrations | RALPH-010A             |

**Risk level determination (for RALPH-024):**

- Default: `review_required` (safest)
- Override via ROADMAP metadata (future enhancement)
- Inferred from DoD/Verify text (future enhancement)

### 4.4 Source Attribution Rules

**All created runtime tasks must include:**

1. **`source` field:** Set to `"roadmap_import"` for ROADMAP-derived tasks
2. **`roadmap_section` field:** Full section path from ROADMAP parsing
3. **`roadmap_line` field:** Line number where task heading was found
4. **`roadmap_status` field:** Original ROADMAP status at creation time
5. **`runtime_only` field:** Set to `false` for ROADMAP-backed tasks
6. **`created_at` timestamp:** ISO8601 timestamp of creation
7. **Creation event in `tasks/task-history.jsonl`:** Audit trail entry

**Example creation event:**

```json
{
  "event_id": "evt_2026-05-23_task-created_p1-003",
  "event_type": "task.created",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_id": "P1-003",
  "source": "roadmap_import",
  "roadmap_section": "PHASE 1 > EPIC: Resolver & Normalization",
  "roadmap_line": 518,
  "roadmap_status": "todo",
  "initial_runtime_status": "not_started",
  "created_by": "runtime_task_creation_pipeline",
  "pipeline_version": "1.0.0"
}
```

---

## 5. Duplicate Prevention Strategy

### 5.1 ID Collision Detection

**Pre-creation checks (all must pass):**

1. **Exact ID match:** Check if `task_id` exists in `tasks/task-state.json`
2. **Case-insensitive match:** Check for case variants (e.g., `ralph-001a` vs `RALPH-001A`)
3. **Normalized ID match:** Check with `-CLOSEOUT` suffix removed
4. **Historical ID check:** Check `tasks/task-history.jsonl` for retired IDs (optional)

**If collision detected:**

- Log as error: "Duplicate task ID detected: {id}"
- Skip task creation
- Report in dry-run output
- Exit with error if `--strict` mode enabled

### 5.2 Reconciliation Integration

**Before creating any tasks:**

1. **Run reconciler:** `node scripts/agent/reconcile-roadmap-task-state.mjs --json`
2. **Check exit code:** Must be 0 (no critical findings)
3. **Parse ownership summary:** Identify existing `roadmap_backed` and `runtime_only` tasks
4. **Build exclusion list:** All task IDs currently in runtime state
5. **Filter eligible tasks:** Remove tasks in exclusion list from creation candidates

**After creating tasks:**

1. **Run reconciler again:** Verify no critical findings introduced
2. **Compare before/after:** Ensure expected ownership changes occurred
3. **Validate new tasks:** All created tasks should be `roadmap_backed`
4. **Check warning count:** Should decrease (fewer `roadmap_only` tasks)

### 5.3 Atomic Creation

**Task creation must be atomic:**

1. **Read current state:** Load `tasks/task-state.json`
2. **Validate schema:** Ensure current state is valid
3. **Build new task list:** Append new tasks to existing tasks array
4. **Validate new state:** Ensure new state is valid JSON and schema-compliant
5. **Write atomically:** Use temp file + rename pattern for atomic write
6. **Verify write:** Read back and confirm write succeeded
7. **Log creation event:** Append to `tasks/task-history.jsonl`

**Rollback on failure:**

- If any step fails, do not modify `tasks/task-state.json`
- Log failure event to `tasks/task-history.jsonl`
- Report error to user
- Exit with non-zero code

---

## 6. Safety Gates

### 6.1 Pre-Creation Safety Checks

**All checks must pass before creating any tasks:**

| Check                        | Purpose                                 | Failure Action               |
| ---------------------------- | --------------------------------------- | ---------------------------- |
| **Reconciler baseline**      | Verify green baseline (exit_code=0)     | Abort creation, report error |
| **Validator baseline**       | Verify no critical runtime errors       | Abort creation, report error |
| **Working tree clean**       | Ensure no uncommitted changes           | Abort creation, report error |
| **Protected file check**     | Verify no protected files in scope      | Abort creation, report error |
| **Schema validation**        | Verify current task-state.json is valid | Abort creation, report error |
| **Duplicate detection**      | Check for ID collisions                 | Skip duplicate tasks         |
| **ROADMAP parse confidence** | Verify parser can read ROADMAP reliably | Abort creation, report error |

### 6.2 Creation-Time Validation

**For each task being created:**

| Validation                 | Check                        | Failure Action                |
| -------------------------- | ---------------------------- | ----------------------------- |
| **ID format**              | Matches canonical pattern    | Skip task, log warning        |
| **Title presence**         | Non-empty title exists       | Skip task, log warning        |
| **Status validity**        | Status is in allowed set     | Skip task, log warning        |
| **Risk level validity**    | Risk level is in allowed set | Use default `review_required` |
| **Metadata completeness**  | Required fields present      | Skip task, log warning        |
| **JSON schema compliance** | New task matches schema      | Skip task, log error          |

### 6.3 Post-Creation Verification

**After all tasks created:**

| Verification          | Check                             | Failure Action             |
| --------------------- | --------------------------------- | -------------------------- |
| **JSON validity**     | task-state.json is valid JSON     | Rollback, restore backup   |
| **Schema compliance** | All tasks match schema            | Rollback, restore backup   |
| **ID uniqueness**     | No duplicate IDs in runtime state | Rollback, restore backup   |
| **Reconciler green**  | Reconciler still passes           | Rollback, restore backup   |
| **Validator green**   | Validator still passes            | Rollback, restore backup   |
| **Evidence written**  | Creation events logged            | Warn, but allow completion |

### 6.4 Human Review Gates

**Creation pipeline must stop for human review when:**

1. **Large batch creation:** More than 5 tasks created in single run
2. **High-risk tasks:** Any task with `risk_level: "human_required"`
3. **Validation warnings:** Any validation warnings during creation
4. **Reconciler warnings:** New warnings introduced by creation
5. **Schema changes:** Any changes to task-state.json schema
6. **First run:** Initial execution of creation pipeline (RALPH-024)

---

## 7. Failure & Recovery Scenarios

### 7.1 Failure Modes

| Failure Mode                  | Detection                                | Recovery Strategy                                           |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| **ROADMAP parse failure**     | Parser throws error or returns empty     | Abort creation, report parse error, fix ROADMAP syntax      |
| **task-state.json corrupted** | JSON parse error                         | Abort creation, restore from backup, investigate corruption |
| **Duplicate ID collision**    | ID already exists in runtime             | Skip duplicate, log warning, continue with other tasks      |
| **Schema validation failure** | New task doesn't match schema            | Skip invalid task, log error, continue with valid tasks     |
| **Reconciler regression**     | Reconciler exit_code changes from 0 to 1 | Rollback creation, restore backup, investigate regression   |
| **Validator regression**      | Validator critical_count increases       | Rollback creation, restore backup, investigate regression   |
| **File write failure**        | Cannot write task-state.json             | Abort creation, report I/O error, check permissions         |
| **Evidence write failure**    | Cannot append to task-history.jsonl      | Warn, allow creation to complete, retry evidence write      |

### 7.2 Recovery Procedures

**For each failure mode:**

1. **Detect failure:** Identify specific failure condition
2. **Log failure:** Record failure details to console and evidence stream
3. **Assess impact:** Determine if rollback is required
4. **Execute recovery:** Rollback if needed, otherwise continue
5. **Verify recovery:** Confirm system is in consistent state
6. **Report to user:** Provide clear error message and next steps

**Rollback procedure:**

```bash
# 1. Restore task-state.json from backup
cp tasks/task-state.json.backup tasks/task-state.json

# 2. Verify restoration
node scripts/agent/reconcile-roadmap-task-state.mjs
node scripts/agent/validate-ralph-state.mjs

# 3. Log rollback event
# (append to tasks/task-history.jsonl)

# 4. Report to user
echo "Task creation rolled back due to: {failure_reason}"
```

### 7.3 Partial Creation Handling

**If some tasks succeed and others fail:**

1. **Atomic batch:** Either all tasks in batch succeed or all are rolled back
2. **No partial state:** Never leave task-state.json in partially-created state
3. **All-or-nothing:** Use transaction-like semantics for batch creation
4. **Retry strategy:** Allow user to retry failed batch after fixing issues

**Exception:** Duplicate detection is not a failure, just a skip

---

## 8. Interaction with Validation/Review Gates

### 8.1 Validation Gate Integration

**Creation pipeline interacts with validation system:**

1. **Pre-creation validation:** Run reconciler/validator before creation
2. **Creation validation:** Validate each task during creation
3. **Post-creation validation:** Run reconciler/validator after creation
4. **Evidence recording:** Write validation results to `validation/validation-results.jsonl`

**Validation evidence schema:**

```json
{
  "validation_id": "val_2026-05-23_task-creation_batch-001",
  "event_type": "validation.task_creation",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_ids": ["P1-003", "P1-004"],
  "validation_type": "runtime_task_creation",
  "required_checks": [
    "reconciler_baseline",
    "validator_baseline",
    "schema_validation",
    "duplicate_detection"
  ],
  "check_results": {
    "reconciler_baseline": "passed",
    "validator_baseline": "passed",
    "schema_validation": "passed",
    "duplicate_detection": "passed"
  },
  "overall_result": "passed",
  "created_task_count": 2,
  "skipped_task_count": 0,
  "failed_task_count": 0
}
```

### 8.2 Review Gate Integration

**Creation pipeline interacts with review system:**

1. **Automatic review requirement:** All task creation runs require human review
2. **Review evidence:** Write review request to `review/review-results.jsonl`
3. **Stop for review:** Pipeline stops after creation, waits for human approval
4. **Review acceptance:** Human reviews created tasks, approves or rejects
5. **Rejection handling:** If rejected, rollback creation and investigate

**Review evidence schema:**

```json
{
  "review_id": "rev_2026-05-23_task-creation_batch-001",
  "event_type": "review.requested",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_ids": ["P1-003", "P1-004"],
  "review_type": "runtime_task_creation",
  "review_scope": "task_creation_batch",
  "created_task_count": 2,
  "review_required_reason": "first_run_of_creation_pipeline",
  "review_status": "pending",
  "reviewer": null,
  "review_result": null,
  "review_notes": null
}
```

### 8.3 Handoff Generation

**Creation pipeline generates handoff:**

1. **Handoff location:** `handoffs/latest-handoff.md`
2. **Handoff schema:** Follow canonical schema from `.governance/RULES.md`
3. **Required sections:** All 8 required handoff fields
4. **Creation summary:** List of created tasks, skipped tasks, failed tasks
5. **Validation results:** Summary of all validation checks
6. **Review request:** Explicit request for human review

**Handoff template:**

```markdown
# Task Creation Pipeline Handoff

**Run ID:** run_2026-05-23_task-creation_batch-001
**Task:** Runtime Task Creation (RALPH-024)
**Status:** Completed, awaiting human review

## What Changed

- Created {N} runtime tasks from ROADMAP.md
- Updated tasks/task-state.json with new task entries
- Logged creation events to tasks/task-history.jsonl

## Why Changed

- Establish runtime execution state for ROADMAP-backed product tasks
- Enable autonomous task selection and execution
- Bridge planning authority (ROADMAP.md) with runtime execution (task-state.json)

## Changed Files

- tasks/task-state.json (added {N} tasks)
- tasks/task-history.jsonl (appended {N} creation events)
- handoffs/latest-handoff.md (this file)

## Validation Executed

- Reconciler baseline: PASSED (exit_code=0)
- Validator baseline: PASSED (exit_code=0)
- Schema validation: PASSED
- Duplicate detection: PASSED
- Post-creation reconciler: PASSED (exit_code=0)
- Post-creation validator: PASSED (exit_code=0)

## Validation Result

✅ All validation checks passed

## Known Issues/Risks

- First run of creation pipeline (requires careful review)
- {N} tasks created (review each for correctness)
- No issues detected during creation

## Human Review Status

⏳ PENDING - Human review required before proceeding
```

---

## 9. Human Override Requirements

### 9.1 Override Mechanisms

**Humans can override creation pipeline via:**

1. **Dry-run mode:** `--dry-run` flag to preview without creating
2. **Task selection filter:** `--task-id` flag to create specific tasks only
3. **Batch size limit:** `--max-tasks` flag to limit creation batch size
4. **Force mode:** `--force` flag to bypass certain safety checks (use with caution)
5. **Exclusion list:** `--exclude` flag to skip specific task IDs
6. **Manual task-state.json edit:** Direct file editing (not recommended)

### 9.2 Manual Task Creation

**Humans can manually create runtime tasks:**

1. **Edit task-state.json:** Add task entry manually
2. **Follow schema:** Ensure all required fields present
3. **Run validation:** Verify with reconciler/validator
4. **Log creation event:** Manually append to task-history.jsonl (optional)
5. **Update handoff:** Document manual creation

**When to use manual creation:**

- Pipeline fails and cannot be fixed quickly
- Special task requires custom metadata
- Testing or debugging creation logic
- Emergency task creation needed

### 9.3 Creation Pipeline Disable

**Humans can disable creation pipeline:**

1. **Skip creation:** Don't run creation script
2. **Use manual task selection:** Continue with existing runtime tasks
3. **Revert to manual workflow:** Create tasks manually as needed
4. **Rollback automation:** Remove created tasks if needed

**Disable scenarios:**

- Pipeline introduces bugs or regressions
- Manual control preferred for specific phase
- Testing alternative workflows
- Emergency situation requires manual intervention

---

## 10. Migration Risks

### 10.1 Risk Assessment

| Risk                                | Likelihood | Impact   | Mitigation                                              |
| ----------------------------------- | ---------- | -------- | ------------------------------------------------------- |
| **Duplicate task creation**         | Medium     | High     | Robust duplicate detection, reconciler integration      |
| **Schema drift**                    | Low        | High     | Schema validation, rollback on failure                  |
| **ROADMAP parse errors**            | Low        | Medium   | Parser testing, error handling, dry-run mode            |
| **Reconciler regression**           | Low        | High     | Pre/post validation, rollback on regression             |
| **Validator regression**            | Low        | High     | Pre/post validation, rollback on regression             |
| **Evidence corruption**             | Low        | Medium   | Atomic writes, backup strategy                          |
| **Human review bypass**             | Low        | Critical | Mandatory review gates, no auto-continue                |
| **Ownership classification errors** | Medium     | Medium   | Explicit `runtime_only: false` for ROADMAP-backed tasks |
| **Status mapping errors**           | Low        | Medium   | Conservative mapping (todo → not_started only)          |
| **Batch creation overload**         | Low        | Low      | Batch size limits, dry-run preview                      |

### 10.2 Rollback Strategy

**If creation pipeline causes issues:**

1. **Immediate rollback:** Restore task-state.json from backup
2. **Verify restoration:** Run reconciler/validator to confirm green baseline
3. **Investigate root cause:** Analyze logs and evidence to understand failure
4. **Fix pipeline:** Address bugs or design issues
5. **Test fix:** Use dry-run mode to verify fix
6. **Retry creation:** Re-run pipeline after fix verified

**Rollback checklist:**

- [ ] Backup current task-state.json
- [ ] Restore previous task-state.json
- [ ] Run reconciler (must pass)
- [ ] Run validator (must pass)
- [ ] Verify working tree clean
- [ ] Log rollback event
- [ ] Document rollback reason
- [ ] Plan fix strategy

### 10.3 Gradual Rollout Strategy

**For RALPH-024 implementation:**

1. **Phase 1: Dry-run only** - Test pipeline without creating tasks
2. **Phase 2: Single task creation** - Create one task, verify, review
3. **Phase 3: Small batch (3-5 tasks)** - Create small batch, verify, review
4. **Phase 4: Full batch** - Create all eligible tasks, verify, review
5. **Phase 5: Automated execution** - Integrate with task selector (future)

**Success criteria for each phase:**

- Reconciler remains green (exit_code=0)
- Validator remains green (exit_code=0)
- No schema violations
- No duplicate IDs
- Human review approval

---

## 11. Specific Questions Answered

### A. Which ROADMAP statuses are eligible for runtime creation?

**Primary eligibility:** `todo`

**Rationale:**

- `todo` tasks are planned but not started, ideal for runtime import
- Clear semantic: "planned work ready for execution"
- No ambiguity about current state

**Conditional eligibility:** `in_progress` (recovery scenario only)

**Conditions for `in_progress` creation:**

- Task does not already exist in runtime state
- Explicit `--recovery` flag provided
- Human approval required
- Used only for recovering from state inconsistencies

**Not eligible:** `blocked`, `done`

**Rationale:**

- `blocked`: Should not enter execution until unblocked
- `done`: Already completed, should not be recreated

**Recommendation for RALPH-024:** Only support `todo` status initially. Defer `in_progress` recovery to future enhancement.

---

### B. How should priorities be resolved?

**Priority resolution algorithm (for RALPH-024):**

1. **ROADMAP document order** (primary)
   - First eligible `todo` task in document order
   - Simplest, most deterministic
   - Respects human-curated task ordering

2. **Section-based priority** (future enhancement)
   - Tasks in "TIER 1" before "TIER 2"
   - Tasks in "P0" before "P1" before "P2"
   - Requires section-aware parsing

3. **Explicit priority metadata** (future enhancement)
   - Parse priority from ROADMAP task metadata
   - Example: `Priority: high` in task description
   - Requires metadata parsing

4. **Dependency-aware priority** (future enhancement)
   - Tasks with no unmet dependencies first
   - Requires dependency graph analysis
   - Complex, defer to later phase

**For RALPH-024:** Use ROADMAP document order only. This is sufficient for initial implementation and avoids complexity.

**Priority field in runtime task:**

- Default: `"medium"` for all created tasks
- Override: Parse from ROADMAP metadata if present (future)
- Manual: Human can edit task-state.json to adjust priority

---

### C. How should blocked tasks be skipped?

**Blocked task handling:**

1. **Detection:** Task status is `blocked` in ROADMAP.md
2. **Action:** Skip task, do not create runtime entry
3. **Logging:** Log as info: "Skipping blocked task: {id}"
4. **Reporting:** Include in dry-run output under "skipped_tasks"
5. **Reason:** Include skip reason: "roadmap_status_blocked"

**Blocked task criteria:**

- Explicit `Status: blocked` in ROADMAP
- No other criteria (keep simple for RALPH-024)

**Future enhancements:**

- Parse blocker reason from ROADMAP
- Store blocker metadata in skip log
- Support unblocking workflow

**Example skip log entry:**

```json
{
  "event_type": "task.creation_skipped",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_id": "P2-001",
  "skip_reason": "roadmap_status_blocked",
  "roadmap_status": "blocked",
  "roadmap_section": "TIER 2 > EPIC: Supabase Foundation",
  "roadmap_line": 547
}
```

---

### D. How should already-existing runtime tasks be handled?

**Existing runtime task handling:**

1. **Detection:** Task ID already exists in `tasks/task-state.json`
2. **Action:** Skip creation, do not modify existing task
3. **Logging:** Log as info: "Task {id} already exists in runtime state"
4. **Reporting:** Include in dry-run output under "skipped_tasks"
5. **Reason:** Include skip reason: "already_exists_in_runtime"
6. **Preservation:** Existing runtime state is never modified by creation pipeline

**Rationale:**

- Runtime state is authoritative for execution metadata
- Creation pipeline is additive only, never modifies
- Reconciler handles status drift detection
- Prevents accidental overwrites

**Edge cases:**

**Case 1: ROADMAP task exists, runtime task exists, statuses differ**

- Action: Skip creation
- Reconciler will detect drift and report as finding
- Human resolves drift manually or via future sync tool

**Case 2: ROADMAP task exists, runtime task exists, runtime task is `done`**

- Action: Skip creation
- This is normal: task was completed
- Reconciler reports as info (expected state)

**Case 3: ROADMAP task exists, runtime task exists, runtime task is `runtime_only: true`**

- Action: Skip creation
- This is an error: ROADMAP task should not have same ID as runtime-only task
- Reconciler reports as critical finding
- Human must resolve ID collision

**Example skip log entry:**

```json
{
  "event_type": "task.creation_skipped",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_id": "RALPH-001A",
  "skip_reason": "already_exists_in_runtime",
  "existing_runtime_status": "done",
  "existing_runtime_only": true,
  "roadmap_status": "todo"
}
```

---

### E. What metadata must be generated automatically?

**Required auto-generated metadata:**

| Field                   | Generation Rule                   | Example                        |
| ----------------------- | --------------------------------- | ------------------------------ |
| `id`                    | Copy from ROADMAP task ID         | `"P1-003"`                     |
| `title`                 | Copy from ROADMAP task title      | `"Multi-Item Split"`           |
| `status`                | Map from ROADMAP status           | `"not_started"` (from `todo`)  |
| `priority`              | Default or parse from ROADMAP     | `"medium"` (default)           |
| `risk_level`            | Default or infer from DoD         | `"review_required"` (default)  |
| `runtime_only`          | Set to `false` for ROADMAP-backed | `false`                        |
| `created_at`            | Current timestamp (ISO8601)       | `"2026-05-23T18:00:00Z"`       |
| `updated_at`            | Same as `created_at` initially    | `"2026-05-23T18:00:00Z"`       |
| `attempt_count`         | Initialize to 0                   | `0`                            |
| `max_attempts`          | Default based on risk level       | `3`                            |
| `requires_human_review` | Default based on risk level       | `true` (for `review_required`) |

**Optional auto-generated metadata:**

| Field                        | Generation Rule                  | Example                                 |
| ---------------------------- | -------------------------------- | --------------------------------------- |
| `source`                     | Set to `"roadmap_import"`        | `"roadmap_import"`                      |
| `roadmap_section`            | Parse from ROADMAP section stack | `"PHASE 1 > EPIC: Resolver"`            |
| `roadmap_line`               | Line number from parser          | `518`                                   |
| `roadmap_status`             | Original ROADMAP status          | `"todo"`                                |
| `acceptance_criteria`        | Parse from DoD section           | `["ei und quark produces two entries"]` |
| `validation.type`            | Infer from task type             | `"standard"`                            |
| `validation.required_checks` | Default set                      | `["npm_run_verify"]`                    |

**Not auto-generated (require human input or future enhancement):**

| Field             | Why Not Auto-Generated            | Future Enhancement                     |
| ----------------- | --------------------------------- | -------------------------------------- |
| `allowed_files`   | Requires scope analysis           | Parse from DoD or infer from task type |
| `forbidden_files` | Requires safety analysis          | Use default protected file list        |
| `outputs`         | Requires implementation knowledge | Parse from DoD or leave empty          |
| `notes`           | Requires human context            | Leave empty or copy from ROADMAP       |

---

### F. What conditions prevent task creation?

**Blocking conditions (prevent ALL task creation):**

1. **Reconciler baseline failure:** `exit_code ≠ 0` or `critical_count > 0`
2. **Validator baseline failure:** `exit_code ≠ 0` or `critical_count > 0`
3. **Working tree not clean:** Uncommitted changes detected
4. **task-state.json corrupted:** JSON parse error or schema violation
5. **ROADMAP.md parse failure:** Parser cannot read ROADMAP reliably
6. **Protected file violation:** Creation would require modifying protected files

**Skip conditions (prevent SPECIFIC task creation):**

1. **Task already exists:** ID found in `tasks/task-state.json`
2. **Duplicate ID in ROADMAP:** Multiple canonical definitions with same ID
3. **Invalid task ID:** ID doesn't match canonical pattern
4. **Missing required metadata:** No title, no status, or unparseable
5. **Blocked status:** Task status is `blocked` in ROADMAP
6. **Done status:** Task status is `done` in ROADMAP
7. **Parsing ambiguity:** Task parsed from checkbox reference, not canonical heading
8. **Safety violation:** DoD/Verify text indicates forbidden operations (future)

**Warning conditions (allow creation but flag for review):**

1. **Large batch:** More than 5 tasks in single creation run
2. **High-risk task:** Task has `risk_level: "human_required"`
3. **Missing DoD:** Task has no DoD/Verify section in ROADMAP
4. **Incomplete metadata:** Optional fields missing
5. **Section ambiguity:** Task section path unclear

**Example prevention logic:**

```javascript
// Blocking check
if (reconcilerExitCode !== 0) {
  console.error("Reconciler baseline failed, aborting task creation");
  process.exit(1);
}

// Skip check
if (existingTaskIds.has(taskId)) {
  console.info(`Skipping task ${taskId}: already exists in runtime`);
  skippedTasks.push({ taskId, reason: "already_exists" });
  continue;
}

// Warning check
if (eligibleTasks.length > 5) {
  console.warn(`Large batch creation: ${eligibleTasks.length} tasks`);
  requiresHumanReview = true;
}
```

---

## 12. Recommended RALPH-024 Implementation Scope

### 12.1 Core Implementation

**File:** `scripts/agent/create-runtime-tasks.mjs`

**Functionality:**

1. Parse ROADMAP.md using existing reconciler parser
2. Filter eligible tasks (status=`todo`, not in runtime)
3. Generate runtime task entries with required metadata
4. Validate new tasks against schema
5. Write to task-state.json atomically
6. Log creation events to task-history.jsonl
7. Generate handoff documentation

**CLI Interface:**

```bash
# Dry-run mode (preview only, no changes)
node scripts/agent/create-runtime-tasks.mjs --dry-run

# Create tasks (requires human approval)
node scripts/agent/create-runtime-tasks.mjs

# Create specific task only
node scripts/agent/create-runtime-tasks.mjs --task-id P1-003

# Limit batch size
node scripts/agent/create-runtime-tasks.mjs --max-tasks 3

# JSON output
node scripts/agent/create-runtime-tasks.mjs --json

# Help
node scripts/agent/create-runtime-tasks.mjs --help
```

**Exit codes:**

- 0: Success (tasks created or dry-run completed)
- 1: Validation failure (baseline checks failed)
- 2: Creation failure (task creation failed)
- 3: Rollback executed (creation rolled back due to error)

### 12.2 Safety Features

**Pre-creation checks:**

- ✅ Reconciler baseline (exit_code=0)
- ✅ Validator baseline (exit_code=0)
- ✅ Working tree clean
- ✅ task-state.json valid JSON
- ✅ ROADMAP.md parseable

**Creation-time validation:**

- ✅ Duplicate detection
- ✅ ID format validation
- ✅ Schema compliance
- ✅ Required field presence

**Post-creation verification:**

- ✅ Reconciler still green
- ✅ Validator still green
- ✅ JSON validity
- ✅ ID uniqueness

**Rollback capability:**

- ✅ Backup task-state.json before modification
- ✅ Restore on any validation failure
- ✅ Atomic write (temp file + rename)

### 12.3 Evidence & Audit Trail

**Creation events logged to `tasks/task-history.jsonl`:**

```json
{
  "event_id": "evt_2026-05-23_task-created_p1-003",
  "event_type": "task.created",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_id": "P1-003",
  "source": "roadmap_import",
  "roadmap_section": "PHASE 1 > EPIC: Resolver & Normalization",
  "roadmap_line": 518,
  "roadmap_status": "todo",
  "initial_runtime_status": "not_started",
  "created_by": "create-runtime-tasks.mjs",
  "pipeline_version": "1.0.0"
}
```

**Validation evidence logged to `validation/validation-results.jsonl`:**

```json
{
  "validation_id": "val_2026-05-23_task-creation_batch-001",
  "event_type": "validation.task_creation",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_ids": ["P1-003"],
  "validation_type": "runtime_task_creation",
  "overall_result": "passed",
  "created_task_count": 1,
  "skipped_task_count": 0
}
```

**Review evidence logged to `review/review-results.jsonl`:**

```json
{
  "review_id": "rev_2026-05-23_task-creation_batch-001",
  "event_type": "review.requested",
  "timestamp": "2026-05-23T18:00:00Z",
  "task_ids": ["P1-003"],
  "review_type": "runtime_task_creation",
  "review_status": "pending"
}
```

### 12.4 Out of Scope for RALPH-024

**Deferred to future enhancements:**

- ❌ Automatic task selection after creation (use existing selector)
- ❌ Dependency graph analysis
- ❌ Priority parsing from ROADMAP metadata
- ❌ Risk level inference from DoD text
- ❌ Allowed/forbidden file inference
- ❌ Acceptance criteria parsing
- ❌ Section-based priority resolution
- ❌ `in_progress` recovery mode
- ❌ Batch creation optimization
- ❌ Parallel task creation
- ❌ Incremental creation (create only new tasks)
- ❌ Automatic ROADMAP status sync (reconciler only)

**Explicitly forbidden for RALPH-024:**

- ❌ Modifying ROADMAP.md
- ❌ Modifying existing runtime tasks
- ❌ Automatic task execution
- ❌ Bypassing human review
- ❌ Modifying reconciler/validator logic
- ❌ Changing task-state.json schema
- ❌ Product code changes
- ❌ Dependency changes

### 12.5 Testing Strategy

**Unit tests:**

- Parser integration (reuse reconciler parser)
- Duplicate detection logic
- Schema validation
- Status mapping
- Metadata generation

**Integration tests:**

- Full creation pipeline (dry-run)
- Reconciler integration
- Validator integration
- Evidence logging
- Rollback mechanism

**Manual testing:**

- Dry-run with current ROADMAP
- Create single task
- Create small batch (3 tasks)
- Verify reconciler output
- Verify validator output
- Test rollback on failure

**Test fixtures:**

- Sample ROADMAP.md with various task types
- Sample task-state.json with existing tasks
- Expected output for each test case

### 12.6 Documentation Requirements

**Files to create/update:**

- ✅ `scripts/agent/create-runtime-tasks.mjs` (new script)
- ✅ `scripts/agent/__tests__/create-runtime-tasks.test.mjs` (new tests)
- ✅ `reports/RALPH-024_RUNTIME_TASK_CREATION_REPORT.md` (implementation report)
- ✅ `handoffs/latest-handoff.md` (handoff after RALPH-024)
- ✅ `package.json` (add `agent:create-tasks` script)
- ✅ `README.md` or `scripts/agent/README.md` (document new script)

**Documentation content:**

- Script purpose and usage
- CLI flags and options
- Safety features and gates
- Rollback procedure
- Troubleshooting guide
- Example workflows

---

## 13. Architecture Overview

### 13.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     ROADMAP.md (Planning Authority)          │
│                                                              │
│  - Task definitions (canonical)                              │
│  - Task status (planning)                                    │
│  - Task priorities (human-curated)                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ (read-only)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│          Runtime Task Creation Pipeline (RALPH-024)          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 1. Pre-Creation Safety Checks                          │ │
│  │    - Reconciler baseline (exit_code=0)                 │ │
│  │    - Validator baseline (exit_code=0)                  │ │
│  │    - Working tree clean                                │ │
│  │    - task-state.json valid                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2. ROADMAP Parsing (reuse reconciler parser)           │ │
│  │    - Parse task definitions                            │ │
│  │    - Extract metadata                                  │ │
│  │    - Build section context                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 3. Task Filtering & Selection                          │ │
│  │    - Filter by status (todo only)                      │ │
│  │    - Duplicate detection                               │ │
│  │    - Priority resolution (document order)              │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 4. Runtime Task Generation                             │ │
│  │    - Generate required metadata                        │ │
│  │    - Apply defaults                                    │ │
│  │    - Validate schema compliance                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 5. Atomic Write                                        │ │
│  │    - Backup current state                              │ │
│  │    - Write to temp file                                │ │
│  │    - Rename to task-state.json                         │ │
│  │    - Verify write success                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 6. Evidence Logging                                    │ │
│  │    - Log to task-history.jsonl                         │ │
│  │    - Log to validation-results.jsonl                   │ │
│  │    - Log to review-results.jsonl                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 7. Post-Creation Verification                          │ │
│  │    - Reconciler still green                            │ │
│  │    - Validator still green                             │ │
│  │    - Rollback on failure                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 8. Handoff Generation                                  │ │
│  │    - Generate handoff document                         │ │
│  │    - Request human review                              │ │
│  │    - Stop for approval                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ (write)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              tasks/task-state.json (Runtime State)           │
│                                                              │
│  - Runtime task entries (execution state)                    │
│  - Execution metadata                                        │
│  - Lifecycle status                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ (read by)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Task Selector (existing)                        │
│                                                              │
│  - Select next eligible task                                 │
│  - Update runs/current-run.json                              │
│  - Trigger agent execution                                   │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ROADMAP Task Lifecycle                    │
└─────────────────────────────────────────────────────────────┘

    [ROADMAP: todo]
           │
           │ (creation pipeline)
           ↓
    [Runtime: not_started]
           │
           │ (task selector)
           ↓
    [Runtime: in_progress]
           │
           │ (agent execution)
           ↓
    [Runtime: needs_validation]
           │
           │ (validation passes)
           ↓
    [Runtime: needs_review]
           │
           │ (review accepted)
           ↓
    [Runtime: done]
           │
           │ (manual human update OR future automation)
           ↓
    [ROADMAP: done]


Alternative paths:

    [Runtime: in_progress]
           │
           │ (blocker detected)
           ↓
    [Runtime: blocked]

    [Runtime: needs_validation]
           │
           │ (validation fails)
           ↓
    [Runtime: failed]

    [Runtime: needs_review]
           │
           │ (review rejected)
           ↓
    [Runtime: cancelled]
```

### 13.3 Data Flow Diagram

```
┌──────────────┐
│  ROADMAP.md  │
│  (planning)  │
└──────┬───────┘
       │
       │ read
       ↓
┌──────────────────────────────────────────────────────────┐
│  Reconciler Parser                                       │
│  - parseRoadmap()                                        │
│  - Extract task definitions                              │
│  - Build section context                                 │
└──────┬───────────────────────────────────────────────────┘
       │
       │ task list
       ↓
┌──────────────────────────────────────────────────────────┐
│  Task Filter                                             │
│  - Filter by status (todo)                               │
│  - Check duplicates                                      │
│  - Apply selection criteria                              │
└──────┬───────────────────────────────────────────────────┘
       │
       │ eligible tasks
       ↓
┌──────────────────────────────────────────────────────────┐
│  Runtime Task Generator                                  │
│  - Generate required metadata                            │
│  - Apply defaults                                        │
│  - Validate schema                                       │
└──────┬───────────────────────────────────────────────────┘
       │
       │ runtime tasks
       ↓
┌──────────────────────────────────────────────────────────┐
│  Atomic Writer                                           │
│  - Backup current state                                  │
│  - Write to temp file                                    │
│  - Rename atomically                                     │
└──────┬───────────────────────────────────────────────────┘
       │
       │ write
       ↓
┌──────────────────┐     ┌──────────────────────────────┐
│ task-state.json  │     │  Evidence Streams            │
│ (runtime state)  │     │  - task-history.jsonl        │
└──────────────────┘     │  - validation-results.jsonl  │
                         │  - review-results.jsonl      │
                         └──────────────────────────────┘
```

---

## 14. Test Matrix

### 14.1 Unit Test Cases

| Test Case             | Input                  | Expected Output         | Rationale                   |
| --------------------- | ---------------------- | ----------------------- | --------------------------- |
| **Parse ROADMAP**     | Valid ROADMAP.md       | Task list with metadata | Verify parser integration   |
| **Filter todo tasks** | Mixed status tasks     | Only `todo` tasks       | Verify status filtering     |
| **Detect duplicates** | Task ID in runtime     | Skip creation           | Verify duplicate detection  |
| **Generate metadata** | ROADMAP task           | Complete runtime task   | Verify metadata generation  |
| **Validate schema**   | Generated task         | Schema compliance       | Verify schema validation    |
| **Map status**        | `todo` → `not_started` | Correct mapping         | Verify status mapping       |
| **Handle blocked**    | `blocked` task         | Skip creation           | Verify blocked handling     |
| **Handle done**       | `done` task            | Skip creation           | Verify done handling        |
| **Invalid ID**        | Malformed task ID      | Skip creation           | Verify ID validation        |
| **Missing title**     | Task without title     | Skip creation           | Verify required field check |

### 14.2 Integration Test Cases

| Test Case                  | Setup              | Action               | Expected Result            | Verification                       |
| -------------------------- | ------------------ | -------------------- | -------------------------- | ---------------------------------- |
| **Dry-run mode**           | Valid ROADMAP      | Run with `--dry-run` | Preview output, no changes | task-state.json unchanged          |
| **Create single task**     | 1 eligible task    | Run creation         | 1 task created             | Reconciler green, validator green  |
| **Create batch**           | 3 eligible tasks   | Run creation         | 3 tasks created            | Reconciler green, validator green  |
| **Skip duplicates**        | 1 existing, 1 new  | Run creation         | 1 created, 1 skipped       | Correct skip reason logged         |
| **Skip blocked**           | 1 blocked task     | Run creation         | 0 created, 1 skipped       | Correct skip reason logged         |
| **Rollback on failure**    | Corrupt task-state | Run creation         | Rollback executed          | Original state restored            |
| **Evidence logging**       | Create 1 task      | Run creation         | Evidence written           | All 3 evidence streams updated     |
| **Reconciler integration** | Green baseline     | Run creation         | Still green                | exit_code=0 before and after       |
| **Validator integration**  | Green baseline     | Run creation         | Still green                | exit_code=0 before and after       |
| **Handoff generation**     | Create tasks       | Run creation         | Handoff written            | handoffs/latest-handoff.md updated |

### 14.3 Manual Test Scenarios

| Scenario              | Steps                                                                  | Expected Outcome                  | Success Criteria                    |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------- | ----------------------------------- |
| **First run**         | 1. Dry-run<br>2. Review output<br>3. Run creation<br>4. Review handoff | Tasks created, handoff generated  | Human approval, reconciler green    |
| **Incremental run**   | 1. Create 3 tasks<br>2. Run again<br>3. Verify skips                   | Existing tasks skipped            | No duplicates, correct skip reasons |
| **Recovery scenario** | 1. Corrupt task-state<br>2. Run creation<br>3. Verify rollback         | Rollback executed, state restored | Original state intact               |
| **Large batch**       | 1. Create 10+ tasks<br>2. Verify review gate                           | Review required                   | Human review triggered              |
| **Edge cases**        | 1. Empty ROADMAP<br>2. All tasks blocked<br>3. All tasks done          | Graceful handling                 | Appropriate messages, no errors     |

---

## 15. Governance Compliance

This design is consistent with:

- ✅ **SSOK.md:** ROADMAP.md remains planning authority; runtime state is execution authority; no planning truth created by runtime
- ✅ **AGENTS.md:** Respects Ralph-Loop safety (read-only ROADMAP, explicit task creation, stop-for-review)
- ✅ **ROADMAP.md:** Aligns with existing task format and ownership model
- ✅ **VERIFY.md:** Category 1 (documentation-only) verification for RALPH-023; Category 4 (product/runtime code) for RALPH-024
- ✅ **RALPH-015:** Implements ownership classification model (`roadmap_backed` for created tasks)
- ✅ **RALPH-022:** Maintains green baseline (reconciler/validator must remain green)
- ✅ **.governance/SYSTEM.md:** Respects lifecycle gates and stop conditions
- ✅ **.governance/RULES.md:** One-task-per-run (creation is one task), no product code changes for RALPH-023
- ✅ **.governance/SAFETY.md:** No protected file modifications, no forbidden operations
- ✅ **.governance/REVIEW_POLICY.md:** Human review required after creation

---

## 16. Acceptance Criteria for RALPH-023

This design task is complete when:

1. ✅ Runtime task lifecycle analyzed
2. ✅ Task selection criteria defined
3. ✅ Required task-state fields specified
4. ✅ Source attribution rules defined
5. ✅ Duplicate prevention strategy designed
6. ✅ Reconciliation implications analyzed
7. ✅ Failure and recovery scenarios documented
8. ✅ Validation/review gate interaction designed
9. ✅ Human override requirements specified
10. ✅ Migration risks assessed
11. ✅ All 6 specific questions answered (A-F)
12. ✅ Architecture overview provided
13. ✅ State diagram provided
14. ✅ Test matrix defined
15. ✅ RALPH-024 implementation scope recommended

---

## 17. Next Steps

### Human Review Required

1. Review design document for completeness and correctness
2. Approve task selection algorithm (ROADMAP order only for RALPH-024)
3. Approve runtime task schema (required and optional fields)
4. Approve safety gates and rollback strategy
5. Approve RALPH-024 implementation scope

### After Approval

1. Create RALPH-024 task in ROADMAP.md (if approved)
2. Implement `scripts/agent/create-runtime-tasks.mjs`
3. Implement unit tests
4. Implement integration tests
5. Execute manual testing (dry-run, single task, small batch)
6. Run validation: reconciler/validator before and after
7. Generate handoff and request human review
8. Update ROADMAP.md task status to `done`

---

## 18. Summary

**Design conclusion:** The Runtime Task Creation Pipeline is a critical bridge between planning authority (ROADMAP.md) and runtime execution (task-state.json). This design provides a safe, deterministic, and auditable mechanism for creating runtime tasks from ROADMAP definitions.

**Key design decisions:**

- **Read-only ROADMAP:** Never modify planning authority
- **Additive only:** Never modify existing runtime tasks
- **Conservative defaults:** Safe defaults for all metadata
- **Robust duplicate detection:** Multiple collision checks
- **Atomic writes:** Rollback on any failure
- **Full audit trail:** Evidence in all streams
- **Mandatory human review:** Stop after creation for approval

**Recommended implementation:** RALPH-024 should implement core functionality with conservative scope (todo tasks only, ROADMAP order priority, default metadata). Defer enhancements (dependency analysis, priority parsing, risk inference) to future tasks.

**Risk assessment:** Low risk with proper safety gates. Rollback capability and green baseline verification ensure repository integrity.

**Validation strategy:** Pre/post reconciler and validator checks ensure no regressions. Dry-run mode enables safe testing.

---

**End of RALPH-023 Design Report**
