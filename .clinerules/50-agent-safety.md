# Agent Safety Rules

## Terminal Error Containment

- Cline must run one terminal command at a time.
- Cline must use PowerShell-safe commands only.
- Cline must not use `&&` in terminal commands.
- Cline must not use nested `powershell -Command` invocations.
- If a command emits repeated identical PowerShell errors, Cline must stop and report instead of continuing or retrying similar commands.
- Cline must not self-resume after a terminal abort caused by repeated command errors.
- After a terminal abort caused by repeated command errors, Cline must ask for human direction before continuing.

## Tool Selection Priority

- Editor/file tools have priority over terminal commands for repository changes.
- Terminal commands must never be used as a substitute for editor/file tools.
- If a repository file must be created, edited, patched, rewritten, or deleted, Cline must use editor/file tools.
- Terminal usage is primarily for inspection, diagnostics, verification, and running development tooling.

## Prefer the Simplest Available Tool

If a task can be solved directly with an existing tool, Cline must prefer that tool over a more complex alternative.

Examples:

- Modify repository files with editor/file tools instead of terminal commands.
- Edit a single file directly instead of creating patch scripts or shell workarounds.
- Reuse existing APIs, helpers, and project patterns instead of building new infrastructure.
- Implement the smallest working step first, then extend only when needed.

The goal is to avoid unnecessary complexity and reduce blockers caused by tool workarounds or oversized implementations.

## Editor-First File Modification

- Cline must modify repository files only through editor/file tools.
- Source files, tests, Markdown, JSON, YAML, TOML, config files, scripts, and generated project documents must not be created or modified through terminal commands.
- Implementation work should be performed through editor/file tools, not shell-generated writes.
- Do not use terminal output redirection or shell scripting as a substitute for editor/file tools.

### Forbidden Terminal File Mutation Patterns

Cline must not use terminal commands to create, overwrite, append, patch, or rewrite files, including but not limited to:

- `Set-Content`
- `Add-Content`
- `Out-File`
- `>`
- `>>`
- here-strings used for file writes
- heredocs used for file writes
- echo-to-file patterns
- `node -e` / inline Node.js scripts that write files
- `python -c` / inline Python scripts that write files
- `powershell -Command` invocations that write files
- any terminal command whose primary effect is repository file mutation

If a file must be changed, use the available editor/file modification tool instead.

## Terminal Usage Philosophy

Terminal usage is intended for inspection, diagnostics, verification, and development-tool execution.

Allowed terminal usage includes, but is not limited to:

- `git --no-pager status --short`
- `git --no-pager diff`
- `git --no-pager diff --stat`
- `git --no-pager diff --name-only`
- `git --no-pager log`
- `git check-*` read-only checks
- `npm run test` / `npm test`
- `npm run typecheck` / `npm typecheck`
- `npm run lint` / `npm lint`
- `npm run verify` / `npm verify`
- read-only inspection commands
- diagnostics commands
- development runtime commands such as emulator, Expo, adb, or platform tooling when required by the task

Terminal commands must not create, modify, delete, stage, commit, push, install dependencies, run formatters, or run fix commands unless the user explicitly requests that operation and repository governance allows it.

Terminal commands must remain PowerShell-safe:

- run one command at a time
- do not use `&&`
- do not use nested `powershell -Command` invocations

## PowerShell Member Access Safety

- Cline must not generate PowerShell pipelines using `Where-Object` member access unless the pipeline variable is explicitly correct.
- The following broken `Where-Object` member-access patterns are forbidden:
  - `Where-Object { .Name ... }`
  - `Where-Object { .FullName ... }`
  - `Where-Object { .Extension ... }`
- Required valid `Where-Object` member-access patterns include the explicit pipeline variable:
  - `Where-Object { $_.Name ... }`
  - `Where-Object { $_.FullName ... }`
  - `Where-Object { $_.Extension ... }`
- For search and inventory tasks, prefer safer alternatives before constructing complex PowerShell pipelines:
  - `git --no-pager ls-files`
  - `Get-ChildItem -Filter`
  - `Select-String`
  - `rg` if available

## Implementation Phasing

Prefer multiple small Act tasks over one large Act task.

A task should ideally touch only one architectural layer whenever possible, for example:

- Domain
- Infrastructure
- DI
- UI
- Tests
- Review
- Commit

Large implementation tasks should be split into independent phases whenever possible.
Avoid implementing Domain + Persistence + DI + UI + Tests in a single execution unless the user explicitly requests that scope.

## Scope Discipline

Do not expand the implementation beyond the approved task.

If solving the task reveals additional architectural improvements, document them as recommendations instead of implementing them automatically.

Wait for explicit user approval before expanding scope.

## Context Window Protection

If the scope grows materially beyond the original task, Cline must stop expanding the current execution and:

1. summarize the current progress,
2. identify the added scope,
3. report why continuing in the same task risks context loss or workflow deadlock,
4. recommend starting a new focused Act task for the next phase.

## Verification Strategy

Prefer focused verification during implementation.

Run targeted tests for the modified area first.

Run full repository verification only when the implementation scope is complete or when explicitly required by project governance.

Do not repeatedly execute expensive full verification commands after every small change.

## Progress over Perfection

If the same action fails twice in a row, or if Cline appears to be repeating the same confirmation request or recovery attempt without making progress, Cline must:

1. stop retrying the same action,
2. summarize what has been completed,
3. explain the blocker,
4. propose the smallest meaningful next step,
5. ask the user for guidance instead of looping.
