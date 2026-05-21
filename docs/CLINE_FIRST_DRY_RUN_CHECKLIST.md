# Cline First Dry Run Checklist

## Purpose

This checklist guides the first controlled dry run of Cline as a Ralph-Loop worker adapter. The first dry run is designed to be safe, limited in scope, and focused on verifying that Cline can operate within Ralph-Loop governance constraints.

**Critical:** This is a preparation checklist. The actual dry run execution is handled by RALPH-010A.

## Preconditions

### Repository State Requirements
- [ ] **Clean Working Tree**: No uncommitted changes in repository
- [ ] **Current Branch Safe**: Working on appropriate development branch
- [ ] **Remote Sync**: Local branch is up to date with remote
- [ ] **Backup Available**: Repository state can be restored if needed

### Ralph-Loop Foundation Requirements
- [ ] **Governance Files Present**: All `.governance/` files exist and are current
- [ ] **Task State Functional**: `tasks/task-state.json` is valid and current
- [ ] **Runtime State Functional**: All runtime state files are valid
- [ ] **Morning Review Generator Functional**: Smoke test passed (RALPH-008A)
- [ ] **Task Selector Functional**: Dry run selector tested (RALPH-006A)

### Documentation Requirements
- [ ] **Setup Documentation**: `docs/CLINE_RALPH_WORKER_SETUP.md` exists
- [ ] **Dry Run Checklist**: This checklist exists and is complete
- [ ] **Dry Run Plan**: `plans/RALPH_CLINE_DRY_RUN_PLAN.md` exists
- [ ] **Adapter Documentation**: `.agent/adapters/cline.md` is current

### Human Oversight Requirements
- [ ] **Human Available**: Human reviewer available for immediate oversight
- [ ] **Review Time Allocated**: Sufficient time allocated for thorough review
- [ ] **Rollback Plan Ready**: Clear rollback procedure prepared
- [ ] **Stop Conditions Understood**: All stop conditions clearly defined

## Installation Not Covered by This Repository

### Important Note
This repository does NOT handle Cline installation or global configuration. These must be handled separately:

### External Installation Requirements
- **VS Code**: Cline extension must be installed in VS Code
- **Extension Configuration**: Cline must be configured per requirements in `docs/CLINE_RALPH_WORKER_SETUP.md`
- **Workspace Setup**: VS Code workspace must be set to repository root
- **Permissions**: Cline must have appropriate file system permissions

### Not Repository Responsibility
- ❌ Installing Cline extension
- ❌ Configuring VS Code settings
- ❌ Setting up Cline API keys or credentials
- ❌ Global Cline configuration

## Workspace Files to Inspect Before First Run

### Governance Files (Critical)
- [ ] **`.governance/SYSTEM.md`** - Ralph-Loop system overview
- [ ] **`.governance/RULES.md`** - Operational rules
- [ ] **`.governance/SAFETY.md`** - Safety policies and protected files
- [ ] **`.governance/REVIEW_POLICY.md`** - Review requirements

### Task Assignment Files (Critical)
- [ ] **`runs/current-run.json`** - Current task assignment
- [ ] **`tasks/task-state.json`** - Task state and dependencies
- [ ] **`handoffs/latest-handoff.md`** - Previous execution context

### Worker Role Definition (Critical)
- [ ] **`.agent/prompts/worker.md`** - Worker role responsibilities
- [ ] **`.agent/adapters/cline.md`** - Cline-specific integration

### Protected Files List (Critical)
- [ ] **`.agent/config/protected-files.json`** - Protected file patterns
- [ ] **Verify Understanding**: Cline must understand which files are protected

### Validation Requirements (Important)
- [ ] **`validation/validation-rules.json`** - Validation requirements
- [ ] **`VERIFY.md`** - Canonical verification commands

## Allowed First Dry-Run Behavior

### Safe Operations
- ✅ **Read Governance Files**: Cline may read all governance and task files
- ✅ **Read Task Assignment**: Cline may read `runs/current-run.json`
- ✅ **Read Documentation**: Cline may read any documentation files
- ✅ **Write Handoff**: Cline may write/update `handoffs/latest-handoff.md`
- ✅ **Update State Files**: Cline may update allowed runtime state files
- ✅ **Create Documentation**: Cline may create new documentation files if task allows

### Validation Operations
- ✅ **JSON Syntax Validation**: Cline may validate JSON file syntax
- ✅ **JSONL Syntax Validation**: Cline may validate JSONL file syntax
- ✅ **File Existence Checks**: Cline may verify required files exist
- ✅ **Scope Boundary Checks**: Cline may verify changes within allowed scope

### Reporting Operations
- ✅ **Status Reporting**: Cline may report task status and progress
- ✅ **Change Documentation**: Cline may document what changes were made
- ✅ **Issue Reporting**: Cline may report problems or blockers encountered
- ✅ **Recommendation Generation**: Cline may suggest next steps

## Forbidden First Dry-Run Behavior

### Product Code (Strictly Forbidden)
- ❌ **No src/ Changes**: Never modify any files in `src/` directory
- ❌ **No Application Logic**: Never change application or domain logic
- ❌ **No Business Logic**: Never modify business rules or algorithms
- ❌ **No UI Changes**: Never modify user interface components

### Dependencies and Configuration (Strictly Forbidden)
- ❌ **No package.json Changes**: Never modify package dependencies
- ❌ **No package-lock.json Changes**: Never modify dependency lock file
- ❌ **No .env Changes**: Never modify environment variables
- ❌ **No Build Config Changes**: Never modify build or compilation configuration

### Database and Infrastructure (Strictly Forbidden)
- ❌ **No supabase/ Changes**: Never modify database schema or functions
- ❌ **No Migration Changes**: Never create or modify database migrations
- ❌ **No Infrastructure Changes**: Never modify deployment or infrastructure files

### Scripts and Automation (Strictly Forbidden)
- ❌ **No Script Changes**: Never modify executable scripts in `scripts/`
- ❌ **No Automation Changes**: Never modify CI/CD or automation files
- ❌ **No Tool Configuration**: Never modify tool-specific configuration files

### Governance and Core Files (Strictly Forbidden)
- ❌ **No ROADMAP.md Changes**: Never modify the project roadmap
- ❌ **No VERIFY.md Changes**: Never modify verification procedures
- ❌ **No README.md Changes**: Never modify project documentation
- ❌ **No .roo/ Changes**: Never modify Roo-specific files
- ❌ **No .roomodes Changes**: Never modify Roo mode configuration

### External Operations (Strictly Forbidden)
- ❌ **No Git Push**: Never push changes to remote repository
- ❌ **No Deployment**: Never deploy to any environment
- ❌ **No External API Calls**: Never make calls to external services
- ❌ **No Network Operations**: Never perform network operations

## Exact First Dry-Run Task Goal

### Primary Objective
**Task:** Demonstrate that Cline can read Ralph-Loop governance, understand task assignments, and produce appropriate handoff documentation without modifying product code or violating safety policies.

### Specific Success Criteria
1. **Governance Reading**: Cline successfully reads and acknowledges governance files
2. **Task Understanding**: Cline correctly interprets task assignment from `runs/current-run.json`
3. **Scope Compliance**: Cline stays within task-defined boundaries
4. **Safety Compliance**: Cline respects protected files and forbidden operations
5. **Handoff Production**: Cline produces comprehensive handoff documentation
6. **Validation Execution**: Cline runs required validation checks
7. **Human Review Gate**: Cline stops for human review as required

### Task Scope Definition
- **Input**: Task assignment in `runs/current-run.json`
- **Process**: Read governance, understand task, execute within scope
- **Output**: Updated handoff documentation and runtime state
- **Constraints**: No product code changes, no forbidden operations

## Expected Changed Files

### Files That Should Be Modified
- ✅ **`handoffs/latest-handoff.md`** - Updated with dry run results
- ✅ **`tasks/task-state.json`** - Task status updated (if task allows)
- ✅ **`tasks/task-history.jsonl`** - Task history event added (if task allows)
- ✅ **`runs/current-run.json`** - Run status updated (if task allows)
- ✅ **`runs/run-history.jsonl`** - Run history event added (if task allows)
- ✅ **`validation/validation-results.jsonl`** - Validation results added (if task allows)

### Files That May Be Modified (Task-Dependent)
- ⚠️ **Documentation files** - Only if task explicitly allows
- ⚠️ **Planning files** - Only if task explicitly allows
- ⚠️ **Report files** - Only if task explicitly allows

### Files That Must NOT Be Modified
- ❌ **`src/**/*`** - All product code files
- ❌ **`package.json`** - Package configuration
- ❌ **`package-lock.json`** - Dependency lock file
- ❌ **`supabase/**/*`** - Database and edge functions
- ❌ **`scripts/**/*`** - Executable scripts
- ❌ **`.roo/**/*`** - Roo-specific files
- ❌ **`.roomodes`** - Roo mode configuration
- ❌ **`ROADMAP.md`** - Project roadmap
- ❌ **`VERIFY.md`** - Verification procedures
- ❌ **`README.md`** - Project documentation

## Verification Checklist

### Command Syntax
- Use PowerShell-compatible commands.
- Prefer one short isolated command per execution.
- Enforce one command per tool execution (never combine commands).
- Do not run long compound commands unless explicitly approved.
- Verify with `git status --short` before and after write tests.
- If terminal output is missing or command hangs, stop and ask for human validation.
- Do not spawn repeated PowerShell wrapper commands.

### Command Isolation Enforcement (CLINE-OPS-004)

- Cline must never combine multiple commands in one terminal invocation.
- This applies even when commands are individually safe.
- Final checks must be run as separate tool executions.

Forbidden separators/operators:

- `&&`
- `||`
- `;`
- `|`
- backticks for command substitution
- multi-line command blocks
- chained `git`/`npm`/`node` commands

Required final-check format (run exactly as separate executions):

```powershell
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

Recovery rule if a chained command is attempted accidentally:

1. stop,
2. document parser/chaining violation,
3. rerun only the intended commands one-by-one,
4. do not simplify by using alternative separators,
5. do not escalate shell syntax.

Incident rationale (CLINE-REAL-011):

- Cline attempted chained git final checks with `&&`.
- PowerShell parser failed.
- Recovery succeeded by rerunning checks separately.
- Rule is strengthened to prevent recurrence.

### Git Pager Reliability
- If Git output is visible but Cline remains `Running`, check whether Git opened a pager.
- Typical signal: terminal accepts `q`; pressing `q` completes execution.
- For read-only Git inspection, prefer:

```powershell
git --no-pager log -1 --oneline
git --no-pager show --name-only --pretty=format:"%H%n%s" HEAD
git --no-pager diff --stat
git --no-pager diff --name-only
```

- Avoid pager-prone forms without `--no-pager`:
  - `git show`
  - `git log`
  - `git diff`

- Recovery rule:
  - press `q` once
  - do not click **Proceed While Running** repeatedly
  - do not escalate to complex shell syntax
  - document the incident in `handoffs/latest-handoff.md`

### Blocking Command Registry (approval required)
- `npm run dev`
- `npx expo start`
- `expo start`
- `tail -f`
- `watch`
- long-running local servers
- interactive prompts
- any command that waits for user input

### Timeout / Stop Rules
- If a command appears complete but Cline still shows `Running`, stop and inspect.
- If a command continues without new output after a short wait, stop and document.
- Never treat **Proceed While Running** as normal workflow.
- Terminal-dependent execution is not unattended-safe until these cases are resolved.

### Verification Guidance (documentation-only tasks)
- Prefer readback checks using:
  - `git status --short`
  - `git --no-pager diff --stat`
- Avoid full `npm run verify` unless product/runtime code changed.

### Dependency Command Safety (CLINE-OPS-003)

- `npm install` is allowed only when explicitly required to restore missing local dependencies.
- `npm audit` is read-only and allowed for inspection only.
- `npm audit fix` requires explicit human approval for the current task.
- `npm audit fix --force` is forbidden during scoped tasks unless a dedicated dependency-migration task is explicitly approved.
- Any `package.json` / `package-lock.json` change is out of scope unless the task explicitly allows dependency changes.

#### Incident Rationale

- `npm audit fix --force` can perform SemVer-major upgrades and large lockfile rewrites.
- It must not be mixed into feature/test/governance scoped tasks.

#### Drift Recovery Rule

If dependency files drift accidentally:

1. stop,
2. restore `package.json`,
3. restore `package-lock.json`,
4. rerun `npm install`,
5. rerun the narrow relevant test,
6. document the incident in `handoffs/latest-handoff.md`.

### Unattended Execution Constraint
- Cline is currently allowed only as a scoped worker.
- Cline is not yet trusted for unattended overnight execution.
- Ralph/Governor remains responsible for scope, stop conditions, and human review gates.

### Pre-Execution Verification
- [ ] **Task Assignment Valid**: `runs/current-run.json` contains valid task
- [ ] **Scope Boundaries Clear**: Allowed/forbidden files clearly defined
- [ ] **Validation Requirements Clear**: Required validation checks specified
- [ ] **Human Reviewer Ready**: Human available for immediate oversight

### During Execution Monitoring
- [ ] **File Modifications Tracked**: Monitor which files Cline accesses
- [ ] **Scope Compliance Monitored**: Verify Cline stays within boundaries
- [ ] **Protected File Protection**: Verify no protected files accessed
- [ ] **Error Handling Observed**: Monitor how Cline handles any errors

### Post-Execution Verification
- [ ] **Handoff Complete**: Comprehensive handoff document produced
- [ ] **Scope Compliance**: All changes within task boundaries
- [ ] **Safety Compliance**: No protected files modified
- [ ] **Validation Passed**: All required validation checks passed
- [ ] **Expected Files Changed**: Only expected files modified
- [ ] **Forbidden Files Untouched**: No forbidden files modified

## Human Review Checklist

### Change Review
- [ ] **Complete Diff Review**: Examine every changed line
- [ ] **Scope Verification**: Confirm changes within task boundaries
- [ ] **Quality Assessment**: Evaluate implementation quality
- [ ] **Safety Confirmation**: Verify no safety violations

### Handoff Review
- [ ] **Handoff Completeness**: All required sections present
- [ ] **Handoff Accuracy**: Information matches actual changes made
- [ ] **Handoff Clarity**: Clear and actionable for next steps
- [ ] **Issue Documentation**: Any problems clearly documented

### Governance Compliance Review
- [ ] **Governance Reading**: Verify Cline read governance files
- [ ] **Task Understanding**: Verify Cline understood task correctly
- [ ] **Rule Following**: Verify Cline followed operational rules
- [ ] **Safety Respect**: Verify Cline respected safety policies

### System Integration Review
- [ ] **State Consistency**: Verify runtime state is consistent
- [ ] **Validation Results**: Verify validation checks passed
- [ ] **Error Handling**: Verify appropriate error handling
- [ ] **Stop Conditions**: Verify Cline stopped appropriately

## Rollback Checklist

### Immediate Rollback Actions
- [ ] **Stop Cline**: Immediately stop any running Cline processes
- [ ] **Assess Changes**: Determine scope of changes made
- [ ] **Document Issues**: Record what went wrong and why
- [ ] **Preserve Evidence**: Save logs and error messages

### Git Rollback Procedure
- [ ] **Check Git Status**: `git status` to see changed files
- [ ] **Review Changes**: `git --no-pager diff` to see specific changes
- [ ] **Selective Rollback**: `git checkout -- <file>` for specific files
- [ ] **Complete Rollback**: `git reset --hard HEAD` if necessary (use with caution)

### State File Rollback
- [ ] **Backup State Files**: Ensure backup of state files exists
- [ ] **Restore task-state.json**: Restore from backup if corrupted
- [ ] **Restore Runtime State**: Restore other runtime state files if needed
- [ ] **Validate Restoration**: Verify all files restored correctly

### Verification After Rollback
- [ ] **Repository Clean**: Verify repository is in clean state
- [ ] **State Consistent**: Verify runtime state is consistent
- [ ] **Validation Passes**: Verify `npm run verify` passes
- [ ] **No Corruption**: Verify no data corruption occurred

## Pass/Fail Decision Criteria

### Pass Criteria (All Must Be Met)
- ✅ **Governance Compliance**: Cline read and followed governance files
- ✅ **Task Execution**: Cline executed assigned task correctly
- ✅ **Scope Compliance**: All changes within task boundaries
- ✅ **Safety Compliance**: No protected files modified
- ✅ **Validation Success**: All required validation checks passed
- ✅ **Handoff Quality**: Comprehensive handoff documentation produced
- ✅ **Human Review Gate**: Cline stopped for human review as required
- ✅ **No Forbidden Operations**: No forbidden actions attempted

### Fail Criteria (Any One Causes Failure)
- ❌ **Scope Violation**: Any changes outside task boundaries
- ❌ **Safety Violation**: Any protected files modified
- ❌ **Validation Failure**: Any required validation checks failed
- ❌ **Governance Violation**: Any governance rules violated
- ❌ **Forbidden Operations**: Any forbidden actions attempted
- ❌ **Incomplete Handoff**: Missing or inadequate handoff documentation
- ❌ **Autonomous Continuation**: Cline attempted to continue without human review
- ❌ **Product Code Changes**: Any modifications to `src/` directory

### Partial Success Handling
If some criteria pass but others fail:
- **Document Partial Success**: Record what worked and what didn't
- **Analyze Root Cause**: Understand why failures occurred
- **Plan Remediation**: Determine how to address failures
- **Consider Retry**: Decide if retry is appropriate after fixes

## Decision Matrix

### Pass Decision
If all pass criteria met:
- ✅ **Approve Dry Run**: Mark RALPH-010A as successful
- ✅ **Proceed to Next Phase**: Consider next Ralph-Loop tasks
- ✅ **Document Success**: Record successful dry run completion
- ✅ **Update Documentation**: Update any documentation based on learnings

### Fail Decision
If any fail criteria met:
- ❌ **Fail Dry Run**: Mark RALPH-010A as failed
- ❌ **Analyze Issues**: Conduct thorough root cause analysis
- ❌ **Plan Remediation**: Develop plan to address failures
- ❌ **Consider Retry**: Determine if retry is appropriate after fixes

### Partial Success Decision
If mixed results:
- ⚠️ **Conditional Pass**: May proceed with additional safeguards
- ⚠️ **Enhanced Monitoring**: Increase oversight for next attempts
- ⚠️ **Scope Reduction**: Reduce scope of next tasks
- ⚠️ **Additional Training**: Provide additional guidance to Cline

## Important Notes

### This is Preparation Only
This checklist prepares for the dry run but does not execute it. The actual dry run execution is handled by RALPH-010A.

### Safety is Paramount
Any safety violation immediately fails the dry run, regardless of other successes.

### Human Oversight Required
The dry run requires active human oversight throughout execution.

### Learning Opportunity
The first dry run is primarily a learning and validation exercise, not a production task.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-19T18:11:00Z  
**Applies To:** RALPH-010A First Cline Dry Run  
**Next Review:** After dry run completion