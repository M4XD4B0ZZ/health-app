# RALPH-RETIRE-001 — Dead Runtime Cleanup Report

**Date:** 2026-07-23
**Scope:** Remove the retired Ralph-Loop / Overnight Worker runtime, simulators, and
historical noise. No product code, workflow, dependency, or governance-content change beyond
removing dangling references to deleted paths.

## 1) Executive outcome

The Ralph-Loop / Overnight Worker initiative (`RALPH-001` … `RALPH-047B`, plus the
`CLINE-GOV-*` / `CLINE-REAL-*` / `CLINE-READ-*` governance-track reports) never produced a
working unattended worker. Every stage was an intentionally non-executing dry-run/simulator;
the only real write capability ever built was a supervised single-Markdown-file creator. This
task removes the dead scaffolding, compresses its ~1,940-line `ROADMAP.md` footprint to a
short historical note, and repairs the resulting dangling references in `AGENTS.md`,
`SSOK.md`, and `reports/README.md`.

**Net change:** 245 files changed, 98 insertions(+), 79,792 deletions(-).

## 2) Directories and subsystems inspected

- `scripts/agent/**` (55 top-level scripts + `lib/` + `__tests__/` + `README.md`)
- `.agent/**` (overnight, runtime/sandbox, prompts, adapters, config, out)
- `tasks/`, `runs/`, `validation/`, `review/`
- `plans/**` (searched for RALPH/autonomous-worker plans)
- `reports/**` (searched for RALPH/CLINE reports)
- `docs/**` (searched for RALPH/Cline transition docs)
- `.github/workflows/**` (the only workflow, `verify.yml`)
- `package.json` (all `agent:*` script entries)
- `src/**`, `scripts/lib/**`, root `scripts/*.mjs` (searched for any import/reference)
- `AGENTS.md`, `SSOK.md`, `VERIFY.md`, `README.md`, `.governance/**`

## 3) Active consumers found (evidence)

- **CI (`verify.yml`):** runs only `npm ci --ignore-scripts` + `npm run verify`
  (typecheck/lint/format/test). Zero references to `scripts/agent/**` or `.agent/**`.
- **Jest config (`jest.config.js`):** `roots: ['<rootDir>/src']`,
  `testMatch: ['**/__tests__/**/*.test.ts']`. The ~40 Node-format tests under
  `scripts/agent/__tests__/*.test.mjs` were never picked up by `npm test`; they could only ever
  be run manually with `node --test`.
- **Product code (`src/`, all subdirectories):** zero references to either `scripts/agent` or
  `.agent/`.
- **Other scripts (`scripts/lib/`, root-level `scripts/*.mjs`, `scripts/__tests__/`):** zero
  references to `scripts/agent` or `.agent/`.
- **Only consumers found:** the 13 `agent:*` entries in `package.json`, and
  `tasks/task-state.json` (itself dead runtime state, see below).
- **`handoffs/latest-handoff.md`:** actively written by the current product workflow (most
  recently by RESOLVER-V3-039, 2026-07-23) — confirmed unrelated to the RALPH runtime and left
  untouched.

## 4) Deleted subsystems

| Path                                                                                                                                                                                                                                                                                   | Contents                                                                     | Reason                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/agent/**`                                                                                                                                                                                                                                                                     | 55 scripts, `lib/`, `__tests__/`, `README.md`                                | Dead: no CI, no product, no other-script consumer (see §3). Includes the old OpenCode worker path (`run-opencode-worker.mjs` etc.) and the full RALPH-034 simulator chain.                                                                                          |
| `.agent/**`                                                                                                                                                                                                                                                                            | `overnight/`, `runtime/sandbox/`, `prompts/`, `adapters/`, `config/`, `out/` | Exclusively consumed by the deleted `scripts/agent/**`; no other reference.                                                                                                                                                                                         |
| `tasks/`, `runs/`, `validation/`, `review/`                                                                                                                                                                                                                                            | Runtime-state JSON/JSONL                                                     | Confirmed the state only ever tracked `RALPH-*` task IDs (last entries: `RALPH-010A`…`RALPH-030`, updated May 2026) and never tracked `RESOLVER-V3-*`, `P1-*`, `P2-*`, or any current work. Fully superseded by `ROADMAP.md` status + `handoffs/latest-handoff.md`. |
| `plans/RALPH-002_STATE_MODEL_UNIFICATION_PLAN.md`, `plans/RALPH_CLINE_DRY_RUN_PLAN.md`, `plans/RALPH_DRY_RUN_SELECTOR_PLAN.md`, `plans/RALPH_LOOP_GOVERNANCE_MIGRATION_PLAN.md`, `plans/RALPH_MORNING_REVIEW_GENERATOR_PLAN.md`, `plans/AUTONOMOUS_WORKER_LOOP_IMPLEMENTATION_PLAN.md` | 6 planning documents                                                         | Historical planning for the retired initiative; not referenced by `plans/README.md`'s "Aktuelle Pläne" list.                                                                                                                                                        |
| `reports/RALPH-*` (68 files), `reports/CLINE-GOV-*` (9), `reports/CLINE-REAL-*` (11), `reports/CLINE-READ-001` (1)                                                                                                                                                                     | 70 historical reports                                                        | Evidence/output for the retired initiative's own tasks. See §6 for the one judgment call made here.                                                                                                                                                                 |
| `reports/morning-review.md`                                                                                                                                                                                                                                                            | 1 file                                                                       | Documented as "regenerated output, safe to overwrite" by the old `reports/README.md`; generator (`scripts/agent/generate-morning-review.mjs`) is deleted.                                                                                                           |
| `docs/RALPH_LOOP_TRANSITION_NOTES.md`, `docs/CLINE_RALPH_WORKER_SETUP.md`, `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`                                                                                                                                                                     | 3 docs                                                                       | Onboarding/transition docs for the retired initiative; explicitly marked non-authoritative in their own text.                                                                                                                                                       |

Total: 240 files deleted, 79,838 lines removed by `git rm` (before the +98/-79,792 net counting
the small edits below).

## 5) Retained exceptions and reasons

- **`.governance/**`(SYSTEM.md, RULES.md, SAFETY.md, REVIEW_POLICY.md) — untouched.** Still
contains unique, potentially-reusable safety/review principles and still references some of
the now-deleted paths (e.g.`.agent/config/protected-files.json`, `tasks/task-state.json`).
This is a **known, intentional residual inconsistency**, explicitly reserved for
`RALPH-RETIRE-002`(added to`ROADMAP.md`), not resolved here, per the task's own scope
  boundary (no governance consolidation in this task).
- **`.roo/`, `.roomodes` — untouched.** Still active Roo-first legacy workflow content;
  disposition explicitly deferred to `RALPH-RETIRE-002`.
- **`handoffs/`, `handoffs/latest-handoff.md` — untouched.** Actively used by the current
  product workflow.
- **All `RESOLVER-V3-*`, `P1-*`, `P2-*`, `DEPENDENCY_HYGIENE_*`, `APP_TESTING_*` reports —
  untouched.** Active product/verification history.
- **`plans/README.md` and all non-RALPH plans — untouched.**

## 6) One judgment call flagged for transparency

`reports/CLINE-REAL-007`, `-011`, `-012` document rationale for three regression tests
(`Zero-Macro Guard`, resolver-exception, and persistence-integrity assertions) that are still
present and passing in `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.test.ts`
(verified: all three test names still exist in that file). These reports were still deleted
along with the rest of the `CLINE-*` set because: (a) `reports/README.md` itself grouped them
under the single retired "Cline governance track" effort; (b) the tests are self-documenting
via their descriptive names and assertions; (c) Git history retains the full rationale if ever
needed. No active code or tooling references these reports by path. Flagged here in case a
maintainer disagrees and wants them restored from history.

## 7) Package scripts removed

All 13 `agent:*` entries removed from `package.json`: `agent:next`, `agent:prompt`,
`agent:verify`, `agent:handoff`, `agent:run`, `agent:worker`, `agent:worker:debug`,
`agent:worker:matrix`, `agent:worker-prompt`, `agent:model`, `agent:auto`, `agent:milestone`,
`agent:watch`. No dependency changed; `package-lock.json` required no change (script-entry
removal only, confirmed by `git status`).

## 8) ROADMAP.md reduction

The "Ralph-Loop Governance / Overnight Worker" section shrank from 1,940 lines (114 tasks'
worth of detail, lines 114–2051) to a 55-line historical retirement note plus one `todo`
follow-up task (`RALPH-RETIRE-002`). `RALPH-034V` changed from `in_progress` to retired
(described as cancelled in the retirement note, since the repository's status vocabulary
— `todo`/`in_progress`/`blocked`/`done` — has no `cancelled` value and `blocked` would
incorrectly imply it might resume). Total `ROADMAP.md`: 11,133 → 9,248 lines.

## 9) Files and lines removed (exact, from Git)

```
245 files changed, 98 insertions(+), 79792 deletions(-)
```

Breakdown of the 240 deleted files by top-level location: `scripts/agent/` 127,
`reports/` 71, `.agent/` 26, `plans/` 6, `docs/` 3, `validation/` 2, `tasks/` 2, `runs/` 2,
`review/` 1.

## 10) Unresolved references or risks

- `.governance/**` still references deleted paths (see §5) — intentional, tracked as
  `RALPH-RETIRE-002`.
- `docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`
  contains one historical sentence referencing `AGENTS.md`'s former "Dual Governance During
  Transition" section (now replaced) while explaining a past task's (`RESOLVER-V3-030`)
  reasoning. Left unedited: it is a historical decision-log entry describing what was true at
  the time, not a live navigational link, and rewriting unrelated product task history is out
  of scope per `AGENTS.md`.
- Several `ROADMAP.md` entries for already-completed product tasks (e.g. the J-001..J-006
  Journal sequence, an OAuth scaffold task) mention `scripts/agent/**` or
  `.agent/config/protected-files.json` in describing pre-existing conditions at the time those
  tasks ran (e.g. a repo-wide `format:check` Prettier gap, or protected-file policy). These are
  historical task records and were left unedited for the same reason.
- `reports/DEPENDENCY_HYGIENE_2026-07-10_REPORT.md` references
  `.agent/config/protected-files.json` in historical context; left unedited (historical
  report).

## 11) Scope reserved for RALPH-RETIRE-002

Added to `ROADMAP.md` as `todo`: consolidate `.governance/**` against `AGENTS.md` / `SSOK.md` /
`VERIFY.md`, remove remaining Roo/Cline/OpenCode transition language, and decide the final
disposition of `.roo/` and `.roomodes`. Not started here.

## 12) Verification

- Baseline (before any change, after `npm ci --ignore-scripts` to restore missing
  `node_modules`): `npm run verify` — **fully green**: typecheck clean, lint clean, format
  clean, 235 test suites / 2,279 tests passed.
- Post-cleanup: see final report section for the actual re-run result on this branch.
- Repo-wide re-search after deletion confirmed no remaining reference to any deleted path
  outside historical/intentional mentions listed in §10, and no remaining `agent:*` script
  reference anywhere in the repo.

## 13) No-product-effect statement

- No `src/**` file changed.
- No Supabase/migration file changed.
- No GitHub workflow added or changed.
- No dependency changed (only `package.json` script-entry removals; `package-lock.json`
  required no change).
- No secret accessed.
- No AI worker invoked as part of this task's own execution beyond the assistant performing
  the cleanup itself.
- `.governance/**` unchanged.
- `handoffs/latest-handoff.md` present and unchanged by this task (updated separately per the
  handoff contract, see below).
- `RALPH-RETIRE-002` not started.
