# Task Summary

- Handoff ID: `handoff_ralph-011_20260523T114000Z`
- Generated: 2026-05-23T11:40:00Z
- Task ID: RALPH-011
- Status: done
- Category: Governance / Tooling
- Agent: Cline
- Objective: Extract shared review-gate evaluation logic into a reusable module used by both `scripts/agent/review-gate-engine.mjs` and `scripts/agent/run-review-gate-workflow.mjs` without changing review decision behavior.

The task created `scripts/agent/lib/review-gate-core.mjs` and refactored both review-gate CLIs to use the shared module for canonical handoff JSON loading, handoff schema validation, review decision evaluation, normalized decision construction, and decision-object validation.

No product code, ROADMAP, runtime state, validation evidence, review evidence, `tasks/`, `runs/`, `validation/`, `review/`, `src/`, `supabase/`, `package.json`, or `package-lock.json` files were modified.

# Validation Summary

- Status: passed
- Validation ID: None; this task does not append validation evidence.
- Summary: Required syntax checks, help output checks, sample handoff generation, engine dry-run, workflow dry-run, and git readback checks passed. No real review append was performed.

Commands executed separately:

```bash
node --check scripts/agent/lib/review-gate-core.mjs
```

Result: passed.

```bash
node --check scripts/agent/review-gate-engine.mjs
```

Result: passed.

```bash
node --check scripts/agent/run-review-gate-workflow.mjs
```

Result: passed.

```bash
node scripts/agent/review-gate-engine.mjs --help
```

Result: passed; help output listed supported CLI flags, supported decisions, decision rules, and safety behavior.

```bash
node scripts/agent/run-review-gate-workflow.mjs --help
```

Result: passed; help output listed supported CLI flags, dry-run/default behavior, and append safety gates.

```bash
node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-009 --status done --json --output .agent/out/handoff.json
```

Result: passed; generated `.agent/out/handoff.json` sample canonical handoff.

```bash
node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --dry-run --json
```

Result: passed; emitted normalized decision JSON with `review_result: "needs_changes"`, warning findings, and no file write.

```bash
node scripts/agent/run-review-gate-workflow.mjs --handoff .agent/out/handoff.json --output-dir .agent/out --dry-run --json
```

Result: passed; wrote `.agent/out/review-decision.json`, emitted JSON summary with `review_result: "needs_changes"`, did not create prepared review evidence, and did not append to `review/review-results.jsonl`.

```bash
git --no-pager status --short
```

Result: passed; output showed:

```text
M handoffs/latest-handoff.md
M scripts/agent/review-gate-engine.mjs
 M scripts/agent/run-review-gate-workflow.mjs
?? reports/RALPH-011_SHARED_REVIEW_GATE_CORE_REPORT.md
?? scripts/agent/lib/
```

```bash
git --no-pager diff --stat
```

Result: passed; output showed tracked-file changes for the handoff and both refactored CLIs. New untracked report and shared core module are visible in `git status` until staged by a human.

```bash
git --no-pager diff --name-only
```

Result: passed; output showed:

```text
handoffs/latest-handoff.md
scripts/agent/review-gate-engine.mjs
scripts/agent/run-review-gate-workflow.mjs
```

New untracked files are visible in status until staged by a human.

# Review Summary

- Status: human_review_required
- Review ID: None
- Summary: Human review remains required. The shared core preserves the existing review-gate decision behavior. The workflow approval gate remains unchanged and no real review evidence append was performed.

# Files Changed

- `scripts/agent/lib/review-gate-core.mjs` — Added shared review-gate core module.
- `scripts/agent/review-gate-engine.mjs` — Refactored to use shared core review-gate functions.
- `scripts/agent/run-review-gate-workflow.mjs` — Refactored to use shared core review-gate functions.
- `reports/RALPH-011_SHARED_REVIEW_GATE_CORE_REPORT.md` — Added implementation report.
- `handoffs/latest-handoff.md` — Updated this latest handoff.
- `.agent/out/handoff.json` — Sample canonical handoff generated during required verification.
- `.agent/out/review-decision.json` — Review decision output generated during required workflow dry-run.

# Artifacts

- `scripts/agent/lib/review-gate-core.mjs`
- `scripts/agent/review-gate-engine.mjs`
- `scripts/agent/run-review-gate-workflow.mjs`
- `reports/RALPH-011_SHARED_REVIEW_GATE_CORE_REPORT.md`
- `handoffs/latest-handoff.md`
- `.agent/out/handoff.json`
- `.agent/out/review-decision.json`

# Issues

## Critical

- None.

## Warnings

- The shared core preserves existing structural validation logic but does not introduce a separate JSON Schema artifact.
- The default workflow dry-run/no-append path still writes adapter outputs under `.agent/out`, preserving RALPH-010 behavior.
- The required sample handoff for `RALPH-009` may evaluate to `needs_changes` if runtime task metadata, validation evidence, or review evidence is missing; this is expected and blocks prepared append execution.

# Recommended Next Task

RALPH-012 (proposed): Add focused review-gate core fixture tests for accepted, needs_changes, rejected, and malformed handoff scenarios.

# Human Review Status

- Human review required: true
- Review gate status: Required before autonomous continuation.
- Commits: None.
- Push: None.
