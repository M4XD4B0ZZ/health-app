# Ralph-Loop Governance System

## Purpose

This governance layer provides agent-neutral operational contracts for the HealthApp repository. It serves as a transition layer between the existing Roo-specific governance and a future fully agent-neutral Ralph-Loop runtime.

## Relationship to Existing Governance

This `.governance/` layer operates alongside existing governance files:

- **[`README.md`](../README.md)** - Project overview, setup, key commands
- **[`ROADMAP.md`](../ROADMAP.md)** - Single Source of Knowledge for tasks and priorities
- **[`AGENTS.md`](../AGENTS.md)** - Agent governance rules and verification requirements
- **[`VERIFY.md`](../VERIFY.md)** - Canonical verification commands and Definition of Done
- **[`SSOK.md`](../SSOK.md)** - Overarching Roo-first governance definition

## Transition Rule

**Roo remains the legacy/temporary operational adapter until explicitly replaced.**

The existing `.roo/` directory structure continues to function as the operational SSOK. This `.governance/` layer provides agent-neutral contracts that can be implemented by any tool (Roo, Cline, OpenCode, Codex) without replacing the current working system.

## Core Principle

**Repository state is durable memory, not chat memory.**

All operational state, decisions, and progress must be persisted in repository files. Chat conversations and tool-specific sessions are ephemeral. The repository contains the authoritative state of all work.

## Ralph-Loop Lifecycle

**Gate ownership (lifecycle):** `SYSTEM.md` owns the lifecycle gate position/order (including stop-for-review placement and lifecycle stop-condition framework). It does not redefine safety, execution, review-acceptance, or verification-completion policy owners.

The high-level loop lifecycle defines how agents should operate:

### 1. Read Governance

- Read this governance layer (`.governance/`)
- Read project governance ([`ROADMAP.md`](../ROADMAP.md), [`AGENTS.md`](../AGENTS.md), [`VERIFY.md`](../VERIFY.md))
- Understand current repository state

### 2. Read Task State

- Identify eligible tasks from [`ROADMAP.md`](../ROADMAP.md)
- Check task dependencies and prerequisites
- Assess current working tree state

### 3. Select One Task

- Choose exactly one task per run
- Verify task is eligible and safe to execute
- Update task status to `in_progress`

### 4. Execute Scoped Work

- Implement only the selected task
- Follow architecture boundaries and safety rules
- Make minimal, focused changes

### 5. Write Handoff

- Document what was changed and why
- Record any issues or blockers encountered
- Prepare clear handoff for human review

### 6. Validate

- Run verification pipeline per [`VERIFY.md`](../VERIFY.md)
- Ensure all safety checks pass
- Confirm no protected files were modified

### 7. Update State

- Update task status in [`ROADMAP.md`](../ROADMAP.md)
- Record completion or failure state
- Persist any learned information

### 8. Stop for Review

- Always stop after one task completion
- Wait for human review and approval
- Never continue to next task automatically

## Stop Conditions

The loop must stop immediately when any of these conditions occur:

### No Eligible Task

- All tasks are `done`, `blocked`, or `in_progress`
- No tasks meet safety criteria for execution
- Task dependencies are not satisfied

### Validation Failure

- [`npm run verify`](../package.json) fails
- Type errors or lint errors detected
- Tests fail or edge verification fails

### Protected File Change Needed

- Task requires modifying protected files (see [`SAFETY.md`](SAFETY.md))
- Environment variables need changes
- Package dependencies require updates

### Human Review Required

- Large diff generated (>500 lines changed)
- Architecture boundaries crossed
- Complex multi-file changes made

### Ambiguous Scope

- Task requirements are unclear or conflicting
- Multiple valid implementation approaches exist
- Dependencies on external decisions

### Repeated Failure

- Same validation error occurs multiple times
- No progress after multiple attempts
- Tool producing identical failed outputs

### Missing Dependency/Environment

- Required tools or credentials unavailable
- Network connectivity issues
- External services unreachable

### Task Exceeds Allowed Scope

- Implementation requires broader changes than specified
- Task scope creep beyond original definition
- Unrelated cleanup or refactoring needed

## Escalation Rules

When stop conditions occur:

1. **Document the Issue** - Record why the stop occurred
2. **Preserve State** - Ensure all work is committed or stashed
3. **Clear Handoff** - Explain what was attempted and what failed
4. **Human Review** - Wait for human intervention before continuing
5. **No Workarounds** - Do not attempt to bypass stop conditions

## Agent Neutrality

This governance layer is designed to work with any agent tool:

- **Roo** - Current operational adapter via `.roo/` commands
- **Cline** - VS Code extension with tool access
- **OpenCode** - CLI-based code generation tool
- **Codex** - Repository-aware AI assistant

All agents must implement the same contracts defined in this governance layer, regardless of their specific capabilities or interfaces.
