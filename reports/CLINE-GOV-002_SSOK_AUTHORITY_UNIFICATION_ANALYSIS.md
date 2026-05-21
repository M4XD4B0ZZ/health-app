# Executive Summary

This analysis resolves governance authority ambiguity for **CLINE-GOV-002** by mapping where authority is explicitly declared, where it is implied by runtime behavior, and where contradictions currently exist.

Core finding: authority is currently split between a **legacy Roo-first model** and a **transitioning Ralph repository-first model**, with unresolved overlap in `SSOK.md` and secondary drift across adapter/setup docs.

Recommended outcome:

1. Establish a **single active authority hierarchy** for Ralph-governed work.
2. Keep legacy Roo governance as **explicitly scoped legacy context**, not co-equal authority.
3. Define deterministic conflict resolution rules that prioritize:
   - repository governance contracts,
   - then runtime assignment/state artifacts,
   - then adapter execution rules.

Safest hierarchy principle: **policy authority and runtime authority must be separated**.
- Policy answers “what is allowed and required.”
- Runtime state answers “what is currently assigned/selected/executed.”


# Current Authority Sources

## Core Governance Sources (read)

- `SSOK.md`
- `ROADMAP.md`
- `AGENTS.md`
- `VERIFY.md`

## Ralph Governance Sources (read)

- `.governance/SYSTEM.md`
- `.governance/RULES.md`
- `.governance/SAFETY.md`
- `.governance/REVIEW_POLICY.md`

## Cline Governance Sources (read)

- `.agent/adapters/cline.md`
- `docs/CLINE_RALPH_WORKER_SETUP.md`
- `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`

## Governance Inventory Source (read)

- `reports/CLINE-GOV-001_GOVERNANCE_INVENTORY_REPORT.md`

## Additional runtime artifacts referenced by these sources

- `tasks/task-state.json`
- `tasks/task-history.jsonl`
- `runs/current-run.json`
- `runs/run-history.jsonl`
- `validation/validation-rules.json`


# Authority Conflict Matrix

| Area | Current authority claims | Conflict | Risk |
|---|---|---|---|
| Repository governance | `SSOK.md` transition says repository-first emerging; legacy section says “Roo ist die operative SSOK” | Dual top-level authority in one canonical file | High |
| Task planning | `ROADMAP.md` says SSOK for tasks/decisions; Ralph runtime references `tasks/task-state.json` and `runs/current-run.json` for operational execution | Planning SSOK vs runtime selection source not explicitly unified | High |
| Runtime execution state | `.governance/*`, `AGENTS.md`, adapter docs point to runtime files for selected/current run | No contradiction on existence; contradiction on precedence against ROADMAP when mismatch occurs | Medium-High |
| Verification decisions | `VERIFY.md` canonical; `AGENTS.md` repeats strict sequence; adapter docs add docs-only guidance | Minor semantic drift (“never skip” vs docs-only minimal checks) | Medium |
| Safety decisions | `.governance/SAFETY.md` explicit policy; `AGENTS.md` references SAFETY + protected-files; adapter/setup restate restrictions | Mostly aligned; duplication can drift | Medium |
| Tool authority | `.governance/RULES.md`, `AGENTS.md`, `SSOK.md` transition: tools are adapters | Legacy Roo-first wording in `SSOK.md` can be read as conflicting | High |


# Recommended Authority Hierarchy

Recommended canonical hierarchy for Ralph-governed execution:

1. **Repository Governance Constitution (Policy Layer)**
   - `SSOK.md` (after unification)
   - `AGENTS.md`
2. **Domain-specific Canonical Contracts**
   - Task planning/status contract: `ROADMAP.md`
   - Verification contract: `VERIFY.md`
   - Ralph operational governance: `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md`, `.governance/REVIEW_POLICY.md`
3. **Runtime Assignment/State (Execution Layer)**
   - `runs/current-run.json` (active assignment)
   - `tasks/task-state.json` (task machine state)
   - `runs/run-history.jsonl`, `tasks/task-history.jsonl`, `validation/validation-rules.json` (trace + enforcement metadata)
4. **Adapter/Worker Execution Rules**
   - `.agent/adapters/cline.md`
5. **Operational Guides / Checklists (Non-authoritative)**
   - `docs/CLINE_RALPH_WORKER_SETUP.md`
   - `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`
6. **Legacy Roo Artifacts (Scoped Legacy Authority)**
   - `.roo/`, `.roomodes` only where explicitly declared during transition and only when not in conflict with Ralph-governed task policy.


# Repository Governance Authority

## 1) Current authority chain

- `AGENTS.md` defers to `SSOK.md` for overarching governance.
- `SSOK.md` contains both:
  - transition repository-first/tool-neutral hierarchy, and
  - legacy Roo-first operational SSOK assertion.
- `.governance/SYSTEM.md` positions `.governance/` as transition layer alongside root files.

## 2) Existing contradictions

- `SSOK.md` has unresolved dual-authority language:
  - transition direction: repository-first, tool-neutral
  - legacy assertion: Roo operative SSOK

## 3) Recommended authority chain

1. `SSOK.md` as singular constitution of governance hierarchy.
2. `AGENTS.md` as cross-agent operating contract constrained by SSOK.
3. `.governance/*` as Ralph-mode operational policy specialization.
4. Tool adapters as implementation details.

## 4) Why this is safest

- Prevents tool-specific takeover of policy.
- Preserves one clear top authority for audit/review.
- Enables migration without policy ambiguity.


# Task Authority

## 1) Current authority chain

- `ROADMAP.md`: SSOK for tasks, epics, decisions, statuses.
- `AGENTS.md` requires task IDs from ROADMAP.
- Ralph artifacts (`tasks/task-state.json`, `runs/current-run.json`) govern runtime selection/assignment.

## 2) Existing contradictions

- ROADMAP is declared SSOK for tasks/decisions, while runtime executes tasks that may exist as runtime IDs/streams not clearly mirrored in ROADMAP.
- No explicit tie-break rule when runtime state and roadmap status diverge.

## 3) Recommended authority chain

1. `ROADMAP.md` = canonical planning ledger and status truth.
2. `tasks/task-state.json` = runtime orchestration projection of roadmap tasks (or formally mapped governance tasks).
3. `runs/current-run.json` = immediate execution assignment only.
4. Histories (`task-history.jsonl`, `run-history.jsonl`) = audit evidence, not planning authority.

## 4) Why this is safest

- Maintains human-readable strategic truth in one place.
- Allows deterministic runtime execution without replacing planning SSOK.
- Avoids silent drift between “planned” and “executed.”


# Runtime Authority

## 1) Current authority chain

- `.governance/SYSTEM.md` and adapter docs direct workers to runtime files.
- `runs/current-run.json` is the active task assignment artifact.
- `tasks/task-state.json` is task machine state for runtime rules.

## 2) Existing contradictions

- Runtime authority is clear operationally, but precedence vs ROADMAP is not consistently formalized.

## 3) Recommended authority chain

1. `runs/current-run.json` controls **what to execute now**.
2. `tasks/task-state.json` controls **state transitions and guardrails**.
3. `ROADMAP.md` constrains runtime validity (**runtime must not violate roadmap contract**).

## 4) Why this is safest

- Supports deterministic one-task-per-run behavior.
- Keeps runtime fast and machine-usable while preserving strategic governance guardrails.


# Verification Authority

## 1) Current authority chain

- `VERIFY.md` declares canonical verification commands and DoD semantics.
- `AGENTS.md`, `.governance/RULES.md`, and adapter docs echo verification constraints.

## 2) Existing contradictions

- Minor wording drift:
  - strict “do not skip” language,
  - vs docs-only allowance of git readback checks.

## 3) Recommended authority chain

1. `VERIFY.md` is sole canonical verification decision authority.
2. `AGENTS.md` references VERIFY without redefining decision semantics.
3. `.governance/*` and adapter/docs reference VERIFY by pointer.

## 4) Why this is safest

- Eliminates ambiguous completion claims.
- Centralizes verification evolution in one file.
- Minimizes policy drift across duplicated operational docs.


# Safety Authority

## 1) Current authority chain

- `.governance/SAFETY.md` provides explicit protected files, forbidden actions, and stop rules.
- `AGENTS.md` requires SAFETY compliance and protected files compliance.
- Adapter/setup/checklist docs restate safety constraints.

## 2) Existing contradictions

- No major direct contradiction; primary issue is duplicated policy text across adapter/docs with drift potential.

## 3) Recommended authority chain

1. `.governance/SAFETY.md` is canonical safety policy.
2. `.agent/config/protected-files.json` is technical enforcement list aligned to SAFETY.
3. `AGENTS.md` references SAFETY as binding.
4. Adapter/docs summarize and link, but do not redefine.

## 4) Why this is safest

- Keeps strict controls centralized.
- Reduces accidental relaxations in secondary docs.
- Makes safety review deterministic and auditable.


# Proposed Conflict Resolution Rules

When governance sources disagree, apply this deterministic resolution order:

1. **Safety first**
   - `.governance/SAFETY.md` overrides all conflicting operational instructions.
2. **Canonical domain contract next**
   - Task planning conflict → `ROADMAP.md`
   - Verification conflict → `VERIFY.md`
   - Cross-agent governance conflict → `AGENTS.md` (constrained by SSOK)
3. **Ralph operational policy next**
   - `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/REVIEW_POLICY.md`
4. **Runtime assignment/state next**
   - `runs/current-run.json`, `tasks/task-state.json` for current execution behavior
5. **Adapter rules next**
   - `.agent/adapters/cline.md`
6. **Guides/checklists last**
   - `docs/CLINE_*` files are explanatory, not policy-authoritative
7. **Legacy Roo fallback only if explicitly scoped**
   - `.roo/` and `.roomodes` only where transition scope explicitly says so and no higher-layer conflict exists.

Tie-break meta-rule:

- If two same-level sources conflict, prefer:
  1) newest explicitly versioned governance decision,
  2) then stricter safety-preserving interpretation,
  3) then stop and request human review.


# Migration Impact

## Immediate impact if hierarchy is adopted

- Clarifies that policy authority is repository-first and adapter-neutral.
- Removes ambiguity in task execution when roadmap/runtime diverge.
- Prevents verification argument conflicts for docs-only tasks.
- Reduces risk of unsafe interpretation from duplicated adapter/setup text.

## Operational impact

- Workers can make deterministic decisions without chat-memory dependence.
- Human review can audit decisions against a single authority chain.
- Future governance cleanup becomes mechanical (deduplicate by pointer to canonical owner).

## Risk reduction

- High-risk ambiguity in `SSOK.md` dual model is neutralized by explicit hierarchy.
- Governance drift across many duplicated docs is controlled by canonical ownership.


# Recommended GOV-003 Inputs

For **CLINE-GOV-003**, use this analysis as input and implement the following specification targets:

1. **Verification Canonicalization Table**
   - Add explicit decision matrix in `VERIFY.md` for:
     - docs/governance-only,
     - runtime-state-only,
     - product/runtime code,
     - edge/supabase modifications.

2. **Reference-only propagation rule**
   - In `AGENTS.md`, `.governance/RULES.md`, adapter/setup docs:
     - replace duplicated verify semantics with references to `VERIFY.md`.

3. **Conflict-resolution insertion point**
   - Add concise “when sources disagree” section in `SSOK.md` using recommended hierarchy from this report.

4. **ROADMAP ↔ runtime consistency note (prepare GOV-004)**
   - Add explicit statement that runtime state is execution projection and must remain roadmap-consistent.

5. **Safety canonical pointer hardening**
   - Ensure secondary docs reference `.governance/SAFETY.md` instead of restating full policy blocks where possible.
