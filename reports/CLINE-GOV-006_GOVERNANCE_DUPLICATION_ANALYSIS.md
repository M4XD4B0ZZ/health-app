# Executive Summary

This report delivers a complete duplication analysis for task **CLINE-GOV-006** across governance domains A–J.

Overall conclusion:

- The repository intentionally duplicates several governance rules across constitutional, operational, adapter, and onboarding surfaces for usability.
- The highest-value canonicalization from GOV-002..005 is already in place for **authority hierarchy**, **runtime contract**, and **verification ownership**.
- Remaining duplication risk is concentrated in:
  - Cline onboarding/setup docs (`docs/CLINE_*`) that restate adapter policy blocks verbatim,
  - legacy Roo-era wording inside `SSOK.md` that can still be interpreted as co-authoritative,
  - mixed ownership expression for handoff/review-gate text across `.governance/*`, `AGENTS.md`, and adapter docs.

No governance source files were modified in this task. This is analysis-only, as required.

# Governance Ownership Matrix

| Rule domain                 | Canonical owner                                                                        | Canonical reason                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A) Authority hierarchy      | `SSOK.md` (+ aligned in `AGENTS.md`)                                                   | Constitutional hierarchy and conflict ordering are now formalized (GOV-005).            |
| B) Verification rules       | `VERIFY.md`                                                                            | Explicit canonical decision table + category resolution rules (GOV-003).                |
| C) Safety rules             | `.governance/SAFETY.md`                                                                | Central safety policy and stop/violation rules.                                         |
| D) Protected file rules     | `.governance/SAFETY.md` + `.agent/config/protected-files.json` (enforcement list)      | Policy in SAFETY, technical matcher list in protected-files config.                     |
| E) Task execution rules     | `.governance/RULES.md` + `.governance/SYSTEM.md`                                       | One-task-per-run and Ralph lifecycle mechanics are operational policy.                  |
| F) Runtime contract rules   | `SSOK.md` / `AGENTS.md` (formal contract ownership) + runtime files as execution state | GOV-005 formalized ownership boundaries; runtime files execute, not redefine authority. |
| G) Terminal safety rules    | `.agent/adapters/cline.md`                                                             | Tool-specific PowerShell/terminal behavior is adapter-level policy.                     |
| H) Dependency safety rules  | `VERIFY.md` + `AGENTS.md`                                                              | Root governance now holds CLINE-OPS-003 normative rule text.                            |
| I) Handoff requirements     | `.governance/RULES.md` + `.governance/REVIEW_POLICY.md`                                | Ralph execution/review policy defines mandatory handoff expectation.                    |
| J) Review-gate requirements | `.governance/REVIEW_POLICY.md` + `.governance/SYSTEM.md`                               | Human-review gate and stop-for-review are operationally canonical.                      |

# Duplication Inventory

## Cross-Surface Special Analysis (Required)

### 1) Rules duplicated across SSOK / AGENTS / VERIFY / .governance/\* / Cline docs

- **Authority hierarchy and conflict resolution:** appears in `SSOK.md`, `AGENTS.md`, `.governance/SYSTEM.md`, and Cline docs references.
- **Verification behavior:** canonical in `VERIFY.md`, echoed in `AGENTS.md`, `.governance/RULES.md`, adapter/docs.
- **Safety/protected-file constraints:** canonical in `.governance/SAFETY.md`, repeated in `AGENTS.md`, adapter/docs/checklist.
- **One-task-per-run + stop-for-review:** repeated in `.governance/SYSTEM.md`, `.governance/RULES.md`, `AGENTS.md`, adapter/docs.

### 2) Rules duplicated only for onboarding convenience

- Terminal command isolation, forbidden separators, pager recovery, and blocking command registry copied from `.agent/adapters/cline.md` into both `docs/CLINE_*` files.
- Dry-run checklists repeating protected-file and validation rule sets primarily for operator convenience.

### 3) Rules duplicated in ways that can produce conflicting agent behavior

- Legacy Roo-first authority wording in lower `SSOK.md` vs active constitutional hierarchy at top of `SSOK.md`/`AGENTS.md`.
- Verification strictness language outside `VERIFY.md` can be interpreted as broader/narrower than the decision table.
- Repeated protected-file lists across docs may diverge from `.governance/SAFETY.md` and `.agent/config/protected-files.json`.

### 4) Legacy Roo wording still present but no longer top-level authoritative

- `SSOK.md` sections describing Roo as operative SSOK and Roo-first hierarchy logic.
- Transition-era references are valid historical context but should not remain ambiguous as active top-level authority.

## A) Authority hierarchy

- **Canonical owner:** `SSOK.md` (constitutional hierarchy), mirrored in `AGENTS.md`.
- **Duplicates:** `AGENTS.md`, transition passages in `SSOK.md` legacy sections, references in `.governance/SYSTEM.md`, `.agent/adapters/cline.md`, `docs/CLINE_*`, GOV reports.
- **Classification:**
  - `SSOK.md` + `AGENTS.md`: **intentional** (binding mirror).
  - Legacy Roo-first wording in lower `SSOK.md` sections: **drift risk / partially obsolete**.
  - Adapter/docs references: **reference-only** should be sufficient.
- **Recommended action:** keep constitutional pair; convert secondary docs to concise references; mark legacy Roo wording explicitly historical-only.

## B) Verification rules

- **Canonical owner:** `VERIFY.md`.
- **Duplicates:** `AGENTS.md`, `.governance/RULES.md`, `.governance/SYSTEM.md`, `.agent/adapters/cline.md`, `docs/CLINE_*`, `SSOK.md` verify-contract text.
- **Classification:**
  - Root reference statements: **intentional**.
  - Detailed decision logic outside `VERIFY.md`: **drift risk**.
  - Adapter/docs task examples: **reference-only**.
- **Recommended action:** keep `VERIFY.md` as sole decision logic; reduce non-VERIFY semantic restatement to pointers.

## C) Safety rules

- **Canonical owner:** `.governance/SAFETY.md`.
- **Duplicates:** `AGENTS.md` safety bullets; `.governance/RULES.md` safety integration clause; adapter/setup/checklist safety excerpts.
- **Classification:** mostly **intentional** visibility duplication; detailed duplicated blocks in docs are **drift risk**.
- **Recommended action:** consolidate detail in `SAFETY.md`; keep short references elsewhere.

## D) Protected file rules

- **Canonical owner:** `.governance/SAFETY.md` (policy), `.agent/config/protected-files.json` (enforcement patterns).
- **Duplicates:** `AGENTS.md`, `.agent/adapters/cline.md`, `docs/CLINE_*`, checklist forbidden sections.
- **Classification:**
  - High-level mentions: **intentional/reference-only**.
  - Duplicated explicit lists: **drift risk**.
- **Recommended action:** keep one normative list in SAFETY + one technical pattern list; convert other locations to “see SAFETY + protected-files.json”.

## E) Task execution rules

- **Canonical owner:** `.governance/RULES.md` + `.governance/SYSTEM.md`.
- **Duplicates:** `AGENTS.md` Ralph-Loop section, `.agent/adapters/cline.md`, `docs/CLINE_*`, prior GOV reports.
- **Classification:** largely **intentional** for onboarding and runtime reliability.
- **Recommended action:** keep duplicated high-level statements; remove line-by-line procedure copies from setup/checklist docs.

## F) Runtime contract rules

- **Canonical owner:** `SSOK.md` + `AGENTS.md` runtime contract formalization (GOV-005), with runtime files as execution authority.
- **Duplicates:** GOV-004/005 reports, `.governance/SYSTEM.md` lifecycle text, adapter/docs runtime references.
- **Classification:**
  - GOV-005 constitutional statements: **intentional**.
  - operational restatements in docs: **reference-only**.
  - verbose repeated narrative in reports/docs: **low drift risk** but noisy.
- **Recommended action:** keep normative contract in SSOK/AGENTS; use lightweight references elsewhere.

## G) Terminal safety rules

- **Canonical owner:** `.agent/adapters/cline.md`.
- **Duplicates:** `docs/CLINE_RALPH_WORKER_SETUP.md`, `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` (large verbatim blocks on command isolation, pager handling, blocking commands, timeout rules).
- **Classification:**
  - Duplication is partly **intentional** (onboarding convenience),
  - but current near-verbatim copies are **drift risk**.
- **Recommended action:** retain full policy only in adapter; convert docs to shortened “operator checklist + canonical pointer”.

## H) Dependency safety rules

- **Canonical owner:** `VERIFY.md` + `AGENTS.md`.
- **Duplicates:** `.agent/adapters/cline.md`, `docs/CLINE_*`.
- **Classification:**
  - Root duplication is **intentional** (cross-agent safety).
  - Adapter/docs full block copies are **reference-only with drift risk**.
- **Recommended action:** keep normative in VERIFY/AGENTS; adapter may include concise enforcement summary; setup/checklist should reference.

## I) Handoff requirements

- **Canonical owner:** `.governance/RULES.md` + `.governance/REVIEW_POLICY.md`.
- **Duplicates:** `.governance/SYSTEM.md`, `AGENTS.md`, `.agent/adapters/cline.md`, `docs/CLINE_*`, `SSOK.md` (handoff contract section).
- **Classification:** mixed:
  - high-level requirement duplicated **intentionally**,
  - detailed section-by-section templates repeated in many places are **drift risk**.
- **Recommended action:** choose one normative handoff schema location and keep all others reference/template-oriented.

## J) Review-gate requirements

- **Canonical owner:** `.governance/REVIEW_POLICY.md` (with stop-for-review from `.governance/SYSTEM.md`).
- **Duplicates:** `AGENTS.md` stop conditions, adapter/docs “stop after one task,” checklist pass/fail review criteria.
- **Classification:** primarily **intentional**, but procedural duplication in onboarding docs is **reference-only** and can drift.
- **Recommended action:** keep canonical gate criteria in REVIEW_POLICY/SYSTEM; reduce parallel rule prose in adapter/setup/checklist.

# Duplication Risk Matrix

| Rule domain                 | Canonical source                                               | Duplicate source(s)                                                         | Risk level      | Recommended action                                                                                         |
| --------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| A) Authority hierarchy      | `SSOK.md` (+ `AGENTS.md`)                                      | legacy sections in `SSOK.md`, `.governance/SYSTEM.md`, Cline docs           | **High**        | Consolidate active hierarchy wording; mark legacy Roo wording historical-only; convert docs to references. |
| B) Verification rules       | `VERIFY.md`                                                    | `AGENTS.md`, `.governance/*`, adapter/docs                                  | **Medium**      | Keep only decision semantics in VERIFY; reference elsewhere.                                               |
| C) Safety rules             | `.governance/SAFETY.md`                                        | `AGENTS.md`, adapter/docs                                                   | **Medium**      | Keep detailed policy in SAFETY; shorten secondary copies.                                                  |
| D) Protected file rules     | `.governance/SAFETY.md` + `.agent/config/protected-files.json` | `AGENTS.md`, adapter/docs/checklist                                         | **Medium-High** | Single normative list + single technical list; convert others to pointers.                                 |
| E) Task execution rules     | `.governance/RULES.md` + `.governance/SYSTEM.md`               | `AGENTS.md`, adapter/docs                                                   | **Low-Medium**  | Keep high-level duplication; trim procedural redundancy.                                                   |
| F) Runtime contract rules   | `SSOK.md`/`AGENTS.md` formalized contract                      | `.governance/SYSTEM.md`, docs, reports                                      | **Low-Medium**  | Keep formal owner text in SSOK/AGENTS; make others reference-oriented.                                     |
| G) Terminal safety rules    | `.agent/adapters/cline.md`                                     | `docs/CLINE_RALPH_WORKER_SETUP.md`, `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md` | **High**        | Convert docs to concise onboarding references; avoid verbatim policy copies.                               |
| H) Dependency safety rules  | `VERIFY.md` + `AGENTS.md`                                      | adapter/docs                                                                | **Medium**      | Retain root normative text; adapter/docs summarize + link only.                                            |
| I) Handoff requirements     | `.governance/RULES.md` + `.governance/REVIEW_POLICY.md`        | `SSOK.md`, `AGENTS.md`, adapter/docs                                        | **Medium**      | Consolidate detailed schema in one place; others reference or provide non-normative template.              |
| J) Review-gate requirements | `.governance/REVIEW_POLICY.md` + `.governance/SYSTEM.md`       | `AGENTS.md`, adapter/docs/checklist                                         | **Medium**      | Keep gate authority in Ralph governance; reduce repeated normative prose.                                  |

# Intentional Duplications

The following duplications are intentional and should generally be preserved (with wording tightening):

1. **Authority hierarchy mirror:** `SSOK.md` and `AGENTS.md` both carry binding hierarchy/conflict rules.
2. **Verification authority reminders:** Non-VERIFY docs pointing to `VERIFY.md`.
3. **Safety reminder propagation:** `AGENTS.md` and adapter docs reminding agents to obey `.governance/SAFETY.md`.
4. **One-task-per-run / stop-for-review reminders:** repeated across `.governance/*`, `AGENTS.md`, and adapter-facing docs.
5. **Tool-neutral principle:** repeated statements that adapters are workers, repository governance is source of truth.

These are beneficial for operability and onboarding as long as secondary texts remain reference-first.

# Drift-Risk Duplications

Primary drift-risk areas:

1. **Terminal safety block duplication (G):**
   - `.agent/adapters/cline.md`
   - `docs/CLINE_RALPH_WORKER_SETUP.md`
   - `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`

   Near-verbatim policy blocks increase divergence risk when one copy changes.

2. **Dependency safety block duplication (H):**
   - repeated CLINE-OPS-003 blocks across root, adapter, and docs.

3. **Protected file list duplication (D):**
   - explicit lists repeated in many onboarding sections.

4. **Legacy + active authority wording coexistence (A):**
   - top-level Ralph formalization in `SSOK.md` plus lower legacy Roo-first sections can cause interpretation split if readers consume selectively.

5. **Handoff/review templates repeated as normative text (I/J):**
   - same constraints expressed with different phrasing across governance and docs, inviting inconsistent enforcement.

# Obsolete Governance Wording

The following wording classes appear obsolete or transition-obsolete relative to current formal authority:

1. **Legacy Roo top-level authority phrasing in `SSOK.md` body**
   - e.g., “Roo ist die operative SSOK” and Roo-first hierarchy sections presented as still normative.
   - Current top sections and GOV-005 formalization establish repository-first constitutional hierarchy with Roo as historical/transition context.

2. **Future-task-state placeholder in `.governance/RULES.md`**
   - “Future Task-State Integration” wording is stale because task-state/runtime files are already active artifacts.

3. **Onboarding docs carrying policy as if primary**
   - Setup/checklist docs frequently present normative rules in full instead of clearly stating they are convenience surfaces.

4. **Legacy Roo workflow authority framing in transition narrative surfaces**
   - references are valid historically but no longer top-level authoritative under the formalized hierarchy.

# Recommended Cleanup Actions

## Domain-by-domain action summary

- **A Authority hierarchy:** consolidate active language; retain legacy material only as clearly non-authoritative historical appendix.
- **B Verification:** keep single decision semantics in `VERIFY.md`; non-canonical docs should reference category table.
- **C Safety:** keep comprehensive safety policy in `SAFETY.md`; shorten all derivative descriptions.
- **D Protected files:** maintain one normative list (`SAFETY.md`) and one enforcement list (`.agent/config/protected-files.json`); remove repeated explicit lists elsewhere.
- **E Task execution:** retain high-level reminders across layers; remove copy-heavy procedure duplication.
- **F Runtime contract:** preserve SSOK/AGENTS as ownership declaration; operational docs should reference not re-formalize.
- **G Terminal safety:** make `.agent/adapters/cline.md` sole full policy owner; replace doc copies with compact checklists + link.
- **H Dependency safety:** keep normative rule in root governance (`VERIFY.md`/`AGENTS.md`); adapter/docs concise mirror only.
- **I Handoff:** define one normative handoff schema location; other files provide reference or examples only.
- **J Review gate:** keep normative acceptance/stop criteria in `.governance/REVIEW_POLICY.md` (+ SYSTEM for lifecycle); simplify duplicates.

## Priority order

1. **High priority:** G, A, D
2. **Medium priority:** B, H, I, J
3. **Lower priority optimization:** C, E, F

# Proposed GOV-006 Implementation Plan

> This section is a proposed follow-up execution plan only; no implementation performed in GOV-006.

## Phase 1 — Canonical pointer hardening

1. Add/verify short “Canonical owner” pointer blocks in each secondary doc family:
   - `docs/CLINE_*`
   - `.agent/adapters/cline.md` (where root ownership exists)
2. Ensure every repeated rule block is tagged as either:
   - **Normative owner text**, or
   - **Reference-only summary**.

## Phase 2 — High-risk deduplication pass

1. Replace verbatim terminal safety block copies in `docs/CLINE_*` with compact checklists linking to `.agent/adapters/cline.md`.
2. Replace repeated protected-file explicit lists with links to:
   - `.governance/SAFETY.md`
   - `.agent/config/protected-files.json`.
3. Clean stale/legacy authority language in `SSOK.md` by preserving history but removing normative ambiguity.

## Phase 3 — Consistency normalization

1. Normalize handoff and review-gate wording to one normative schema each.
2. Ensure verification mentions outside `VERIFY.md` are reference-only.
3. Add a small maintenance rule: when canonical owner changes, update reference surfaces in same task.

## Phase 4 — Validation

Governance/docs verification only (as per `VERIFY.md` category):

- `git --no-pager status --short`
- `git --no-pager diff --stat`
- `git --no-pager diff --name-only`

# Inputs For GOV-007

Recommended scope for **GOV-007** based on this analysis:

1. **Execute high-risk deduplication first**
   - Terminal safety (G) and protected file duplication (D).

2. **Codify duplication taxonomy in governance maintenance guidance**
   - allowed classes: intentional mirror, reference-only summary,
   - disallowed class: parallel normative restatement without owner tag.

3. **Add explicit “legacy wording retirement” checklist**
   - especially for `SSOK.md` mixed-era sections.

4. **Define ownership labels per section**
   - e.g., `Normative Owner`, `Reference Summary`, `Historical Context`.

5. **Establish drift audit cadence**
   - lightweight periodic check for copied blocks across:
     - `AGENTS.md`
     - `VERIFY.md`
     - `.governance/*`
     - `.agent/adapters/*`
     - `docs/CLINE_*`.
