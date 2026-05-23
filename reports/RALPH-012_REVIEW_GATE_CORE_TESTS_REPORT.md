# RALPH-012 Review Gate Core Tests Report

**Task ID:** RALPH-012  
**Generated:** 2026-05-23T11:55:00Z  
**Status:** Implementation complete; required verification passed  
**Category:** Governance / Tooling

---

# Files Changed

- `scripts/agent/__tests__/review-gate-core.test.mjs` — Added focused Node test fixtures for direct shared review-gate core behavior.
- `reports/RALPH-012_REVIEW_GATE_CORE_TESTS_REPORT.md` — Added this task report.
- `handoffs/latest-handoff.md` — Updated latest handoff for RALPH-012.

No product code, ROADMAP, runtime state, validation evidence, review evidence, `tasks/`, `runs/`, `validation/`, `review/`, `src/`, `supabase/`, `package.json`, or `package-lock.json` files were modified.

---

# Tests Added

Added `scripts/agent/__tests__/review-gate-core.test.mjs` using Node's built-in `node:test` runner and `node:assert/strict`.

The tests import `buildNormalizedReviewDecision` and `SCHEMA_VERSION` directly from `scripts/agent/lib/review-gate-core.mjs`.

The tests do not execute CLIs and do not write adapter outputs.

---

# Scenarios Covered

1. Accepted handoff:
   - `task.status = done`
   - `validation.status = passed`
   - no critical issues
   - no warnings
   - acceptable review status
   - asserts `review_result = accepted`, no blockers, no warnings

2. Needs changes handoff:
   - validation passed
   - no critical issues
   - warning exists
   - asserts `review_result = needs_changes`, warnings present, no blockers

3. Rejected handoff:
   - validation failed
   - asserts `review_result = rejected`, blockers present

4. Malformed/schema violation handoff:
   - missing `task.task_id`
   - unsupported `schema_version`
   - asserts no accepted decision and schema-related critical findings

---

# Verification Performed

All required commands were executed separately, without command chaining.

```bash
node --test scripts/agent/__tests__/review-gate-core.test.mjs
```

Result: passed. Five focused fixture tests passed:

- accepted handoff returns accepted without blockers or warnings
- needs_changes handoff returns warnings without blockers
- rejected handoff returns blockers for validation failure
- malformed handoff missing task_id is rejected with schema finding
- unsupported schema_version is rejected with schema finding

```bash
node --check scripts/agent/lib/review-gate-core.mjs
```

Result: passed.

```bash
node --check scripts/agent/review-gate-engine.mjs
```

Result: passed.

```bash
node --check scripts/agent/run-review-gate-workflow.mjs
```

Result: passed.

```bash
git --no-pager status --short
```

Result: passed; output showed:

```text
M handoffs/latest-handoff.md
?? reports/RALPH-012_REVIEW_GATE_CORE_TESTS_REPORT.md
?? scripts/agent/__tests__/
```

```bash
git --no-pager diff --stat
```

Result: passed; output showed tracked-file changes for `handoffs/latest-handoff.md`. New report and test files are untracked and visible in `git status` until staged by a human.

```bash
git --no-pager diff --name-only
```

Result: passed; output showed:

```text
handoffs/latest-handoff.md
```

New untracked files are visible in status until staged by a human.

---

# Behavior Locked

- Accepted decisions require no critical findings, no warnings, passed validation, done task status, and acceptable review status.
- Warnings or optional metadata concerns without critical findings produce `needs_changes`.
- Validation failures produce `rejected` with blocking findings.
- Structural schema violations such as missing required task identity or unsupported schema version produce `rejected` and never `accepted`.
- Generated review IDs and timestamps remain intentionally unasserted except through structural decision behavior.

---

# Limitations

- These are focused fixture tests for the shared core module only; they do not exercise CLI argument parsing or workflow file-writing behavior.
- The tests intentionally avoid exact assertions on generated IDs, nonces, and timestamps.
- The malformed coverage targets representative schema violations rather than every required-field branch in `validateHandoffSchema`.

---

# Recommended Next Task

Recommended next task: add coordinator-level integration tests that consume the shared review-gate core only after human review confirms the RALPH-012 fixture coverage is sufficient.