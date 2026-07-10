# RALPH-019 Ownership-Aware Severity Alignment Plan

**Task ID:** RALPH-019  
**Generated:** 2026-05-23T16:11:45Z  
**Status:** Analysis complete, awaiting human review  
**Category:** Documentation / governance analysis only

---

## 1. Executive Summary

This report analyzes the current severity logic in the ROADMAP/runtime reconciler and proposes ownership-aware severity alignment to reduce false-positive warnings for legitimate `runtime_only` tasks.

**Key Finding:** The reconciler already has partial ownership-awareness for two finding codes. The primary gap is that 10 RALPH-XXX runtime tasks have `ownership_explicit: false`, causing them to produce `warning` severity instead of `info`.

**Recommendation:** RALPH-020 should set `runtime_only: true` on all RALPH-XXX tasks in `tasks/task-state.json` to align severity with ownership intent.

---

## 2. Current Severity Inventory

### 2.1 Live Reconciler State (2026-05-23T16:10:06Z)

**ROADMAP.md:**

- 27 tasks (all product tasks: P0-xxx, P1-xxx, P2-xxx, RESOLVER-V2-xxx)
- No RALPH-XXX tasks in ROADMAP.md

**tasks/task-state.json:**

- 10 tasks (all RALPH-001A through RALPH-010A)
- All `status: "done"`
- All `runtime_only: false` (should be `true`)
- All `ownership_explicit: false` (derived from `runtime_only: false`)

**Reconciler output:**

- 37 findings: 0 critical, 11 warnings, 26 info
- 0 `roadmap_backed` tasks (no overlap between authorities)
- 10 `runtime_only` tasks (all RALPH-XXX)
- 27 `roadmap_only` tasks (all product tasks)

### 2.2 Finding Code Inventory

| Code                                     | Current Severity                                                      | Ownership Applicability            | Governance Impact                                    | Ownership-Aware?                                   |
| ---------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `duplicate_roadmap_task_id`              | `critical`                                                            | `roadmap_backed` or `roadmap_only` | Breaks stable task identity and evidence linkage     | No (hardcoded)                                     |
| `duplicate_task_state_id`                | `critical`                                                            | `roadmap_backed` or `runtime_only` | Breaks stable task identity and evidence linkage     | No (hardcoded)                                     |
| `unknown_roadmap_status`                 | `warning`                                                             | Task's own class                   | Invalid status vocabulary                            | No (hardcoded)                                     |
| `unknown_task_state_status`              | `warning`                                                             | Task's own class                   | Invalid status vocabulary                            | No (hardcoded)                                     |
| `roadmap_task_missing_from_task_state`   | `info` (done/todo) or `warning` (in_progress)                         | `roadmap_only`                     | Missing runtime visibility for active work           | **Yes** (via `severityForMissingRuntime()`)        |
| `runtime_task_missing_from_roadmap`      | `info` (explicit runtime_only), `warning` (done), `critical` (active) | `runtime_only`                     | Runtime state must not create planning truth         | **Yes** (via `severityForRuntimeMissingRoadmap()`) |
| `roadmap_done_runtime_active`            | `critical`                                                            | `roadmap_backed`                   | Planning says complete while runtime says incomplete | No (hardcoded)                                     |
| `runtime_done_roadmap_not_done`          | `critical`                                                            | `roadmap_backed`                   | Runtime claims done without planning authority       | No (hardcoded)                                     |
| `roadmap_status_differs_from_task_state` | `warning`                                                             | `roadmap_backed`                   | Status drift between authorities                     | No (hardcoded)                                     |

**Total:** 9 finding codes, 2 already ownership-aware, 7 ownership-blind.

---

## 3. Critical Findings That Must Never Downgrade

These findings represent governance violations that must always remain `critical` regardless of ownership classification:

### 3.1 Duplicate Canonical Task ID

**Finding codes:**

- `duplicate_roadmap_task_id`
- `duplicate_task_state_id`

**Why critical:**

- Task IDs are stable and never reused (SSOK.md, AGENTS.md)
- Duplicate canonical IDs break evidence linkage
- Ambiguous identity prevents safe task selection
- Violates fundamental governance contract

**Ownership impact:** None. Duplicates are always critical.

**Recommendation:** Keep `critical` severity. No ownership-aware logic needed.

---

### 3.2 ROADMAP Done While Runtime Active

**Finding code:** `roadmap_done_runtime_active`

**Why critical:**

- Planning authority says complete while runtime says incomplete
- Dependent planning may proceed incorrectly
- Violates ROADMAP.md as planning authority (SSOK.md)
- Must stop for human reconciliation

**Ownership impact:** Only applies to `roadmap_backed` tasks (both authorities exist).

**Recommendation:** Keep `critical` severity. No ownership-aware logic needed (finding only emitted for `roadmap_backed`).

---

### 3.3 Runtime Done While ROADMAP Not Done

**Finding code:** `runtime_done_roadmap_not_done`

**Why critical:**

- Runtime claims completion without planning authority
- Violates ROADMAP.md as planning authority (SSOK.md)
- Dependent planning may proceed incorrectly
- Must stop for human reconciliation

**Ownership impact:** Only applies to `roadmap_backed` tasks (both authorities exist).

**Recommendation:** Keep `critical` severity. No ownership-aware logic needed (finding only emitted for `roadmap_backed`).

---

### 3.4 Active Runtime Task Without Explicit Runtime-Only Marker

**Finding code:** `runtime_task_missing_from_roadmap` (when `status` is active and `ownership_explicit: false`)

**Why critical:**

- Active runtime task appears to represent product/planning work
- Should have ROADMAP authority if not explicitly runtime-only
- Runtime state must not create planning truth (RALPH-015)
- Prevents silent planning authority bypass

**Current severity logic:**

```javascript
function severityForRuntimeMissingRoadmap(runtimeTask) {
  if (runtimeTask.runtime_only === true) return 'info';
  if (runtimeTask.status === 'done') return 'warning';
  return 'critical';
}
```

**Ownership impact:** Already ownership-aware. Active tasks without explicit marker are `critical`.

**Recommendation:** Keep existing logic. This is correct.

---

## 4. Candidate Ownership-Aware Findings

These findings could safely downgrade when ownership classification indicates legitimate runtime-only work:

### 4.1 Runtime Task Missing From ROADMAP (Already Ownership-Aware)

**Finding code:** `runtime_task_missing_from_roadmap`

**Current severity logic:**

- `info` when `runtime_only: true` (explicit runtime-only marker)
- `warning` when `status: "done"` and `runtime_only: false`
- `critical` when active and `runtime_only: false`

**Ownership impact:**

- `ownership_explicit: true` (derived from `runtime_only: true`) → `info` (legitimate runtime-only work)
- `ownership_explicit: false` + `done` → `warning` (done without explicit classification)
- `ownership_explicit: false` + active → `critical` (active work without planning authority)

**Current gap:** All 10 RALPH-XXX tasks have `runtime_only: false`, producing 10 `warning` findings instead of 10 `info` findings.

**Recommendation:** RALPH-020 should set `runtime_only: true` on all RALPH-XXX tasks. No severity logic changes needed.

---

### 4.2 ROADMAP Task Missing From Task-State (Already Ownership-Aware)

**Finding code:** `roadmap_task_missing_from_task_state`

**Current severity logic:**

- `info` when `roadmap_status: "done"` or `roadmap_status: "todo"`
- `warning` when `roadmap_status: "in_progress"`

**Ownership impact:**

- `roadmap_only` + `done` → `info` (historical/product completion outside Ralph runtime)
- `roadmap_only` + `todo` → `info` (normal backlog not yet imported)
- `roadmap_only` + `in_progress` → `warning` (active work without runtime visibility)

**Rationale:**

- ROADMAP owns planning backlog; runtime absence is expected before execution
- `in_progress` without runtime state suggests missing runtime visibility
- `done` without runtime state is valid for pre-Ralph work

**Recommendation:** Keep existing logic. This is correct.

---

### 4.3 ROADMAP Status Differs From Task-State (Candidate for Ownership-Awareness)

**Finding code:** `roadmap_status_differs_from_task_state`

**Current severity:** `warning` (hardcoded)

**Ownership applicability:** Only applies to `roadmap_backed` tasks (both authorities exist).

**Current behavior:** Always `warning` for any status mismatch that isn't explicitly allowed by `isStatusMappingAllowed()`.

**Potential ownership-aware logic:**

- `roadmap_backed` + incompatible status → `warning` (status drift between authorities)
- `runtime_only` + any status → N/A (finding not emitted; no ROADMAP entry exists)

**Analysis:** This finding is already scoped to `roadmap_backed` tasks only (emitted in the `roadmap_backed` comparison loop). No ownership-aware logic needed because the finding cannot occur for `runtime_only` tasks.

**Recommendation:** Keep `warning` severity. No changes needed.

---

## 5. Proposed Severity Matrix

### 5.1 Always-Critical Findings (No Ownership Logic)

| Finding Code                    | Current Severity | Recommended Severity | Ownership Conditions  | Rationale                      |
| ------------------------------- | ---------------- | -------------------- | --------------------- | ------------------------------ |
| `duplicate_roadmap_task_id`     | `critical`       | `critical`           | Always                | Breaks stable identity         |
| `duplicate_task_state_id`       | `critical`       | `critical`           | Always                | Breaks stable identity         |
| `roadmap_done_runtime_active`   | `critical`       | `critical`           | `roadmap_backed` only | Planning/runtime contradiction |
| `runtime_done_roadmap_not_done` | `critical`       | `critical`           | `roadmap_backed` only | Planning/runtime contradiction |

---

### 5.2 Ownership-Aware Findings (Existing Logic Correct)

| Finding Code                           | Current Severity                | Recommended Severity | Ownership Conditions                                                                                                                                  | Rationale                                                        |
| -------------------------------------- | ------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `runtime_task_missing_from_roadmap`    | `info` / `warning` / `critical` | **No change**        | `info` when `ownership_explicit: true`<br>`warning` when `done` + `ownership_explicit: false`<br>`critical` when active + `ownership_explicit: false` | Already ownership-aware via `severityForRuntimeMissingRoadmap()` |
| `roadmap_task_missing_from_task_state` | `info` / `warning`              | **No change**        | `info` when `done` or `todo`<br>`warning` when `in_progress`                                                                                          | Already ownership-aware via `severityForMissingRuntime()`        |

---

### 5.3 Ownership-Blind Findings (No Changes Recommended)

| Finding Code                             | Current Severity | Recommended Severity | Ownership Conditions  | Rationale                                                           |
| ---------------------------------------- | ---------------- | -------------------- | --------------------- | ------------------------------------------------------------------- |
| `unknown_roadmap_status`                 | `warning`        | `warning`            | Always                | Invalid vocabulary                                                  |
| `unknown_task_state_status`              | `warning`        | `warning`            | Always                | Invalid vocabulary                                                  |
| `roadmap_status_differs_from_task_state` | `warning`        | `warning`            | `roadmap_backed` only | Status drift (finding scoped to `roadmap_backed` by loop structure) |

---

## 6. Recommended RALPH-020 Implementation Scope

### 6.1 Primary Action: Set `runtime_only: true` on RALPH-XXX Tasks

**File:** `tasks/task-state.json`

**Change:** Set `runtime_only: true` on all RALPH-001A through RALPH-010A tasks.

**Impact:**

- 10 `warning` findings → 10 `info` findings
- `warning_count: 11` → `warning_count: 1`
- `info_count: 26` → `info_count: 36`
- Exit code remains 0 (no critical findings)

**Rationale:**

- RALPH-XXX tasks are explicitly Ralph-Loop migration/governance work
- They are not product tasks and should not be in ROADMAP.md
- Setting `runtime_only: true` aligns severity with ownership intent
- Reduces false-positive warnings

**Example change:**

```json
{
  "id": "RALPH-001A",
  "title": "Minimal agent-neutral governance foundation",
  "status": "done",
  "runtime_only": true,  // ← Change from false to true
  ...
}
```

---

### 6.2 Optional Action: No Severity Logic Changes Needed

**Analysis:** The existing severity logic is correct. The reconciler already has ownership-aware severity for the two findings that need it:

- `runtime_task_missing_from_roadmap` (via `severityForRuntimeMissingRoadmap()`)
- `roadmap_task_missing_from_task_state` (via `severityForMissingRuntime()`)

**Recommendation:** RALPH-020 should focus on data correction (`runtime_only: true`) rather than logic changes.

---

### 6.3 Out of Scope for RALPH-020

The following must remain out of scope unless explicitly tasked:

- Modifying severity logic in `reconcile-roadmap-task-state.mjs`
- Modifying parser logic
- Modifying ownership classification logic
- Modifying ROADMAP.md
- Modifying evidence files
- Modifying validation/review evidence
- Automatic repair logic
- Migration execution
- Product code changes
- Dependency changes
- Commits or pushes

---

## 7. Migration Risks and Validation Strategy

### 7.1 Risks

**Risk 1: Incorrect `runtime_only` classification**

- **Mitigation:** Only set `runtime_only: true` on RALPH-XXX tasks (explicitly Ralph-Loop work)
- **Validation:** Manual review of each task title/description before setting flag

**Risk 2: Breaking existing reconciler behavior**

- **Mitigation:** No severity logic changes; only data changes
- **Validation:** Run reconciler before/after and compare finding counts

**Risk 3: False negatives (missing legitimate warnings)**

- **Mitigation:** Existing severity logic already handles this correctly
- **Validation:** Test with fixture data (active runtime task without marker should remain critical)

---

### 7.2 Validation Strategy

**Pre-change validation:**

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs --json > before.json
```

**Expected before state:**

- `warning_count: 11`
- `info_count: 26`
- 10 `runtime_task_missing_from_roadmap` warnings for RALPH-XXX tasks

**Post-change validation:**

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs --json > after.json
```

**Expected after state:**

- `warning_count: 1` (only P1-003 `in_progress` without runtime state)
- `info_count: 36` (26 + 10 RALPH-XXX tasks)
- 10 `runtime_task_missing_from_roadmap` info findings for RALPH-XXX tasks

**Diff validation:**

```bash
# Compare finding counts
jq '.summary | {critical_count, warning_count, info_count}' before.json
jq '.summary | {critical_count, warning_count, info_count}' after.json

# Verify RALPH-XXX findings changed from warning to info
jq '.findings[] | select(.details.task_id | startswith("RALPH-")) | {task_id: .details.task_id, severity}' before.json
jq '.findings[] | select(.details.task_id | startswith("RALPH-")) | {task_id: .details.task_id, severity}' after.json
```

**Test coverage validation:**

```bash
node --test scripts/agent/__tests__/reconcile-roadmap-task-state.test.mjs
```

**Expected:** All 21 tests pass (no test changes needed; existing tests cover ownership logic).

---

### 7.3 Rollback Strategy

**If validation fails:**

1. Restore `tasks/task-state.json` from git
2. Rerun reconciler to confirm original state
3. Document failure reason
4. Escalate to human review

**Rollback command:**

```bash
git checkout tasks/task-state.json
node scripts/agent/reconcile-roadmap-task-state.mjs --json
```

---

## 8. Governance Compliance

This analysis is consistent with:

- ✓ **SSOK.md:** ROADMAP.md remains planning authority; runtime state is execution authority
- ✓ **AGENTS.md:** Respects Ralph-Loop safety (read-only analysis, no file modifications)
- ✓ **ROADMAP.md:** Aligns with existing task format and ownership model
- ✓ **VERIFY.md:** Category 1 (documentation-only) verification requirements
- ✓ **RALPH-015:** Implements ownership classification model as specified
- ✓ **RALPH-016:** Preserves ownership classification output logic
- ✓ **RALPH-018:** Preserves parser canonicalization logic
- ✓ **.governance/SYSTEM.md:** Respects lifecycle gates and stop conditions
- ✓ **.governance/RULES.md:** No product code changes, no unrelated cleanup
- ✓ **.governance/SAFETY.md:** No protected file modifications
- ✓ **.governance/REVIEW_POLICY.md:** Human review required before RALPH-020 implementation

---

## 9. Acceptance Criteria for RALPH-019

This analysis task is complete when:

1. ✓ All 9 finding codes inventoried with current severity
2. ✓ Critical findings identified (4 codes that must never downgrade)
3. ✓ Ownership-aware candidates identified (2 codes already correct)
4. ✓ Severity matrix produced (3 tables: always-critical, ownership-aware, ownership-blind)
5. ✓ RALPH-020 scope recommended (set `runtime_only: true` on RALPH-XXX tasks)
6. ✓ Risks identified (3 risks with mitigations)
7. ✓ Validation strategy defined (before/after reconciler output comparison)
8. ✓ Rollback strategy defined (git checkout + rerun reconciler)
9. ✓ Governance compliance verified (8 governance documents)

---

## 10. Next Steps

### Human Review Required

1. Review severity matrix and recommendations
2. Approve RALPH-020 scope (data correction only, no logic changes)
3. Verify risk mitigations are acceptable
4. Approve validation strategy

### After Approval

1. Create RALPH-020 task in ROADMAP.md (if approved)
2. Execute data correction: set `runtime_only: true` on RALPH-XXX tasks
3. Run validation: before/after reconciler output comparison
4. Verify test suite: all 21 tests pass
5. Update ROADMAP.md task status to `done`
6. Generate canonical handoff

---

## 11. Summary

**Current state:** Reconciler has partial ownership-awareness (2/9 finding codes). The primary gap is that 10 RALPH-XXX tasks lack explicit `runtime_only: true` marker, producing 10 false-positive warnings.

**Recommendation:** RALPH-020 should set `runtime_only: true` on all RALPH-XXX tasks in `tasks/task-state.json`. No severity logic changes needed.

**Impact:** 10 warnings → 10 info findings. Exit code remains 0. No governance violations introduced.

**Risk:** Low. Data correction only, no logic changes. Existing tests cover ownership logic.

**Validation:** Before/after reconciler output comparison + test suite execution.

---

**End of RALPH-019 Analysis Report**
