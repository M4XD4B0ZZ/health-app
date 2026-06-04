# Agent Safety Rules

## Terminal Error Containment

- Cline must run one terminal command at a time.
- Cline must use PowerShell-safe commands only.
- Cline must not use `&&` in terminal commands.
- Cline must not use nested `powershell -Command` invocations.
- If a command emits repeated identical PowerShell errors, Cline must stop and report instead of continuing or retrying similar commands.
- Cline must not self-resume after a terminal abort caused by repeated command errors.
- After a terminal abort caused by repeated command errors, Cline must ask for human direction before continuing.

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
