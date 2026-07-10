# reports/ Index

This directory accumulates evidence/output reports written by agents during
Ralph-Loop governance work and earlier Cline/Codex phases. Every file here is
referenced by exact relative path from `tasks/task-state.json` (and/or
`tasks/task-history.jsonl`, `runs/run-history.jsonl`) as evidence for a
specific completed task. **Do not rename, move, or delete individual report
files** — doing so breaks those evidence references. This index exists so the
directory is navigable without opening every file; it does not replace or
reorganize the files themselves.

## Categories

- **`CLINE-GOV-*`** — Governance inventory/authority/duplication analysis
  produced during the SSOK/Ralph-Loop governance unification effort
  (CLINE-GOV-001 … 009).
- **`CLINE-REAL-*`** / **`CLINE-READ-*`** — Read-only audits and controlled
  regression/readback tests run under the Cline governance track
  (CLINE-REAL-002 … 012, CLINE-READ-001).
- **`RALPH-0xx_*`** — Ralph-Loop foundation work: runtime-state validators,
  handoff/review-gate engine, roadmap parser canonicalization
  (RALPH-001 … RALPH-047B). Numerically ordered; each report documents one
  scoped implementation or planning step in the Ralph-Loop migration
  (`tasks/task-state.json` is the authoritative status for each ID).
- **`P1-003_*`** — Multi-item split discovery/implementation reports (Tier 1
  resolver work).
- **`P2-011_*`** — Project-scoped Codex governance closeout report (Tier 2).
- **`ROADMAP_PRIORITY_*`** — Roadmap priority review/applied-changes reports.
- **`morning-review.md`** — Regenerated output of
  `scripts/agent/generate-morning-review.mjs --write`; not historical
  evidence, safe to overwrite.

## Status

Task completion status for `RALPH-*`, `CLINE-*`, `P1-*`, `P2-*` IDs lives in
`tasks/task-state.json` (canonical runtime state) and `ROADMAP.md` (planning
authority) — check those files rather than inferring status from a report's
presence here.
