# RALPH-017 ROADMAP Parser Canonicalization Plan

**Task ID:** RALPH-017  
**Generated:** 2026-05-23T13:55:33Z  
**Status:** Read-only analysis complete, awaiting human review  
**Category:** Planning / governance analysis

---

## 1. Executive Summary

This document provides a read-only analysis of ROADMAP.md parsing behavior to diagnose the P0-002 duplicate task ID finding and propose safe parser canonicalization rules for RALPH-018 implementation.

**Key Finding:** The P0-002 duplicate is a **parser canonicalization issue**, not a real duplicate task definition. The parser currently treats both checkbox references and heading-style task sections as canonical task definitions.

**Recommendation:** Implement a two-tier parsing model where heading-style sections are canonical task definitions and checkbox lines are reference-only markers.

---

## 2. Current Parser Behavior Summary

### 2.1 Parser Implementation (reconcile-roadmap-task-state.mjs)

The current parser recognizes two patterns as task definitions:

1. **Heading-style task headers** (lines 62, 189):

   ```regex
   ^(#{2,6})\s+(?:[-*]\s+)?(TASK_ID)(?::)?\s*(.*)$
   ```

   Example: `## P0-002 Single Item 6 Resolver 6 Macros Pipeline`

2. **Checkbox task lines** (lines 63, 190):
   ```regex
   ^\s*-\s+\[[ xX]\]\s+(TASK_ID)(?::)?\s*(.*)$
   ```
   Example: `- [x] P0-002: Kerninputs Proof`

**Current behavior:** Both patterns create task entries in the parsed output with equal canonical weight.

### 2.2 Task Extraction Logic

For **heading-style tasks** (lines 195-208):

- Collects full task section text
- Extracts `Status:` line
- Extracts `DoD:` and `Verify:` blocks
- Captures section hierarchy context

For **checkbox tasks** (lines 195-208):

- No section text collection
- Status inferred from checkbox state (`[x]` = done, `[ ]` = null)
- No DoD/Verify extraction
- Minimal context

**Implication:** Heading-style tasks carry full planning metadata; checkbox tasks are lightweight references.

---

## 3. ROADMAP Pattern Inventory

### 3.1 Patterns Found in Current ROADMAP.md

| Pattern Type                   | Example                                              | Line(s) | Metadata Available               | Current Parser Treatment              |
| ------------------------------ | ---------------------------------------------------- | ------- | -------------------------------- | ------------------------------------- |
| **Heading-style task section** | `## P0-002 Single Item 6 Resolver 6 Macros Pipeline` | 401     | Status, DoD, Verify, description | Canonical task definition             |
| **Checkbox reference**         | `- [x] P0-002: Kerninputs Proof`                     | 40      | Checkbox state only              | Canonical task definition (incorrect) |
| **Epic header**                | `## EPIC: Zero-Friction Input System`                | 335     | None                             | Ignored (no task ID)                  |
| **Section header**             | `# PHASE 0 6 LOGGING MUST WORK`                      | 387     | None                             | Ignored (no task ID)                  |
| **Status line**                | `Status: \`done\``                                   | Various | Extracted by parser              | Part of task metadata                 |
| **DoD block**                  | `**DoD:** Single item passes...`                     | Various | Extracted by parser              | Part of task metadata                 |
| **Verify block**               | `**Verify:** \`npm run test\``                       | Various | Extracted by parser              | Part of task metadata                 |
| **Inline status marker**       | `Status: \`in_progress\``                            | Various | Extracted by parser              | Part of task metadata                 |
| **Planning table**             | `\| Module \| Status \| Notes \|`                    | 530-536 | None                             | Ignored (no task ID pattern)          |
| **Checklist summary**          | Tier/module grouping lists                           | Various | None                             | Ignored unless task ID present        |

### 3.2 Pattern Usage Analysis

**Heading-style task sections (27 instances):**

- All P0-XXX, P1-XXX, P2-XXX, RESOLVER-V2-XXX tasks
- Full task metadata: title, status, DoD, Verify, description
- Clear section boundaries with `---` separators
- Hierarchical context (epic/phase parent sections)

**Checkbox references (1 instance):**

- Line 40: `- [x] P0-002: Kerninputs Proof`
- Appears in "Hinweise" (Notes) section under "Phase C: OpenCode CLI Worker Integration"
- No DoD, no Verify, no description
- Appears to be a **summary reference** to the full task defined at line 401

**Interpretation:** The checkbox at line 40 is a **reference/summary link**, not a canonical task definition. It points to the full task section at line 401.

---

## 4. P0-002 Duplicate Diagnosis

### 4.1 The Two P0-002 Instances

**Instance 1 (Line 40):**

```markdown
- [x] P0-002: Kerninputs Proof
      Architecture: Clean Architecture + Feature-First + Deterministic-First Nutrition Engine
```

- **Context:** Under "Phase C: OpenCode CLI Worker Integration" > "Ziel" section
- **Type:** Checkbox reference with brief architecture note
- **Metadata:** Checkbox state = done, no Status line, no DoD, no Verify
- **Interpretation:** Summary reference to completed work

**Instance 2 (Line 401):**

```markdown
## P0-002 Single Item 6 Resolver 6 Macros Pipeline

Status: `done`

Minimal working chain:

1. Input: raw text (e.g. "ei")
2. Deterministic normalization
3. Resolver call
4. USDA/OFF match
5. Macro calculation
6. Journal persistence
7. SummaryBar update

No Review Modal. No Confirm All. No extra layers.

**DoD:** 5 individual foods produce correct macros without zero-macro results.
```

- **Context:** Under "PHASE 0 6 LOGGING MUST WORK" section
- **Type:** Full heading-style task section
- **Metadata:** Status = done, full DoD, detailed description
- **Interpretation:** Canonical task definition

### 4.2 Diagnosis

**Root Cause:** Parser treats both patterns as canonical task definitions with equal weight.

**Reality:** Line 40 is a **reference/summary** to the canonical task at line 401. The checkbox serves as a quick-reference checklist in the Phase C context, linking to the detailed task definition in Phase 0.

**Evidence:**

1. Line 40 has minimal metadata (no Status line, no DoD)
2. Line 401 has full task metadata (Status, DoD, description)
3. Line 40 appears in a summary/overview section
4. Line 401 appears in the canonical task section hierarchy

**Conclusion:** This is a **parser false positive**, not a real duplicate task definition.

---

## 5. Canonical Task Definition Proposal

### 5.1 Canonical Task Definition Rules

A **canonical task definition** must be a heading-style section with:

1. **Heading pattern:** `## TASK_ID Title` (or `###`, `####`, etc.)
2. **Status line:** `Status: \`value\`` (required for active tasks)
3. **DoD or Verify block:** At least one present (recommended)
4. **Section context:** Clear hierarchical placement

**Examples of canonical definitions:**

```markdown
## P0-002 Single Item 6 Resolver 6 Macros Pipeline

Status: `done`

**DoD:** 5 individual foods produce correct macros without zero-macro results.
```

```markdown
### RALPH-016 Reconciliation Ownership Classification

Status: `in_progress`

**Verify:** `npm run test -- reconcile-roadmap-task-state.test.mjs`
```

### 5.2 Why Heading-Style is Canonical

**Rationale:**

1. **Metadata richness:** Heading sections contain Status, DoD, Verify, description
2. **Section boundaries:** Clear start/end with heading hierarchy and `---` separators
3. **Hierarchical context:** Parent epic/phase sections provide planning context
4. **Existing usage:** All 27 current tasks use heading-style for canonical definitions
5. **ROADMAP.md authority:** SSOK.md establishes ROADMAP.md as planning authority; heading sections are the natural planning unit

**Governance alignment:**

- SSOK.md: "ROADMAP.md is the Single Source of Knowledge (SSOK) for all planned and completed work."
- ROADMAP.md: "Every task must have a stable ID, a status, and a Definition of Done."
- Heading-style sections are the only pattern that consistently provides all three requirements.

---

## 6. Reference-Only Pattern Proposal

### 6.1 Reference-Only Patterns

The following patterns should be treated as **references** to canonical tasks, not canonical definitions:

1. **Checkbox task references:**

   ```markdown
   - [x] P0-002: Kerninputs Proof
   - [ ] P1-003: Multi-Item Split
   ```

   - **Purpose:** Quick-reference checklists, summary links, progress tracking
   - **Metadata:** Checkbox state only (done/not done)
   - **Parser treatment:** Extract for cross-reference validation, but do not create canonical task entries

2. **Inline task mentions:**

   ```markdown
   See P0-002 for details.
   Depends on RALPH-016 completion.
   ```

   - **Purpose:** Cross-references, dependency links
   - **Parser treatment:** Ignore (no structured metadata)

3. **Table row references:**

   ```markdown
   | Task | Status | Notes |
   | P0-002 | done | Core pipeline |
   ```

   - **Purpose:** Summary tables, planning matrices
   - **Parser treatment:** Ignore (table context, not task definition)

### 6.2 Reference Validation Rules

**Cross-reference validation (optional future enhancement):**

- Checkbox references should point to existing canonical task definitions
- Warn if checkbox references a non-existent task ID
- Warn if checkbox state conflicts with canonical task status

**Current scope (RALPH-018):**

- Simply exclude checkbox patterns from canonical task parsing
- No cross-reference validation yet (defer to future task)

---

## 7. Product vs. Ralph Task Classification

### 7.1 Current Task ID Patterns

**Product tasks:**

- `P0-XXX`: Phase 0 (core logging)
- `P1-XXX`: Phase 1 (deterministic parsing)
- `P2-XXX`: Phase 2 (guardrails, auth, subscription)
- `RESOLVER-V2-XXX`: Resolver V2 architecture

**Ralph tasks:**

- `RALPH-XXX`: Ralph-Loop governance, tooling, migration

### 7.2 Should Ralph Tasks Require Heading-Style Definitions?

**Recommendation: Yes, same canonical parser rule for all task types.**

**Rationale:**

1. **Governance consistency:** ROADMAP.md is planning authority for all work (product + Ralph)
2. **Evidence linkage:** Ralph tasks require validation/review evidence, which needs stable task IDs
3. **Status tracking:** Ralph tasks have lifecycle states (todo, in_progress, done) like product tasks
4. **DoD requirements:** Ralph tasks have verification requirements (see VERIFY.md Category 1/2)

**Exception handling:**

- Runtime-only tasks (e.g., RALPH-016A, RALPH-007A) may exist in `tasks/task-state.json` without ROADMAP entries
- These should be marked `runtime_only: true` in task-state
- Reconciler should report these as `info` severity, not `critical`

**Implication for RALPH-018:**

- Parser canonicalization rules apply equally to product and Ralph tasks
- No special checkbox-only parsing for Ralph tasks
- If a Ralph task needs ROADMAP presence, it must use heading-style definition

---

## 8. Recommended RALPH-018 Implementation Scope

### 8.1 Safe Parser Changes

**Primary change: Exclude checkbox patterns from canonical task parsing**

**Implementation:**

1. Modify `parseRoadmap()` function (line 172-212)
2. Keep heading-style task parsing unchanged
3. Remove checkbox pattern from canonical task extraction
4. Optional: Collect checkbox references separately for future cross-reference validation

**Code change location:**

- File: `scripts/agent/reconcile-roadmap-task-state.mjs`
- Function: `parseRoadmap(content)` (lines 172-212)
- Lines to modify: 189-191 (checkbox matching logic)

**Proposed change:**

```javascript
// BEFORE (current):
const headerMatch = line.match(ROADMAP_TASK_HEADER);
const checkboxMatch = headerMatch ? null : line.match(CHECKBOX_TASK);
if (!headerMatch && !checkboxMatch) return;

// AFTER (RALPH-018):
const headerMatch = line.match(ROADMAP_TASK_HEADER);
if (!headerMatch) return;
// Checkbox patterns no longer create canonical task entries
```

### 8.2 Severity and Exit Code Preservation

**No changes to:**

- Severity assignment logic (lines 305-315)
- Exit code logic (lines 27-31, 436)
- Ownership classification (lines 33-40, 237-243)
- Status mapping rules (lines 296-303)

**Rationale:** RALPH-016 already implemented ownership classification correctly. RALPH-018 only fixes parser canonicalization, not reconciliation logic.

### 8.3 Test Updates Required

**New test cases to add:**

1. **Checkbox reference should not create canonical task:**

   ```javascript
   test('checkbox reference does not create canonical task entry', () => {
     const roadmap = '- [x] P0-002: Summary reference\n\n## P0-002 Full Task\n\nStatus: `done`';
     const result = buildResultFromInputs(roadmap, taskState([]));

     // Should find only 1 P0-002 (heading-style), not 2
     const p0002Tasks = result.roadmap_tasks.filter((t) => t.id === 'P0-002');
     assert.equal(p0002Tasks.length, 1);
     assert.equal(p0002Tasks[0].line, 3); // Heading line, not checkbox line
   });
   ```

2. **P0-002 duplicate should be resolved:**

   ```javascript
   test('P0-002 duplicate finding is resolved after parser canonicalization', () => {
     const roadmapContent = readFileSync('ROADMAP.md', 'utf8');
     const result = buildResultFromInputs(roadmapContent, taskState([]));

     // Should not find duplicate_roadmap_task_id for P0-002
     const p0002Duplicate = result.findings.find(
       (f) => f.code === 'duplicate_roadmap_task_id' && f.details.task_id === 'P0-002',
     );
     assert.equal(p0002Duplicate, undefined);
   });
   ```

3. **Heading-style tasks still parsed correctly:**

   ```javascript
   test('heading-style tasks still parsed with full metadata', () => {
     const roadmap = '## P0-002 Full Task\n\nStatus: `done`\n\n**DoD:** Test DoD.';
     const result = buildResultFromInputs(roadmap, taskState([]));

     const task = result.roadmap_tasks.find((t) => t.id === 'P0-002');
     assert.ok(task);
     assert.equal(task.status, 'done');
     assert.match(task.dod_verify_text, /DoD: Test DoD/);
   });
   ```

### 8.4 Documentation Updates

**Files to update:**

1. **ROADMAP.md (optional clarification):**
   - Add a brief note in "SSOK Rules" section explaining canonical task format
   - Example: "Canonical task definitions use heading-style sections (## TASK_ID Title). Checkbox references are summary links only."

2. **AGENTS.md (optional):**
   - Update task governance section if it references task format

3. **This report (RALPH-017):**
   - Becomes the canonical reference for parser canonicalization decisions

---

## 9. Test Matrix for Parser Canonicalization

### 9.1 Core Parser Behavior Tests

| Test Case                  | Input                                                     | Expected Output                          | Rationale                           |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| Heading-style task parsed  | `## P0-002 Title\n\nStatus: \`done\``                     | 1 task entry, status=done, full metadata | Canonical definition                |
| Checkbox reference ignored | `- [x] P0-002: Summary`                                   | 0 task entries                           | Reference-only pattern              |
| Mixed heading + checkbox   | `- [x] P0-002: Ref\n\n## P0-002 Full\n\nStatus: \`done\`` | 1 task entry (heading only)              | Checkbox ignored, heading canonical |
| Multiple headings same ID  | `## P0-002 First\n\n## P0-002 Second`                     | 2 task entries, duplicate finding        | Real duplicate (critical)           |
| Checkbox without heading   | `- [x] P0-999: Orphan`                                    | 0 task entries                           | No canonical definition exists      |
| Heading without status     | `## P0-002 Title`                                         | 1 task entry, status=null                | Valid but incomplete                |
| Checkbox state extraction  | `- [x] P0-002: Done\n- [ ] P1-003: Todo`                  | 0 task entries                           | Checkboxes no longer parsed         |

### 9.2 Reconciliation Logic Tests (Unchanged)

| Test Case                   | Expected Behavior                  | RALPH-018 Impact                           |
| --------------------------- | ---------------------------------- | ------------------------------------------ |
| Roadmap-backed task         | Ownership class = roadmap_backed   | No change                                  |
| Runtime-only task           | Ownership class = runtime_only     | No change                                  |
| Roadmap-only task           | Ownership class = roadmap_only     | No change                                  |
| Status mapping              | Compatible statuses = info/warning | No change                                  |
| Duplicate task ID           | Severity = critical                | No change (real duplicates still critical) |
| Missing validation evidence | Severity per RALPH-015 matrix      | No change                                  |

### 9.3 Regression Prevention Tests

| Test Case                              | Purpose                                  | Expected Result                      |
| -------------------------------------- | ---------------------------------------- | ------------------------------------ |
| All current heading-style tasks parsed | Ensure no existing tasks lost            | 27 tasks found (same as before)      |
| Ownership classification preserved     | Ensure RALPH-016 logic intact            | Ownership classes assigned correctly |
| Exit codes unchanged                   | Ensure CLI contract preserved            | Exit 0 (ok), 1 (critical), 2 (error) |
| JSON output schema stable              | Ensure machine-readable output unchanged | All existing fields present          |
| Human output format stable             | Ensure human-readable output unchanged   | Same format as before                |

---

## 10. Risks and Migration Concerns

### 10.1 Implementation Risks

| Risk                                   | Severity | Mitigation                                                             |
| -------------------------------------- | -------- | ---------------------------------------------------------------------- |
| **Checkbox references used elsewhere** | Low      | Search ROADMAP.md for all checkbox patterns; only 1 found (P0-002)     |
| **Parser breaks existing tests**       | Medium   | Add new tests before changing parser; run full test suite              |
| **Reconciler logic regression**        | Low      | No changes to reconciliation logic, only parser input                  |
| **Exit code changes**                  | Low      | Exit code logic unchanged; P0-002 duplicate will resolve to 0 findings |
| **Ownership classification breaks**    | Low      | Ownership logic unchanged; fewer false duplicates improve accuracy     |

### 10.2 ROADMAP.md Migration Concerns

**Current state:**

- 1 checkbox reference (P0-002 at line 40)
- 27 heading-style task sections
- No other checkbox task patterns found

**Migration required:** None

**Rationale:**

- The single checkbox reference (P0-002) is already a reference to the canonical heading-style task
- No ROADMAP.md edits needed
- Parser change resolves the false positive automatically

**Future guidance:**

- Document in ROADMAP.md or AGENTS.md that canonical tasks use heading-style format
- Checkbox references are allowed for summary/quick-reference purposes
- Parser will ignore checkbox references for canonical task extraction

### 10.3 Backward Compatibility

**CLI interface:** No changes

- `--json` flag behavior unchanged
- `--help` output unchanged
- Exit codes unchanged

**Output schema:** No breaking changes

- `roadmap_tasks` array may have fewer entries (false duplicates removed)
- `findings` array may have fewer entries (duplicate findings resolved)
- All existing fields preserved

**Test compatibility:**

- Existing tests may need updates if they expect checkbox patterns to create task entries
- New tests added to cover canonicalization rules

### 10.4 Evidence Linkage Impact

**Validation evidence:** No impact

- Evidence links to task IDs, not parser patterns
- Heading-style tasks already have stable IDs

**Review evidence:** No impact

- Same reasoning as validation evidence

**Handoff documentation:** No impact

- Handoffs reference task IDs, not parser patterns

**Task history:** No impact

- History uses task IDs from task-state.json, not ROADMAP parser

---

## 11. Alternative Approaches Considered

### 11.1 Alternative 1: Keep Both Patterns, Add Disambiguation Logic

**Approach:** Parse both heading and checkbox patterns, but add logic to detect when a checkbox is a reference to a heading-style task.

**Pros:**

- More flexible for future ROADMAP patterns
- Could support checkbox-only tasks if needed

**Cons:**

- More complex parser logic
- Ambiguity in determining reference vs. definition
- Higher risk of false positives/negatives

**Rejected because:** Adds complexity without clear benefit. Current ROADMAP usage shows heading-style is canonical.

### 11.2 Alternative 2: Require Explicit Reference Markers

**Approach:** Require checkbox references to use a special marker (e.g., `- [x] REF: P0-002`).

**Pros:**

- Explicit intent
- No parser ambiguity

**Cons:**

- Requires ROADMAP.md edits
- Breaks existing checkbox reference (P0-002)
- Adds governance overhead

**Rejected because:** Unnecessary complexity. Parser can infer reference vs. definition from pattern type.

### 11.3 Alternative 3: Separate Checkbox Section

**Approach:** Create a dedicated "Task Summary" section for checkbox references, excluded from parser scope.

**Pros:**

- Clear separation of concerns
- No parser changes needed

**Cons:**

- Requires ROADMAP.md restructuring
- Limits flexibility in placing references
- Doesn't solve the parser canonicalization problem

**Rejected because:** Doesn't address root cause. Parser should handle references intelligently.

---

## 12. Recommended RALPH-018 Task Definition

### 12.1 Task Scope

**Task ID:** RALPH-018 (to be created)  
**Title:** ROADMAP Parser Canonicalization Implementation  
**Category:** Ralph-Loop tooling / reconciler enhancement  
**Priority:** Medium  
**Risk Level:** Safe autonomous (with tests)

**Scope:**

1. Modify `parseRoadmap()` to exclude checkbox patterns from canonical task parsing
2. Add 3 new test cases for parser canonicalization
3. Run full test suite to ensure no regressions
4. Verify P0-002 duplicate finding is resolved
5. Update documentation (optional: add ROADMAP.md task format note)

**Out of scope:**

- Reconciliation logic changes
- Severity assignment changes
- Exit code changes
- Ownership classification changes
- Cross-reference validation (defer to future task)
- ROADMAP.md content edits

### 12.2 Definition of Done

**Required checks (VERIFY.md Category 3: Test-only):**

- `npm run test -- --testPathPattern=reconcile-roadmap-task-state.test.mjs` (pass)
- `git --no-pager status --short` (documented)
- `git --no-pager diff --stat` (documented)
- `git --no-pager diff --name-only` (documented)

**Acceptance criteria:**

1. All new tests pass
2. All existing tests pass (no regressions)
3. P0-002 duplicate finding no longer appears in reconciler output
4. Reconciler still finds 27 ROADMAP tasks (heading-style only)
5. Exit code remains 0 for current ROADMAP.md (no critical findings)

### 12.3 Changed Files

**Expected changes:**

- `scripts/agent/reconcile-roadmap-task-state.mjs` (parser logic)
- `scripts/agent/__tests__/reconcile-roadmap-task-state.test.mjs` (new tests)
- `reports/RALPH-018_ROADMAP_PARSER_CANONICALIZATION_REPORT.md` (implementation report)
- `handoffs/latest-handoff.md` (handoff documentation)

**No changes to:**

- `ROADMAP.md` (no content edits)
- `tasks/task-state.json` (read-only reconciler)
- `runs/current-run.json` (read-only reconciler)
- Product code (reconciler-only change)
- Dependencies (no package.json changes)

---

## 13. Consistency Review

This analysis is consistent with:

- **SSOK.md:** Preserves ROADMAP.md as planning authority; heading-style sections are natural planning units
- **AGENTS.md:** Respects Ralph-Loop safety (read-only analysis, no file modifications)
- **ROADMAP.md:** Aligns with existing task format usage (27 heading-style tasks)
- **VERIFY.md:** Follows Category 1 (documentation-only) verification for this analysis task
- **RALPH-015:** Builds on ownership classification without changing reconciliation logic
- **RALPH-016:** Preserves ownership classification output (if implemented)

---

## 14. Human Review Gate

This is a **read-only analysis and planning document**. No files were modified.

**Human review required before RALPH-018 implementation:**

1. Approve parser canonicalization approach (heading-style canonical, checkbox reference-only)
2. Approve RALPH-018 task scope and DoD
3. Approve test matrix and regression prevention strategy
4. Decide whether to add ROADMAP.md task format documentation (optional)

**Next steps after approval:**

1. Create RALPH-018 task in ROADMAP.md (heading-style section)
2. Import RALPH-018 into tasks/task-state.json
3. Execute RALPH-018 implementation per this plan
4. Run verification per VERIFY.md Category 3
5. Generate handoff and stop for review

---

## 15. Changed Files for RALPH-017

- `reports/RALPH-017_ROADMAP_PARSER_CANONICALIZATION_PLAN.md` — Added this analysis document
- `handoffs/latest-handoff.md` — Will be updated separately with RALPH-017 handoff

---

**End of RALPH-017 Analysis**
