# Ralph-Loop Operational Rules

## Core Execution Rules

### One-Task-Per-Run Rule

**Agents must execute exactly one task per run.**

- Select one eligible task from [`ROADMAP.md`](../ROADMAP.md)
- Complete that task fully before stopping
- Never attempt multiple tasks in a single run
- Always stop for human review after task completion

### No Unrelated Cleanup

**Agents must not perform cleanup outside the selected task scope.**

- Do not fix unrelated lint errors
- Do not refactor code not touched by the task
- Do not update dependencies unless explicitly required by the task
- Do not reorganize file structures unless part of the task

### No Broad Refactors

**Agents must not perform architectural changes unless explicitly tasked.**

- Preserve existing architecture boundaries
- Do not rename major modules or classes
- Do not introduce new design patterns
- Do not consolidate or split modules without explicit task requirement

### No Product-Code Changes Without Task Authorization

**Agents must not modify implementation code unless the selected task explicitly allows it.**

- Documentation-only tasks must not touch `src/` directory
- Planning tasks must not modify implementation files
- Review tasks must not make code changes
- Only implementation tasks may modify product code

## Task Selection Rules

### Task Selection Must Follow ROADMAP.md

**All task selection must reference [`ROADMAP.md`](../ROADMAP.md) as the single source of truth.**

- Only select tasks with status `todo` or `in_progress`
- Respect task dependencies and prerequisites
- Follow priority order when multiple tasks are eligible
- Never create or modify tasks without human approval

### Future Task-State Integration

**When task-state system is implemented, agents must follow structured task state.**

- Read task state from designated task state files
- Update task state through proper state management
- Respect state transition rules
- Never bypass task state validation

## Agent Handoff Rules

### Agents Must Write Handoffs

**Every agent run must produce a clear handoff document.**

- Document what was changed and why
- List all files modified
- Record any issues or blockers encountered
- Provide clear status for human review

### Agents Must Not Claim Done Without Validation

**No task may be marked complete without passing verification.**

- Run verification pipeline per [`VERIFY.md`](../VERIFY.md)
- All checks must pass before claiming completion
- Document verification results in handoff
- Never bypass or skip verification steps

## Validation Rules

### Validation Must Follow VERIFY.md

**All validation must follow the canonical verification process.**

- Execute `npm run verify` as primary validation
- Run additional checks as specified in [`VERIFY.md`](../VERIFY.md)
- Edge verification required when edge functions are modified
- Document all verification results

### Validation Failures Block Completion

**Any validation failure prevents task completion.**

- Fix validation errors before claiming done
- Do not commit code that fails verification
- Update task status to reflect validation state
- Escalate to human review if validation cannot be resolved

## Tool Governance Rules

### Tool-Specific Files Are Adapters

**Tool-specific configuration files are adapters, not permanent project truth.**

- `.roo/` files are Roo-specific operational adapters
- `.cline/` files (if present) are Cline-specific adapters
- `.codex/` files (if present) are Codex-specific adapters
- Repository governance in `.governance/` is tool-neutral truth

### Agents Are Worker Tools

**Roo, Cline, OpenCode, and Codex are worker tools, not sources of truth.**

- Repository files contain authoritative state
- Agent tools implement repository contracts
- No tool-specific logic in domain or application layers
- Tools are replaceable; repository contracts are durable

## State Management Rules

### Repository State Is Authoritative

**All operational state must be persisted in repository files.**

- Task status in [`ROADMAP.md`](../ROADMAP.md)
- Verification results in handoff documents
- Decision rationale in commit messages
- No critical state in chat history or tool sessions

### State Changes Must Be Traceable

**All state changes must be documented and traceable.**

- Update [`ROADMAP.md`](../ROADMAP.md) when task status changes
- Record decision rationale in commit messages
- Document architectural decisions in appropriate files
- Maintain audit trail of all significant changes

## Architecture Preservation Rules

### Respect Existing Architecture Boundaries

**Agents must preserve established architecture layers.**

- Domain logic remains framework-independent
- Infrastructure must not leak into domain logic
- UI should not contain business logic
- Maintain separation between layers

### No Model Names in Core Layers

**No AI model names or provider names in domain or application layer code.**

- Keep AI integration in infrastructure layer
- Use generic interfaces for AI services
- No hardcoded model references in business logic
- Maintain provider independence

## Safety Integration

**All rules must be consistent with safety policies defined in [`SAFETY.md`](SAFETY.md).**

- Protected files override all other rules
- Safety violations immediately stop execution
- No rule permits bypassing safety constraints
- Human approval required for protected file changes