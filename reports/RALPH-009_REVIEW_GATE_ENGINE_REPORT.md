# RALPH-009 Review Gate Engine Report

**Task ID:** RALPH-009  
**Generated:** 2026-05-23T10:49:00Z  
**Status:** Implementation complete  
**Category:** Governance / Tooling

---

## Files Changed

### Created

- `scripts/agent/review-gate-engine.mjs` — Ralph V2 canonical handoff review gate evaluator.
- `reports/RALPH-009_REVIEW_GATE_ENGINE_REPORT.md` — This implementation report.

### Modified

- `handoffs/latest-handoff.md` — Updated latest task handoff for RALPH-009.

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

## Review Decision Schema

The review gate engine emits a canonical decision object:

```json
{
  "schema_version": "2.0.0",
  "review_id": "review_...",
  "timestamp": "...",
  "task_id": "...",
  "review_result": "accepted",
  "decision_reason": "...",
  "blocking_findings": [],
  "warnings": [],
  "human_review_required": true,
  "source": {
    "engine": "ralph-v2-review-gate-engine",
    "handoff_id": "...",
    "handoff_schema_version": "2.0.0"
  }
}
```

Supported normalized review results:

- `accepted`
- `needs_changes`
- `rejected`

---

## Acceptance Rules

The engine returns `accepted` only when all of the following are true:

- The handoff schema is valid and supported.
- No critical findings exist.
- No warnings exist.
- Validation status is `passed` or otherwise pass-like.
- Review evidence is present, pending, missing-but-pending, not required, or unknown without blocking concerns.
- Task status is `done` or a done-equivalent alias.

---

## Needs Changes Rules

The engine returns `needs_changes` when no critical findings exist but review attention is still required, including:

- Warnings exist in the handoff.
- Optional validation evidence metadata is missing.
- Optional review evidence metadata is missing or pending.
- Task metadata is incomplete, such as missing title or run ID.
- Task status is not yet `done`.
- Validation status is not failed but also not clearly passed.
- Review evidence reports non-blocking concerns such as `needs_changes`.

---

## Rejection Rules

The engine returns `rejected` when any critical finding exists, including:

- Malformed JSON input.
- Unsupported handoff schema version.
- Missing required schema fields.
- Missing task ID.
- Invalid required field types.
- Validation status is failed, blocked, or error-like.
- Handoff contains critical issues.
- Review evidence reports `rejected`.

---

## Dry Run Examples

Print a decision and write nothing:

```bash
node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --dry-run --json
```

Write a decision object:

```bash
node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --output .agent/out/review-decision.json --json
```

Show CLI help:

```bash
node scripts/agent/review-gate-engine.mjs --help
```

---

## Validation Performed

Commands executed separately, without command chaining:

```bash
node --check scripts/agent/review-gate-engine.mjs
```

Result: passed.

```bash
node scripts/agent/review-gate-engine.mjs --help
```

Result: passed; help output lists supported flags, supported decisions, decision rules, and safety behavior.

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-009 --status done --json --output .agent/out/handoff.json
```

Result: passed; generated `.agent/out/handoff.json` as a sample canonical handoff for review-gate evaluation.

```bash
node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --dry-run --json
```

Result: passed; emitted a normalized decision object with `review_result: "needs_changes"` and wrote nothing. The generated sample handoff lacks runtime task metadata and validation/review evidence for `RALPH-009`, so the warning-based `needs_changes` result is expected.

```bash
git --no-pager status --short
```

Result: passed; output showed:

```text
M handoffs/latest-handoff.md
?? reports/RALPH-009_REVIEW_GATE_ENGINE_REPORT.md
?? scripts/agent/review-gate-engine.mjs
```

```bash
git --no-pager diff --stat
```

Result: passed; output showed:

```text
handoffs/latest-handoff.md | 65 +++++++++++++++++++++++++++++++---------------
1 file changed, 44 insertions(+), 21 deletions(-)
```

New untracked files are visible in status until staged by a human.

```bash
git --no-pager diff --name-only
```

Result: passed; output showed:

```text
handoffs/latest-handoff.md
```

New untracked files are visible in status until staged by a human.

---

## Limitations

- The engine evaluates the supplied canonical handoff only; it does not read runtime state directly.
- It does not append review evidence to `review/review-results.jsonl`.
- It does not update task state, run state, validation evidence, or ROADMAP.
- Current validation uses in-script structural checks rather than an external JSON Schema file.
- Missing optional evidence is intentionally treated as `needs_changes`, not `rejected`, unless a required schema field is malformed or absent.

---

## Future Integration

- Make future review coordinators call `review-gate-engine.mjs` as the single authoritative review-decision path.
- Feed accepted decision objects into `ralph-write-review-evidence.mjs` only after human review policy allows evidence recording.
- Add an external JSON Schema artifact if future validators require schema sharing across tools.
- Integrate decision output into morning-review aggregation after the review gate workflow is stabilized.

---

## Recommended Next Task

**Task ID:** RALPH-010 (proposed)  
**Title:** Integrate Review Gate Engine with Review Evidence Recording  
**Category:** Governance / Tooling

Objective: Connect review gate decision output to the review evidence writer through an explicitly approved workflow that preserves human review gates and append safety.
