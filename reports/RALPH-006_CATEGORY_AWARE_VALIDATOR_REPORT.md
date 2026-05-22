# RALPH-006 Category-Aware Validator Report

## Files Changed

- `scripts/agent/ralph-validate-category.mjs`
- `reports/RALPH-006_CATEGORY_AWARE_VALIDATOR_REPORT.md`
- `handoffs/latest-handoff.md`

No product code, Supabase code, dependency files, ROADMAP, task state, run state, validation rules, validation results, commits, or pushes are part of this task.

## Categories Implemented

The validator supports the requested Ralph V2 / VERIFY.md categories:

- `documentation-only`
- `governance-only`
- `test-only`
- `product-runtime-code`
- `edge-supabase`
- `dependency-change`
- `runtime-state-only`
- `governance-script-only`

Category can be supplied explicitly with `--category`. If omitted, the script inspects changed files from `git --no-pager status --short` and chooses the strictest detected category using conservative precedence.

## VERIFY.md Mapping Summary

| Category | Required checks produced |
| --- | --- |
| `documentation-only` | `git --no-pager status --short`; `git --no-pager diff --stat`; `git --no-pager diff --name-only` |
| `governance-only` | `git --no-pager status --short`; `git --no-pager diff --stat`; `git --no-pager diff --name-only` |
| `test-only` | task-specific `--test-command` values if provided; readback git checks |
| `product-runtime-code` | `npm run verify` |
| `edge-supabase` | `npm run verify:supabase:link`; `npm run verify:schema`; `npm run verify:edge`; plus `npm run verify` when runtime code is also detected |
| `dependency-change` | `npm run verify`; task-specific regression tests from `--test-command` if provided |
| `runtime-state-only` | `node scripts/agent/validate-ralph-state.mjs`; readback git checks |
| `governance-script-only` | `node --check <changed-script>` for scripts supplied by `--script` or detected under `scripts/agent/*.mjs`; task-specific dry-run commands from `--dry-run-command` if provided; readback git checks |

Optional checks from `VERIFY.md` are included in `optional_checks` but are not executed or treated as blocking unless explicitly included as required inputs in a future task.

## Dry-Run Examples

```bash
node scripts/agent/ralph-validate-category.mjs --category documentation-only --dry-run
node scripts/agent/ralph-validate-category.mjs --category governance-script-only --script scripts/agent/ralph-state-transitions.mjs --dry-run
node scripts/agent/ralph-validate-category.mjs --json --category documentation-only --dry-run
```

Dry-run is the default even without `--dry-run`.

## Execute Behavior

Execute mode exists behind explicit `--execute` only.

Safety behavior:

- Commands are executed one at a time.
- Commands are executed with `spawnSync(..., { shell: false })`.
- Command chaining tokens are rejected before execution: `&&`, `;`, `||`, `|`.
- The validator never writes runtime state.
- The validator never appends `validation/validation-results.jsonl`.
- The structured result always reports `writes_performed: false`.

## Validation Performed

Required task verification commands were run separately, with no command chaining. Results are documented in `handoffs/latest-handoff.md`.

## Non-Goals

- No product code changes.
- No ROADMAP edits.
- No runtime state mutations.
- No validation rule edits.
- No writes to `validation/validation-results.jsonl`.
- No automatic repairs.
- No dependency changes.
- No commits or pushes.

## Known Limitations

- Changed-file category detection is intentionally conservative and path-pattern based.
- Task-specific test and dry-run commands are optional CLI inputs; the validator does not infer every possible task-specific regression command.
- Execute mode captures excerpts of stdout/stderr but does not persist evidence to JSONL yet.
- The validator references `validation/validation-rules.json` in output metadata but does not enforce every structured rule from that catalog; this task focuses on VERIFY.md category decision logic.

## Next Recommended Task

Implement an append-only validation evidence writer in a follow-up task, gated by human approval, that records category validation results to `validation/validation-results.jsonl` using the RALPH-002 validation event schema.