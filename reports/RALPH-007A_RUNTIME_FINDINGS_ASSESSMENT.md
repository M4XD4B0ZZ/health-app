# Executive Summary

Task: **RALPH-007A — Runtime Findings Assessment**  
Mode: **analysis only**  
Generated from read-only execution of:

```bash
node scripts/agent/validate-ralph-state.mjs --json
node scripts/agent/reconcile-roadmap-task-state.mjs --json
```

Both tools executed successfully and returned `exit_code: 1` because current repository state contains critical findings. This is expected for these read-only diagnostic tools when critical findings are present.

## Overall assessment

The findings do **not** indicate product/runtime application breakage. They indicate that the Ralph V2 runtime-state model is still in transition and that existing evidence/state files were produced before the normalized V2 completion, validation, review, reconciliation, and legacy-artifact rules were fully established.

## Finding groups

| Group                         |                         Findings | Assessment                                                                                                                                            |
| ----------------------------- | -------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A) Production blockers        |                                0 | No product-code, app-runtime, Supabase, dependency, or deployment blocker was detected.                                                               |
| B) Governance inconsistencies |         1 critical + 10 warnings | Duplicate ROADMAP ID and RALPH runtime tasks missing from ROADMAP violate canonical planning/runtime authority expectations.                          |
| C) Legacy migration artifacts |                      40 warnings | Legacy JSONL schemas and `.agent/*` artifacts are expected during transition and safe to ignore as authorities, but should be migrated/retired later. |
| D) Runtime-state mismatches   |                        1 warning | `P1-003` is `in_progress` in ROADMAP but absent from `tasks/task-state.json`. This matters for Ralph V2 task selection.                               |
| E) Validation evidence gaps   |                       1 critical | `RALPH-006A` is `done` but validation evidence is attached to `RALPH-006A-FIX`, not `RALPH-006A`.                                                     |
| F) Review evidence gaps       |                       7 critical | Several `done` tasks require human review but lack structured review acceptance evidence.                                                             |
| G) Low-priority cleanup       | 27 info + duplicate derived info | ROADMAP tasks missing from task-state are mostly normal until V2 imports eligible tasks.                                                              |

## Must-fix conclusion

Before Ralph V2 can safely perform autonomous or semi-autonomous task selection/completion, it must fix or explicitly resolve:

1. **Review evidence model gap** for review-required completed tasks.
2. **Validation evidence linkage gap** for `RALPH-006A`.
3. **ROADMAP duplicate task ID `P0-002`**.
4. **Runtime-only classification gap** for `RALPH-001A` through `RALPH-010A`.
5. **Import/reconciliation gap for active ROADMAP task `P1-003`**.

Legacy JSONL schema warnings and stale `.agent/*` artifacts are not blockers if Ralph V2 treats them as non-authoritative, as defined in `plans/RALPH-002_STATE_MODEL_UNIFICATION_PLAN.md`.

# Validator Findings Assessment

Source command:

```bash
node scripts/agent/validate-ralph-state.mjs --json
```

Observed summary:

```json
{
  "status": "critical_findings",
  "critical_count": 8,
  "warning_count": 43,
  "exit_code": 1
}
```

## Critical findings

| Finding id                                        | Severity | Root cause                                                                                                                                                              | Current impact                                                                     | Ralph V2 impact                                                                             | False positive?                                           | Legacy artifact?                                           | Must-fix?                         | Should-fix? | Can-ignore? | Group                       |
| ------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- | ----------- | ----------- | --------------------------- |
| `done_without_review_evidence` / `RALPH-002A`     | critical | `tasks/task-state.json` marks task `done` and `requires_human_review: true`, but no structured `review.accepted` / `task.review_accepted` evidence exists.              | Completion is not fully provable under V2 evidence rules.                          | Blocks strict V2 done-gate enforcement unless backfilled, waived, or reclassified.          | No. The evidence is genuinely absent in current streams.  | Partly: task predates normalized review events.            | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |
| `done_without_review_evidence` / `RALPH-003A`     | critical | Same as above.                                                                                                                                                          | Same as above.                                                                     | Same as above.                                                                              | No.                                                       | Partly.                                                    | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |
| `done_without_review_evidence` / `RALPH-004A`     | critical | Same as above.                                                                                                                                                          | Same as above.                                                                     | Same as above.                                                                              | No.                                                       | Partly.                                                    | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |
| `done_without_validation_evidence` / `RALPH-006A` | critical | The passing validation evidence exists for `RALPH-006A-FIX`, while `tasks/task-state.json` marks `RALPH-006A` as `done`. The validator requires matching task identity. | The original `RALPH-006A` completion cannot be validated by exact `task_id` match. | Blocks strict V2 completion integrity because `done` requires matching validation evidence. | No. It is an identity/linkage mismatch, not a tool error. | Partly: created during pre-normalized repair/fix workflow. | Yes before strict V2 enforcement. | Yes.        | No.         | E) Validation evidence gaps |
| `done_without_review_evidence` / `RALPH-006A`     | critical | `RALPH-006A` requires review but lacks structured acceptance evidence.                                                                                                  | Completion review gate is not auditable.                                           | Blocks strict V2 done-gate enforcement.                                                     | No.                                                       | Partly.                                                    | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |
| `done_without_review_evidence` / `RALPH-008A`     | critical | `RALPH-008A` requires review but lacks structured acceptance evidence.                                                                                                  | Completion review gate is not auditable.                                           | Blocks strict V2 done-gate enforcement.                                                     | No.                                                       | Partly.                                                    | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |
| `done_without_review_evidence` / `RALPH-009A`     | critical | `RALPH-009A` requires review but lacks structured acceptance evidence.                                                                                                  | Completion review gate is not auditable.                                           | Blocks strict V2 done-gate enforcement.                                                     | No.                                                       | Partly.                                                    | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |
| `done_without_review_evidence` / `RALPH-010A`     | critical | `RALPH-010A` requires review but lacks structured acceptance evidence.                                                                                                  | Completion review gate is not auditable.                                           | Blocks strict V2 done-gate enforcement.                                                     | No.                                                       | Partly.                                                    | Yes before strict V2 enforcement. | Yes.        | No.         | F) Review evidence gaps     |

## Warning findings

| Finding id                                                                     | Severity | Count | Root cause                                                                                                                                                                                             | Current impact                                                  | Ralph V2 impact                                                                                  | False positive? | Legacy artifact?                                                        | Must-fix?                                           | Should-fix?                            | Can-ignore?                  | Group                         |
| ------------------------------------------------------------------------------ | -------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------- | ---------------------------- | ----------------------------- |
| `legacy_jsonl_event_schema` in `tasks/task-history.jsonl`                      | warning  |    20 | Historical task events use pre-V2 event types such as `task_completed`, `task_started`, `bugfix_completed`, `state_repaired`, and `completed`.                                                         | No immediate runtime impact; parser tolerates them.             | V2 cannot treat them as normalized transition evidence without migration/import semantics.       | No.             | Yes.                                                                    | No, if tolerated.                                   | Yes, migrate or mark legacy later.     | Yes as current authority.    | C) Legacy migration artifacts |
| `legacy_jsonl_event_schema` in `runs/run-history.jsonl`                        | warning  |    16 | Historical run events use pre-V2 event types such as `run_started`, `run_completed`, `smoke_test_completed`, `runtime_review_completed`, and repair events.                                            | No immediate runtime impact; parser tolerates them.             | V2 cannot rely on these as normalized lifecycle events without migration/import semantics.       | No.             | Yes.                                                                    | No, if tolerated.                                   | Yes, migrate or mark legacy later.     | Yes as current authority.    | C) Legacy migration artifacts |
| `handoff_run_mismatch_or_missing`                                              | warning  |     1 | `handoffs/latest-handoff.md` does not mention latest `run_id` from `runs/current-run.json` (`run_2026-05-19_ralph-010a-closeout`). Latest handoff is mutable and may reflect a later or unrelated run. | Latest handoff cannot be used as reliable current-run evidence. | V2 handoff generator/archive requirement must fix this; otherwise handoff evidence remains weak. | No.             | Partly: latest mutable handoff predates archival/generator enforcement. | No for product. Yes before strict handoff-gated V2. | Yes.                                   | No for V2 authority.         | F) Review evidence gaps       |
| `stale_agent_state`                                                            | warning  |     1 | `.agent/state.json` references stale `P1-002` / `ready_for_human_review` from 2026-05-16.                                                                                                              | None if treated as legacy adapter state.                        | Dangerous only if a V2 coordinator reads it as authority.                                        | No.             | Yes.                                                                    | No.                                                 | Yes, retire or clearly label.          | Yes if ignored as authority. | C) Legacy migration artifacts |
| `legacy_artifact_present_non_authoritative` / `.agent/state.json`              | warning  |     1 | Deprecated adapter state still exists.                                                                                                                                                                 | None if non-authoritative.                                      | Must not be consumed by V2 core.                                                                 | No.             | Yes.                                                                    | No.                                                 | Yes.                                   | Yes.                         | C) Legacy migration artifacts |
| `stale_selected_task`                                                          | warning  |     1 | `.agent/out/selected-task.json` references stale `P2-011`, while current run references `RALPH-010A-CLOSEOUT`.                                                                                         | None if ignored.                                                | Dangerous if legacy selected task is used for V2 selection.                                      | No.             | Yes.                                                                    | No.                                                 | Yes, retire after V2 selection exists. | Yes if ignored as authority. | C) Legacy migration artifacts |
| `legacy_artifact_present_non_authoritative` / `.agent/out/selected-task.json`  | warning  |     1 | Deprecated selected-task snapshot still exists.                                                                                                                                                        | None if non-authoritative.                                      | Must not be consumed by V2 core.                                                                 | No.             | Yes.                                                                    | No.                                                 | Yes.                                   | Yes.                         | C) Legacy migration artifacts |
| `legacy_artifact_present_non_authoritative` / `.agent/out/verify-report.md`    | warning  |     1 | Marker-based verification report remains present.                                                                                                                                                      | None if supplemental only.                                      | V2 validation must use `validation/validation-results.jsonl`, not this report.                   | No.             | Yes.                                                                    | No.                                                 | Yes.                                   | Yes.                         | C) Legacy migration artifacts |
| `legacy_artifact_present_non_authoritative` / `.agent/out/handoff-template.md` | warning  |     1 | Legacy template remains present.                                                                                                                                                                       | None if supplemental only.                                      | V2 handoff evidence must be generated/archived, not inferred from a template.                    | No.             | Yes.                                                                    | No.                                                 | Yes.                                   | Yes.                         | C) Legacy migration artifacts |

# Reconciler Findings Assessment

Source command:

```bash
node scripts/agent/reconcile-roadmap-task-state.mjs --json
```

Observed summary:

```json
{
  "status": "critical_findings",
  "roadmap_task_count": 28,
  "task_state_task_count": 10,
  "finding_count": 39,
  "critical_count": 1,
  "warning_count": 11,
  "info_count": 27,
  "exit_code": 1
}
```

## Critical findings

| Finding id                             | Severity | Root cause                                                                                                                    | Current impact                               | Ralph V2 impact                                                                                      | False positive? | Legacy artifact? | Must-fix?                            | Should-fix? | Can-ignore? | Group                         |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------- | ---------------- | ------------------------------------ | ----------- | ----------- | ----------------------------- |
| `duplicate_roadmap_task_id` / `P0-002` | critical | `ROADMAP.md` contains `P0-002` twice: line 40 (`Kerninputs Proof`) and line 401 (`Single Item 6 Resolver 6 Macros Pipeline`). | Planning identity is ambiguous for `P0-002`. | Blocks deterministic ROADMAP import/reconciliation because task IDs must be stable and never reused. | No.             | No.              | Yes before V2 imports ROADMAP tasks. | Yes.        | No.         | B) Governance inconsistencies |

## Warning findings

| Finding id                                                              | Severity | Count / tasks | Root cause                                                                                                                        | Current impact                                                                            | Ralph V2 impact                                                                                                                                     | False positive? | Legacy artifact?                              | Must-fix?                                               | Should-fix? | Can-ignore?                               | Group                                                         |
| ----------------------------------------------------------------------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------- | ------------------------------------------------------- | ----------- | ----------------------------------------- | ------------------------------------------------------------- |
| `roadmap_task_missing_from_task_state` / `P1-003`                       | warning  | 1 task        | `P1-003` is `in_progress` in `ROADMAP.md` but absent from Ralph runtime task-state.                                               | Product planning says active work exists, but Ralph runtime cannot track it structurally. | Blocks V2 from safely selecting/tracking active product work unless imported or explicitly excluded.                                                | No.             | No.                                           | Yes before V2 executes product ROADMAP tasks.           | Yes.        | No for V2 execution.                      | D) Runtime-state mismatches                                   |
| `runtime_task_missing_from_roadmap` / `RALPH-001A` through `RALPH-010A` | warning  | 10 tasks      | Ralph migration tasks exist only in `tasks/task-state.json` and are not declared in ROADMAP; they also lack `runtime_only: true`. | Planning/runtime authority split is ambiguous.                                            | V2 must not let runtime state create planning truth. These tasks need ROADMAP entries, a runtime-only marker, or explicit migration classification. | No.             | Partly: these are transition/migration tasks. | Yes before strict V2 task selection over runtime state. | Yes.        | No unless explicitly marked runtime-only. | B) Governance inconsistencies / C) Legacy migration artifacts |

Runtime tasks affected by `runtime_task_missing_from_roadmap`:

- `RALPH-001A` — Minimal agent-neutral governance foundation
- `RALPH-002A` — Minimal runtime-state and handoff foundation
- `RALPH-003A` — Minimal agent prompt and adapter contracts
- `RALPH-004A` — Root governance transition notes
- `RALPH-005A` — Dry-run task selector plan
- `RALPH-006A` — Dry-run task selector implementation
- `RALPH-007A` — Morning review generator plan
- `RALPH-008A` — Morning Review Generator Implementation
- `RALPH-009A` — Cline Worker Adapter Preparation
- `RALPH-010A` — First controlled single-task loop

## Info findings

| Finding id                                                           | Severity | Count / tasks                                            | Root cause                                                                     | Current impact                                            | Ralph V2 impact                                                                               | False positive? | Legacy artifact?             | Must-fix?                           | Should-fix?                      | Can-ignore?                | Group                   |
| -------------------------------------------------------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------- | ---------------------------- | ----------------------------------- | -------------------------------- | -------------------------- | ----------------------- |
| `roadmap_task_missing_from_task_state` / completed ROADMAP tasks     | info     | 11 entries, including duplicate-derived `P0-002` entries | Historical completed ROADMAP tasks were not imported into Ralph runtime state. | No active impact if not selected by Ralph.                | V2 may need import markers or archived/imported status if it wants complete ROADMAP coverage. | No.             | Historical planning backlog. | No.                                 | Maybe, as cleanup/import policy. | Yes for current execution. | G) Low-priority cleanup |
| `roadmap_task_missing_from_task_state` / future `todo` ROADMAP tasks | info     | 15 tasks                                                 | Planned ROADMAP tasks are not yet imported into runtime task-state.            | No immediate impact until Ralph V2 is used for execution. | V2 coordinator should import eligible tasks before execution with safety metadata.            | No.             | No.                          | No until selected for V2 execution. | Yes before autonomous execution. | Yes short-term.            | G) Low-priority cleanup |

Info ROADMAP tasks missing from task-state:

- Completed/historical: `P0-002` (`Kerninputs Proof`), `P0-001`, `P0-002` (`Single Item 6 Resolver 6 Macros Pipeline`), `P0-003`, `P0-004`, `P0-005`, `P0-007`, `P1-001`, `P1-002`, `P2-004`, `P2-005`, `P2-006`, `P2-011`.
- Planned/future: `P2-001`, `P2-002`, `RESOLVER-V2-001`, `RESOLVER-V2-002`, `RESOLVER-V2-003`, `RESOLVER-V2-004`, `P2-003`, `P2-007`, `RESOLVER-V2-005`, `RESOLVER-V2-006`, `P2-008`, `P2-009`, `P2-010`, `RESOLVER-V2-007`.

Note: the reconciler reports 27 info findings. The task list above contains both duplicate-derived `P0-002` entries because the ROADMAP itself currently contains duplicate task identity.

# Root Cause Analysis

## 1. Ralph V2 governance was introduced after older state/evidence files already existed

The validator is enforcing rules from `plans/RALPH-002_STATE_MODEL_UNIFICATION_PLAN.md`, including normalized task/run/validation/review evidence. Many current runtime records were produced by earlier Ralph-Loop foundation work, before the normalized V2 schemas existed.

Resulting findings:

- `legacy_jsonl_event_schema`
- `done_without_review_evidence`
- `done_without_validation_evidence` for identity-mismatched repair tasks

## 2. Runtime tasks were used as migration execution tasks without ROADMAP registration

`tasks/task-state.json` contains `RALPH-001A` through `RALPH-010A`, but `ROADMAP.md` does not contain those IDs. Under the formal authority hierarchy, ROADMAP is planning authority and runtime state cannot create planning truth.

Resulting findings:

- `runtime_task_missing_from_roadmap`

## 3. ROADMAP has historical product tasks that were never imported into runtime state

This is mostly expected because `tasks/task-state.json` began as Ralph migration runtime state rather than a full import of all ROADMAP tasks.

Resulting findings:

- `roadmap_task_missing_from_task_state` info findings
- `P1-003` warning because it is currently `in_progress`

## 4. ROADMAP contains a duplicate task ID

`P0-002` appears both as a checked item near the top of the file and as a detailed task section later. Even if one is a summary reference, the current parser treats both as task declarations.

Resulting finding:

- `duplicate_roadmap_task_id`

## 5. Review acceptance evidence has not yet been implemented as structured append-only evidence

The plan recommends `review.accepted` / `task.review_accepted` event types, but current evidence streams do not contain them.

Resulting findings:

- `done_without_review_evidence`
- `handoff_run_mismatch_or_missing`

## 6. Legacy adapter outputs remain in place

`.agent/state.json` and `.agent/out/*` are still present from the legacy adapter flow. The V2 plan explicitly classifies them as deprecated/non-authoritative.

Resulting findings:

- `stale_agent_state`
- `stale_selected_task`
- `legacy_artifact_present_non_authoritative`

# Must Fix Before Ralph V2

These items should be resolved before Ralph V2 is allowed to perform strict task selection, state transitions, or done-gate enforcement.

## 1. Establish structured review evidence handling

Affected findings:

- `done_without_review_evidence` for `RALPH-002A`, `RALPH-003A`, `RALPH-004A`, `RALPH-006A`, `RALPH-008A`, `RALPH-009A`, `RALPH-010A`
- `handoff_run_mismatch_or_missing`

Recommended resolution options:

1. Add a review outcome recorder that appends `review.accepted` or `task.review_accepted` events.
2. Backfill explicit human-approved review decisions for legacy review-required tasks.
3. If human approval is not available, reclassify those tasks as `needs_review` or document a human waiver through a canonical review event.

## 2. Fix `RALPH-006A` validation evidence linkage

Affected finding:

- `done_without_validation_evidence` for `RALPH-006A`

Recommended resolution options:

1. Add explicit validation evidence linked to `task_id: RALPH-006A`, or
2. Add a canonical reconciliation/repair event that maps `RALPH-006A-FIX` validation evidence to `RALPH-006A`, if human-approved by policy.

## 3. Resolve duplicate ROADMAP task ID `P0-002`

Affected finding:

- `duplicate_roadmap_task_id`

Recommended resolution options:

1. Convert the top `P0-002` checked item into a non-task summary reference that the parser does not interpret as a task, or
2. Rename/supersede one entry with a unique ID through an explicit ROADMAP governance task.

## 4. Classify Ralph migration tasks in planning authority

Affected findings:

- `runtime_task_missing_from_roadmap` for `RALPH-001A` through `RALPH-010A`

Recommended resolution options:

1. Add these tasks to `ROADMAP.md`, or
2. Mark them in `tasks/task-state.json` with a future schema field such as `runtime_only: true`, with explicit governance policy saying migration bootstrap tasks are runtime-only historical tasks.

## 5. Import or explicitly exclude active ROADMAP task `P1-003`

Affected finding:

- `roadmap_task_missing_from_task_state` warning for `P1-003`

Recommended resolution options:

1. Import `P1-003` into `tasks/task-state.json` with status mapped from ROADMAP `in_progress` to an allowed runtime state, or
2. Explicitly mark product ROADMAP tasks as outside Ralph V2 runtime selection until a later import phase.

# Should Fix Later

These items are important for robustness but do not block read-only analysis or current product operation.

## 1. Normalize or legacy-mark JSONL histories

Affected findings:

- `legacy_jsonl_event_schema` in `tasks/task-history.jsonl`
- `legacy_jsonl_event_schema` in `runs/run-history.jsonl`

Recommendation:

- Do not rewrite history casually.
- Add import/migration semantics that preserve old events as historical evidence and append normalized V2 events going forward.

## 2. Implement canonical handoff generation and archival

Affected finding:

- `handoff_run_mismatch_or_missing`

Recommendation:

- Generate `handoffs/latest-handoff.md` from structured state/evidence.
- Archive every handoff before overwriting latest.

## 3. Implement controlled ROADMAP → task-state import

Affected findings:

- `roadmap_task_missing_from_task_state` info findings for planned future tasks

Recommendation:

- Import only eligible tasks with explicit safety metadata, validation category, allowed files, forbidden files, and review requirements.

## 4. Retire or quarantine legacy `.agent/*` state outputs

Affected findings:

- `stale_agent_state`
- `stale_selected_task`
- `legacy_artifact_present_non_authoritative`

Recommendation:

- Keep them during transition if adapters still need them.
- Ensure Ralph V2 core never reads them as authority.
- Later move them behind adapter-only output naming or cleanup policy.

# Legacy Findings Safe To Ignore

The following findings are safe to ignore **as current authorities**, provided Ralph V2 continues to treat them as non-authoritative:

| Finding                                                                          | Why safe to ignore now                                               | Condition                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `legacy_jsonl_event_schema`                                                      | Old JSONL events are tolerated and useful as historical evidence.    | V2 must not treat them as normalized transition/review/validation proof unless explicitly migrated. |
| `stale_agent_state`                                                              | `.agent/state.json` is deprecated adapter state.                     | V2 must ignore it for planning/runtime decisions.                                                   |
| `stale_selected_task`                                                            | `.agent/out/selected-task.json` is deprecated adapter output.        | V2 must ignore it for selection decisions.                                                          |
| `legacy_artifact_present_non_authoritative`                                      | Presence alone is not harmful.                                       | They must remain non-authoritative and must not override ROADMAP/task-state/current-run.            |
| Info-level `roadmap_task_missing_from_task_state` for future `todo` tasks        | Not every ROADMAP task must be imported before execution is planned. | Import must occur before V2 selects one of those tasks.                                             |
| Info-level `roadmap_task_missing_from_task_state` for completed historical tasks | Historical product tasks do not need active runtime execution.       | If V2 requires full coverage, import as historical/done with evidence policy, not as active tasks.  |

# Recommended Cleanup Roadmap

## Phase 1 — Evidence gates before V2 execution

1. Create a **review outcome recorder** that appends structured `review.*` / `task.review_*` evidence.
2. Backfill or explicitly waive review evidence for completed review-required Ralph tasks.
3. Resolve the `RALPH-006A` validation evidence identity mismatch.

## Phase 2 — Planning/runtime reconciliation

1. Fix or disambiguate duplicate ROADMAP ID `P0-002`.
2. Decide whether `RALPH-001A` through `RALPH-010A` are ROADMAP tasks or runtime-only bootstrap tasks.
3. Import or explicitly exclude `P1-003` before Ralph V2 handles product work.

## Phase 3 — Legacy migration hardening

1. Add legacy event classification for existing JSONL streams.
2. Ensure new events use V2 schema only.
3. Keep `.agent/*` outputs adapter-only and prevent V2 core from consuming them.

## Phase 4 — Full V2 readiness

1. Implement canonical handoff generator with archive support.
2. Implement guarded ROADMAP/task-state import mode.
3. Re-run validator and reconciler until critical findings are either resolved or explicitly waived by canonical evidence.

# Recommended Next Task

Recommended next task: **RALPH-007B — Review Evidence Recorder and Legacy Review Backfill Plan**.

## Objective

Design a read-only-first or dry-run-first review evidence recorder that can produce canonical review acceptance events for Ralph V2, then define a human-approved backfill process for legacy review-required tasks.

## Why this should be next

The largest strict V2 blocker is not product code or runtime execution. It is missing review acceptance evidence for already-`done` tasks that require human review. Until this is resolved, a strict V2 transition module should not trust `done` status for review-required tasks.

## Proposed scope

- Define canonical review evidence shape using `plans/RALPH-002_STATE_MODEL_UNIFICATION_PLAN.md`.
- Add or plan a dry-run CLI for review events.
- Require explicit human approval for any append/backfill mode.
- Do not modify ROADMAP, task-state, or runtime-state automatically.

## Verification evidence for this assessment

Commands executed during RALPH-007A assessment:

```bash
node scripts/agent/validate-ralph-state.mjs --json
node scripts/agent/reconcile-roadmap-task-state.mjs --json
```

Observed outcomes:

- Validator: `critical_count: 8`, `warning_count: 43`, `exit_code: 1` due to reported findings.
- Reconciler: `critical_count: 1`, `warning_count: 11`, `info_count: 27`, `exit_code: 1` due to reported findings.

No implementation repairs, runtime-state edits, ROADMAP edits, commits, or pushes were performed as part of this assessment.
