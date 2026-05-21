# Executive Summary

This analysis defines a concrete contract between **planning state** and **runtime execution state** for task **CLINE-GOV-004**.

Key conclusion:

- **`ROADMAP.md` is the planning authority (what should exist, priority, lifecycle intent).**
- **Runtime files (`tasks/task-state.json`, `runs/current-run.json`) are execution authority (what is currently assigned/executing), but only when consistent with planning authority or explicitly mapped governance runtime streams.**
- **History files (`tasks/task-history.jsonl`, `runs/run-history.jsonl`) are evidence/audit artifacts, not authority for current truth.**
- **`validation/validation-rules.json` is policy metadata authority for runtime validation behavior and must reference `VERIFY.md` for canonical verification decisions.**

Current state is functional but ambiguous in conflict cases. This report proposes deterministic resolution rules to remove ambiguity across:

- planned work
- assigned work
- executing work
- completed work
- historical evidence


# Runtime Artifact Inventory

Runtime artifacts requested were present and inspected:

- `tasks/task-state.json`
- `tasks/task-history.jsonl`
- `runs/current-run.json`
- `runs/run-history.jsonl`
- `validation/validation-rules.json`

Planning authority artifact inspected:

- `ROADMAP.md`


# Planning vs Runtime State Matrix

| Artifact | Primary Purpose | State Domain | Typical Time Horizon | Current Authority Level | Notes |
|---|---|---|---|---|---|
| **A) `ROADMAP.md`** | Canonical planning/task ledger (IDs, status, priorities, DoD intent) | Planned + officially completed work | Long-lived / strategic | **High (planning SSOK)** | Explicitly declared SSOK in `ROADMAP.md` and `AGENTS.md` |
| **B) `tasks/task-state.json`** | Structured runtime task machine (execution metadata, allowed/forbidden files, validation profile) | Assigned/executable task state | Medium-lived / operational | **Medium-High (runtime projection)** | Contains explicit note that ROADMAP remains source of truth |
| **C) `runs/current-run.json`** | Active (or last) run assignment and execution envelope | Current assigned/executing run | Short-lived / immediate | **Medium (ephemeral runtime authority)** | Must never override planning truth; currently can point to closeout IDs not in roadmap |
| **D) `tasks/task-history.jsonl`** | Task transition/event log | Historical task evidence | Append-only historical | **Low (evidence only)** | Useful for audit, not authoritative for current status |
| **E) `runs/run-history.jsonl`** | Run-level execution history | Historical run evidence | Append-only historical | **Low (evidence only)** | Includes operational events, smoke tests, closeouts |
| **F) `validation/validation-rules.json`** | Runtime validation policy metadata and conditional checks | Validation behavior contract | Medium-lived governance/runtime | **Medium-High (runtime validation policy)** | Declares `VERIFY.md` reference; should not redefine conflicting verify authority |


# Authority Ownership Matrix

| Artifact | Purpose | Authority Type | Data Owner | Update Mechanism | Authoritative vs Derivative | Agent Writable? | Human Editable? | Failure Modes |
|---|---|---|---|---|---|---|---|---|
| **A) ROADMAP.md** | Task canon, planning status, priorities | Planning authority | Human governance/product owner (agents under explicit task scope) | Manual governance updates tied to task lifecycle | **Authoritative** | **Yes, but only when explicitly tasked** | **Yes (primary)** | Drift from runtime; stale status; missing runtime-executed IDs; contradictory status vs evidence |
| **B) task-state.json** | Runtime state machine for tasks | Runtime execution authority (bounded by roadmap contract) | Runtime orchestrator/governance layer | Structured updates by runtime selector/agents | **Derivative from planning + enriched runtime metadata** | **Yes, for runtime operations** | **Yes, with care** | Status vocabulary drift (`todo` vs `not_started` etc.); runtime-only tasks not mapped to roadmap; stale active states |
| **C) current-run.json** | Selected current/last run | Immediate execution authority | Runtime selector/orchestrator | Overwritten per run lifecycle | **Derivative/ephemeral** | **Yes, operationally required** | **Yes (recovery/repair)** | Points to non-existent/completed task; stale run lock; conflicting task IDs (`selected_task_id` variants seen historically) |
| **D) task-history.jsonl** | Task event audit trail | Evidence authority | Runtime execution logger | Append-only JSONL events | **Derivative evidence** | **Yes (append only)** | **Yes (repair only, exceptional)** | Contradictory events, missing transition events, malformed JSONL, retroactive edits breaking audit trust |
| **E) run-history.jsonl** | Run event audit trail | Evidence authority | Runtime execution logger | Append-only JSONL events | **Derivative evidence** | **Yes (append only)** | **Yes (repair only, exceptional)** | Orphan run events, unknown task IDs, incomplete run lifecycle, malformed JSONL |
| **F) validation-rules.json** | Runtime validation policy map | Policy metadata authority | Governance maintainers | Controlled governance edits | **Authoritative for runtime validation metadata; derivative of VERIFY for verify semantics** | **Yes, only in governance tasks** | **Yes (primary)** | Divergence from VERIFY.md canonical decision model; over-restrictive/under-restrictive rules; stale file patterns |


# Conflict Scenario Matrix

| Scenario | Current Behavior (Observed/Implied) | Risk | Recommended Resolution Rule |
|---|---|---|---|
| **1) ROADMAP says `done`, runtime says `in_progress`** | Possible due to stale runtime state or incomplete closeout | False active work, accidental re-execution, human confusion | **ROADMAP status wins for completion truth.** Runtime must be reconciled: set runtime task to terminal non-active state and append repair event to histories. |
| **2) ROADMAP says `in_progress`, runtime says `done`** | Can occur if runtime closeout happened but roadmap not updated | Undocumented completion, governance non-compliance (`done` claim mismatch) | **ROADMAP remains official completion authority**; treat runtime `done` as provisional evidence. Require roadmap update + validation evidence before accepted completion. |
| **3) Runtime references task not present in roadmap** | Seen with `RALPH-*`/closeout streams not mirrored in roadmap | Split universe of tasks; audit and prioritization ambiguity | Allow only if task is in an **explicitly whitelisted runtime-governance namespace** (e.g., `RALPH-*`, `CLINE-REAL-*`, closeouts) with mapping/index policy; otherwise block as invalid reference. |
| **4) task-history contradicts roadmap** | Historical logs may show completion/state transitions not reflected in roadmap | Audit reliability degradation; impossible “true status” decisions | Current status authority = roadmap; history is evidence. Trigger **consistency repair protocol**: investigate, then append corrective history event (no silent rewrite). |
| **5) current-run references completed task** | `current-run.json` currently stores completed closeout record | Selector may think run still active or re-run completed scope | Enforce run validity check: if selected task terminal/completed, mark run terminal and require new selection before execution. Never execute against terminal task without explicit reopen event. |
| **6) orphan runtime records** (history entries without matching task-state/roadmap context) | Present risk in manual/state-fix operations | Broken traceability and forensic gaps | Require **orphan classification**: `known_legacy`, `state_repair`, or `invalid`. Invalid orphans block autonomous progression until human review. |


# Recommended Runtime Contract

## 1) State role separation

- **Planning truth:** `ROADMAP.md`
- **Runtime execution truth (current run/task machine):** `tasks/task-state.json`, `runs/current-run.json`
- **Historical evidence:** `tasks/task-history.jsonl`, `runs/run-history.jsonl`
- **Validation policy metadata:** `validation/validation-rules.json` (with `VERIFY.md` as verification authority)

## 2) Authoritative boundaries

1. Runtime may select/execute only tasks that are:
   - present in roadmap, **or**
   - present in approved runtime-governance namespace with explicit mapping contract.
2. Runtime status cannot independently assert official completion if roadmap does not reflect completion semantics.
3. History cannot override current state; it can only justify reconciliation.

## 3) Write permissions model

- `ROADMAP.md`: human-led canonical planning ledger; agent writes only when task explicitly authorizes status update.
- `task-state.json` + `current-run.json`: runtime writable by agents/tools as part of loop execution.
- `*.jsonl` histories: append-only by runtime processes; corrective entries allowed, destructive rewrites disallowed.
- `validation-rules.json`: governance-edit only; runtime should read, not mutate.


# Recommended State Hierarchy

Deterministic hierarchy for decision conflicts:

1. **Safety policy** (`.governance/SAFETY.md`) and protected file constraints
2. **Canonical domain authority**
   - planning/status: `ROADMAP.md`
   - verification decisions: `VERIFY.md`
3. **Ralph operational governance** (`.governance/SYSTEM.md`, `RULES.md`, `REVIEW_POLICY.md`)
4. **Runtime execution state** (`tasks/task-state.json`, `runs/current-run.json`)
5. **Historical evidence** (`tasks/task-history.jsonl`, `runs/run-history.jsonl`)
6. **Adapter-specific operational guidance** (e.g., `.agent/adapters/*`, docs)


# Proposed Resolution Rules

## Rule R1 — Planning/Runtime tie-break

When roadmap and runtime disagree on lifecycle completion, **roadmap is official planning status authority**; runtime is reconciled to roadmap through explicit repair entries.

## Rule R2 — Runtime eligibility gate

A runtime selection is valid only if task ID is:

- roadmap-declared, or
- in approved governance-runtime namespace with explicit canonical mapping.

Otherwise: block execution and require human review.

## Rule R3 — Current-run freshness

Before any execution, verify `current-run.json` does not reference terminal/completed task state unless explicitly reopened.

## Rule R4 — History immutability preference

History files are append-only evidence. Corrections are additive events (`state_repaired`, `reconciled`, etc.), not silent rewrites.

## Rule R5 — Verification authority containment

`validation/validation-rules.json` may operationalize validation flows, but in verify decision conflicts, `VERIFY.md` is canonical.

## Rule R6 — Orphan handling

Any orphan runtime record must be tagged and resolved before autonomous continuation:

- `known_legacy` (accepted)
- `state_repair` (accepted with rationale)
- `invalid` (blocking)

## Rule R7 — Completion assertion rule

No “task done” claim is final unless required validation evidence exists per `VERIFY.md` and planning status is synchronized.


# Migration Impact

If adopted, this contract will:

1. **Remove status ambiguity** between roadmap and runtime state.
2. **Preserve runtime agility** while keeping roadmap as planning SSOK.
3. **Improve auditability** by classifying history as evidence, not mutable truth.
4. **Reduce governance drift risk** by separating validation policy metadata from canonical verification authority.
5. **Support transition reality** (RALPH/CLINE governance streams) through explicit namespace rules instead of implicit exceptions.

Primary implementation impact for follow-up work:

- introduce a formal mapping/index rule for non-roadmap runtime task namespaces,
- enforce pre-run consistency checks,
- define reconciliation event taxonomy in history artifacts.


# Inputs For GOV-005

Recommended next governance task: **CLINE-GOV-005** should formalize and enforce the contract above.

Suggested GOV-005 inputs from this analysis:

1. Adopt the **state hierarchy** and **R1-R7 rules** as normative contract text.
2. Define accepted runtime namespaces and mapping requirements.
3. Add deterministic consistency checks for:
   - roadmap vs task-state,
   - task-state vs current-run,
   - current-run vs histories.
4. Define “state repair protocol” and allowed event types.
5. Add orphan-record detection/reporting as a blocking governance check.