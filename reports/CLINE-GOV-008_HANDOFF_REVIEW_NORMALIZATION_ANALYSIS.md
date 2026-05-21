# Executive Summary

Task **CLINE-GOV-008** analyzed handoff and review-gate requirements across the requested governance, adapter, onboarding, and history sources.

Primary finding:

- Both domains currently mix **normative requirements** and **descriptive/onboarding summaries** across multiple layers.
- Canonical ownership exists in principle (via authority hierarchy), but requirement expression is still distributed and partially overlapping.
- Highest drift risk is where onboarding/adapter summaries restate mandatory policy in detailed prose.

Normalization intent:

- Keep mandatory policy in the highest-appropriate canonical owners.
- Keep onboarding duplication only as clearly labeled, non-authoritative summaries/checklists.
- Reduce semantic divergence between “must/required” statements across domains.

---

# Handoff Ownership Matrix

| source | authority level | schema ownership | duplication type | recommendation |
|---|---|---|---|---|
| `SSOK.md` (Handoff Contract section) | L1 constitutional, but section marked historical context | Partial legacy contract (5 required points) | Legacy normative overlap | Treat as historical/contextual reference only for handoff details; do not use as active schema owner |
| `AGENTS.md` | L1 constitutional | No full schema; mandates handoff update and truthfulness via validation evidence | Intentional high-level reminder | Keep as high-level obligation only; reference canonical schema owner |
| `.governance/SYSTEM.md` | L2 canonical governance | Lifecycle requirement to write handoff and stop for review | Intentional lifecycle duplication | Keep lifecycle requirement; avoid detailed schema restatement |
| `.governance/RULES.md` | L2 canonical governance | Core mandatory handoff content (what changed/why/files/issues/status) | Normative core + partial overlap | **Primary candidate owner for normative handoff schema** |
| `.governance/REVIEW_POLICY.md` | L2 canonical governance | Review expectations for handoff quality/content | Complementary, not schema owner | Keep as review-evaluation policy; reference handoff schema owner |
| `VERIFY.md` | L2 verification authority | Requires handoff to state checks run and rationale | Normative cross-cutting requirement | Keep verification-disclosure requirement only; do not expand to full handoff schema |
| `.agent/adapters/cline.md` | L4 adapter rule | Requires writing `handoffs/latest-handoff.md`; adapter workflow/escalation | Adapter-level procedural duplication | Keep adapter execution requirement; convert schema detail to reference-first wording where possible |
| `docs/CLINE_RALPH_WORKER_SETUP.md` | L5 onboarding guide | Detailed 9-section handoff template-like definition | High-detail onboarding duplication | Keep as onboarding checklist/template; explicitly non-authoritative and linked to canonical schema |
| `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` | L5 onboarding guide | Handoff quality and completion checklist | Onboarding-only summary | Keep duplicated for first-run usability, but labeled informational |
| `scripts/agent/README.md` | L5 operational guide | Handoff-template process references | Operational/process duplication | Keep as process guide; reference canonical governance requirements |
| `plans/*` (e.g., `plans/RALPH_CLINE_DRY_RUN_PLAN.md`) | L5 planning artifacts | Planned handoff expectations and outputs | Planning-only descriptive duplication | Keep non-normative; do not treat as policy source |
| `handoffs/latest-handoff.md` | L3 runtime/evidence state | Example output, not policy | Runtime evidence only | Never treated as schema owner; useful for conformance audit only |

---

# Review-Gate Ownership Matrix

| source | authority level | gate ownership | duplication type | recommendation |
|---|---|---|---|---|
| `.governance/REVIEW_POLICY.md` | L2 canonical governance | Human review policy, acceptance/manual-review criteria, failure/blocked handling | Normative policy (broad) | **Primary owner for review-gate policy semantics** |
| `.governance/SYSTEM.md` | L2 canonical governance | Lifecycle stop-for-review position and stop conditions | Normative lifecycle gate | **Primary owner for lifecycle stop gate** |
| `.governance/RULES.md` | L2 canonical governance | One-task-per-run + mandatory stop after one task | Normative execution gate | Keep as execution-rule owner aligned with SYSTEM/REVIEW_POLICY |
| `.governance/SAFETY.md` | L2 safety authority | Safety gates and immediate stop conditions | Normative safety gates | Keep as sole owner for safety-triggered review/stop gates |
| `VERIFY.md` | L2 verification authority | Completion/verification gate and Definition of Done checks | Normative completion gate | Keep as sole owner for verification completion requirements |
| `AGENTS.md` | L1 constitutional | High-level stop conditions, human-review requirements, no-done-without-validation | Intentional constitutional mirror | Keep concise mirror; avoid adding parallel procedural details |
| `.agent/adapters/cline.md` | L4 adapter rule | Cline escalation and stop behavior under policy | Adapter-level behavioral mapping | Keep adapter-specific execution details; reference canonical gates |
| `docs/CLINE_RALPH_WORKER_SETUP.md` | L5 onboarding guide | Human review expectations/checklists; stop conditions summary | Onboarding duplication | Keep as non-authoritative operator summary |
| `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` | L5 onboarding guide | Pass/fail criteria and review checklists for first dry run | Onboarding-only summary | Keep duplicated for onboarding safety; explicit informational labeling |
| `scripts/agent/README.md` | L5 operational guide | Gate terminology for automation phases (review/fix/roo gates) | Operational descriptive duplication | Keep as tooling process doc; clarify non-governance authority |
| `reports/*` governance history | Evidence/history | Prior analyses and recommendations | Historical analytical duplication | Keep for traceability; not normative |
| `ROADMAP.md` | L2 planning authority | Contains DoD per task and status process, not operational review policy | Adjacent requirement domain | Reference for task state only; not review-gate policy owner |

---

# Normative Requirement Inventory

## A) Handoff — mandatory requirements (normative)

1. **Handoff must be produced each run/task completion**  
   Sources: `.governance/RULES.md`, `.governance/SYSTEM.md`, `AGENTS.md`, `.agent/adapters/cline.md`.

2. **Handoff must document change rationale and scope** (what changed, why, files touched, issues/blockers, status).  
   Primary normative source: `.governance/RULES.md`.

3. **Handoff must include verification evidence context** (checks run and why, incl. docs-only path when used).  
   Primary normative source: `VERIFY.md`.

4. **No false completion claims** (cannot claim done without validation evidence).  
   Sources: `AGENTS.md`, `.governance/RULES.md`, `VERIFY.md`.

### Mandatory handoff fields (normalized set)

Derived from `.governance/RULES.md`, `VERIFY.md`, and governance lifecycle/review requirements:

1. **Run/Task identity and status** (task ID + completion/blocking status)
2. **What changed**
3. **Why changed**
4. **Changed files list**
5. **Validation executed** (commands/check set used)
6. **Validation result** (pass/fail and constraints)
7. **Known issues/blockers/risks**
8. **Human-review status / stop-for-review context**

### Informational/optional handoff fields

Present mainly in onboarding/operator docs and useful for usability, but not required for minimal normative compliance:

1. Detailed assumptions section
2. Extended next-step recommendations
3. Reviewer-specific check prompts
4. Expanded risk taxonomy labels
5. Extra narrative summaries beyond required evidence fields

## B) Review-gate — mandatory requirements (normative)

1. **One-task-per-run and mandatory stop-for-review** after task completion.  
   Sources: `.governance/RULES.md`, `.governance/SYSTEM.md`, `AGENTS.md`.

2. **Immediate stop conditions** for ambiguity/safety/scope/validation failures/human-review trigger.  
   Sources: `.governance/SYSTEM.md`, `.governance/SAFETY.md`, `AGENTS.md`.

3. **Human review required before progressing to next task**.  
   Sources: `.governance/SYSTEM.md`, `.governance/REVIEW_POLICY.md`, `AGENTS.md`, adapter/docs summaries.

4. **Completion requires required verification checks to pass** per decision table category.  
   Canonical owner: `VERIFY.md`.

5. **Safety policy supersedes other operations** when conflicting.  
   Owners: `AGENTS.md` (conflict hierarchy), `.governance/SAFETY.md`.

### Mandatory review-gate requirements (normalized)

1. Stop after one task for human review
2. Stop immediately on safety/scope/ambiguity/validation-failure triggers
3. Do not claim done without required verification pass conditions
4. Require explicit human approval before continuation to next task

### Informational/optional review-gate guidance

1. Rich review checklist formatting in onboarding docs
2. Dry-run specific pass/fail wording for first-run scenarios
3. Additional reviewer heuristics and advisory prompts
4. Tool-specific UX/operator conveniences that do not alter mandatory stop/approval logic

---

# Descriptive Requirement Inventory

These are informative/operator-facing surfaces that should not own policy semantics:

1. `docs/CLINE_RALPH_WORKER_SETUP.md` — setup and operational instructions, including detailed handoff section examples.
2. `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` — dry-run focused preconditions, monitoring lists, pass/fail checklist.
3. `scripts/agent/README.md` — automation phase/gate workflow descriptions and command usage.
4. `plans/*` (e.g., `plans/RALPH_CLINE_DRY_RUN_PLAN.md`) — planned behavior and expected artifacts.
5. `reports/*` governance analyses (`CLINE-GOV-006`, `CLINE-GOV-007`, etc.) — historical analysis, not policy.
6. `handoffs/latest-handoff.md` and `reports/morning-review.md` — runtime/evidence outputs, not requirement owners.

Normative vs descriptive wording pattern used for classification:

- **Normative:** “must”, “required”, “never”, “stop immediately”, “only when”.
- **Descriptive/informational:** “guides”, “checklist”, “expected”, “recommended”, “operator summary”, “example”.

---

# Duplication Risk Areas

1. **Handoff schema detail split across `.governance/RULES.md`, setup docs, and legacy `SSOK.md` section**  
   Risk: mismatched required fields and completion wording.

2. **Review-gate semantics split across SYSTEM/RULES/REVIEW_POLICY + adapter/docs restatements**  
   Risk: inconsistent interpretation of when manual review is optional vs mandatory.

3. **Verification-completion wording repeated outside `VERIFY.md`**  
   Risk: broadened or narrowed completion conditions diverging from decision table.

4. **Adapter-level procedural docs gradually accumulating normative statements**  
   Risk: L4/L5 files functionally overriding L2 policy by operator habit.

5. **Historical/legacy authority text in `SSOK.md` handoff area**  
   Risk: readers may treat historical section as concurrent active schema.

6. **Onboarding checklists with pass/fail criteria** (`docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`)  
   Risk: first-run criteria copied into general policy interpretations.

---

# Recommended Canonical Owners

## Handoff domain

- **Normative schema owner:** `.governance/RULES.md` (preferred)  
  Rationale: L2 operational governance; already contains mandatory handoff substance and is tool-neutral.

- **Review evaluation owner:** `.governance/REVIEW_POLICY.md`  
  Rationale: defines how humans evaluate handoff quality at gate time.

- **Verification disclosure owner (within handoff):** `VERIFY.md`  
  Rationale: canonical verification authority; handoff must report verification path/results.

- **Constitutional mirror only:** `AGENTS.md`  
  Rationale: should retain high-level obligations, not full schema duplication.

- **Reference-only surfaces:** `.agent/adapters/cline.md`, `docs/CLINE_*`, `scripts/agent/README.md`, `plans/*`.

## Review-gate domain

- **Lifecycle gate owner:** `.governance/SYSTEM.md`  
  (stop after one task; stop-condition framework).

- **Policy gate owner:** `.governance/REVIEW_POLICY.md`  
  (manual review criteria, acceptance/revision handling).

- **Execution rule owner:** `.governance/RULES.md`  
  (one-task-per-run operational enforcement).

- **Safety gate owner:** `.governance/SAFETY.md`.

- **Verification/completion gate owner:** `VERIFY.md`.

- **Constitutional mirrors:** `SSOK.md` + `AGENTS.md` (high-level only).

- **Onboarding summaries:** `docs/CLINE_*` (explicitly non-authoritative).

---

# Proposed Normalization Plan

> Analysis-only proposal for follow-up implementation task(s); no changes made in GOV-008.

## Phase 1 — Ownership labeling and requirement typing

1. Add/standardize per-section labels where needed:
   - `Normative Owner`
   - `Reference Summary (Non-Authoritative)`
   - `Historical Context`
2. Map each handoff and review-gate statement to one owner document.

## Phase 2 — Handoff schema consolidation

1. Consolidate normative handoff field schema in one L2 canonical location (`.governance/RULES.md` preferred).
2. Keep `VERIFY.md` requirement as an explicit mandatory handoff sub-requirement.
3. Convert setup/checklist/template docs to reference + example format.

## Phase 3 — Review-gate de-duplication

1. Keep mandatory gate semantics in SYSTEM + REVIEW_POLICY + RULES + SAFETY + VERIFY by role.
2. Remove/trim parallel mandatory prose in adapter/onboarding docs; retain concise operational summaries.
3. Ensure AGENTS/SSOK mirrors remain high-level and conflict-safe.

## Phase 4 — Drift controls

1. Add periodic drift audit checklist focused on handoff/review-gate domains.
2. Require updates to reference surfaces when canonical owners change.
3. Preserve onboarding duplication only where usability gains are explicit and text is marked informational.

---

# GOV-008 Implementation Scope

This task was analysis-only and recommends next-step implementation scope boundaries:

In scope for future implementation task:

- Governance wording normalization for handoff/review-gate ownership and reference boundaries.
- Labeling normative vs descriptive sections in relevant docs.
- De-duplication adjustments that do not alter runtime behavior.

Out of scope (must remain excluded):

- Product code changes (`src/`, app/runtime logic).
- Dependency/config/runtime-state behavior changes.
- Task status workflow/roadmap state mutation unless explicitly requested.
- Any policy behavior change beyond ownership/wording normalization.

---

# Recommended Next Task

Recommended follow-up implementation task:

**`CLINE-GOV-009` — Handoff & Review-Gate Canonicalization Implementation**

Suggested objective:

1. Normalize canonical ownership exactly as proposed in this report.
2. Consolidate normative handoff schema into one L2 canonical owner.
3. Convert `docs/CLINE_*` and adapter duplicate mandatory prose into explicit onboarding summaries and references.
4. Align AGENTS/SSOK mirror wording to avoid schema-level duplication.
5. Re-run governance-only verification readback checks and publish implementation report.

Success criteria:

- Single canonical normative owner for handoff schema is unambiguous.
- Review-gate ownership split (SYSTEM/REVIEW_POLICY/RULES/SAFETY/VERIFY) is explicit and non-conflicting.
- Onboarding duplicates remain intentionally descriptive and clearly labeled non-authoritative.
- No runtime/product behavior changes introduced.