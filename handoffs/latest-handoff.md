# RALPH-018 Handoff — ROADMAP Parser Canonicalization

**Task ID:** RALPH-018  
**Generated:** 2026-05-23T16:04:53Z  
**Status:** Implementation complete, awaiting human review  
**Agent:** Cline  
**Category:** Ralph-Loop tooling / reconciler enhancement

---

## Task Summary

Implemented ROADMAP parser canonicalization to resolve the P0-002 false duplicate task finding by distinguishing between canonical task definitions (heading-style sections) and task references (checkbox lines).

---

## What Was Done

### 1. Parser Implementation

**File:** `scripts/agent/reconcile-roadmap-task-state.mjs`

**Changes:**
- Modified `parseRoadmap()` to return `{ tasks, taskReferences }` instead of flat array
- Heading-style task sections (`## TASK_ID Title`) → canonical task definitions
- Checkbox task lines (`- [x] TASK_ID: Title`) → reference-only entries (captured separately)
- Added `task_references` array to output schema
- Added `task_reference_count` to summary
- Preserved backward compatibility in `buildResultFromInputs()`

**Key logic change:**
```javascript
// Before: Both patterns created canonical tasks
const headerMatch = line.match(ROADMAP_TASK_HEADER);
const checkboxMatch = headerMatch ? null : line.match(CHECKBOX_TASK);
if (!headerMatch && !checkboxMatch) return;

// After: Only headings are canonical, checkboxes are references
const headerMatch = line.match(ROADMAP_TASK_HEADER);
if (headerMatch) {
  tasks.push({ id, title, status, ... }); // Canonical
  return;
}
const checkboxMatch = line.match(CHECKBOX_TASK);
if (checkboxMatch) {
  taskReferences.push({ id, title, checkbox_state, ... }); // Reference only
}
```

### 2. Test Coverage

**File:** `scripts/agent/__tests__/reconcile-roadmap-task-state.test.mjs`

**Added 7 new tests:**
1. Checkbox reference does not create canonical task entry
2. Checkbox reference is captured separately as task reference
3. Checkbox-only reference creates no canonical task
4. Heading-style tasks still parsed with full metadata
5. Duplicate heading definitions still produce critical finding
6. Summary includes task_reference_count
7. Backward compatibility: parseRoadmap returns object with tasks array

**Test results:** 21/21 tests passed (14 existing + 7 new)

### 3. Verification

**Syntax checks:**
- ✓ `node --check scripts/agent/reconcile-roadmap-task-state.mjs`
- ✓ `node --check scripts/agent/__tests__/reconcile-roadmap-task-state.test.mjs`

**Test suite:**
- ✓ `node --test scripts/agent/__tests__/reconcile-roadmap-task-state.test.mjs` (21/21 pass)

**Reconciler output on current ROADMAP.md:**
- ✓ `exit_code: 0` (no critical findings)
- ✓ `critical_count: 0`
- ✓ `roadmap_task_count: 27` (heading-style canonical tasks)
- ✓ `task_reference_count: 1` (checkbox reference at line 40)
- ✓ P0-002 duplicate finding **RESOLVED** (no `duplicate_roadmap_task_id` for P0-002)

---

## Changed Files

```
M scripts/agent/__tests__/reconcile-roadmap-task-state.test.mjs (+82 lines)
M scripts/agent/reconcile-roadmap-task-state.mjs (+65 lines, -22 lines)
```

**Total:** 2 files changed, 125 insertions(+), 22 deletions(-)

---

## Unchanged Files (Verified)

- ✓ ROADMAP.md (no content edits)
- ✓ tasks/task-state.json (read-only reconciler)
- ✓ runs/current-run.json (read-only reconciler)
- ✓ validation/validation-rules.json (no validation changes)
- ✓ package.json (no dependency changes)
- ✓ package-lock.json (no dependency changes)

---

## Key Results

### P0-002 Duplicate Finding Resolution

**Before RALPH-018:**
- Parser found 2 P0-002 entries (line 40 checkbox + line 401 heading)
- Reconciler reported `duplicate_roadmap_task_id` critical finding
- Exit code: 1 (critical findings)

**After RALPH-018:**
- Parser finds 1 canonical P0-002 task (line 401 heading)
- Parser finds 1 P0-002 reference (line 40 checkbox)
- No duplicate finding
- Exit code: 0 (ok)

### Output Schema Extension

**New fields:**
- `summary.task_reference_count`: Number of checkbox references
- `task_references[]`: Array of reference entries with `{ id, title, checkbox_state, line, section }`

**Backward compatibility:**
- All existing fields preserved
- Exit codes unchanged (0, 1, 2)
- Ownership classification logic unchanged

---

## Acceptance Criteria

### Required Checks (VERIFY.md Category 3)

- ✓ Syntax checks pass
- ✓ Test suite passes (21/21)
- ✓ Git status documented
- ✓ Git diff documented

### Task-Specific Criteria

1. ✓ Checkbox reference + heading definition with same ID → exactly one canonical task
2. ✓ Checkbox-only reference → zero canonical tasks, one reference
3. ✓ Heading-only task → unchanged parsing behavior
4. ✓ Duplicate heading definitions → still critical finding
5. ✓ Existing ownership classification tests → continue passing unchanged
6. ✓ Existing exit-code behavior → unchanged
7. ✓ P0-002 duplicate finding → no longer appears
8. ✓ Duplicate heading definitions → still produce critical finding
9. ✓ Checkbox references → preserved as references
10. ✓ No ROADMAP/runtime/evidence/package files modified

---

## Implementation Notes

### Design Decisions

1. **Canonical vs. Reference Distinction:**
   - Heading-style sections are canonical because they contain full metadata (Status, DoD, Verify)
   - Checkbox lines are references because they only contain checkbox state and title
   - This aligns with existing ROADMAP.md usage (27 heading-style tasks, 1 checkbox reference)

2. **Reference Preservation:**
   - Checkbox references are not discarded, but captured separately
   - Enables future cross-reference validation (e.g., warn if checkbox references non-existent task)
   - Current scope: reference collection only, no validation

3. **Backward Compatibility:**
   - `buildResultFromInputs()` handles both old array format and new object format
   - Ensures existing code using the reconciler continues to work

### Risks Mitigated

- ✓ Parser regression: All existing tests pass
- ✓ Ownership classification regression: All ownership tests pass
- ✓ Exit code changes: CLI integration tests verify unchanged behavior
- ✓ False positive removal: P0-002 duplicate resolved without losing real duplicate detection

---

## Next Steps

### Human Review Required

1. Review parser canonicalization logic
2. Review test coverage
3. Verify P0-002 duplicate finding resolution
4. Approve changed files

### After Approval

1. Commit changes to repository
2. Update ROADMAP.md task status to `done` (if RALPH-018 exists in ROADMAP)
3. Consider adding ROADMAP.md documentation note about canonical task format (optional)

---

## Governance Compliance

- ✓ **SSOK.md:** ROADMAP.md remains planning authority; heading-style sections are canonical
- ✓ **AGENTS.md:** Read-only reconciler, no file modifications beyond allowed scope
- ✓ **ROADMAP.md:** Aligns with existing task format usage
- ✓ **VERIFY.md:** Category 3 (test-only) verification completed
- ✓ **RALPH-015:** Ownership classification logic preserved
- ✓ **RALPH-017:** Implements canonicalization plan as specified

---

## Evidence

**Implementation report:** `reports/RALPH-018_ROADMAP_PARSER_CANONICALIZATION_REPORT.md`

**Test output:**
```
✔ 21/21 tests passed
Duration: 251.29ms
```

**Reconciler output:**
```json
{
  "summary": {
    "status": "ok",
    "roadmap_task_count": 27,
    "task_reference_count": 1,
    "critical_count": 0,
    "exit_code": 0
  }
}
```

---

**End of RALPH-018 Handoff**
