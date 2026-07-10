# RALPH-008 Canonical Handoff Generator Report

**Task ID:** RALPH-008  
**Generated:** 2026-05-23T10:36:22Z  
**Status:** Implementation complete  
**Category:** Governance / Tooling

---

## Summary

Implemented `scripts/agent/generate-canonical-handoff.mjs`, a deterministic Ralph V2 handoff generator that creates both machine-readable JSON and human-readable Markdown from runtime state, validation evidence, review evidence, current task metadata, and CLI arguments.

The generator is intended to become the single authoritative creation path for structured task-completion handoffs. It does not modify product code, runtime state, validation evidence, review evidence, ROADMAP, tasks, runs, validation, review, `src/`, or `supabase/`.

---

## Files Changed

### Created

- `scripts/agent/generate-canonical-handoff.mjs` — Canonical handoff generator CLI.
- `reports/RALPH-008_CANONICAL_HANDOFF_GENERATOR_REPORT.md` — This implementation report.

### Modified

- `handoffs/latest-handoff.md` — Updated RALPH-008 handoff documentation.

### Not Modified

- `ROADMAP.md`
- `tasks/`
- `runs/`
- `validation/`
- `review/`
- `src/`
- `supabase/`
- `package.json`
- `package-lock.json`

---

## Schema Implemented

The generator validates the canonical JSON structure before printing or writing output.

Minimum implemented schema:

```json
{
  "schema_version": "2.0.0",
  "handoff_id": "...",
  "timestamp": "...",
  "generator": {
    "id": "ralph-v2-canonical-handoff-generator",
    "dry_run": true
  },
  "task": {
    "task_id": "...",
    "status": "..."
  },
  "validation": {
    "status": "...",
    "validation_id": "...",
    "summary": "..."
  },
  "review": {
    "status": "...",
    "review_id": "...",
    "summary": "..."
  },
  "changes": {
    "files_changed": [],
    "artifacts_created": []
  },
  "issues": {
    "critical": [],
    "warnings": []
  },
  "recommended_next_task": "...",
  "human_review_required": true
}
```

Additional deterministic metadata may be included when available:

- `task.title`
- `task.run_id`
- `generator.id`
- `generator.dry_run`

---

## Markdown Structure

Markdown output always uses this section order:

1. `# Task Summary`
2. `# Validation Summary`
3. `# Review Summary`
4. `# Files Changed`
5. `# Artifacts`
6. `# Issues`
7. `# Recommended Next Task`
8. `# Human Review Status`

Empty arrays render as `- None` to preserve deterministic readability.

---

## CLI Interface

Supported flags:

- `--task-id <id>` — Required task identifier.
- `--status <status>` — Required status.
- `--output <path>` — Optional write target, intended for `.agent/out/`.
- `--json` — Generate canonical JSON.
- `--markdown` — Generate canonical Markdown.
- `--dry-run` — Print output and write nothing.
- `--help` — Show usage information.

Valid task statuses:

- `not_started`
- `in_progress`
- `needs_validation`
- `needs_review`
- `blocked`
- `failed`
- `done`
- `skipped`
- `cancelled`
- `complete` / `completed` normalized to `done`

---

## Data Sources

The generator reads:

- `validation/validation-results.jsonl`
- `review/review-results.jsonl`
- `tasks/task-state.json`
- `runs/current-run.json`
- supplied CLI arguments

Read behavior is tolerant of missing task-specific evidence but strict about malformed JSON/JSONL and malformed evidence reference fields.

---

## Dry-Run Examples

JSON dry-run:

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id TEST --status done --dry-run --json
```

Markdown dry-run:

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id TEST --status done --dry-run --markdown
```

Write JSON to `.agent/out/`:

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-008 --status done --json --output .agent/out/handoff.json
```

Write Markdown to `.agent/out/`:

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-008 --status done --markdown --output .agent/out/handoff.md
```

---

## Validation Performed

Commands executed separately, without command chaining:

```bash
node --check scripts/agent/generate-canonical-handoff.mjs
```

Result: passed.

```bash
node scripts/agent/generate-canonical-handoff.mjs --help
```

Result: passed; help output lists supported flags, data sources, and safety behavior.

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id TEST --status done --dry-run --json
```

Result: passed; emitted valid schema-versioned JSON and wrote nothing.

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id TEST --status done --dry-run --markdown
```

Result: passed; emitted deterministic Markdown with required section order and wrote nothing.

Final git readback commands were executed separately and are documented in `handoffs/latest-handoff.md`.

---

## Validation Rules Implemented

The generator rejects:

- Missing `--task-id`
- Missing `--status`
- Invalid task status
- Selecting both `--json` and `--markdown`
- Selecting neither `--json` nor `--markdown`
- Malformed JSON in JSON source files
- Malformed JSONL lines in evidence source files
- Non-string evidence reference IDs for `validation_id`, `review_id`, `task_id`, or `run_id`
- Generated payloads missing canonical schema fields

---

## Limitations

- The generator reads current repository evidence only; it does not execute validation or review commands.
- It does not append evidence and does not update runtime state.
- For task IDs not present in `tasks/task-state.json`, it can still generate a handoff from CLI metadata, but records warnings.
- For task IDs without validation/review evidence, it records warnings rather than failing so dry-run and pre-evidence workflows remain usable.
- It does not currently infer changed files from Git diff; it relies on validation evidence fields where available.

---

## Future Integration Points

- Integrate generator invocation into future coordinator task-completion flow.
- Use `--output .agent/out/handoff.json` for machine review gates.
- Use `--output .agent/out/handoff.md` or `handoffs/latest-handoff.md` for human review packets.
- Add optional Git diff collection if future governance authorizes read-only Git metadata as a handoff data source.
- Add JSON Schema file if future validation tooling needs external schema validation.
- Integrate canonical handoff output with future milestone automation and morning-review aggregation.

---

## Recommended Next Task

**Task ID:** RALPH-009 (proposed)  
**Title:** Integrate Canonical Handoff Generator with Review Gate Inputs  
**Category:** Governance / Tooling  
**Priority:** Medium

Objective: Wire canonical handoff JSON into the future review gate processing path so automated and human review consumers share the same structured handoff source.

---

## Conclusion

RALPH-008 delivered the canonical handoff generator as scoped governance tooling. The implementation is deterministic, uses Node.js built-ins only, supports JSON and Markdown output, validates schema before output, supports dry-run, and avoids product/runtime repairs or prohibited file modifications.

**Report Status:** Complete  
**Product Code Changed:** No  
**Runtime State Changed:** No  
**ROADMAP Edited:** No  
**Commits:** None  
**Push:** None
