# Cline Adapter Documentation

## Adapter Overview

**Cline** is a VS Code extension that provides AI-powered coding assistance with direct file system access. In the Ralph-Loop system, Cline serves as a **worker adapter** - it executes assigned tasks but is not the source of truth for project governance.

## Cline Role in Ralph-Loop

### Primary Role: Worker Implementation
- Cline executes exactly one assigned task per run
- Cline reads task assignments from `runs/current-run.json`
- Cline implements, modifies, and creates files as specified by the task
- Cline writes handoff documentation to `handoffs/latest-handoff.md`

### Not a Source of Truth
- Repository governance in `.governance/` is authoritative, not Cline's internal logic
- Task definitions in `tasks/task-state.json` override any Cline assumptions
- Safety policies in `.governance/SAFETY.md` supersede Cline's default behaviors
- Validation rules in `validation/validation-rules.json` are binding

## Cline Integration Requirements

### Governance Compliance
Cline MUST follow Ralph-Loop governance:
- Read `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md` before starting work
- Respect task scope defined in `runs/current-run.json`
- Follow safety policies for protected files and forbidden actions
- Execute validation as specified in task definition

### Task Execution Protocol
1. **Read Assignment**: Parse `runs/current-run.json` for task details
2. **Scope Verification**: Confirm allowed/forbidden files and actions
3. **Implementation**: Execute task within defined boundaries
4. **Validation**: Run required validation checks
5. **Handoff**: Document work in `handoffs/latest-handoff.md`
6. **Stop**: Never continue to next task automatically

### File System Constraints
- **Allowed Files**: Only modify files listed in task's `allowed_files`
- **Forbidden Files**: Never touch files in task's `forbidden_files`
- **Protected Files**: Never modify `.env*`, `secrets/**`, `credentials/**`, `node_modules/**`, `.git/**`
- **Output Documentation**: Always update handoff documentation

## Cline-Specific Considerations

### VS Code Integration Benefits
- Direct file system access for efficient file operations
- Integrated terminal for running validation commands
- Real-time diff viewing for change verification
- Extension ecosystem integration

### Cline Limitations in Ralph-Loop
- **No Chat History Reliance**: Cline must not rely on conversation history for task context
- **No Autonomous Task Selection**: Cline executes assigned tasks, never selects them
- **No Multi-Task Execution**: Cline stops after completing one task
- **No Push/Deploy Operations**: Cline never pushes to remote or deploys

### Cline Safety Integration
- Cline must respect protected file patterns defined in `.governance/SAFETY.md`
- Cline must stop immediately on safety policy violations
- Cline must never bypass validation requirements
- Cline must escalate to human review when required

## Cline Configuration Requirements

## Terminal Command Policy for Windows PowerShell

- This workspace uses Windows/PowerShell by default.
- Never use Bash command chaining such as `&&`.
- Prefer one command per terminal execution.
- Avoid long `node -e` one-liners when possible.
- Avoid complex nested quoting.
- If a command produces no visible output, do not keep retrying with more complex quoting.
- Stop and report the output-capture issue.
- For validation, prefer short explicit commands.
- For multi-step validation, ask the user to run commands manually if Cline terminal output is unreliable.
- Keep terminal usage minimal; summarize results in the Cline chat.
- If multiple commands are needed, use PowerShell semicolon `;` or run commands separately.
- For conditional execution, use PowerShell-compatible logic:

```powershell
if ($LASTEXITCODE -eq 0) { <next command> }
```

- Never assume Bash syntax.
- Prefer explicit PowerShell-safe commands.
- Keep commands short to reduce token and terminal failure risk.

Examples:

Correct:

```powershell
git status --short
```

Correct:

```powershell
node --version
```

Correct:

```powershell
node scripts/agent/generate-morning-review.mjs --dry-run
```

Correct:

```powershell
git status --short; node scripts/agent/generate-morning-review.mjs --dry-run
```

Incorrect:

```powershell
git status --short && node scripts/agent/generate-morning-review.mjs --dry-run
```

Incorrect:

```powershell
# very long node -e commands with nested quotes
```

### Required Cline Settings
```json
{
  "cline.autoApprove": false,
  "cline.maxFileChanges": 10,
  "cline.requireConfirmation": true,
  "cline.respectGitignore": true,
  "cline.safeMode": true
}
```

### Cline Workspace Integration
- Cline workspace must be set to repository root
- Cline must have access to all governance files
- Cline must be able to execute npm commands
- Cline must be able to read/write handoff files

## Cline Prompt Integration

When using Cline as a Ralph-Loop worker, provide:

```markdown
You are operating as a Ralph-Loop Worker via Cline. Your task assignment is in runs/current-run.json.

CRITICAL: Read these files in order before starting:
1. .governance/SYSTEM.md
2. .governance/RULES.md  
3. .governance/SAFETY.md
4. runs/current-run.json
5. tasks/task-state.json

Execute ONLY the assigned task. Stay within allowed scope. Document work in handoffs/latest-handoff.md. Stop after task completion.
```

## Cline Validation Integration

### Validation Execution
- Cline must execute validation commands as specified in task definition
- Cline must capture and document validation results
- Cline must not claim task completion without passing validation
- Cline must escalate validation failures to human review

### Validation Commands
Cline should be configured to execute:
```bash
npm run verify          # Standard validation pipeline
npm run verify:edge     # Edge function validation (conditional)
npm run lint           # Linting (component of verify)
npm run typecheck      # Type checking (component of verify)
```

## Cline Error Handling

### Scope Violations
If Cline attempts to modify forbidden files:
1. Stop the operation immediately
2. Document the attempted violation
3. Update handoff with violation details
4. Escalate to human review

### Validation Failures
If validation fails:
1. Document specific failure details
2. Attempt to fix within task scope
3. If unfixable, document and escalate
4. Never bypass or ignore validation failures

### Human Escalation Triggers
Cline must escalate to human review when:
- Task requirements are ambiguous
- Validation failures cannot be resolved within scope
- Safety policy violations are detected
- Task requires forbidden file modifications
- Implementation exceeds allowed scope

## Cline Installation and Setup

### Prerequisites
- VS Code with Cline extension installed
- Node.js and npm available in PATH
- Repository cloned and accessible
- Appropriate file system permissions

### Initial Configuration
1. Install Cline extension in VS Code
2. Configure Cline settings per requirements above
3. Set workspace to repository root
4. Verify access to governance files
5. Test npm command execution

### Verification of Setup
```bash
# Verify Cline can execute validation
npm run verify

# Verify Cline can read governance
cat .governance/SYSTEM.md

# Verify Cline can write handoffs
echo "test" > handoffs/test-handoff.md
```

## Cline vs Other Adapters

### Cline Advantages
- Direct VS Code integration
- Real-time file editing and preview
- Integrated terminal access
- Extension ecosystem benefits

### Cline Limitations
- Requires VS Code environment
- May have extension-specific behaviors
- Limited to VS Code workspace context

### When to Use Cline
- Interactive development tasks
- Complex file editing requirements
- Tasks requiring real-time feedback
- Development environment integration needs

### When Not to Use Cline
- Automated/headless execution
- Simple documentation tasks
- Tasks requiring specialized tools not available in VS Code
- Batch processing operations

## Future Cline Integration

### Planned Enhancements
- Automated task assignment from Ralph-Loop coordinator
- Enhanced safety monitoring and violation detection
- Improved validation result capture and reporting
- Better integration with morning review system

### Cline Adapter Evolution
As Ralph-Loop matures, the Cline adapter may evolve to:
- Support more sophisticated task routing
- Provide better error recovery mechanisms
- Integrate with additional validation tools
- Support parallel task execution (with safety constraints)

## Important Notes

### Cline is NOT Installed/Configured by This Task
This documentation describes how Cline should integrate with Ralph-Loop when it is installed and configured. The actual installation and configuration of Cline is handled by separate tasks (RALPH-009A and beyond).

### Additional Documentation
For detailed setup and dry-run procedures, see:
- `docs/CLINE_RALPH_WORKER_SETUP.md` - Comprehensive setup guide
- `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` - First dry-run checklist
- `plans/RALPH_CLINE_DRY_RUN_PLAN.md` - Detailed dry-run plan for RALPH-010A

### Repository-First Principle
Cline is an adapter that implements repository contracts. The repository governance is authoritative, not Cline's internal logic or default behaviors. When conflicts arise, repository governance takes precedence.