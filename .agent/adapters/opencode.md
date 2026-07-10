# OpenCode Adapter Documentation

## Adapter Overview

**OpenCode** is a CLI-based code generation tool that provides AI-powered development assistance through command-line interfaces. In the Ralph-Loop system, OpenCode serves as a **worker adapter** for implementation tasks.

## OpenCode Role in Ralph-Loop

### Primary Role: Worker Implementation

- OpenCode executes exactly one assigned task per run
- OpenCode reads task assignments from `runs/current-run.json`
- OpenCode implements, modifies, and creates files as specified by the task
- OpenCode writes handoff documentation to `handoffs/latest-handoff.md`

### Implementation Focus

- OpenCode is particularly suited for implementation tasks requiring focused code generation
- OpenCode excels at scoped file modifications and creation
- OpenCode provides deterministic, reproducible code changes
- OpenCode integrates well with existing CI/CD pipelines

## OpenCode Integration Requirements

### Governance Compliance

OpenCode MUST follow Ralph-Loop governance:

- Read `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md` before starting work
- Respect task scope defined in `runs/current-run.json`
- Follow safety policies for protected files and forbidden actions
- Execute validation as specified in task definition
- Never bypass task-state or validation requirements

### Task Execution Protocol

1. **Read Assignment**: Parse `runs/current-run.json` for task details
2. **Scope Verification**: Confirm allowed/forbidden files and actions
3. **Implementation**: Execute task within defined boundaries using scoped prompts
4. **Validation**: Run required validation checks
5. **Handoff**: Document work in `handoffs/latest-handoff.md`
6. **Stop**: Never continue to next task automatically

### File System Constraints

- **Allowed Files**: Only modify files listed in task's `allowed_files`
- **Forbidden Files**: Never touch files in task's `forbidden_files`
- **Protected Files**: Never modify `.env*`, `secrets/**`, `credentials/**`, `node_modules/**`, `.git/**`
- **Output Documentation**: Always update handoff documentation

## OpenCode-Specific Considerations

### CLI Integration Benefits

- Scriptable and automatable execution
- Consistent, reproducible outputs
- Easy integration with existing build systems
- Headless operation capability

### OpenCode Limitations in Ralph-Loop

- **No Autonomous Task Selection**: OpenCode executes assigned tasks, never selects them
- **No Multi-Task Execution**: OpenCode stops after completing one task
- **No Push/Deploy Operations**: OpenCode never pushes to remote or deploys
- **Scoped Prompt Dependency**: OpenCode requires well-defined, scoped prompts

### OpenCode Safety Integration

- OpenCode must respect protected file patterns defined in `.governance/SAFETY.md`
- OpenCode must stop immediately on safety policy violations
- OpenCode must never bypass validation requirements
- OpenCode must escalate to human review when required

## OpenCode Command Integration

### Basic OpenCode Execution Pattern

```bash
# OpenCode execution for Ralph-Loop tasks
opencode --task-file runs/current-run.json \
         --governance-dir .governance \
         --output-handoff handoffs/latest-handoff.md \
         --validate-on-completion
```

### OpenCode Configuration Requirements

```json
{
  "opencode": {
    "max_file_changes": 10,
    "require_validation": true,
    "respect_gitignore": true,
    "safe_mode": true,
    "governance_compliance": true
  }
}
```

## OpenCode Prompt Integration

When using OpenCode as a Ralph-Loop worker, provide scoped prompts:

```markdown
You are operating as a Ralph-Loop Worker via OpenCode. Your task assignment is in runs/current-run.json.

CRITICAL: Read these files in order before starting:

1. .governance/SYSTEM.md
2. .governance/RULES.md
3. .governance/SAFETY.md
4. runs/current-run.json
5. tasks/task-state.json

Execute ONLY the assigned task. Stay within allowed scope. Document work in handoffs/latest-handoff.md. Stop after task completion.

SCOPE CONSTRAINTS:

- Allowed files: [from task definition]
- Forbidden files: [from task definition]
- Validation required: [from task definition]
```

## OpenCode Validation Integration

### Validation Execution

- OpenCode must execute validation commands as specified in task definition
- OpenCode must capture and document validation results
- OpenCode must not claim task completion without passing validation
- OpenCode must escalate validation failures to human review

### Validation Commands

OpenCode should execute:

```bash
npm run verify          # Standard validation pipeline
npm run verify:edge     # Edge function validation (conditional)
npm run lint           # Linting (component of verify)
npm run typecheck      # Type checking (component of verify)
```

### Validation Result Capture

```bash
# OpenCode validation execution pattern
opencode --validate \
         --capture-output validation-results.json \
         --fail-on-validation-error \
         --document-results handoffs/latest-handoff.md
```

## OpenCode Error Handling

### Scope Violations

If OpenCode attempts to modify forbidden files:

1. Stop the operation immediately
2. Document the attempted violation
3. Update handoff with violation details
4. Exit with error code
5. Escalate to human review

### Validation Failures

If validation fails:

1. Document specific failure details
2. Attempt to fix within task scope
3. If unfixable, document and escalate
4. Never bypass or ignore validation failures
5. Exit with appropriate error code

### Human Escalation Triggers

OpenCode must escalate to human review when:

- Task requirements are ambiguous
- Validation failures cannot be resolved within scope
- Safety policy violations are detected
- Task requires forbidden file modifications
- Implementation exceeds allowed scope

## OpenCode Integration with Existing Scripts

### Current OpenCode Integration

The repository already has OpenCode integration in:

- `scripts/agent/run-opencode-worker.mjs` - Existing OpenCode worker script
- `scripts/agent/build-worker-prompt.mjs` - Compact worker prompt builder

### Ralph-Loop Integration Strategy

- Preserve existing OpenCode scripts during transition
- Enhance existing scripts to support Ralph-Loop governance
- Migrate to new adapter framework gradually
- Maintain backward compatibility during transition

### Migration Path

1. **Phase 1**: Enhance existing scripts with governance compliance
2. **Phase 2**: Add Ralph-Loop task state integration
3. **Phase 3**: Implement new adapter interface
4. **Phase 4**: Deprecate old scripts in favor of adapter framework

## OpenCode vs Other Adapters

### OpenCode Advantages

- CLI-based, scriptable execution
- Deterministic, reproducible outputs
- Good for automated/headless operation
- Integrates well with CI/CD systems

### OpenCode Limitations

- Requires well-defined prompts
- Less interactive than VS Code extensions
- May need additional tooling for complex tasks

### When to Use OpenCode

- Automated task execution
- CI/CD integration
- Batch processing tasks
- Headless development environments
- Reproducible code generation

### When Not to Use OpenCode

- Interactive development requiring real-time feedback
- Complex debugging scenarios
- Tasks requiring specialized IDE features
- Highly interactive user interfaces

## OpenCode Configuration Files

### OpenCode Project Configuration

```json
{
  "name": "healthapp-ralph-loop",
  "version": "1.0.0",
  "governance": {
    "system_file": ".governance/SYSTEM.md",
    "rules_file": ".governance/RULES.md",
    "safety_file": ".governance/SAFETY.md"
  },
  "validation": {
    "command": "npm run verify",
    "required": true,
    "fail_on_error": true
  },
  "safety": {
    "protected_files": [".env*", "secrets/**", "credentials/**"],
    "forbidden_actions": ["push", "deploy", "install"]
  }
}
```

### OpenCode Task Template

```json
{
  "task_id": "RALPH-XXX",
  "task_type": "implementation",
  "allowed_files": ["src/**/*.ts", "tests/**/*.test.ts"],
  "forbidden_files": [".env*", "package.json"],
  "validation_type": "standard",
  "max_attempts": 3,
  "timeout_minutes": 30
}
```

## Future OpenCode Integration

### Planned Enhancements

- Enhanced governance compliance checking
- Improved validation result capture and reporting
- Better integration with Ralph-Loop coordinator
- Advanced error recovery mechanisms

### OpenCode Adapter Evolution

As Ralph-Loop matures, the OpenCode adapter may evolve to:

- Support more sophisticated task routing
- Provide better error recovery mechanisms
- Integrate with additional validation tools
- Support specialized code generation patterns

## Integration with Existing Infrastructure

### Existing OpenCode Scripts

The repository contains existing OpenCode integration:

- These scripts will be preserved during Ralph-Loop migration
- New adapter framework will enhance, not replace, existing functionality
- Gradual migration path ensures no disruption to current workflows

### Backward Compatibility

- Existing OpenCode workflows continue to function
- New Ralph-Loop features are additive
- Migration to new adapter framework is optional initially
- Full migration occurs only after thorough testing and validation

## Important Notes

### Repository-First Principle

OpenCode is an adapter that implements repository contracts. The repository governance is authoritative, not OpenCode's internal logic or default behaviors. When conflicts arise, repository governance takes precedence.

### Existing Integration Preservation

This documentation describes the target state for OpenCode integration with Ralph-Loop. Existing OpenCode scripts and workflows are preserved and enhanced, not replaced, during the migration process.
