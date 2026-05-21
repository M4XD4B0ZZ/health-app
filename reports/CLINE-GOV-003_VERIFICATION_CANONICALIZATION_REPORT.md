# CLINE-GOV-003 Verification Canonicalization Report

## Task

- **Task ID:** CLINE-GOV-003
- **Mode:** Analysis + Implementation
- **Objective:** Canonicalize verification authority so `VERIFY.md` is the single authoritative verification decision model.

---

## Read Inputs (as required)

- `SSOK.md`
- `AGENTS.md`
- `VERIFY.md`
- `reports/CLINE-GOV-001_GOVERNANCE_INVENTORY_REPORT.md`
- `reports/CLINE-GOV-002_SSOK_AUTHORITY_UNIFICATION_ANALYSIS.md`

---

## Analysis: Where Verification Requirements Were Defined or Implied

The following verification requirement surfaces were identified:

1. **Root governance**
   - `VERIFY.md` (already canonical intent, but missing a single explicit decision matrix)
   - `AGENTS.md` (redeclared command order / strictness semantics)
   - `SSOK.md` (verify contract + relevant-check framing)

2. **Ralph governance layer**
   - `.governance/RULES.md` (validation must follow `VERIFY.md`, plus local wording)
   - `.governance/SYSTEM.md` (validate via `VERIFY.md`)

3. **Adapter/setup/checklist docs**
   - `.agent/adapters/cline.md`
   - `docs/CLINE_RALPH_WORKER_SETUP.md`
   - `docs/CLINE_FIRST_DRY_RUN_CHECKLIST.md`
   - These include docs-only guidance, command examples, and validation constraints.

4. **Task/plan/report references**
   - `ROADMAP.md`, plans, reports, and README references that imply category-specific verification expectations.

### Category coverage confirmed in analysis

- Documentation-only
- Governance-only
- Test-only
- Product/runtime code
- Edge/Supabase
- Dependency changes

---

## Implemented Changes

### 1) `VERIFY.md` updated as canonical decision authority

Added explicit authority section:

- `VERIFY.md` is canonical for required/optional/blocking checks and verification-related DoD decisions.
- Other governance docs should reference rather than redefine verification behavior.

Added **Canonical Verification Decision Table** with required categories:

1. Documentation-only
2. Governance-only
3. Test-only
4. Product/runtime code
5. Edge/Supabase
6. Dependency changes

For each category, defined:

- required checks
- optional checks
- blocking checks

Added **Category Resolution Rule**:

- If multiple categories apply, use strictest combined required/blocking checks.
- In conflicts, `VERIFY.md` is authoritative.

Clarified existing sections (without behavior change):

- Command order applies when full runtime verification is required by the decision table.
- Local-vs-CI section now references Category 1 / 4 / 5 explicitly.
- DoD now binds to required checks from decision table and preserves runtime/edge constraints.

### 2) `AGENTS.md` deduplicated to reference `VERIFY.md`

Replaced duplicated verification semantics with canonical references:

- Verification decisions by change category now explicitly delegated to `VERIFY.md`.
- `npm run verify` positioned as canonical runtime entrypoint when required by `VERIFY.md` table.
- DoD language updated to: required blocking checks from `VERIFY.md` must pass.

This reduces drift while preserving existing behavior intent.

---

## Behavior Preservation Statement

No verification behavior was intentionally changed.

- Existing conditional docs-only readback model remains.
- Existing runtime requirement (`npm run verify`) remains for product/runtime code.
- Existing edge verification requirements remain conditional on edge/supabase changes.
- Existing dependency safety policy remains unchanged.

Changes are authority/ownership clarifications and decision-table normalization.

---

## Files Changed

- `VERIFY.md`
- `AGENTS.md`
- `reports/CLINE-GOV-003_VERIFICATION_CANONICALIZATION_REPORT.md`

---

## Final Check Commands Required by Task

The following commands were executed separately:

1. `git --no-pager status --short`
2. `git --no-pager diff --stat`
3. `git --no-pager diff --name-only`

---

## Outcome

CLINE-GOV-003 objective achieved:

- Canonical verification authority centralized in `VERIFY.md` via explicit decision model.
- Duplicate verification semantics reduced in `AGENTS.md` by reference-based alignment.
- Governance authority clarified without changing runtime verification behavior.
