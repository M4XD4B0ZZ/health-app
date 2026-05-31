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

## Terminal Safety Policy for Windows PowerShell

- This workspace uses Windows/PowerShell by default.
- Use short, isolated, PowerShell-safe commands.
- Prefer one command per tool execution.
- Never use chained or compound command separators/operators.
- No long compound commands unless explicitly approved by the human reviewer.
- Avoid long `node -e` one-liners and complex nested quoting.
- If a command produces no visible output, do not retry with increasingly complex syntax.
- Stop and report output-capture or terminal-completion issues.
- Keep terminal usage minimal and deterministic.
- If multiple checks are needed, execute each check as a separate tool execution.

- Never assume Bash syntax.
- Prefer explicit PowerShell-safe commands.
- Keep commands short to reduce token and terminal failure risk.

### Command Isolation Enforcement (CLINE-OPS-004)

- **Exactly one terminal command per tool execution.**
- This applies even when individual commands are safe.
- Final checks must be executed as separate commands, never combined.

Forbidden in Cline terminal commands:

- `&&`
- `||`
- `;`
- `|`
- backticks for command substitution
- multi-line command blocks
- chained `git`/`npm`/`node` commands

Required final-check format:

Run these as three separate executions:

```powershell
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

Never use combined variants such as:

```powershell
git --no-pager status --short && git --no-pager diff --stat && git --no-pager diff --name-only
```

Recovery rule for accidental chained command attempts:

1. stop,
2. document parser/chaining violation,
3. rerun only the intended commands one-by-one,
4. do not simplify with alternative separators,
5. do not escalate shell syntax.

Incident rationale (CLINE-REAL-011):

- Cline attempted chained git final checks with `&&`.
- PowerShell parser failed.
- Recovery succeeded by rerunning checks separately.
- This rule is strengthened to prevent recurrence.

### PowerShell Heredoc and Interactive Session Prohibition (CLINE-OPS-005)

This repository uses Windows PowerShell as the default Cline terminal. Cline must never use Bash-style heredocs, interactive interpreter sessions, or command patterns that require manual stdin during agent tasks.

Forbidden heredoc patterns in PowerShell include, but are not limited to:

- `python - <<'PY'`
- `python - <<PY`
- `cat <<EOF`
- `node <<EOF`
- any `<<EOF`-style heredoc with any command or delimiter

Forbidden interactive sessions during agent tasks include:

- `python` without a script/file argument
- Node.js REPL sessions, including `node` without a script/file argument
- interactive PowerShell prompts or continuation prompts
- commands that require manual stdin or wait for typed input

Required multi-line edit/script execution patterns:

- Prefer normal file editing tools for repository file edits.
- For temporary PowerShell automation, create a temporary `.ps1` file and run it directly.
- For temporary Python automation, create a temporary `.py` file and run it with `python .\file.py`.
- Use direct single-line PowerShell commands only when the command is simple, deterministic, and non-interactive.
- Do not use inline Bash syntax as a substitute for file-based execution.

Recovery rule for interactive or hanging terminal states:

1. If the terminal shows a Python `>>>` prompt, PowerShell continuation prompt, or a hanging command waiting for stdin, stop immediately.
2. Report the terminal state and the command that caused it.
3. Ask for human intervention instead of attempting additional shell syntax or continuing execution.
4. Do not press forward with `Proceed While Running` as a normal recovery path.

Command style examples:

Bad:

```powershell
python - <<'PY'
powershell -Command "..."
git --no-pager status --short && git --no-pager diff --stat
```

Good:

```powershell
python .\tmp_edit.py
.\scripts\verify.ps1
git --no-pager status --short
```

Good command style guidance:

- Run separate PowerShell commands one at a time.
- Use a PowerShell semicolon only for simple, non-interactive command separation when explicitly safe for the task; Cline final verification checks must still be separate executions.
- Prefer repository file editing tools over terminal-generated multi-line edits.

Incident rationale (RALPH-025B):

- During RALPH-025A, Cline attempted `python - <<'PY'` in a Windows PowerShell terminal.
- PowerShell did not interpret the heredoc as Bash would; execution dropped into an interactive Python REPL and blocked.
- These rules prevent recurrence by forbidding heredocs and interactive sessions and requiring file-based script execution for multi-line work.

### Inline Interpreter Command Safety (CLINE-OPS-006)

Cline must not use long inline interpreter commands for repository file edits, file writing, or multiline content. This is especially important in Windows PowerShell, where nested quotes, continuation prompts, and embedded document payloads can fail or hang unpredictably.

Forbidden inline command patterns include, but are not limited to:

- `python -c "...large script..."` when the command writes files or embeds document content
- `node -e "...large script..."` when the command writes files or embeds document content
- `powershell -Command "...large script..."` when the command writes files or embeds document content
- any shell command that embeds multiline markdown, reports, JSON/JSONL payloads, or other document bodies in command arguments

Inline shell commands must never be used to write:

- handoffs
- reports
- JSON state
- JSONL history
- markdown documents

Only very short read-only one-liners are allowed, and only when all of these conditions are true:

- the command performs a read-only check or assertion,
- the command does not write files,
- the command does not contain multiline strings,
- the command does not embed markdown, reports, JSON state payloads, or document bodies,
- the command is simple enough to be reviewed as a single isolated operation.

Allowed short read-only examples include JSON parse checks and console output assertions such as:

```powershell
node -e "JSON.parse(require('fs').readFileSync('tasks/task-state.json','utf8')); console.log('JSON OK')"
```

Required multiline edit patterns:

- Use normal file editing tools for repository file edits whenever possible.
- For bounded temporary script work, create a temporary script file, run it directly, and delete the temporary script after use, for example `python .\tmp_edit.py`.
- Use direct editor/tool-based file modification for markdown, handoffs, reports, JSON state, and JSONL history.

Bad examples:

```powershell
python -c "from pathlib import Path; Path('handoffs/latest-handoff.md').write_text('''...''')"
node -e "fs.writeFileSync('file.md', `...large markdown...`)"
powershell -Command "...large script..."
```

Good examples:

```powershell
# Use normal edit tools for documentation and handoff changes.
python .\tmp_edit.py
node -e "JSON.parse(require('fs').readFileSync('tasks/task-state.json','utf8')); console.log('JSON OK')"
```

Recovery rule for failed or hanging long inline commands:

1. Stop immediately.
2. Do not retry with more escaping, quote changes, larger inline strings, or alternative shell wrapping.
3. Inspect repository state with `git --no-pager status --short` and a targeted diff/readback check.
4. Repair only with normal file editing tools or bounded temporary script files.
5. Ask for human review if partial file corruption is possible.

Incident rationale (RALPH-032):

- During RALPH-032, Cline attempted to write a long markdown handoff with `python -c "...write_text('''...huge multiline content...''')"`.
- The command produced a Python `SyntaxError` and left the workflow hanging.
- These rules prevent recurrence by forbidding long inline interpreter write commands and requiring file-editing tools or bounded temporary scripts for multiline work.

### Git Pager Reliability Rule

- If output from a Git read command is visible but Cline remains in `Running`, check for a Git pager session.
- Typical symptom: terminal accepts `q`, and pressing `q` completes the command.
- Prefer `git --no-pager ...` for read-only Git inspection commands.
- Avoid pager-prone read commands without `--no-pager`, especially:
  - `git show`
  - `git log`
  - `git diff`
- Preferred safe forms:

```powershell
git --no-pager log -1 --oneline
git --no-pager show --name-only --pretty=format:"%H%n%s" HEAD
git --no-pager diff --stat
git --no-pager diff --name-only
```

### Pager Recovery Rule

- If output is visible but Cline remains `Running`, assume Git pager or terminal-completion artifact first.
- If terminal input is accepted, press `q` once.
- Do not click **Proceed While Running** repeatedly.
- Do not escalate into complex shell syntax just to recover output.
- Document the incident in `handoffs/latest-handoff.md`.

### Blocking Command Registry (approval required)

Cline must not run the following unless explicitly approved for the current task:

- `npm run dev`
- `npx expo start`
- `expo start`
- `tail -f`
- `watch`
- long-running local servers
- interactive prompts
- any command that waits for user input

### Timeout / Stop Rules

- If a command appears complete but Cline still shows `Running`, stop and inspect before retrying.
- If a command is still running with no new output after a short reasonable wait, stop and document.
- Never treat **Proceed While Running** as normal workflow.
- Terminal-dependent execution is not unattended-safe until these cases are resolved.

### Documentation-Only Verification Guidance

For documentation/governance-only Cline tasks:

- Prefer git readback checks over full runtime verification.
- Use `git status --short` and `git --no-pager diff --stat` for final validation.
- Avoid `npm run verify` unless product/runtime code actually changed.

### Dependency Command Safety (CLINE-OPS-003)

- `npm install` is allowed **only** when explicitly required to restore missing local dependencies.
- `npm audit` is read-only and allowed for inspection only.
- `npm audit fix` requires explicit human approval for the current task.
- `npm audit fix --force` is forbidden during scoped tasks unless a dedicated dependency-migration task is explicitly approved.
- Any `package.json` / `package-lock.json` change is out of scope unless the task explicitly allows dependency changes.

#### Incident Rationale

- The CLINE-REAL-007 incident showed that `npm audit fix --force` can trigger SemVer-major upgrades and large lockfile rewrites.
- These dependency migrations must not be mixed into feature/test/governance scoped tasks.

#### Drift Recovery Rule

If dependency file drift happens accidentally:

1. stop immediately,
2. restore `package.json`,
3. restore `package-lock.json`,
4. rerun `npm install`,
5. rerun the narrow relevant test,
6. document the incident in `handoffs/latest-handoff.md`.

### Unattended Execution Constraint

- Cline is currently allowed only as a scoped worker.
- Cline is not yet trusted for unattended overnight execution.
- Ralph/Governor remains responsible for scope control, stop conditions, and human-review gates.

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

Incorrect:

```powershell
git status --short && node scripts/agent/generate-morning-review.mjs --dry-run
```

Incorrect:

```powershell
git status --short; node scripts/agent/generate-morning-review.mjs --dry-run
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