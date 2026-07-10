# reports/ — Index

This directory is an append-only evidence/audit trail, not a scratch space. Per `AGENTS.md` /
`ROADMAP.md` governance ("Completed tasks are marked `done`, never deleted"), files here are
**never deleted or moved** once written — this README exists purely to make the existing 75
files navigable, without touching any of them.

## Categories

- **`RALPH-001` … `RALPH-047B`** (48 files): Ralph-Loop/Overnight-Worker governance build-out —
  planning, sandbox probes, controlled-mutation smoke tests, task-admission/queue-admission
  classifiers, review-evidence bundling, etc. Each `RALPH-NNN[letter]` is one governance
  capability step; letters (`A`/`B`/`C`…) split a single capability into
  planning → implementation → smoke-evaluation sub-steps.
- **`CLINE-GOV-001` … `CLINE-GOV-009`** (9 files): governance-document consolidation audits
  (authority hierarchy, verification canonicalization, handoff/review normalization).
- **`CLINE-REAL-002` … `CLINE-REAL-012`** (11 files): read-only diagnostic/regression-test
  reports produced while validating real product behavior (resolver failure paths, portion
  defaults, persistence integrity).
- **`CLINE-READ-001`**: a single read-only investigation report (egg default portion source).
- **`P1-003_*`, `P2-011_*`**: product-task discovery/implementation/closeout reports for
  specific `ROADMAP.md` task IDs.
- **`ROADMAP_PRIORITY_REVIEW.md`, `ROADMAP_PRIORITY_APPLIED_REPORT.md`**: the Tier 1–5
  reprioritization review and its applied result (see `ROADMAP.md`'s current tier structure).
- **`morning-review.md`**: standalone review note.
- **`HOUSEKEEPING_*` reports** (e.g. `HOUSEKEEPING_2026-07-10_AUDIT_REPORT.md`): periodic
  repo-hygiene audits (branch cleanup candidates, dependency hygiene findings) — recommendations
  for a human to act on, not automatically-applied changes.

## Finding a specific report

Reports are prefixed by their originating task ID (`RALPH-NNN`, `P1-NNN`, `P2-NNN`, `CLINE-*`) —
cross-reference the task ID against `ROADMAP.md` or `.governance/` to find the task that produced
it.
