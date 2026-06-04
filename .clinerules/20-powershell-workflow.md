# PowerShell Workflow Rules

## Search and Inventory Command Safety

- Cline must run one terminal command at a time.
- Cline must use PowerShell-safe commands only.
- Cline must not use `&&` in terminal commands.
- Cline must not use nested `powershell -Command` invocations.
- For search and inventory tasks, prefer safer alternatives before constructing complex PowerShell pipelines:
  - `git --no-pager ls-files`
  - `Get-ChildItem -Filter`
  - `Select-String`
  - `rg` if available
- Cline must not generate PowerShell pipelines using `Where-Object` member access unless the pipeline variable is explicitly correct.
- The following broken `Where-Object` member-access patterns are forbidden:
  - `Where-Object { .Name ... }`
  - `Where-Object { .FullName ... }`
  - `Where-Object { .Extension ... }`
- Required valid `Where-Object` member-access patterns include the explicit pipeline variable:
  - `Where-Object { $_.Name ... }`
  - `Where-Object { $_.FullName ... }`
  - `Where-Object { $_.Extension ... }`
