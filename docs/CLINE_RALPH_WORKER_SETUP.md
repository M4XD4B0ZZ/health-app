# Cline Ralph Worker Setup

## Purpose

This document provides setup instructions and operational guidelines for using Cline as a Ralph-Loop worker adapter. Cline serves as an implementation tool that executes assigned tasks within the Ralph-Loop governance framework.

**Important:** This document describes setup procedures. Cline installation and configuration are handled separately and are NOT part of this task.

## What Cline is Allowed to Be

### Worker Adapter Role
- **Task Executor**: Cline executes exactly one assigned task per run
- **File Modifier**: Cline creates, modifies, and deletes files as specified by task scope
- **Validation Runner**: Cline executes required validation checks per task definition
- **Handoff Writer**: Cline documents work in `handoffs/latest-handoff.md`
- **Repository Reader**: Cline reads governance files and task assignments

### Operational Boundaries
- **Scoped Implementation**: Cline works within task-defined file boundaries
- **Safety Compliant**: Cline respects protected files and forbidden operations
- **Governance Follower**: Cline implements repository contracts, not its own logic
- **Human-Gated**: Cline stops after task completion for human review

## What Cline is NOT Allowed to Be

### Prohibited Roles
- **Source of Truth**: Repository governance is authoritative, not Cline's internal logic
- **Task Selector**: Cline executes assigned tasks, never selects them
- **Autonomous Agent**: Cline requires explicit task assignment and human review gates
- **Decision Maker**: Cline implements specifications, does not make architectural decisions

### Prohibited Behaviors
- **Multi-Task Execution**: Never execute multiple tasks in a single run
- **Scope Expansion**: Never exceed task-defined boundaries
- **Chat History Reliance**: Never rely on conversation history for task context
- **Autonomous Continuation**: Never continue to next task without human approval

## Required Files Cline Must Read First

### Governance Foundation (Read in Order)
1. **`.governance/SYSTEM.md`** - Ralph-Loop governance system overview
2. **`.governance/RULES.md`** - Operational rules and constraints
3. **`.governance/SAFETY.md`** - Safety policies and protected files
4. **`.governance/REVIEW_POLICY.md`** - Human review requirements

### Task Assignment Context
5. **`runs/current-run.json`** - Current task assignment and scope
6. **`tasks/task-state.json`** - Task state and dependencies
7. **`handoffs/latest-handoff.md`** - Previous execution context

### Worker Role Definition
8. **`.agent/prompts/worker.md`** - Worker role responsibilities and constraints

### Adapter Integration
9. **`.agent/adapters/cline.md`** - Cline-specific integration requirements

## Required Operating Rules

### Task Execution Protocol
1. **Read Assignment**: Parse `runs/current-run.json` for complete task details
2. **Verify Scope**: Confirm allowed/forbidden files and operations
3. **Plan Implementation**: Understand requirements before making changes
4. **Execute Within Bounds**: Modify only allowed files, respect forbidden constraints
5. **Validate Work**: Run required validation checks per task definition
6. **Document Handoff**: Write comprehensive handoff in `handoffs/latest-handoff.md`
7. **Stop for Review**: Never continue to next task automatically

### Governance Compliance
- **Repository First**: Repository files are authoritative, not Cline defaults
- **Safety First**: Protected files override all other considerations
- **Scope First**: Task boundaries override implementation preferences
- **Human First**: Human review gates override automation desires

### File System Discipline
- **Allowed Files Only**: Modify only files listed in task's `allowed_files`
- **Forbidden Files Never**: Never touch files in task's `forbidden_files`
- **Protected Files Never**: Never modify `.env*`, `secrets/**`, `credentials/**`, `node_modules/**`, `.git/**`
- **Handoff Always**: Always update `handoffs/latest-handoff.md`

## Forbidden Actions

### Never Allowed Under Any Circumstances
- **Push to Remote**: No `git push` operations
- **Deploy to Production**: No production deployments
- **Install Dependencies**: No `npm install` without explicit task authorization
- **Modify Protected Files**: Never touch `.env*`, `package.json`, `package-lock.json` without explicit approval
- **Execute Multiple Tasks**: One task per run, always
- **Bypass Validation**: Never skip required validation checks
- **Claim Done Without Validation**: Never mark tasks complete without passing validation

### Requires Explicit Task Authorization
- **Product Code Changes**: Only if task explicitly allows `src/` modifications
- **Configuration Changes**: Only if task explicitly allows config file modifications
- **Database Changes**: Only if task explicitly allows schema modifications
- **Script Execution**: Only if task explicitly allows script modifications

### Human Approval Required
- **Protected File Changes**: Any modification to protected files requires human approval
- **Scope Expansion**: Any work beyond task definition requires human approval
- **Safety Policy Exceptions**: Any deviation from safety policies requires human approval

## First Safe Task Type

### Documentation and State Tasks
The safest first tasks for Cline are:
- **Documentation Creation**: Creating or updating `.md` files
- **State File Updates**: Updating `tasks/task-state.json`, `handoffs/latest-handoff.md`
- **Planning Tasks**: Creating files in `plans/` directory
- **Report Generation**: Updating `reports/` files

### Characteristics of Safe Tasks
- **No Product Code**: No modifications to `src/` directory
- **No Dependencies**: No `package.json` or `package-lock.json` changes
- **No Database**: No `supabase/` modifications
- **No Scripts**: No executable script modifications
- **Clear Scope**: Well-defined file boundaries
- **Reversible**: Easy to rollback if issues occur

## Handoff Requirements

### Required Handoff Sections
Every Cline run MUST produce a handoff document with:

1. **Run Summary**: Task ID, status, completion assessment
2. **Current Task**: Task details and scope verification
3. **Completed Work**: Detailed list of changes made
4. **Changed Files**: Complete list of modified files
5. **Validation Status**: Results of all required validation checks
6. **Known Issues**: Any problems or blockers encountered
7. **Next Recommended Action**: Clear guidance for next steps
8. **Human Review Needed**: Specific items requiring human attention
9. **Risks/Assumptions**: Risk assessment and assumptions made

### Handoff Quality Standards
- **Complete**: All sections must be filled out
- **Specific**: Concrete details, not generic statements
- **Actionable**: Clear next steps for human reviewer
- **Traceable**: All changes documented with rationale

## Validation Requirements

### Always Required
- **Protected File Check**: Verify no protected files were modified
- **Scope Boundary Check**: Confirm all changes within allowed scope
- **Forbidden File Check**: Verify no forbidden files were touched
- **JSON/JSONL Syntax**: Validate syntax of any JSON/JSONL files modified

### Conditionally Required
- **Standard Validation**: Run `npm run verify` if task validation type is "standard" or higher
- **Edge Verification**: Run `npm run verify:edge` if Supabase functions modified
- **Custom Validation**: Run task-specific validation commands as defined

### Validation Failure Handling
- **Document Failure**: Record specific validation errors
- **Attempt Fix**: Try to resolve within task scope
- **Escalate if Unfixable**: Stop and escalate to human review if cannot resolve
- **Never Bypass**: Never ignore or skip validation failures

## Stop Conditions

### Immediate Stop Required
Cline MUST stop immediately when:
- **Ambiguous Requirements**: Task specification is unclear or conflicting
- **Protected File Needed**: Implementation requires modifying protected files
- **Forbidden Operation**: Task requires forbidden actions
- **Validation Failure**: Required validation checks fail and cannot be resolved
- **Scope Violation**: Implementation would exceed allowed boundaries
- **Safety Violation**: Any safety policy would be violated
- **Missing Dependency**: Required tools or resources unavailable

### Escalation Process
When stop conditions occur:
1. **Preserve State**: Save all work in progress
2. **Document Issue**: Record what caused the stop
3. **Update Handoff**: Explain the blocking condition
4. **Human Review**: Wait for human intervention

## Human Review Requirements

### Always Requires Human Review
- **Task Completion**: Every task completion requires human approval
- **Validation Failures**: Any validation failure that cannot be resolved
- **Scope Questions**: Any ambiguity about task boundaries
- **Safety Concerns**: Any potential safety policy violations
- **Large Changes**: Changes exceeding 500 lines or 10 files

### Review Quality Expectations
- **Complete Diff Review**: Human must examine all changes
- **Scope Verification**: Human must confirm changes within task boundaries
- **Quality Assessment**: Human must assess implementation quality
- **Safety Confirmation**: Human must verify no safety violations

## Setup Checklist Before Installing Cline

### Prerequisites Verification
- [ ] **VS Code Installed**: Cline requires VS Code environment
- [ ] **Node.js Available**: Verify `node --version` works
- [ ] **NPM Available**: Verify `npm --version` works
- [ ] **Repository Access**: Verify read/write access to repository
- [ ] **Git Status Clean**: Verify no uncommitted changes

### Governance Verification
- [ ] **Governance Files Exist**: Verify `.governance/` directory exists
- [ ] **Task State Exists**: Verify `tasks/task-state.json` exists
- [ ] **Handoff Directory Exists**: Verify `handoffs/` directory exists
- [ ] **Agent Prompts Exist**: Verify `.agent/prompts/` directory exists

### Permission Verification
- [ ] **File System Access**: Verify can read/write repository files
- [ ] **Terminal Access**: Verify can execute commands in VS Code terminal
- [ ] **Network Access**: Verify can access required external resources

### Safety Verification
- [ ] **Protected Files Identified**: Review `.governance/SAFETY.md` protected file list
- [ ] **Forbidden Operations Understood**: Review forbidden actions list
- [ ] **Validation Commands Work**: Verify `npm run verify` executes successfully

## How to Verify Cline is Following Repository Governance

### Pre-Execution Verification
Before each Cline run:
- [ ] **Task Assignment Clear**: Verify `runs/current-run.json` contains clear task
- [ ] **Scope Boundaries Defined**: Verify allowed/forbidden files are specified
- [ ] **Validation Requirements Clear**: Verify required validation checks are defined

### During Execution Monitoring
While Cline is running:
- [ ] **File Modifications Tracked**: Monitor which files Cline is modifying
- [ ] **Scope Compliance**: Verify modifications stay within allowed boundaries
- [ ] **Protected File Protection**: Verify no protected files are accessed

### Post-Execution Verification
After each Cline run:
- [ ] **Handoff Complete**: Verify comprehensive handoff document created
- [ ] **Validation Passed**: Verify all required validation checks passed
- [ ] **Scope Compliance**: Verify all changes within task boundaries
- [ ] **Safety Compliance**: Verify no protected files modified
- [ ] **Quality Assessment**: Review implementation quality and approach

### Governance Compliance Indicators

#### Good Compliance Signs
- ✅ Cline reads governance files before starting work
- ✅ Cline stays within task-defined file boundaries
- ✅ Cline runs required validation checks
- ✅ Cline produces comprehensive handoff documentation
- ✅ Cline stops after task completion for human review

#### Poor Compliance Signs
- ❌ Cline modifies files outside task scope
- ❌ Cline skips validation requirements
- ❌ Cline produces incomplete handoff documentation
- ❌ Cline attempts to continue to next task automatically
- ❌ Cline modifies protected files

### Corrective Actions
If governance violations detected:
1. **Stop Cline Immediately**: Prevent further violations
2. **Document Violation**: Record what governance rule was violated
3. **Assess Damage**: Determine scope of any inappropriate changes
4. **Rollback if Necessary**: Revert changes that violate governance
5. **Update Configuration**: Adjust Cline configuration to prevent recurrence
6. **Human Review**: Escalate to human review before continuing

## Important Notes

### Cline Installation Not Covered
This document describes how Cline should operate within Ralph-Loop governance. The actual installation and configuration of Cline is handled by separate processes and is NOT part of this task.

### Repository Governance is Authoritative
Cline is an adapter that implements repository contracts. When conflicts arise between Cline's default behaviors and repository governance, repository governance takes precedence.

### Safety is Paramount
All Cline operations must comply with safety policies defined in `.governance/SAFETY.md`. Safety violations immediately stop execution and require human intervention.

### Human Review is Required
Cline operates under human supervision. Every task completion requires human review and approval before proceeding to next tasks.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-19T18:09:00Z  
**Applies To:** Ralph-Loop v0.1.0-alpha  
**Next Review:** After first Cline dry run completion