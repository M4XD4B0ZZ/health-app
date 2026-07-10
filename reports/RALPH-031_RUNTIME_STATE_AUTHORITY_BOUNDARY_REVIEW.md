# RALPH-031: Runtime State Authority Boundary Review

**Task ID:** RALPH-031  
**Category:** Read-only architecture / governance review  
**Generated:** 2026-05-31  
**Status:** Review complete; stop for human review  
**Deliverable:** `reports/RALPH-031_RUNTIME_STATE_AUTHORITY_BOUNDARY_REVIEW.md`

---

## 1. Purpose

This review defines the authority boundary for Ralph task tracking:

- which Ralph work belongs in runtime state, and
- which Ralph work should remain git/report-only.

The review was requested after observing that RALPH-030 is implemented and committed in git, while recent Ralph tasks after RALPH-010A are not consistently represented in runtime-state artifacts.

This report is intentionally documentation-only. It does not backfill runtime state, append evidence, update ROADMAP, or mutate task/run files.

---

## 2. Current Authority Model

| Artifact                                             | Owns                                                                                     | Does not own                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `ROADMAP.md`                                         | Planning authority: product/task priorities, planned work, roadmap statuses              | Runtime execution state or evidence details                      |
| `tasks/task-state.json`                              | Current runtime task execution state for tasks intentionally admitted into Ralph runtime | Planning truth; it must not create roadmap authority             |
| `runs/current-run.json`                              | Current/latest runtime run pointer and run lifecycle state                               | Historical truth beyond latest/current pointer                   |
| `tasks/task-history.jsonl`, `runs/run-history.jsonl` | Append-only evidence of runtime lifecycle transitions                                    | Current state or planning truth                                  |
| `validation/validation-results.jsonl`                | Verification evidence                                                                    | Planning/task selection authority                                |
| `review/review-results.jsonl`                        | Human or automated review evidence                                                       | Planning/task selection authority                                |
| Git commits                                          | Durable implementation/change proof                                                      | Runtime lifecycle state by itself                                |
| `reports/`                                           | Analysis, design, review, and decision artifacts                                         | Runtime execution state unless explicitly imported or backfilled |

Core rule from `SSOK.md`, `AGENTS.md`, and RALPH-015: runtime state is execution authority only after a task is intentionally admitted into the runtime system. Reports and git commits are valid evidence, but they do not automatically require runtime backfill.

---

## 3. Ralph Task Category Taxonomy

| Category                     | Examples                                                                      | Runtime-state policy                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Discovery / analysis         | `RALPH-001`, investigations                                                   | Should be git/report-only unless assigned as runtime work                                 |
| Design report / plan         | `RALPH-023`, `RALPH-024`, `RALPH-026`, `RALPH-028`, `RALPH-029`               | Should be git/report-only by default                                                      |
| Governance review            | `RALPH-029A`, `RALPH-030A`, `RALPH-031`                                       | Should be git/report-only by default                                                      |
| Documentation-only hardening | Cline PowerShell docs, static guidance                                        | May be runtime-tracked if executed as an assigned runtime task; otherwise git/report-only |
| Script implementation        | `create-runtime-task-from-roadmap`, `create-runtime-run`, `start-runtime-run` | Must be runtime-tracked going forward if part of Ralph runtime lifecycle/tooling          |
| Runtime-state mutation       | task/run state writes, repair, closeout                                       | Must be runtime-tracked                                                                   |
| Evidence backfill            | validation/review backfill                                                    | Must be runtime-tracked if it mutates evidence/state                                      |
| Worker execution             | future adapter-run work                                                       | Must be runtime-tracked                                                                   |
| Recovery / repair            | stale run recovery, lifecycle repair                                          | Must be runtime-tracked                                                                   |

---

## 4. Runtime-State Inclusion Policy

### 4.1 Must Be Runtime-Tracked

- Any task that mutates `tasks/`, `runs/`, `validation/`, `review/`, or `handoffs/` as runtime artifacts.
- Any executable Ralph script implementation or patch that becomes part of the runtime lifecycle.
- Any worker execution, validation writer, review writer, recovery, repair, or evidence backfill.

### 4.2 May Be Runtime-Tracked

- Adapter documentation/hardening if performed as an assigned runtime task.
- Governance/documentation updates that are explicitly selected by Ralph runtime.

### 4.3 Should Be Git/Report-Only

- Discovery, design, architecture review, implementation plans, and policy analysis that do not mutate runtime state or executable runtime tools.

### 4.4 Must Not Be Runtime-Tracked Automatically

- Historical git commits merely because they exist.
- Reports created outside an assigned runtime task.
- Product tasks unless explicitly imported from `ROADMAP.md` into runtime execution.

---

## 5. Backfill Policy

Historical backfill is allowed only when all of these conditions are true:

1. The task category should have been runtime-tracked under the policy above.
2. Strong evidence exists: commit hash, changed files, validation output or handoff/report, and human approval.
3. Backfill metadata clearly says `reconstructed_from_git` or `backfilled`, not original live execution.
4. History writes are append-only and idempotent.
5. Backfill does not mark validation/review as accepted unless that evidence truly exists.

Backfill is forbidden when:

- the task was report-only/design-only and never intended to execute runtime state;
- evidence is ambiguous;
- backfill would fabricate validation/review or original timestamps;
- it would rewrite JSONL history.

---

## 6. Application to Recent Ralph Tasks

| Task         | Category                                                                  | Should appear in runtime state? | Recommendation                                                                |
| ------------ | ------------------------------------------------------------------------- | ------------------------------: | ----------------------------------------------------------------------------- |
| `RALPH-023`  | Runtime task creation plan/report                                         |                   No by default | Keep git/report-only                                                          |
| `RALPH-024`  | Minimal runtime task creation plan                                        |                   No by default | Keep git/report-only                                                          |
| `RALPH-025`  | Runtime task creation implementation (`create-runtime-task-from-roadmap`) |                             Yes | Backfill may be appropriate if not represented                                |
| `RALPH-025A` | Likely implementation/review/patch variant                                |          Depends on exact scope | Track only if script/runtime mutation occurred                                |
| `RALPH-025B` | Likely implementation/review/patch variant                                |          Depends on exact scope | Track only if script/runtime mutation occurred                                |
| `RALPH-026`  | Runtime run creation design report                                        |                              No | Keep git/report-only                                                          |
| `RALPH-027`  | Runtime run creation implementation (`create-runtime-run`)                |                             Yes | Backfill appropriate if missing/incomplete                                    |
| `RALPH-028`  | Worker envelope design report                                             |                              No | Keep git/report-only                                                          |
| `RALPH-029`  | Runtime run-start implementation plan                                     |                              No | Keep git/report-only                                                          |
| `RALPH-029A` | Lifecycle consistency review                                              |                              No | Keep git/report-only                                                          |
| `RALPH-030`  | Guarded runtime run start implementation (`start-runtime-run`)            |                             Yes | Backfill appropriate after approval                                           |
| `RALPH-030A` | Read-only audit                                                           |                              No | Chat/git-only unless report later approved                                    |
| `RALPH-031`  | Authority-boundary review                                                 |                              No | This report is git/report-only unless later imported by explicit runtime task |
| `RALPH-031A` | Planning/reconciliation review                                            |                              No | Chat/report-only unless implementation follows                                |

---

## 7. Operational Recommendations

### 7.1 Should RALPH-030 Be Backfilled?

Yes, but only after this authority-boundary policy is accepted. RALPH-030 is a runtime lifecycle script implementation and should be represented in runtime state.

### 7.2 Should RALPH-027 Be Backfilled?

Yes, likely. It implemented runtime run creation and is part of the Ralph lifecycle tooling. If current runtime state lacks coherent lineage for it, it should be included in a targeted backfill.

### 7.3 Should Report-Only Tasks Be Backfilled?

No. Keep `RALPH-023`, `RALPH-024`, `RALPH-026`, `RALPH-028`, `RALPH-029`, `RALPH-029A`, `RALPH-030A`, and this `RALPH-031` review git/report-only unless they were explicitly executed through runtime state.

### 7.4 Should Future Ralph Tasks Create Runtime Entries Before Implementation?

Yes for implementation/runtime mutation tasks. Before any future Ralph task that changes executable scripts, runtime state, validation/review evidence, worker execution, or recovery behavior, create or select a runtime task/run first.

For docs-only/report-only reviews, report plus git commit is enough unless the human explicitly assigns them as runtime tasks.

---

## 8. Future Workflow Rule

1. Report/design/review-only Ralph work: no runtime task required; evidence is report + git commit + verification readback.
2. Ralph executable/runtime tooling work: must have runtime task and run lineage before or during implementation.
3. Runtime/evidence mutation work: must be runtime-tracked and append evidence; no ad hoc edits.
4. Worker execution: must always be runtime-tracked with task/run identity, allowed files, validation requirements, and review gate.
5. Historical backfill: only targeted, human-approved, idempotent, and explicitly reconstructed.

---

## 9. Smallest Safe Next Task

Recommended next task:

```text
RALPH-032 — Targeted Runtime Lineage Backfill for Runtime Tooling Implementations
```

Initial scope should include only runtime-tooling implementation tasks:

- `RALPH-027` — `create-runtime-run.mjs`
- `RALPH-030` — `start-runtime-run.mjs`
- optionally `RALPH-025` if confirmed missing and in scope

Do not backfill report-only tasks.

Worker invocation should wait until this targeted lineage policy is accepted and necessary runtime-tooling implementation lineage is normalized.

---

## 10. Verification Plan

This task is documentation-only under `VERIFY.md` Category 1. Required checks:

```powershell
git --no-pager status --short
```

```powershell
git --no-pager diff --stat
```

```powershell
git --no-pager diff --name-only
```

No `npm run verify` is required because this task only creates a report file and does not modify runtime code, product code, tests, package files, runtime state, validation evidence, review evidence, or handoff files.

---

## 11. Human Review Gate

Stop after report creation and documentation-only readback checks. Human review is required before any runtime-state backfill or workflow rule implementation.
