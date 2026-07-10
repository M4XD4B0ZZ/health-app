# Roo Adapter Documentation

## Adapter Overview

**Roo** is the current operational agent system for the HealthApp repository. In the Ralph-Loop system, Roo serves as a **temporary legacy adapter** during the transition to agent-neutral governance.

## Roo's Transitional Role

### Current Status: Legacy Operational Adapter

- Roo remains the primary operational agent during Ralph-Loop migration
- Roo files in `.roo/` and `.roomodes` are preserved and continue to function
- Roo provides operational continuity while new Ralph-Loop system is developed
- Roo is NOT the permanent future source of truth

### Transition Principle

- **Repository governance is becoming the permanent source of truth**
- **Roo is transitioning from "source of truth" to "worker adapter"**
- **Ralph-Loop governance in `.governance/` supersedes Roo-specific logic**
- **Roo must follow `.governance/` policies for Ralph-Loop migration work**

## Roo Integration with Ralph-Loop

### Governance Compliance for Ralph-Loop Tasks

When working on Ralph-Loop migration tasks (RALPH-XXX), Roo MUST:

- Read `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md` before starting work
- Respect task scope defined in `runs/current-run.json` (when available)
- Follow safety policies for protected files and forbidden actions
- Execute validation as specified in task definition
- Write handoff documentation to `handoffs/latest-handoff.md`

### Dual Governance During Transition

- **For Ralph-Loop tasks**: Follow `.governance/` policies
- **For existing product tasks**: Continue using `.roo/` operational logic
- **For conflicts**: `.governance/` takes precedence on Ralph-Loop tasks

### File System Constraints for Ralph-Loop Tasks

- **Allowed Files**: Only modify files listed in task's `allowed_files`
- **Forbidden Files**: Never touch files in task's `forbidden_files`
- **Protected Files**: Never modify `.env*`, `secrets/**`, `credentials/**`, `node_modules/**`, `.git/**`
- **Legacy Preservation**: Never delete or rewrite `.roo/` or `.roomodes` unless explicitly tasked

## Roo-Specific Considerations

### Roo Strengths During Transition

- Deep integration with existing repository workflows
- Established patterns and operational knowledge
- Proven track record with HealthApp development
- Existing verification and validation integration

### Roo Limitations in Ralph-Loop Context

- **Not the future permanent source of truth** - Repository governance is
- **Tool-specific logic** - Must adapt to tool-neutral governance
- **Legacy assumptions** - May conflict with new Ralph-Loop patterns
- **Transition complexity** - Must operate in dual-governance mode

### Roo Safety Integration

- Roo must respect protected file patterns defined in `.governance/SAFETY.md`
- Roo must stop immediately on safety policy violations
- Roo must never bypass validation requirements
- Roo must escalate to human review when required

## Roo Legacy File Preservation

### Files to Preserve

- **`.roo/rules/`** - Existing operational rules (preserved but not authoritative for Ralph-Loop)
- **`.roo/commands/`** - Existing command workflows (preserved for backward compatibility)
- **`.roomodes`** - Existing mode definitions (preserved for existing workflows)
- **All other `.roo/` files** - Preserved unless explicitly tasked to modify

### Files NOT to Delete or Rewrite

Roo must NOT delete or rewrite these files unless explicitly tasked later:

- `.roo/rules/01-global.md`
- `.roo/rules-code/01-code.md`
- `.roo/rules-code/02-plans.md`
- `.roo/commands/feature.md`
- `.roo/commands/bugfix.md`
- `.roo/commands/review.md`
- `.roo/commands/commit.md`
- `.roomodes`

## Roo Validation Integration

### Validation for Ralph-Loop Tasks

When working on Ralph-Loop tasks, Roo must:

- Execute validation commands as specified in task definition
- Capture and document validation results
- Not claim task completion without passing validation
- Escalate validation failures to human review

### Validation Commands

```bash
npm run verify          # Standard validation pipeline
npm run verify:edge     # Edge function validation (conditional)
npm run lint           # Linting (component of verify)
npm run typecheck      # Type checking (component of verify)
```

### Existing Roo Validation Integration

- Roo already integrates with `npm run verify` pipeline
- Roo understands existing VERIFY.md requirements
- Roo can continue using existing validation patterns
- Enhanced with Ralph-Loop validation requirements

## Roo Error Handling

### Scope Violations

If Roo attempts to modify forbidden files on Ralph-Loop tasks:

1. Stop the operation immediately
2. Document the attempted violation
3. Update handoff with violation details
4. Escalate to human review

### Validation Failures

If validation fails on Ralph-Loop tasks:

1. Document specific failure details
2. Attempt to fix within task scope
3. If unfixable, document and escalate
4. Never bypass or ignore validation failures

### Human Escalation Triggers

Roo must escalate to human review when:

- Task requirements are ambiguous
- Validation failures cannot be resolved within scope
- Safety policy violations are detected
- Task requires forbidden file modifications
- Implementation exceeds allowed scope

## Roo vs Other Adapters

### Roo Advantages During Transition

- Deep repository knowledge and context
- Established operational patterns
- Proven integration with existing systems
- Continuity during migration period

### Roo Limitations for Future

- Tool-specific rather than tool-neutral
- Legacy assumptions may conflict with new patterns
- Not designed for multi-tool interoperability
- Transition complexity

### When to Use Roo

- Existing product development tasks
- Tasks requiring deep repository context
- During transition period for continuity
- Complex tasks requiring established patterns

### When to Prefer Other Adapters

- New Ralph-Loop system development
- Tasks requiring tool-neutral approaches
- Future-oriented development patterns
- Multi-tool interoperability requirements

## Roo Migration Strategy

### Phase 1: Dual Governance (Current)

- Roo continues existing product work using `.roo/` governance
- Roo follows `.governance/` for Ralph-Loop migration tasks
- Both governance systems coexist

### Phase 2: Gradual Transition

- More tasks migrate to `.governance/` governance
- Roo adapts to tool-neutral patterns
- Legacy `.roo/` files preserved but less used

### Phase 3: Legacy Preservation

- `.roo/` files archived for historical reference
- Roo operates fully under `.governance/` governance
- Tool-neutral patterns fully established

### Phase 4: Optional Retirement

- Roo may be retired in favor of other adapters
- Or Roo may evolve to full tool-neutral compliance
- Decision based on effectiveness and maintenance needs

## Roo Configuration for Ralph-Loop

### Required Roo Behavior Changes

For Ralph-Loop tasks, Roo must:

- Read governance files before starting work
- Respect task scope boundaries strictly
- Write structured handoff documentation
- Stop after single task completion
- Never bypass validation requirements

### Roo Prompt Enhancement

When working on Ralph-Loop tasks, Roo should receive:

```markdown
You are operating as a Ralph-Loop Worker via Roo. This is a Ralph-Loop migration task.

CRITICAL: For Ralph-Loop tasks, follow .governance/ policies, not .roo/ policies.

Read these files in order before starting:

1. .governance/SYSTEM.md
2. .governance/RULES.md
3. .governance/SAFETY.md
4. runs/current-run.json (if available)
5. tasks/task-state.json

Execute ONLY the assigned task. Stay within allowed scope. Document work in handoffs/latest-handoff.md. Stop after task completion.

LEGACY PRESERVATION: Do not delete or rewrite .roo/ or .roomodes files unless explicitly tasked.
```

## Future Roo Evolution

### Potential Evolution Paths

1. **Full Tool-Neutral Compliance** - Roo evolves to fully support Ralph-Loop patterns
2. **Specialized Legacy Adapter** - Roo maintains existing product development focus
3. **Gradual Retirement** - Roo phases out in favor of other adapters
4. **Hybrid Approach** - Roo handles specific types of tasks within Ralph-Loop

### Decision Factors

- Roo's effectiveness with new governance patterns
- Maintenance overhead of dual-governance support
- User preference and workflow efficiency
- Technical debt and complexity considerations

## Important Notes

### Roo is NOT Being Replaced Immediately

This documentation describes Roo's transitional role. Roo continues to be the primary operational agent during the Ralph-Loop migration. The goal is gradual, safe transition, not immediate replacement.

### Repository-First Principle

Even during transition, the repository governance is becoming authoritative. Roo must adapt to repository contracts rather than imposing tool-specific patterns on the repository.

### Preservation of Existing Functionality

All existing Roo functionality is preserved. Ralph-Loop integration is additive, not replacement. Existing workflows continue to function while new patterns are gradually introduced.
