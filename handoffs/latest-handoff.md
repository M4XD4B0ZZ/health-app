# CLINE-OPS Handoff: PowerShell Search Command Safety

## Run / Task Identity and Status

**Task ID:** CLINE-OPS
**Title:** Harden PowerShell search command safety
**Status:** implemented and verified, pending human review
**Mode:** ACT MODE

## What Changed

Added strict Cline terminal safety rules for PowerShell search and inventory commands to prevent invalid `Where-Object` member access, repeated terminal error spam, and unsafe command composition.

## Changed Files

1. `.clinerules/20-powershell-workflow.md`
   - Added PowerShell workflow rules for safe search/inventory commands.
   - Forbids broken `Where-Object` member access without the explicit pipeline variable.
   - Requires valid `Where-Object` member access using `$_`.
   - Prefers safer search/inventory alternatives.
   - Requires one command at a time and forbids `&&` and nested `powershell -Command`.

2. `.clinerules/50-agent-safety.md`
   - Added terminal error containment rules.
   - Requires Cline to stop and report repeated identical PowerShell errors.
   - Forbids self-resume after a terminal abort caused by repeated command errors.
   - Requires human direction before continuing after such an abort.
   - Reiterates PowerShell member access safety and safer search/inventory alternatives.

3. `handoffs/latest-handoff.md`
   - Updated this handoff for CLINE-OPS.

## Exact Rules Added

- Cline must run one terminal command at a time.
- Cline must use PowerShell-safe commands only.
- Cline must not use `&&` in terminal commands.
- Cline must not use nested `powershell -Command` invocations.
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
- If a command emits repeated identical PowerShell errors, Cline must stop and report instead of continuing or retrying similar commands.
- Cline must not self-resume after a terminal abort caused by repeated command errors.
- After a terminal abort caused by repeated command errors, Cline must ask for human direction before continuing.

## Safety Boundaries

- Modified only allowed files.
- No product/runtime code changed.
- No dependency files changed.
- No staging performed.
- No commit performed.
- No push performed.

## Validation Executed

Required documentation/governance readback checks were run one at a time:

- `git --no-pager status --short` — pass; showed `M handoffs/latest-handoff.md` and `?? .clinerules/`.
- `git --no-pager diff --stat` — pass; showed tracked handoff diff only because `.clinerules/` is untracked.
- `git --no-pager diff --name-only` — pass; showed `handoffs/latest-handoff.md` only because `.clinerules/` is untracked.

## Validation Result

Passed for the required docs/governance readback checks. Final git status remains unstaged with one tracked modified handoff and the untracked `.clinerules/` directory containing the two new allowed rule files.

## Human Review Status

Human review required before relying on these rules operationally.
