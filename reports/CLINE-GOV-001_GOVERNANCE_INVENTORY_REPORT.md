# Executive Summary

This report inventories current governance rules, identifies duplication/contradictions, and analyzes drift between implemented governance work and `ROADMAP.md`.

High-level outcome:

- Governance is **rich but fragmented** across root docs, Ralph-Loop docs, adapter docs, and legacy Roo references.
- Several rule families are intentionally duplicated for operational visibility, but some duplications are now drifting.
- There are material contradictions in authority hierarchy, verification semantics, and push/deployment expectations.
- Governance work has been executed (RALPH-* and CLINE-REAL/OPS streams) that is **not reflected as task records in `ROADMAP.md`**.

# Governance Sources

Primary sources reviewed for this task:

1. `ROADMAP.md`
2. `AGENTS.md`
3. `VERIFY.md`
4. `SSOK.md`
5. `.governance/SYSTEM.md`
6. `.governance/RULES.md`
7. `.governance/SAFETY.md`
8. `.governance/REVIEW_POLICY.md`
9. `.agent/adapters/cline.md`
10. `docs/CLINE_RALPH_WORKER_SETUP.md`
11. `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`

Operational evidence sources reviewed:

12. `reports/CLINE-REAL-002_GOVERNANCE_CONSISTENCY_AUDIT_REPORT.md`
13. `reports/CLINE-REAL-003_READ_ONLY_VERIFICATION_AUDIT_REPORT.md`
14. `reports/CLINE-REAL-004_CONTROLLED_DOCUMENTATION_EDIT_REPORT.md`
15. `reports/CLINE-REAL-005_CONTROLLED_RUNTIME_READBACK_TEST_REPORT.md`
16. `reports/CLINE-REAL-006_PRODUCT_CODE_READ_ONLY_DIAGNOSTIC_REPORT.md`
17. `reports/CLINE-REAL-007_ZERO_MACRO_REGRESSION_TEST_REPORT.md`
18. `reports/CLINE-REAL-008_UNIT_PORTION_REGRESSION_TEST_REPORT.md`
19. `reports/CLINE-REAL-009_DEFAULT_PORTION_REGRESSION_TEST_REPORT.md`
20. `reports/CLINE-REAL-010_QUANTITY_DEFAULT_PORTION_REGRESSION_TEST_REPORT.md`
21. `reports/CLINE-REAL-011_RESOLVER_FAILURE_PATH_MATRIX_REPORT.md`
22. `reports/morning-review.md`
23. `handoffs/latest-handoff.md`
24. `tasks/task-history.jsonl`
25. `runs/run-history.jsonl`

Discovery note for requested IDs:

- Explicit standalone documents for `CLINE-OPS-001` and `CLINE-OPS-002` were not found in current repository report/handoff files.
- `CLINE-OPS-003` and `CLINE-OPS-004` are represented through policy sections in governance/adapter documents.
- `CLINE-REAL-001` evidence was found in `reports/morning-review.md` and `runs/run-history.jsonl`; `CLINE-REAL-002` through `CLINE-REAL-011` were found as dedicated report files.

# Rule Inventory

## A) Command execution rules

### Rule: One-command-per-execution (PowerShell-safe isolation)
- **Description:** Terminal commands must be short, isolated, and not chained.
- **Canonical location (recommended):** `.agent/adapters/cline.md` (Cline execution contract)
- **Duplicate locations:** `docs/CLINE_RALPH_WORKER_SETUP.md`, `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`
- **Duplication type:** Intentional (operational safety), but high drift risk.

### Rule: No chained separators (`&&`, `||`, `;`, `|`, etc.)
- **Description:** Explicitly forbidden command chaining and compound shell execution.
- **Canonical location (recommended):** `.agent/adapters/cline.md`
- **Duplicate locations:** same as above
- **Duplication type:** Intentional.

### Rule: Git no-pager reliability
- **Description:** Use `git --no-pager` for read-only inspection to avoid pager hangs.
- **Canonical location (recommended):** `.agent/adapters/cline.md`
- **Duplicate locations:** setup/checklist docs
- **Duplication type:** Intentional.

## B) Verification rules

### Rule: Verification SSOK and command order
- **Description:** Core verification stack is lint → typecheck → verify → verify:edge.
- **Canonical location:** `VERIFY.md`
- **Duplicate locations:** `AGENTS.md`, `SSOK.md`, `.governance/RULES.md`, `.governance/SYSTEM.md`, adapter/setup docs
- **Duplication type:** Mostly intentional; semantic drift present.

### Rule: Docs-only verification path
- **Description:** For documentation/governance-only tasks, git readback checks are allowed.
- **Canonical location:** `VERIFY.md`
- **Duplicate locations:** `.agent/adapters/cline.md`, setup/checklist docs, CLINE-REAL reports
- **Duplication type:** Intentional after CLINE-REAL-004 clarification.

## C) Dependency safety rules

### Rule: CLINE-OPS-003 dependency command safety
- **Description:** `npm install` only when needed; `npm audit` read-only; `npm audit fix` approval required; `npm audit fix --force` forbidden unless dedicated migration task; lockfile/package changes out of scope unless explicitly allowed.
- **Canonical location (recommended):** `AGENTS.md` + `VERIFY.md` (root governance)
- **Duplicate locations:** `.agent/adapters/cline.md`, setup/checklist docs
- **Duplication type:** Intentional (cross-surface safety propagation).

## D) Protected file rules

### Rule: Absolute/conditional protected files
- **Description:** `.env*`, secrets, credentials, `.git`, dependency files, migrations, etc. protected by policy with strict/conditional constraints.
- **Canonical location:** `.governance/SAFETY.md`
- **Duplicate locations:** `AGENTS.md` (references), `.agent/adapters/cline.md` (summaries), setup/checklist docs
- **Duplication type:** Intentional abstraction; should remain referenced, not redefined deeply.

## E) Handoff rules

### Rule: Mandatory handoff and evidence
- **Description:** Every run/task must produce clear handoff, including changes, rationale, checks, risks.
- **Canonical location:** `SSOK.md` (handoff contract) + `.governance/RULES.md`
- **Duplicate locations:** `.governance/SYSTEM.md`, `.governance/REVIEW_POLICY.md`, `.agent/adapters/cline.md`, setup docs
- **Duplication type:** Intentional, but too verbose across layers.

## F) Review gate rules

### Rule: Stop for human review after task
- **Description:** One task then mandatory human review; no autonomous continuation.
- **Canonical location:** `.governance/SYSTEM.md`, `.governance/REVIEW_POLICY.md`
- **Duplicate locations:** `AGENTS.md`, `.governance/RULES.md`, `.agent/adapters/cline.md`, setup/checklist docs
- **Duplication type:** Intentional.

## G) Task execution rules

### Rule: Exactly one task per run
- **Description:** Scope-bounded single-task execution.
- **Canonical location:** `.governance/RULES.md`
- **Duplicate locations:** `AGENTS.md`, `.governance/SYSTEM.md`, adapter/setup docs
- **Duplication type:** Intentional.

### Rule: Task registry expectations
- **Description:** Work must follow declared task source and state model.
- **Canonical location (currently conflicting):** `ROADMAP.md` and `tasks/task-state.json` split model
- **Duplicate locations:** `AGENTS.md`, `.governance/*`, adapter docs
- **Duplication type:** Accidental ambiguity.

## H) Stop conditions

### Rule: Immediate stop on safety/ambiguity/validation/scope issues
- **Description:** Clear stop triggers for protected files, validation failures, ambiguous scope, repeated failures, etc.
- **Canonical location:** `.governance/SYSTEM.md` + `.governance/SAFETY.md`
- **Duplicate locations:** `AGENTS.md`, adapter/setup docs, checklist docs
- **Duplication type:** Intentional.

## I) Agent neutrality rules

### Rule: Tools are adapters, repository is source of truth
- **Description:** Roo/Cline/OpenCode/Codex are workers; governance files are authoritative.
- **Canonical location:** `SSOK.md` (transition section) + `.governance/RULES.md`
- **Duplicate locations:** `AGENTS.md`, `.governance/SYSTEM.md`, `.agent/adapters/cline.md`, setup docs
- **Duplication type:** Intentional, but contradicted by legacy wording.

## J) Ralph-Loop lifecycle rules

### Rule: Lifecycle (read governance → select one task → execute scoped work → validate → update state → stop)
- **Description:** End-to-end operating loop for Ralph-mode execution.
- **Canonical location:** `.governance/SYSTEM.md`
- **Duplicate locations:** `AGENTS.md` Ralph section, adapter/setup/checklist docs
- **Duplication type:** Intentional.

# Duplicate Rule Matrix

| Rule family | Primary source | Duplicates | Intentional? | Drift risk |
|---|---|---|---|---|
| Verification contract | `VERIFY.md` | `AGENTS.md`, `SSOK.md`, `.governance/*`, adapter/docs | Yes | High (wording differences) |
| Dependency safety (CLINE-OPS-003) | `AGENTS.md` + `VERIFY.md` | adapter/setup/checklist docs | Yes | Medium |
| Command isolation (CLINE-OPS-004) | `.agent/adapters/cline.md` | setup/checklist docs | Yes | Medium |
| Protected files | `.governance/SAFETY.md` | AGENTS/adapters/docs summaries | Yes | Medium |
| Stop conditions | `.governance/SYSTEM.md`/`SAFETY.md` | AGENTS/adapters/docs | Yes | Medium |
| Tool-neutral authority | `SSOK.md` transition + `.governance/RULES.md` | AGENTS/adapters | Yes | **High (internal contradiction in SSOK)** |
| Handoff contract | `SSOK.md` + `.governance/RULES.md` | REVIEW_POLICY/adapters/docs | Yes | Low-Medium |

# Contradiction Matrix

| ID | Topic | Source A | Source B | Contradiction |
|---|---|---|---|---|
| C-01 | Governance authority hierarchy | `SSOK.md` transition (repository-first/tool-neutral becoming authoritative) | `SSOK.md` legacy section (“Roo ist die operative SSOK”) | Dual authority model unresolved in one canonical text |
| C-02 | Verification strictness | `AGENTS.md` wording implies full sequence/no skipping | `VERIFY.md` allows docs-only minimal checks; `SSOK.md` relevant-check framing | Ambiguous completion criteria for non-runtime tasks |
| C-03 | Push behavior | Legacy Roo command flows include push workflow references | Ralph safety/governance forbids push in current governed runs | Operational conflict if operator follows wrong command family |
| C-04 | Task source of truth | `AGENTS.md` says every task references ROADMAP ID | Ralph runtime executes `RALPH-*` and CLINE-real runs via runtime state/history | ROADMAP vs runtime task registry boundary is unclear |

# Missing ROADMAP Entries

## Completed governance work not represented in `ROADMAP.md`

Based on `tasks/task-history.jsonl`, `runs/run-history.jsonl`, and reviewed reports, the following governance work streams are completed but not represented as explicit ROADMAP tasks:

1. **RALPH-001A .. RALPH-010A(+fix/closeout/state-fix/smoke)** governance lifecycle tasks
2. **CLINE-REAL-001** runtime review execution
3. **CLINE-REAL-002 .. CLINE-REAL-011** governance audits / controlled docs / runtime readback / regression governance evidence tasks
4. **CLINE-OPS-003 / CLINE-OPS-004** policy formalizations (dependency safety, command isolation) are reflected in docs but not clearly tracked as ROADMAP task IDs

## Governance tasks that should be added retroactively

- Retroactive ROADMAP entries (or a dedicated governance changelog index) for:
  - RALPH governance foundation series
  - CLINE-REAL governance hardening sequence
  - CLINE-OPS policy hardening items

## Governance tasks that appear obsolete

- No explicit obsolete completed tasks identified; however, **legacy-only Roo authority statements** in `SSOK.md` are transition-obsolete and should be retired or clearly marked historical.

## Governance tasks still open

- Governance cleanup tasks implied by contradictions remain open (authority resolution, verification wording unification, task-registry boundary definition, deconflicting push workflows for Ralph mode).

# Recommended Canonical Ownership

| Governance domain | Recommended canonical owner |
|---|---|
| Product/task planning and status | `ROADMAP.md` |
| Verification rules and decision table | `VERIFY.md` |
| Cross-agent operating principles | `AGENTS.md` |
| Ralph loop lifecycle/contracts | `.governance/SYSTEM.md` + `.governance/RULES.md` |
| Safety/protected files/forbidden actions | `.governance/SAFETY.md` |
| Review gates and acceptance policy | `.governance/REVIEW_POLICY.md` |
| Cline-specific terminal and adapter execution policy | `.agent/adapters/cline.md` |
| Setup/how-to guidance only | `docs/CLINE_RALPH_WORKER_SETUP.md`, `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` |

Ownership principle: root + `.governance/` define policy; adapter/docs should **reference**, not redefine.

# Proposed Governance Cleanup Plan

1. **Resolve authority contradiction in `SSOK.md`**
   - Keep one explicit active hierarchy, move legacy Roo wording to “historical transition context”.

2. **Publish one verification decision table in `VERIFY.md`**
   - Cases: docs-only, product-code, edge/supabase, runtime-state-only.
   - Replace ambiguous “never skip” phrasing elsewhere with references to this table.

3. **Formalize ROADMAP ↔ runtime task-state boundary**
   - Document: `ROADMAP.md` (planning SSOK) vs `tasks/task-state.json` (runtime orchestration state).

4. **Deconflict push workflows for Ralph-governed execution**
   - Explicitly mark legacy push flows as out-of-scope in Ralph mode.

5. **Deduplicate high-risk repeated policy blocks**
   - Keep full terminal policy only in `.agent/adapters/cline.md`; setup/checklist retain concise references.

6. **Add governance task indexing discipline**
   - Ensure completed governance workstreams are discoverable from ROADMAP (or canonical linked governance index).

# Recommended Next Governance Tasks

1. **CLINE-GOV-002: SSOK Authority Unification**
   - Remove/segregate contradictory authority language.

2. **CLINE-GOV-003: Verification Decision Table Canonicalization**
   - Add canonical matrix in `VERIFY.md`; harmonize references in `AGENTS.md` and adapter docs.

3. **CLINE-GOV-004: ROADMAP/Runtime Task Registry Contract**
   - Define explicit contract for ROADMAP IDs vs runtime `RALPH-*` execution state.

4. **CLINE-GOV-005: Legacy Push Workflow Guardrail**
   - Add explicit Ralph-mode prohibition markers where legacy push commands exist.

5. **CLINE-GOV-006: Governance Duplication Reduction Pass**
   - Convert repeated blocks in setup/checklists to canonical references.

6. **CLINE-GOV-007: Retroactive Governance Task Backfill**
   - Backfill ROADMAP (or canonical governance index) with completed RALPH/CLINE-REAL/CLINE-OPS streams for audit traceability.
