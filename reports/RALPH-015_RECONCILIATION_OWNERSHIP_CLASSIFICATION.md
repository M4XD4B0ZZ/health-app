# RALPH-015 Reconciliation Ownership Classification

**Task ID:** RALPH-015  
**Generated:** 2026-05-23T12:50:00Z  
**Status:** Governance document ready for human review  
**Category:** Documentation / governance only

---

## 1. Purpose and Authority Boundary

RALPH-015 defines the canonical ownership model for ROADMAP/runtime reconciliation before any reconciler behavior changes are implemented.

This document is intentionally non-executable:

- No reconciler behavior changes.
- No parser changes.
- No runtime state modifications.
- No automatic repair logic.
- No migration execution.
- No commits.
- No pushes.

### Canonical authority inputs

The model follows the repository authority hierarchy in `SSOK.md`, `AGENTS.md`, `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md`, `.governance/REVIEW_POLICY.md`, and `VERIFY.md`:

| Concern                                          | Canonical authority                                  |
| ------------------------------------------------ | ---------------------------------------------------- |
| Planning truth, task identity, roadmap lifecycle | `ROADMAP.md`                                         |
| Runtime execution state                          | `tasks/task-state.json`, `runs/current-run.json`     |
| Task/run history evidence                        | `tasks/task-history.jsonl`, `runs/run-history.jsonl` |
| Validation evidence                              | `validation/validation-results.jsonl`                |
| Review evidence                                  | `review/review-results.jsonl`                        |
| Verification policy                              | `VERIFY.md`                                          |
| Safety policy                                    | `.governance/SAFETY.md`                              |
| Handoff schema                                   | `.governance/RULES.md`                               |
| Review acceptance policy                         | `.governance/REVIEW_POLICY.md`                       |

Runtime state can describe execution, but it must not create or override planning truth. Evidence can prove what happened, but it must not silently repair current state.

---

## 2. Ownership Classes

### 2.1 `roadmap_backed`

**Definition:** A task ID exists in both `ROADMAP.md` and `tasks/task-state.json` and represents the same canonical unit of work.

| Field                       | Rule                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical authority         | `ROADMAP.md` owns planning identity, task intent, planning status, priority/order, and planned completion. `tasks/task-state.json` owns runtime execution metadata and richer lifecycle status.                                                                                             |
| Expected evidence           | Runtime transitions in `tasks/task-history.jsonl`; run lifecycle in `runs/run-history.jsonl`; validation evidence in `validation/validation-results.jsonl`; review evidence in `review/review-results.jsonl` when human review is required; latest handoff in `handoffs/latest-handoff.md`. |
| Expected lifecycle          | Planned in ROADMAP, imported or represented in task-state, executed through runtime states, validated, reviewed if required, then aligned to `done` in both authorities after authorized completion.                                                                                        |
| Reconciliation expectations | Apply status mapping. Compatible mapped states should be accepted. Incompatible states should be findings. Completion findings must check validation/review evidence before recommending any status update.                                                                                 |

### 2.2 `runtime_only`

**Definition:** A task exists in `tasks/task-state.json` but does not exist in `ROADMAP.md`, and is intentionally classified as runtime/internal migration work or execution-only state.

| Field                       | Rule                                                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical authority         | `tasks/task-state.json` owns runtime existence and execution metadata. `ROADMAP.md` remains the planning authority and is not implicitly extended by runtime-only tasks.                                                                                              |
| Expected evidence           | Runtime events, validation evidence, review evidence when required, handoff documentation, and a clear runtime-only marker or equivalent classification in future schema.                                                                                             |
| Expected lifecycle          | May be used for Ralph-internal migration, repair, closeout, or execution support tasks when explicitly authorized. Should proceed through runtime lifecycle gates and stop for review.                                                                                |
| Reconciliation expectations | Missing ROADMAP entry is not automatically critical if the task is explicitly runtime-only and evidence is coherent. Absence of a runtime-only marker should be reported as warning until classified. Runtime-only tasks must not create ROADMAP truth automatically. |

### 2.3 `roadmap_only`

**Definition:** A task exists in `ROADMAP.md` but does not exist in `tasks/task-state.json`.

| Field                       | Rule                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical authority         | `ROADMAP.md` owns the task as planning truth. No runtime authority exists until the task is imported or otherwise represented in task-state through an authorized process.                                                                                                                                   |
| Expected evidence           | ROADMAP task section with stable ID, status, and DoD/verification notes where available. Runtime evidence is not expected unless the task has already entered Ralph execution.                                                                                                                               |
| Expected lifecycle          | Remains planned/managed in ROADMAP until selected for Ralph runtime execution. Import into task-state must be explicit and safe.                                                                                                                                                                             |
| Reconciliation expectations | `todo` roadmap-only tasks are normal planning backlog items and should be informational. `in_progress` roadmap-only tasks are warnings because runtime visibility is missing. `done` roadmap-only tasks may be valid historical/product work but require caution if the reconciler expects runtime evidence. |

### 2.4 `historical`

**Definition:** Evidence exists for a task/run/event that is no longer present in current ROADMAP or current task-state, but remains valid as audit history.

| Field                       | Rule                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical authority         | Append-only evidence streams own the historical fact that work occurred. They do not own current planning or runtime state.                                                       |
| Expected evidence           | JSONL entries in task/run/validation/review evidence; archived handoff if available; report artifacts under `reports/`.                                                           |
| Expected lifecycle          | Retained as audit trail. Should not be rewritten, deleted, or used to silently recreate current state.                                                                            |
| Reconciliation expectations | Report as info unless the historical evidence conflicts with current `done` claims, duplicates a canonical active task ID, or uses a legacy schema that blocks parser confidence. |

### 2.5 `legacy`

**Definition:** Artifacts from older adapter flows or pre-V2 schemas that are retained for transition context but are not current canonical authority.

| Field                       | Rule                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical authority         | No legacy artifact is canonical over `ROADMAP.md`, `tasks/task-state.json`, `runs/current-run.json`, `validation/`, `review/`, `VERIFY.md`, or `.governance/`.                                                                                                                             |
| Expected evidence           | Legacy adapter outputs such as `.agent/state.json`, `.agent/out/*`, older JSONL event shapes, or historical Roo artifacts.                                                                                                                                                                 |
| Expected lifecycle          | Retain for transition evidence unless explicitly retired by a future approved migration task. Do not rewrite or delete during reconciliation classification.                                                                                                                               |
| Reconciliation expectations | Treat as info or warning depending on staleness and parser ambiguity. Legacy artifacts should never trigger automatic repair. Legacy evidence schemas should be tolerated as historical evidence but not treated as V2 completion proof unless normalized by an approved evidence process. |

---

## 3. Severity Classification Matrix

Severity means the reconciler/validator reporting level, not an instruction to modify files.

| Finding                              | Info                                                                                      | Warning                                                                                                                    | Critical                                                                                                                                                         | Why                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `roadmap_backed` status mismatch     | Compatible mapped difference, e.g. ROADMAP `in_progress` with runtime `needs_validation`. | Incompatible but non-terminal drift, e.g. ROADMAP `todo` with runtime `in_progress` where a ROADMAP update may be pending. | Completion contradiction, e.g. ROADMAP `done` while runtime is active, or runtime `done` with ROADMAP not done and dependent planning may proceed incorrectly.   | Both authorities exist; incompatible status can cause wrong task selection or false completion.               |
| `runtime_only` missing ROADMAP entry | Explicitly classified runtime-only task with coherent evidence.                           | Runtime task lacks ROADMAP entry and lacks explicit runtime-only marker/classification.                                    | Runtime task is active/done and appears to represent product/planning work that should have ROADMAP authority, or duplicate ID conflicts with ROADMAP semantics. | Runtime state must not create planning truth.                                                                 |
| `roadmap_only` todo task             | Normal backlog/planning item not yet imported.                                            | `todo` task has metadata implying imminent Ralph execution but lacks runtime safety metadata.                              | Not normally critical unless duplicate canonical ID or parser ambiguity makes task identity unsafe.                                                              | ROADMAP owns planning backlog; runtime absence is expected before execution.                                  |
| `roadmap_only` done task             | Historical/product completion outside Ralph runtime, especially pre-V2.                   | Done task lacks detectable validation/review evidence but is not represented in task-state.                                | Done task is required as dependency for Ralph execution and missing evidence would allow unsafe downstream work.                                                 | ROADMAP done is planning truth, but Ralph completion gates require evidence when runtime claims depend on it. |
| Duplicate canonical task ID          | Legacy/historical duplicate clearly outside active canonical parsing scope.               | Duplicate appears in non-active sections and parser can distinguish one canonical owner.                                   | Duplicate ID appears in canonical ROADMAP or task-state in a way that makes identity ambiguous.                                                                  | Task IDs are stable and never reused; duplicate canonical IDs break evidence linkage.                         |
| Missing validation evidence          | Task not terminal or validation not yet required.                                         | Runtime task is `needs_validation`, or legacy evidence exists but is not V2-linked.                                        | Runtime `done` lacks passing validation evidence linked by task/run where required.                                                                              | `VERIFY.md` owns completion gates; no done-claim without required validation evidence.                        |
| Missing review evidence              | Human review not required or task not terminal.                                           | Review required but task is still `needs_review`, or review evidence is pending.                                           | Runtime `done` has `requires_human_review: true` without accepted review evidence.                                                                               | `.governance/REVIEW_POLICY.md` requires review acceptance before completion when review is required.          |
| Stale handoff                        | Handoff is historical and not used for current completion claims.                         | Latest handoff references an older task/run than current runtime snapshot, but no active/done claim depends on it.         | Current task/run completion depends on missing, mismatched, or stale handoff.                                                                                    | `.governance/RULES.md` requires handoff identity, changed files, validation result, risks, and review status. |
| Stale current-run                    | Terminal latest-run snapshot with inactive/absent legacy lock and coherent history.       | Completed/old snapshot remains in `runs/current-run.json` with ambiguous latest-vs-active semantics.                       | Active-like or locked run is expired, mismatched to task-state, or blocks safe next execution.                                                                   | `runs/current-run.json` owns active/latest run state; stale active locks are stop conditions.                 |
| Legacy artifacts                     | Present but clearly adapter-only and not used as authority.                               | Stale legacy artifact may confuse operators or parsers, e.g. old `.agent/out/selected-task.json`.                          | Legacy artifact is treated as current authority or conflicts with protected/safety policy.                                                                       | Legacy files are transition context only and must not override canonical state.                               |
| Legacy evidence schema               | Valid historical JSONL tolerated as audit evidence.                                       | Schema lacks V2 fields, causing partial parser confidence or weak linkage.                                                 | Malformed/unparseable evidence, duplicate evidence IDs, or legacy schema used to justify a current `done` claim without normalization.                           | Historical evidence is retained, but V2 completion proof requires reliable identity linkage.                  |

---

## 4. Status Mapping Model

### 4.1 Status vocabularies

ROADMAP statuses:

- `todo`
- `in_progress`
- `blocked`
- `done`

Runtime statuses:

- `not_started`
- `in_progress`
- `needs_validation`
- `needs_review`
- `blocked`
- `failed`
- `done`
- `skipped`
- `cancelled`

### 4.2 Recommended compatibility mapping

| ROADMAP status | Compatible runtime status                                                                                          | Drift / incompatible runtime status                                                                                             | Rationale                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `todo`         | `not_started`, optionally `skipped`/`cancelled` when explicitly human-classified                                   | `in_progress`, `needs_validation`, `needs_review`, `done`, `failed` unless clearly documented as runtime-only/historical        | ROADMAP says planned but not started; active or terminal runtime state needs planning reconciliation.  |
| `in_progress`  | `in_progress`, `needs_validation`, `needs_review`, optionally `blocked` when active work is blocked                | `not_started`, `done`, `skipped`, `cancelled`, `failed` without ROADMAP update                                                  | Runtime can be more specific than ROADMAP active work. Terminal runtime states need ROADMAP alignment. |
| `blocked`      | `blocked`, optionally `failed` if human accepted failure as blocker                                                | `not_started`, `in_progress`, `needs_validation`, `needs_review`, `done`, `skipped`, `cancelled` unless explicitly reclassified | ROADMAP blocked means work should not actively proceed until unblocked.                                |
| `done`         | `done`, optionally `skipped`/`cancelled` only if ROADMAP has been explicitly superseded by human planning decision | `not_started`, `in_progress`, `needs_validation`, `needs_review`, `blocked`, `failed`                                           | ROADMAP done must not coexist with active/incomplete runtime state.                                    |

### 4.3 Runtime terminal states and ROADMAP meaning

- Runtime `done` should align to ROADMAP `done` for `roadmap_backed` tasks after validation and review evidence exists.
- Runtime `skipped` and `cancelled` do not mean ROADMAP `done`; they require human planning decision if the ROADMAP task remains planned.
- Runtime `failed` does not mean ROADMAP `blocked` automatically, but it is usually incompatible with ROADMAP `in_progress` unless the next action is a retry or remediation.
- Runtime `needs_validation` and `needs_review` are compatible refinements of ROADMAP `in_progress`, not ROADMAP statuses.

### 4.4 Drift definition

A status pair is drift when:

1. The pair is not listed as compatible above.
2. The task is `roadmap_backed` and both authorities claim different lifecycle phases.
3. A terminal claim lacks required validation/review evidence.
4. A runtime active state exists while ROADMAP says `todo`, `blocked`, or `done` without an explicit documented exception.

---

## 5. Reconciler Test Matrix

These are candidate test cases for future reconciler implementation. They are examples only; RALPH-015 does not implement them.

| Case                                 | Example setup                                                                                                                 | Expected ownership class               | Expected severity | Reason                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| Valid `roadmap_backed` task          | ROADMAP `RALPH-016` is `in_progress`; task-state `RALPH-016` is `needs_validation`; validation pending.                       | `roadmap_backed`                       | `info`            | Runtime is a compatible refinement of ROADMAP active work.                                       |
| Valid `runtime_only` task            | Task-state `RALPH-016A-FIX` exists with explicit `runtime_only: true`; no ROADMAP entry; validation/review evidence coherent. | `runtime_only`                         | `info`            | Runtime-only classification explains missing ROADMAP entry.                                      |
| Valid `roadmap_only` task            | ROADMAP `P2-003` is `todo`; no task-state entry.                                                                              | `roadmap_only`                         | `info`            | Normal planned backlog not yet imported into runtime execution state.                            |
| Duplicate task ID                    | ROADMAP contains two canonical `P0-002` sections or task-state has duplicate `RALPH-016` objects.                             | Ambiguous / invalid canonical identity | `critical`        | Duplicate canonical IDs break stable identity and evidence linkage.                              |
| Runtime done without validation      | Task-state `RALPH-016` is `done`; no passing validation record for matching task/run.                                         | `roadmap_backed` or `runtime_only`     | `critical`        | Done claim violates `VERIFY.md` completion gate.                                                 |
| Runtime done without accepted review | Task-state `RALPH-016` is `done`, `requires_human_review: true`; no accepted review evidence.                                 | `roadmap_backed` or `runtime_only`     | `critical`        | Done claim violates human review gate.                                                           |
| ROADMAP done while runtime active    | ROADMAP `RALPH-016` is `done`; task-state `RALPH-016` is `in_progress` or `needs_review`.                                     | `roadmap_backed`                       | `critical`        | Planning says complete while runtime says incomplete/active; must stop for human reconciliation. |

---

## 6. Candidate Implementation Boundaries

### 6.1 Belongs in RALPH-016

RALPH-016 should be limited to reconciler/parser classification implementation if approved by a future task. Candidate scope:

- Add ownership classification as read-only reconciler output.
- Introduce classification labels: `roadmap_backed`, `runtime_only`, `roadmap_only`, `historical`, `legacy`.
- Refine severity assignment according to this document.
- Improve parser disambiguation only as needed to classify ownership safely.
- Add dry-run/machine-readable output fields for ownership and severity.
- Add tests/fixtures for the reconciler classification matrix.

RALPH-016 should remain read-only unless explicitly expanded by human approval.

### 6.2 Belongs in RALPH-017

RALPH-017 should cover evidence normalization or reconciliation workflow planning after classification exists. Candidate scope:

- Define or implement human-approved evidence backfill/linkage workflows.
- Normalize legacy evidence schema handling where classification has shown parser ambiguity.
- Add review/validation evidence linkage policies for historical tasks.
- Propose human-approved import/update actions without executing them automatically.
- Integrate ownership findings into morning-review or handoff summaries if approved.

RALPH-017 should not silently repair state; any append/write behavior requires explicit allowed files and human approval.

### 6.3 Out of scope

The following must remain out of scope for RALPH-015 and should not be introduced implicitly by RALPH-016/017 unless explicitly tasked:

- Modifying `ROADMAP.md`.
- Modifying `tasks/`, `runs/`, `validation/`, or `review/` state/evidence.
- Changing reconciler behavior during RALPH-015.
- Automatic repair logic.
- Automatic ROADMAP imports.
- Automatic runtime status updates.
- Migration execution.
- Rewriting historical JSONL evidence.
- Treating legacy artifacts as canonical authority.
- Product code changes.
- Dependency changes.
- Commits or pushes.

---

## 7. Consistency Review

This document is consistent with:

- `SSOK.md`: keeps ROADMAP as planning authority, runtime state as execution authority, and evidence as audit/proof rather than current planning truth.
- `AGENTS.md`: respects Ralph-Loop safety, one-task scope, allowed-file boundaries, and stop-for-review behavior.
- `.governance/SYSTEM.md`: preserves lifecycle gates and stop conditions, especially human review and stale active-run handling.
- `.governance/RULES.md`: preserves one-task-per-run discipline, handoff requirements, no unrelated cleanup, and no product-code changes for documentation tasks.
- `.governance/SAFETY.md`: does not modify protected files, dependencies, runtime state, secrets, or external systems.
- `.governance/REVIEW_POLICY.md`: treats human review as required before further autonomous continuation and does not auto-accept changes.
- `VERIFY.md`: treats this as documentation/governance-only work with required git readback checks, not full product runtime verification.

---

## 8. Changed Files for RALPH-015

- `reports/RALPH-015_RECONCILIATION_OWNERSHIP_CLASSIFICATION.md` — Added this governance ownership classification document.
- `handoffs/latest-handoff.md` — Updated separately with the RALPH-015 handoff.

---

## 9. Human Review Gate

Human review is required before any follow-up implementation task changes reconciler behavior, parser behavior, runtime state, validation evidence, review evidence, or migration logic.
