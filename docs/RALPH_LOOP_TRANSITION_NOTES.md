# Ralph-Loop Governance Transition Notes

**Document Version:** 1.0.0  
**Created:** 2026-05-19T09:01:00Z  
**Last Updated:** 2026-05-19T09:01:00Z  
**Status:** Active Transition  

---

## Current State

### Existing Governance Structure
The HealthApp repository currently operates under **Roo-first governance** as defined in [`SSOK.md`](../SSOK.md):

- **Strategic Project SSOK:** [`README.md`](../README.md), [`ROADMAP.md`](../ROADMAP.md), [`AGENTS.md`](../AGENTS.md), [`VERIFY.md`](../VERIFY.md), [`package.json`](../package.json)
- **Operative Roo SSOK:** [`.roomodes`](../.roomodes), [`.roo/rules/`](../.roo/rules/), [`.roo/commands/`](../.roo/commands/)
- **Implementation Reality:** [`src/`](../src/), [`scripts/`](../scripts/), [`docs/`](../docs/), [`supabase/`](../supabase/)

### Current Operational Model
- **Roo is the operative SSOK** for day-to-day development work
- Established agent workflows via slash commands (`/feature`, `/bugfix`, `/review`, etc.)
- Proven track record with HealthApp development
- Deep integration with existing repository patterns

---

## Target State

### Repository-First, Agent-Neutral Governance
The target state establishes **repository governance as authoritative** with tools serving as adapters:

**New Governance Hierarchy:**
1. **Root Project Truth:** [`README.md`](../README.md), [`ROADMAP.md`](../ROADMAP.md), [`AGENTS.md`](../AGENTS.md), [`VERIFY.md`](../VERIFY.md), [`package.json`](../package.json)
2. **Ralph-Loop Governance:** [`.governance/`](../.governance/)
3. **Runtime State:** [`tasks/`](../tasks/), [`runs/`](../runs/), [`handoffs/`](../handoffs/), [`validation/`](../validation/), [`reports/`](../reports/)
4. **Tool Adapters:** [`.agent/adapters/`](../.agent/adapters/)
5. **Legacy Roo Adapter:** [`.roo/`](../.roo/) and [`.roomodes`](../.roomodes) until explicitly retired

### Agent-Neutral Principle
- **Cline, OpenCode, Codex, and Roo are worker adapters**, not sources of truth
- Repository contracts define work requirements, tools implement them
- Standardized adapter interfaces enable tool interoperability
- Tool-specific files are adapters, not permanent project truth

---

## What Has Changed So Far

### Completed Ralph-Loop Foundation (RALPH-001A through RALPH-003A)

#### 1. Agent-Neutral Governance Foundation (RALPH-001A)
- **Created:** [`.governance/`](../.governance/) directory structure
- **Files:** [`SYSTEM.md`](../.governance/SYSTEM.md), [`RULES.md`](../.governance/RULES.md), [`SAFETY.md`](../.governance/SAFETY.md), [`REVIEW_POLICY.md`](../.governance/REVIEW_POLICY.md)
- **Purpose:** Tool-neutral governance contracts and safety policies

#### 2. Runtime State Management Foundation (RALPH-002A)
- **Created:** Runtime state management infrastructure
- **Files:** [`tasks/task-state.json`](../tasks/task-state.json), [`tasks/task-history.jsonl`](../tasks/task-history.jsonl), [`runs/current-run.json`](../runs/current-run.json), [`runs/run-history.jsonl`](../runs/run-history.jsonl), [`handoffs/latest-handoff.md`](../handoffs/latest-handoff.md), [`validation/validation-rules.json`](../validation/validation-rules.json), [`validation/validation-results.jsonl`](../validation/validation-results.jsonl), [`reports/morning-review.md`](../reports/morning-review.md)
- **Purpose:** Structured task state tracking, handoff management, and validation history

#### 3. Agent Prompt and Adapter Contracts (RALPH-003A)
- **Created:** Static prompt templates and adapter documentation
- **Files:** [`.agent/prompts/`](../.agent/prompts/) (coordinator, worker, reviewer, validator), [`.agent/adapters/`](../.agent/adapters/) (cline, opencode, roo, codex), [`.agent/config/`](../.agent/config/) (loop-config, protected-files)
- **Purpose:** Tool-neutral contracts and adapter specifications

### Current Task (RALPH-004A)
- **Adding:** Minimal transition notes to root governance files
- **Updating:** Runtime state files with current progress
- **Creating:** This transition documentation

---

## What Has NOT Changed

### Preserved Existing Functionality
- **All existing Roo workflows continue to function** - no disruption to current development
- **No product code modifications** - all changes are documentation and static foundation files
- **No script modifications** - existing automation remains intact
- **No `.env` or configuration changes** - environment setup unchanged

### Preserved Files and Directories
- **[`.roo/`](../.roo/) directory completely preserved** - all rules and commands intact
- **[`.roomodes`](../.roomodes) file preserved** - existing mode definitions unchanged
- **[`src/`](../src/) directory untouched** - no product code changes
- **[`scripts/`](../scripts/) directory untouched** - no automation changes
- **[`supabase/`](../supabase/) directory untouched** - no database or edge function changes

### Preserved Governance Authority
- **[`ROADMAP.md`](../ROADMAP.md) remains the Single Source of Knowledge** for tasks and priorities
- **[`VERIFY.md`](../VERIFY.md) remains authoritative** for verification requirements
- **[`package.json`](../package.json) remains authoritative** for executable commands
- **Existing verification pipeline unchanged** - `npm run verify` continues to work

---

## How to Use Roo During Transition

### Roo's Transitional Role
**Roo remains the primary operational agent** during the Ralph-Loop migration with these guidelines:

#### For Existing Product Development Tasks
- **Continue using Roo normally** for feature development, bug fixes, and reviews
- **Follow existing [`.roo/rules/`](../.roo/rules/) and [`.roo/commands/`](../.roo/commands/)** as before
- **Use established slash commands** (`/feature`, `/bugfix`, `/review`, etc.)
- **No changes to current workflows** required

#### For Ralph-Loop Migration Tasks (RALPH-XXX)
When working on Ralph-Loop migration tasks, Roo must:
- **Read [`.governance/`](../.governance/) policies first** before starting work
- **Follow Ralph-Loop governance** for migration-specific tasks
- **Respect task scope** defined in [`runs/current-run.json`](../runs/current-run.json) (when available)
- **Write handoff documentation** to [`handoffs/latest-handoff.md`](../handoffs/latest-handoff.md)
- **Never delete or rewrite [`.roo/`](../.roo/) or [`.roomodes`](../.roomodes)** unless explicitly tasked

#### Dual Governance During Transition
- **For Ralph-Loop tasks:** Follow [`.governance/`](../.governance/) policies
- **For product tasks:** Continue using [`.roo/`](../.roo/) operational logic
- **For conflicts:** [`.governance/`](../.governance/) takes precedence on Ralph-Loop tasks

---

## When Cline May Be Installed/Configured

### Cline Integration Timeline
**Cline is NOT installed or configured yet.** The current Ralph-Loop foundation provides documentation and contracts for future Cline integration.

#### Prerequisites for Cline Installation (RALPH-008A)
- **RALPH-004A through RALPH-007A completed** - governance transition and task selector implementation
- **Human approval for Cline installation** - explicit authorization required
- **VS Code environment available** - Cline requires VS Code extension
- **Ralph-Loop safety systems operational** - validation and safety gates functional

#### Cline Integration Approach
- **Cline will be a worker adapter** implementing repository contracts
- **Repository governance remains authoritative** - Cline follows [`.governance/`](../.governance/) policies
- **Controlled introduction** - dry runs without product code changes first (RALPH-009A)
- **Parallel operation** - Cline and Roo can coexist during transition

#### Cline Capabilities (When Installed)
- **Task execution** - implement assigned tasks from [`runs/current-run.json`](../runs/current-run.json)
- **File system access** - direct file modification within allowed scope
- **Validation integration** - run verification commands and capture results
- **Handoff documentation** - write structured handoff reports

---

## Rollback Principle

### Simple Rollback Strategy
**Because no product code or scripts are changed**, rollback is straightforward:

#### What Rollback Involves
- **Revert documentation commits** - undo changes to governance files
- **Remove Ralph-Loop directories** - delete [`.governance/`](../.governance/), [`tasks/`](../tasks/), [`runs/`](../runs/), [`handoffs/`](../handoffs/), [`validation/`](../validation/), [`reports/`](../reports/), [`.agent/`](../.agent/)
- **Restore original governance** - return to pure Roo-first governance

#### What Rollback Does NOT Involve
- **No [`.roo/`](../.roo/) deletion** - Roo files are preserved and continue to function
- **No product code changes** - [`src/`](../src/) directory remains untouched
- **No script modifications** - [`scripts/`](../scripts/) directory remains intact
- **No environment changes** - no [`.env`](../.env) or configuration rollback needed

#### Rollback Decision Points
- **After RALPH-004A:** Documentation-only rollback
- **After RALPH-007A:** Foundation-only rollback (no runtime behavior)
- **After RALPH-010A:** Full rollback including any runtime components

### Rollback Safety
- **No data loss risk** - all changes are additive documentation and state files
- **No breaking changes** - existing workflows continue to function
- **No dependency changes** - no [`package.json`](../package.json) modifications
- **Immediate restoration** - rollback can be completed in minutes

---

## Next Recommended Task

### RALPH-005A: Dry-run Task Selector Plan
**After completing RALPH-004A**, the next recommended task is:

**Task:** RALPH-005A - Dry-run task selector plan  
**Type:** Planning/Documentation  
**Risk Level:** Safe Autonomous  
**Scope:** Create planning document for task selection algorithm

#### Why This Task Next
- **Builds on completed foundation** - uses established governance and state management
- **Low risk planning phase** - documentation only, no implementation
- **Prepares for automation** - designs the core task selection logic
- **Maintains incremental approach** - small, focused planning step

#### Task Objectives
- **Design task selection algorithm** - how to choose eligible tasks from [`ROADMAP.md`](../ROADMAP.md)
- **Define safety constraints** - what makes a task safe for autonomous execution
- **Document selection criteria** - priority, dependencies, risk assessment
- **Plan dry-run approach** - how to test task selection without execution

### Subsequent Task Sequence
1. **RALPH-006A:** Implement dry-run task selector (implementation)
2. **RALPH-007A:** Morning review generator plan (planning)
3. **RALPH-008A:** Cline worker adapter preparation (integration)
4. **RALPH-009A:** First Cline dry run (controlled testing)
5. **RALPH-010A:** First controlled single-task loop (full system test)

---

## Key Principles

### Repository-First Governance
- **Repository state is durable memory** - not chat conversations or tool sessions
- **Repository contracts are authoritative** - tools implement repository requirements
- **Repository governance evolves deliberately** - not driven by tool-specific needs

### Agent Neutrality
- **Tools are replaceable** - repository contracts enable tool interoperability
- **No tool-specific logic in core governance** - contracts are tool-neutral
- **Adapter pattern for tool integration** - standardized interfaces for all tools

### Incremental Transition
- **Small, safe steps** - each task builds on previous foundation
- **Preserve existing functionality** - no disruption to current workflows
- **Human review gates** - explicit approval required for significant changes
- **Rollback capability maintained** - easy return to previous state if needed

### Safety First
- **No product code changes** during foundation establishment
- **No breaking changes** to existing workflows
- **Protected file enforcement** - critical files cannot be modified by agents
- **Validation requirements** - all changes must pass verification

---

## Important Notes

### This is a Transition, Not a Replacement
- **Roo is not being replaced immediately** - it remains the primary operational agent
- **Ralph-Loop is additive** - new capabilities alongside existing functionality
- **Gradual migration approach** - careful, controlled transition over time
- **Preservation of working systems** - existing patterns continue to function

### Repository Governance is Becoming Authoritative
- **Tools adapt to repository contracts** - not the other way around
- **Repository defines work requirements** - tools implement them
- **Durable governance in repository files** - not in tool-specific configurations
- **Tool-neutral approach** - works with any compliant agent tool

### Foundation Before Runtime
- **Static foundation first** - contracts and documentation before executable code
- **Validation before automation** - prove concepts work before scaling
- **Human oversight maintained** - review gates prevent autonomous overreach
- **Safety systems operational** - protection before powerful capabilities

---

**End of Transition Notes**