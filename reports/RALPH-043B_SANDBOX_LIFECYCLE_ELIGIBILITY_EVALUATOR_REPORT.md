# RALPH-043B: Sandbox Lifecycle Eligibility Evaluator Implementation Report

## Base Context

**Task ID:** RALPH-043B  
**Task Title:** Sandbox Lifecycle Eligibility Evaluator  
**Implementation Date:** 2026-06-10  
**Latest Commit:** d091bef chore(roadmap): register lifecycle eligibility evaluator  
**Mode:** Read-only, stdout-only, non-authoritative evaluation

## Implementation Summary

Successfully implemented a read-only, stdout-only sandbox lifecycle eligibility evaluator that determines whether an existing sandbox lifecycle or sandbox queue-entry artifact is eligible for further human consideration. The evaluator performs no file writes, executes no runtime behavior, and claims no authority over queue execution, worker execution, task execution, lifecycle execution, review acceptance, validation authority, task completion, commit readiness, canonical queue admission, or canonical state mutation.

## Architecture

### Components Created

1. **Library Module:** `scripts/agent/lib/sandbox-lifecycle-eligibility-evaluator.mjs`
   - Core evaluation logic
   - Decision constants and protected path definitions
   - Helper functions for parsing and file safety validation
   - Imports lifecycle validation from `sandbox-queue-entry-lifecycle.mjs`

2. **CLI Wrapper:** `scripts/agent/evaluate-sandbox-lifecycle-eligibility.mjs`
   - Command-line interface with `--input-json` and `--input-file` flags
   - Output format support: JSON (default) and Markdown
   - Argument validation and error handling
   - Stdout-only output with no file writes

3. **Test Suite:** `scripts/agent/__tests__/sandbox-lifecycle-eligibility-evaluator.test.mjs`
   - 27 test cases covering all decision paths
   - Canonical scope violation detection
   - Authority claim detection
   - Lifecycle validation integration
   - File safety validation
   - No-write guarantees

## Exact Decisions

The evaluator returns exactly one of five decisions, prioritized in this order:

### 1. `blocked_canonical_scope` (Highest Priority)
Triggered when input references canonical or protected paths:
- `tasks/`, `runs/`, `validation/`, `review/`, `handoffs/`
- `.agent/overnight/`
- `src/`, `supabase/`
- `package.json`, `package-lock.json`
- `.env`, `.env.*`, `secrets/`, `credentials/`
- `.git/`, `node_modules/`
- `SSOK.md`, `AGENTS.md`, `VERIFY.md`, `.governance/`

### 2. `blocked_forbidden_claim`
Triggered when input contains forbidden authority claims:
- `queue_execution`, `worker_execution`, `task_execution`
- `runtime_authority`, `evidence_mutation`, `review_acceptance`
- `validation_pass`, `task_completion`, `staging`, `commit`, `push`, `deploy`
- `dependency_install`, `network`, `product_work`, `canonical_queue_admission`

### 3. `blocked_invalid_lifecycle`
Triggered when lifecycle validation fails:
- Forbidden lifecycle states (queued, executing, committed, pushed, deployed, etc.)
- Unknown lifecycle states
- Invalid lifecycle transitions
- Skipped lifecycle transitions
- Missing non-authoritative statement
- Non-authoritative statement contains authority terms

### 4. `blocked_missing_evidence`
Triggered when required markers or evidence are missing:
- Missing `sandbox: true` marker
- Missing `non_authoritative: true` marker
- Missing `task_id` or `queue_entry_id`
- Missing `lifecycle` object or `lifecycle.state`
- Missing evidence markers (no `evidence_bundled: true` flag and lifecycle state not in `evidence_bundled` or `awaiting_human_review`)

### 5. `eligible_for_human_consideration` (Default Success)
Returned when all validation passes and no blocking conditions detected.

## Protected/Canonical Scope Behavior

The evaluator scans the following input fields for canonical/protected scope references:
- `path`, `artifact_path`, `target_path`, `evidence_path`, `evidence_paths`
- `expected_changed_files`, `allowed_files`, `target_paths`, `referenced_paths`

Both string values and arrays of strings are scanned. Path normalization handles Windows backslashes. Any reference to a protected path triggers `blocked_canonical_scope` decision.

## Verification Results

### Syntax Validation
✅ `node --check scripts/agent/lib/sandbox-queue-entry-lifecycle.mjs` - PASS  
✅ `node --check scripts/agent/lib/sandbox-lifecycle-eligibility-evaluator.mjs` - PASS  
✅ `node --check scripts/agent/evaluate-sandbox-lifecycle-eligibility.mjs` - PASS

### Test Execution
✅ `node --test scripts/agent/__tests__/sandbox-queue-entry-lifecycle.test.mjs` - PASS  
- 14 tests, 14 passed, 0 failed

✅ `node --test scripts/agent/__tests__/sandbox-lifecycle-eligibility-evaluator.test.mjs` - PASS  
- 27 tests, 27 passed, 0 failed

## Test Coverage Summary

### Decision Path Coverage
- ✅ `eligible_for_human_consideration` for valid artifacts
- ✅ `eligible_for_human_consideration` for `awaiting_human_review` state
- ✅ `blocked_missing_evidence` for missing sandbox/non_authoritative markers
- ✅ `blocked_missing_evidence` for missing lifecycle/evidence
- ✅ `blocked_forbidden_claim` for authority claims
- ✅ `blocked_invalid_lifecycle` for forbidden states
- ✅ `blocked_invalid_lifecycle` for invalid transitions
- ✅ `blocked_canonical_scope` for tasks/, runs/, validation/, src/, package.json references
- ✅ Decision priority: canonical_scope > forbidden_claim

### Safety Coverage
- ✅ All authority flags remain false
- ✅ `writes_performed: false` guaranteed
- ✅ `stdout_only: true` guaranteed
- ✅ Non-authoritative and non-authorization statements included
- ✅ Safe file path validation (rejects absolute, traversal, non-json, protected paths)
- ✅ JSON parsing error handling
- ✅ CLI argument validation (unknown flags, positional args rejected)

## No-Authority Assertions

The evaluator explicitly asserts it does NOT authorize:
- ❌ Queue execution
- ❌ Worker execution
- ❌ Task execution
- ❌ Lifecycle execution
- ❌ Runtime behavior
- ❌ Evidence mutation
- ❌ Review mutation
- ❌ Validation mutation
- ❌ Review acceptance
- ❌ Validation authority
- ❌ Task completion
- ❌ Commit readiness
- ❌ Canonical queue admission
- ❌ Canonical state mutation
- ❌ Staging
- ❌ Commit
- ❌ Push
- ❌ Deploy
- ❌ Network operations

All authority flags in result objects are hardcoded to `false`.

## Changed Files

1. `scripts/agent/lib/sandbox-lifecycle-eligibility-evaluator.mjs` (NEW)
2. `scripts/agent/evaluate-sandbox-lifecycle-eligibility.mjs` (NEW)
3. `scripts/agent/__tests__/sandbox-lifecycle-eligibility-evaluator.test.mjs` (NEW)
4. `reports/RALPH-043B_SANDBOX_LIFECYCLE_ELIGIBILITY_EVALUATOR_REPORT.md` (NEW)
5. `ROADMAP.md` (status update pending)

## PASS/FAIL Conclusion

**PASS** ✅

All verification commands passed:
- Syntax validation: 3/3 passed
- Test execution: 41/41 tests passed (14 lifecycle + 27 eligibility)
- No file writes performed
- No runtime/queue/worker/task/lifecycle execution added
- All authority flags remain false
- Protected/canonical scope detection working
- Decision priority correct
- CLI argument validation working
- Safe file path validation working

The sandbox lifecycle eligibility evaluator is ready for use as a read-only, stdout-only, non-authoritative advisory tool for determining whether sandbox artifacts are eligible for further human consideration.

---

**Implementation completed:** 2026-06-10T13:47:00+02:00  
**Verification status:** All checks passed  
**Authority claims:** None (read-only evaluation only)  
**File writes:** None performed  
**Runtime behavior:** None added
